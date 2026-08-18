# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Logs repository for CloudWatch Logs operations.

Uses a hybrid strategy for cost and performance:
- Short ranges (<=24h): FilterLogEvents API (free, fast for small windows)
- Large ranges (>24h): CloudWatch Logs Insights (server-side query engine,
  $0.005/GB scanned, handles months of data in seconds)

Supports multi-group querying for unified audit logging.
"""

import base64
import json
import logging
import time
from typing import List, Optional, Tuple
from datetime import datetime

import boto3
from botocore.exceptions import ClientError

from domain.models.logs import LogEvent

logger = logging.getLogger(__name__)

# Logs Insights queries - filter for structured JSON log lines.
# NOTE: Insights sorts server-side (`sort @timestamp desc`), which is the only
# reliable way to retrieve the NEWEST N events from a busy log group. The
# FilterLogEvents API returns events oldest-first and cannot efficiently return
# the most recent events from a high-volume window, so fresh ("real-time")
# queries are routed through Insights below.
_INSIGHTS_QUERY = """
fields @timestamp, @message, @log
| filter @message like /"message"/ or @message like /"action"/
| sort @timestamp desc
| limit {limit}
"""

_INSIGHTS_QUERY_WITH_SEARCH = """
fields @timestamp, @message, @log
| filter @message like /"message"/ or @message like /"action"/
| filter @message like "{search}"
| sort @timestamp desc
| limit {limit}
"""


class LogsRepository:
    """Repository for querying CloudWatch Logs across multiple log groups."""

    def __init__(self, log_groups: List[str], log_groups_config: List[dict]):
        self.logs_client = boto3.client("logs")
        self.log_groups = log_groups
        self.log_groups_config = log_groups_config
        # Build mapping: logGroupName -> sourceLabel
        self._group_to_source = {
            entry["logGroupName"]: entry["sourceLabel"] for entry in log_groups_config
        }

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def query_logs(
        self,
        limit: int = 100,
        channel_id: Optional[str] = None,
        action: Optional[str] = None,
        start_time_ms: Optional[int] = None,
        end_time_ms: Optional[int] = None,
        search: Optional[str] = None,
        next_token: Optional[str] = None,
        source_filter: Optional[str] = None,
    ) -> Tuple[List[LogEvent], Optional[str]]:
        """Query logs - newest first.

        Fresh queries always go through CloudWatch Logs Insights (server-side
        sort); pagination continuations use FilterLogEvents tokens.
        """
        now_ms = int(time.time() * 1000)
        end = end_time_ms or now_ms
        start = start_time_ms or (now_ms - 3600_000)

        # Determine which groups to query
        groups_in_scope = self._resolve_groups(source_filter)

        try:
            # Pagination continuation - decode composite token
            if next_token:
                decoded = self._decode_pagination_token(next_token)
                if decoded:
                    group_name, cw_token = decoded
                    source = self._group_to_source.get(group_name, "unknown")
                    events, new_cw_token = self._do_filter(
                        group_name,
                        start,
                        end,
                        limit,
                        channel_id,
                        action,
                        search,
                        cw_token,
                    )
                    for ev in events:
                        ev.source = source
                    result_token = (
                        self._encode_pagination_token(group_name, new_cw_token)
                        if new_cw_token
                        else None
                    )
                    return events, result_token
                # Corrupted token - start fresh
                logger.warning("Failed to decode pagination token, starting fresh")

            # Fresh query → Logs Insights (server-side `sort @timestamp desc`).
            #
            # This is the ONLY strategy that reliably returns the NEWEST N
            # events. FilterLogEvents returns events oldest-first and stops once
            # `limit` is reached, so on a high-volume log group it permanently
            # returns the oldest events in the window (e.g. a burst that
            # happened an hour ago), making real-time views appear "frozen"
            # even while new events keep arriving. Insights sorts on the server
            # so the most recent events are always returned first.
            #
            # _multi_group_insights falls back to FilterLogEvents internally if
            # Insights fails to start or times out, so behaviour degrades
            # gracefully rather than erroring.
            return self._multi_group_insights(
                groups_in_scope,
                start,
                end,
                limit,
                channel_id,
                action,
                search,
            )

        except Exception as e:
            logger.error(f"Failed to query logs: {e}")
            raise

    def query_channel_logs(
        self,
        channel_id: str,
        limit: int = 100,
        start_time_ms: Optional[int] = None,
        end_time_ms: Optional[int] = None,
        next_token: Optional[str] = None,
    ) -> Tuple[List[LogEvent], Optional[str]]:
        """Query channel-specific logs - always uses ESAM (first) group only."""
        return self.query_logs(
            limit=limit,
            channel_id=channel_id,
            start_time_ms=start_time_ms,
            end_time_ms=end_time_ms,
            next_token=next_token,
            source_filter="esam",
        )

    # ------------------------------------------------------------------
    # Group resolution
    # ------------------------------------------------------------------

    def _resolve_groups(self, source_filter: Optional[str]) -> List[str]:
        """Resolve which log groups to query based on source filter."""
        if source_filter:
            for entry in self.log_groups_config:
                if entry["sourceLabel"] == source_filter:
                    return [entry["logGroupName"]]
            # Unknown source - return all (handler validates before calling)
            return self.log_groups
        return self.log_groups

    # ------------------------------------------------------------------
    # Multi-group FilterLogEvents (≤24h)
    # ------------------------------------------------------------------

    def _multi_group_filter(
        self,
        groups: List[str],
        start_ms: int,
        end_ms: int,
        limit: int,
        channel_id: Optional[str],
        action: Optional[str],
        search: Optional[str],
    ) -> Tuple[List[LogEvent], Optional[str]]:
        """Query multiple groups via FilterLogEvents, merge results."""
        all_events: List[LogEvent] = []
        last_token = None
        last_token_group = None

        for group_name in groups:
            source = self._group_to_source.get(group_name, "unknown")
            events, token = self._filter_log_events(
                group_name,
                start_ms,
                end_ms,
                limit,
                channel_id,
                action,
                search,
                None,
            )
            for ev in events:
                ev.source = source
            all_events.extend(events)
            if token:
                last_token = token
                last_token_group = group_name

        # Sort all merged events by timestamp descending
        all_events.sort(key=lambda e: e.timestamp, reverse=True)
        truncated = all_events[:limit]

        # Only return pagination token if we have one and results were truncated
        result_token = None
        if last_token and last_token_group and len(all_events) > limit:
            result_token = self._encode_pagination_token(last_token_group, last_token)

        return truncated, result_token

    def _filter_log_events(
        self,
        log_group: str,
        start_ms: int,
        end_ms: int,
        limit: int,
        channel_id: Optional[str],
        action: Optional[str],
        search: Optional[str],
        next_token: Optional[str],
    ) -> Tuple[List[LogEvent], Optional[str]]:
        """Use FilterLogEvents with expanding windows for short ranges."""
        range_ms = end_ms - start_ms

        if next_token:
            return self._do_filter(
                log_group,
                start_ms,
                end_ms,
                limit,
                channel_id,
                action,
                search,
                next_token,
            )

        windows = [w for w in [3600_000, 6 * 3600_000, range_ms] if w <= range_ms]
        if range_ms not in windows:
            windows.append(range_ms)

        for window in windows:
            window_start = max(start_ms, end_ms - window)
            events, token = self._do_filter(
                log_group,
                window_start,
                end_ms,
                limit,
                channel_id,
                action,
                search,
                None,
            )
            if events or window >= range_ms:
                return events, token

        return [], None

    def _do_filter(
        self,
        log_group: str,
        start_ms: int,
        end_ms: int,
        limit: int,
        channel_id: Optional[str],
        action: Optional[str],
        search: Optional[str],
        next_token: Optional[str],
    ) -> Tuple[List[LogEvent], Optional[str]]:
        """Execute FilterLogEvents with pagination (max 10 pages)."""
        params = {
            "logGroupName": log_group,
            "startTime": start_ms,
            "endTime": end_ms,
            "interleaved": True,
        }
        if search:
            params["filterPattern"] = f'"{search}"'
        if next_token:
            params["nextToken"] = next_token

        all_parsed: List[LogEvent] = []
        cw_token = next_token

        for _ in range(10):
            if cw_token and cw_token != next_token:
                params["nextToken"] = cw_token

            response = self.logs_client.filter_log_events(**params)

            for ev in response.get("events", []):
                parsed = self._try_parse(ev)
                if not parsed:
                    continue
                if channel_id and parsed.channel_id != channel_id:
                    continue
                if action and parsed.action != action:
                    continue
                all_parsed.append(parsed)

            cw_token = response.get("nextToken")
            if not cw_token or len(all_parsed) >= limit:
                break

        all_parsed.sort(key=lambda e: e.timestamp, reverse=True)
        return all_parsed[:limit], cw_token

    # ------------------------------------------------------------------
    # Multi-group Logs Insights (>24h)
    # ------------------------------------------------------------------

    def _multi_group_insights(
        self,
        groups: List[str],
        start_ms: int,
        end_ms: int,
        limit: int,
        channel_id: Optional[str],
        action: Optional[str],
        search: Optional[str],
    ) -> Tuple[List[LogEvent], Optional[str]]:
        """Query via CloudWatch Logs Insights (server-side, newest-first).

        Used for all fresh queries regardless of range. Insights sorts on the
        server, so the most recent events are always returned even on
        high-volume log groups. Falls back to FilterLogEvents only if Insights
        cannot start or times out.
        """
        fetch_limit = min(limit * 6, 10000)
        if search:
            query = _INSIGHTS_QUERY_WITH_SEARCH.format(
                limit=fetch_limit,
                search=self._escape_insights(search),
            )
        else:
            query = _INSIGHTS_QUERY.format(limit=fetch_limit)

        start_sec = start_ms // 1000
        end_sec = end_ms // 1000

        try:
            start_resp = self.logs_client.start_query(
                logGroupNames=groups,
                startTime=start_sec,
                endTime=end_sec,
                queryString=query,
            )
            query_id = start_resp["queryId"]
        except ClientError as e:
            logger.warning(f"Logs Insights start failed, falling back: {e}")
            return self._multi_group_filter(
                groups,
                start_ms,
                end_ms,
                limit,
                channel_id,
                action,
                search,
            )

        results = self._poll_query(query_id, timeout_sec=20)
        if results is None:
            logger.warning("Logs Insights query timed out, falling back")
            return self._multi_group_filter(
                groups,
                start_ms,
                end_ms,
                limit,
                channel_id,
                action,
                search,
            )

        all_parsed: List[LogEvent] = []
        for row in results:
            fields = {f["field"]: f["value"] for f in row}
            message = fields.get("@message", "")
            timestamp_str = fields.get("@timestamp", "")
            log_field = fields.get("@log", "")

            parsed = self._parse_json_message(message, timestamp_str)
            if not parsed:
                continue
            if channel_id and parsed.channel_id != channel_id:
                continue
            if action and parsed.action != action:
                continue

            # Extract source from @log field (format: accountId:logGroupName)
            source = self._resolve_source_from_log_field(log_field)
            parsed.source = source

            all_parsed.append(parsed)
            if len(all_parsed) >= limit:
                break

        all_parsed.sort(key=lambda e: e.timestamp, reverse=True)
        return all_parsed[:limit], None

    def _resolve_source_from_log_field(self, log_field: str) -> str:
        """Map @log field value to sourceLabel. Format: accountId:logGroupName"""
        if ":" in log_field:
            group_name = log_field.split(":", 1)[1]
        else:
            group_name = log_field
        return self._group_to_source.get(group_name, "unknown")

    def _poll_query(
        self,
        query_id: str,
        timeout_sec: int = 20,
    ) -> Optional[list]:
        """Poll GetQueryResults until complete or timeout."""
        deadline = time.time() + timeout_sec
        interval = 0.5

        while time.time() < deadline:
            try:
                resp = self.logs_client.get_query_results(queryId=query_id)
                status = resp.get("status", "")

                if status == "Complete":
                    return resp.get("results", [])
                elif status in ("Failed", "Cancelled", "Timeout"):
                    logger.error(f"Insights query {status}: {query_id}")
                    return None

                time.sleep(interval)
                interval = min(interval * 1.5, 2.0)

            except ClientError as e:
                logger.error(f"GetQueryResults failed: {e}")
                return None

        logger.warning(f"Insights query polling timed out: {query_id}")
        return None

    @staticmethod
    def _escape_insights(text: str) -> str:
        """Escape special characters for Logs Insights filter."""
        return text.replace("\\", "\\\\").replace("/", "\\/").replace('"', '\\"')

    # ------------------------------------------------------------------
    # Pagination token encoding/decoding
    # ------------------------------------------------------------------

    @staticmethod
    def _encode_pagination_token(group: str, token: str) -> str:
        """Encode composite pagination token as base64 JSON."""
        payload = json.dumps({"group": group, "token": token})
        return base64.b64encode(payload.encode("utf-8")).decode("utf-8")

    @staticmethod
    def _decode_pagination_token(token: str) -> Optional[Tuple[str, str]]:
        """Decode composite pagination token. Returns (group, cw_token) or None."""
        try:
            payload = base64.b64decode(token.encode("utf-8")).decode("utf-8")
            data = json.loads(payload)
            return data["group"], data["token"]
        except Exception:
            return None

    # ------------------------------------------------------------------
    # Parsing helpers
    # ------------------------------------------------------------------

    def _try_parse(self, event: dict) -> Optional[LogEvent]:
        """Try to parse a CloudWatch log event, return None on failure."""
        try:
            return self._parse_log_event(event)
        except Exception:
            return None

    def _parse_log_event(self, event: dict) -> LogEvent:
        """Parse a raw CloudWatch FilterLogEvents event."""
        message = event.get("message", "")
        timestamp_ms = event.get("timestamp", 0)
        timestamp = datetime.fromtimestamp(timestamp_ms / 1000).isoformat() + "Z"

        try:
            log_data = json.loads(message)
            return self._build_log_event(log_data, timestamp)
        except json.JSONDecodeError:
            return LogEvent(
                timestamp=timestamp,
                level="INFO",
                message=message,
            )

    def _parse_json_message(
        self,
        message: str,
        fallback_timestamp: str = "",
    ) -> Optional[LogEvent]:
        """Parse a JSON log message string (from Insights @message)."""
        try:
            log_data = json.loads(message)
            return self._build_log_event(log_data, fallback_timestamp)
        except (json.JSONDecodeError, Exception):
            return None

    @staticmethod
    def _build_log_event(log_data: dict, fallback_ts: str) -> LogEvent:
        """Build a LogEvent from parsed JSON log data."""
        action_val = log_data.get("action", "")
        is_audit = isinstance(action_val, str) and "." in action_val

        # For audit events, use the action as the message
        msg = action_val if is_audit else log_data.get("message", "")

        event = LogEvent(
            timestamp=log_data.get("timestamp", fallback_ts),
            level=log_data.get("level", "INFO"),
            message=msg,
            channel_id=log_data.get("channelId"),
            command_type=log_data.get("commandType"),
            action=log_data.get("action"),
            rule_id=log_data.get("ruleId"),
            processing_time_ms=log_data.get("processingTimeMs"),
            correlation_id=log_data.get("correlationId"),
            xml=log_data.get("xml"),
            scte35_binary=log_data.get("scte35Binary"),
            error=log_data.get("error"),
            actions_count=log_data.get("actionsCount"),
            actions_succeeded=log_data.get("actionsSucceeded"),
            actions_failed=log_data.get("actionsFailed"),
            dry_run=log_data.get("dryRun"),
            matched=log_data.get("matched"),
            matched_rule_id=log_data.get("matchedRuleId"),
            channel_name=log_data.get("channelName"),
            details=log_data.get("details"),
        )

        # Extract audit-specific fields
        if is_audit:
            event.performed_by = log_data.get("performedBy")
            event.target_id = log_data.get("targetId")
            event.target_type = log_data.get("targetType")
            event.request_data = log_data.get("requestData")

        return event
