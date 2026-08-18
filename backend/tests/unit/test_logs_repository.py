# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Unit tests for LogsRepository.

Regression coverage for the "real-time logs frozen" bug: on a high-volume log
group the previous FilterLogEvents-based path returned the OLDEST events in the
window (because FilterLogEvents returns oldest-first and stopped once `limit`
was reached). The fix routes fresh queries through CloudWatch Logs Insights,
which sorts server-side `desc`, so the newest events are always returned.
"""

import json
from unittest.mock import Mock, patch

import pytest

from domain.repositories.logs_repository import LogsRepository

LOG_GROUPS_CONFIG = [
    {
        "logGroupName": "/aws/lambda/pois-esam-handler",
        "sourceLabel": "esam",
        "displayName": "ESAM Signals",
    }
]


def _spe_message(channel_id: str, ts_iso: str, correlation_id: str) -> str:
    """Build a structured SPE log line as emitted by the ESAM handler."""
    return json.dumps(
        {
            "timestamp": ts_iso,
            "level": "INFO",
            "message": "SignalProcessingEvent (SPE)",
            "channelId": channel_id,
            "correlationId": correlation_id,
        }
    )


@pytest.fixture
def mock_logs_client():
    """Mock the boto3 CloudWatch Logs client used by the repository."""
    with patch("boto3.client") as mock_client:
        client = Mock()
        mock_client.return_value = client
        yield client


@pytest.fixture
def repository(mock_logs_client):
    return LogsRepository(
        [e["logGroupName"] for e in LOG_GROUPS_CONFIG],
        LOG_GROUPS_CONFIG,
    )


class TestLogsRepositoryInsightsRouting:
    """Fresh queries must use Logs Insights (server-side newest-first)."""

    def _wire_insights(self, client, rows):
        """Make the mock client return `rows` from an Insights query."""
        client.start_query.return_value = {"queryId": "q-123"}
        client.get_query_results.return_value = {
            "status": "Complete",
            "results": rows,
        }

    def test_fresh_query_uses_insights_not_filter(self, repository, mock_logs_client):
        """A fresh (no token) query should call start_query, not filter_log_events."""
        self._wire_insights(mock_logs_client, rows=[])

        repository.query_logs(limit=100, source_filter="esam")

        mock_logs_client.start_query.assert_called_once()
        mock_logs_client.filter_log_events.assert_not_called()

    def test_short_range_query_uses_insights(self, repository, mock_logs_client):
        """Even a <=1h range must use Insights so newest events are returned."""
        self._wire_insights(mock_logs_client, rows=[])

        now_ms = 1_700_000_000_000
        repository.query_logs(
            limit=100,
            start_time_ms=now_ms - 3600_000,  # 1 hour window
            end_time_ms=now_ms,
            source_filter="esam",
        )

        mock_logs_client.start_query.assert_called_once()
        mock_logs_client.filter_log_events.assert_not_called()

    def test_returns_newest_events_first(self, repository, mock_logs_client):
        """Regression: the newest event must be returned first, not the oldest."""
        # Insights returns rows already sorted desc (newest first).
        rows = [
            [
                {"field": "@timestamp", "value": "2026-06-10 14:45:00.000"},
                {
                    "field": "@message",
                    "value": _spe_message(
                        "1780587098230", "2026-06-10T14:45:00.000Z", "newest"
                    ),
                },
                {"field": "@log", "value": "123:/aws/lambda/pois-esam-handler"},
            ],
            [
                {"field": "@timestamp", "value": "2026-06-10 14:26:15.000"},
                {
                    "field": "@message",
                    "value": _spe_message(
                        "1780587098230", "2026-06-10T14:26:15.000Z", "oldest"
                    ),
                },
                {"field": "@log", "value": "123:/aws/lambda/pois-esam-handler"},
            ],
        ]
        self._wire_insights(mock_logs_client, rows=rows)

        events, _ = repository.query_logs(limit=100, source_filter="esam")

        assert len(events) == 2
        # Newest first
        assert events[0].correlation_id == "newest"
        assert events[0].timestamp == "2026-06-10T14:45:00.000Z"

    def test_channel_filter_applied(self, repository, mock_logs_client):
        """channelId filtering still excludes other channels' events."""
        rows = [
            [
                {"field": "@timestamp", "value": "2026-06-10 14:45:00.000"},
                {
                    "field": "@message",
                    "value": _spe_message(
                        "1780587098230", "2026-06-10T14:45:00.000Z", "mine"
                    ),
                },
                {"field": "@log", "value": "123:/aws/lambda/pois-esam-handler"},
            ],
            [
                {"field": "@timestamp", "value": "2026-06-10 14:44:00.000"},
                {
                    "field": "@message",
                    "value": _spe_message(
                        "OTHER-CHANNEL", "2026-06-10T14:44:00.000Z", "theirs"
                    ),
                },
                {"field": "@log", "value": "123:/aws/lambda/pois-esam-handler"},
            ],
        ]
        self._wire_insights(mock_logs_client, rows=rows)

        events, _ = repository.query_logs(
            limit=100,
            channel_id="1780587098230",
            source_filter="esam",
        )

        assert len(events) == 1
        assert events[0].channel_id == "1780587098230"
        assert events[0].correlation_id == "mine"

    def test_channel_logs_uses_insights(self, repository, mock_logs_client):
        """query_channel_logs (used by the per-channel real-time view) uses Insights."""
        self._wire_insights(mock_logs_client, rows=[])

        repository.query_channel_logs(channel_id="1780587098230", limit=100)

        mock_logs_client.start_query.assert_called_once()
        mock_logs_client.filter_log_events.assert_not_called()


class TestLogsRepositoryFallback:
    """Insights failures must gracefully fall back to FilterLogEvents."""

    def test_falls_back_to_filter_when_insights_start_fails(
        self,
        repository,
        mock_logs_client,
    ):
        from botocore.exceptions import ClientError

        mock_logs_client.start_query.side_effect = ClientError(
            {
                "Error": {
                    "Code": "LimitExceededException",
                    "Message": "too many queries",
                }
            },
            "StartQuery",
        )
        mock_logs_client.filter_log_events.return_value = {
            "events": [],
            "nextToken": None,
        }

        events, token = repository.query_logs(limit=100, source_filter="esam")

        # Fell back to FilterLogEvents instead of raising
        mock_logs_client.filter_log_events.assert_called()
        assert events == []

    def test_falls_back_to_filter_when_insights_times_out(
        self,
        repository,
        mock_logs_client,
    ):
        mock_logs_client.start_query.return_value = {"queryId": "q-timeout"}
        mock_logs_client.filter_log_events.return_value = {
            "events": [],
            "nextToken": None,
        }

        # Simulate the Insights poll timing out (returns None) -> fallback path.
        with patch.object(repository, "_poll_query", return_value=None):
            events, _ = repository.query_logs(limit=100, source_filter="esam")

        mock_logs_client.filter_log_events.assert_called()
        assert events == []


class TestLogsRepositoryPagination:
    """Pagination tokens continue to use FilterLogEvents continuation."""

    def test_pagination_token_uses_filter(self, repository, mock_logs_client):
        token = repository._encode_pagination_token(
            "/aws/lambda/pois-esam-handler",
            "cw-token-abc",
        )
        mock_logs_client.filter_log_events.return_value = {
            "events": [],
            "nextToken": None,
        }

        repository.query_logs(limit=100, next_token=token, source_filter="esam")

        mock_logs_client.filter_log_events.assert_called()
        mock_logs_client.start_query.assert_not_called()
