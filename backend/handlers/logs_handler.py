# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Logs Lambda handler for querying CloudWatch Logs."""

import json
import os
import logging
from typing import Dict, Any, Optional, List

from infrastructure.logging.structured_logger import (
    StructuredLogger,
    generate_correlation_id,
    configure_logging,
)
from domain.repositories.logs_repository import LogsRepository

# ---------------------------------------------------------------------------
# Module-level initialization
# ---------------------------------------------------------------------------


def _parse_log_groups_config() -> List[dict]:
    """Parse LOG_GROUPS_CONFIG env var, fallback to single ESAM entry."""
    raw = os.environ.get("LOG_GROUPS_CONFIG", "")
    if raw:
        try:
            config = json.loads(raw)
            if isinstance(config, list) and all(
                isinstance(e, dict)
                and "logGroupName" in e
                and "sourceLabel" in e
                and "displayName" in e
                for e in config
            ):
                return config
        except (json.JSONDecodeError, TypeError):
            logging.getLogger(__name__).warning(
                "Invalid LOG_GROUPS_CONFIG, falling back to ESAM-only"
            )
    # Fallback: single ESAM log group
    esam_group = os.environ.get("ESAM_LOG_GROUP", "/aws/lambda/pois-esam-handler")
    return [
        {
            "logGroupName": esam_group,
            "sourceLabel": "esam",
            "displayName": "ESAM Signals",
        }
    ]


log_groups_config = _parse_log_groups_config()
source_registry = {entry["sourceLabel"]: entry for entry in log_groups_config}
log_group_names = [entry["logGroupName"] for entry in log_groups_config]
logs_repo = LogsRepository(log_group_names, log_groups_config)

# Configure logging
log_level = os.environ.get("LOG_LEVEL", "INFO")
configure_logging(log_level)


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for logs queries.

    Supports:
    - GET /logs?channelId=X&action=Y&limit=N&source=S - Query all logs
    - GET /logs/sources - Return available log sources
    - GET /channels/:id/logs?limit=N - Query channel-specific logs
    """
    correlation_id = generate_correlation_id()
    logger = StructuredLogger(__name__, correlation_id=correlation_id, level=log_level)

    try:
        method = event.get("httpMethod", "GET")
        path = event.get("path", "/logs")
        path_params = event.get("pathParameters") or {}
        query_params = event.get("queryStringParameters") or {}

        logger.info("Logs request received", method=method, path=path)

        if method != "GET":
            return _error_response(405, "Method not allowed", correlation_id)

        # Route: GET /logs/sources
        if path.rstrip("/").endswith("/logs/sources"):
            return _get_log_sources(correlation_id)

        # Parse common query parameters
        limit = int(query_params.get("limit", "100"))
        channel_id = query_params.get("channelId")
        action = query_params.get("action")
        start_time = query_params.get("startTime")
        end_time = query_params.get("endTime")
        search = query_params.get("search")
        next_token = query_params.get("nextToken")
        source = query_params.get("source")

        # Route: GET /channels/{id}/logs
        if path_params.get("id"):
            return _get_channel_logs(
                path_params["id"],
                limit,
                logger,
                correlation_id,
                start_time=start_time,
                end_time=end_time,
                next_token=next_token,
            )

        # Route: GET /logs
        # Validate source parameter
        if source and source not in source_registry:
            valid = list(source_registry.keys())
            return _error_response(
                400,
                f"Invalid source. Valid sources: {', '.join(valid)}",
                correlation_id,
            )

        return _get_logs(
            limit,
            channel_id,
            action,
            logger,
            correlation_id,
            start_time=start_time,
            end_time=end_time,
            search=search,
            next_token=next_token,
            source=source,
        )

    except Exception as e:
        logger.error(f"Unexpected error: {e}", error=str(e))
        return _error_response(
            500, "Internal server error", correlation_id, details=str(e)
        )


def _get_log_sources(correlation_id: str) -> Dict[str, Any]:
    """Return the log groups config array."""
    return _success_response(data=log_groups_config, correlation_id=correlation_id)


def _get_logs(
    limit: int,
    channel_id: Optional[str],
    action: Optional[str],
    logger: StructuredLogger,
    correlation_id: str,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    search: Optional[str] = None,
    next_token: Optional[str] = None,
    source: Optional[str] = None,
) -> Dict[str, Any]:
    """Query all logs with optional filters."""
    try:
        start_ms = _parse_time(start_time)
        end_ms = _parse_time(end_time)

        log_events, result_token = logs_repo.query_logs(
            limit=limit,
            channel_id=channel_id,
            action=action,
            start_time_ms=start_ms,
            end_time_ms=end_ms,
            search=search,
            next_token=next_token,
            source_filter=source,
        )

        logger.info(f"Retrieved {len(log_events)} log events")

        events_data = [event.model_dump(by_alias=True) for event in log_events]

        response_body = {
            "events": events_data,
            "count": len(events_data),
        }
        if result_token:
            response_body["nextToken"] = result_token

        return _success_response(data=response_body, correlation_id=correlation_id)

    except Exception as e:
        logger.error(f"Failed to query logs: {e}")
        return _error_response(
            500, "Failed to query logs", correlation_id, details=str(e)
        )


def _get_channel_logs(
    channel_id: str,
    limit: int,
    logger: StructuredLogger,
    correlation_id: str,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    next_token: Optional[str] = None,
) -> Dict[str, Any]:
    """Query logs for a specific channel."""
    try:
        start_ms = _parse_time(start_time)
        end_ms = _parse_time(end_time)

        log_events, result_token = logs_repo.query_channel_logs(
            channel_id=channel_id,
            limit=limit,
            start_time_ms=start_ms,
            end_time_ms=end_ms,
            next_token=next_token,
        )

        logger.info(f"Retrieved {len(log_events)} log events for channel {channel_id}")

        events_data = [event.model_dump(by_alias=True) for event in log_events]

        response_body = {
            "events": events_data,
            "count": len(events_data),
        }
        if result_token:
            response_body["nextToken"] = result_token

        return _success_response(data=response_body, correlation_id=correlation_id)

    except Exception as e:
        logger.error(f"Failed to query channel logs: {e}")
        return _error_response(
            500, "Failed to query channel logs", correlation_id, details=str(e)
        )


def _success_response(data: Any, correlation_id: str) -> Dict[str, Any]:
    """Build success response."""
    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
            "X-Correlation-ID": correlation_id,
        },
        "body": json.dumps(data),
    }


def _error_response(
    status_code: int,
    message: str,
    correlation_id: str,
    details: Optional[str] = None,
) -> Dict[str, Any]:
    """Build error response."""
    response_body = {
        "error": message,
        "correlationId": correlation_id,
    }
    if details:
        response_body["details"] = details

    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
            "X-Correlation-ID": correlation_id,
        },
        "body": json.dumps(response_body),
    }


def _parse_time(time_str: Optional[str]) -> Optional[int]:
    """Parse time string to epoch milliseconds."""
    if not time_str:
        return None

    try:
        val = int(time_str)
        if val > 1_000_000_000_000:
            return val
        return val * 1000
    except ValueError:
        pass

    try:
        from datetime import datetime

        dt = datetime.fromisoformat(time_str.replace("Z", "+00:00"))
        return int(dt.timestamp() * 1000)
    except Exception:
        return None
