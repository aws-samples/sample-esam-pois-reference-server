# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Property-based tests for metrics emission.

Feature: external-actions
Property 31: Metrics Emission
"""

import pytest
from hypothesis import given, strategies as st, settings
from domain.services.metrics_emitter import InMemoryMetricsEmitter
from domain.models.external_actions import ActionResult
from typing import Dict, Any, Optional, Tuple


# Mock plugin for testing
class MockActionPlugin:
    """Mock plugin for testing metrics."""

    def __init__(self, action_type: str = "mock_action", should_succeed: bool = True):
        self._action_type = action_type
        self.should_succeed = should_succeed

    @property
    def action_type(self) -> str:
        return self._action_type

    @property
    def config_schema(self) -> Dict[str, Any]:
        return {"type": "object"}

    def validate_config(self, config: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        return True, None

    async def execute(
        self,
        config: Dict[str, Any],
        signal_data: Dict[str, Any],
        channel_id: str,
        credentials: Dict[str, Any],
    ) -> ActionResult:
        return ActionResult(
            success=self.should_succeed,
            message="Success" if self.should_succeed else "Failed",
        )

    def supports_cleanup(self) -> bool:
        return False

    def get_idempotency_key(
        self, config: Dict[str, Any], signal_data: Dict[str, Any], channel_id: str
    ) -> str:
        import hashlib
        import json

        data = f"{channel_id}:{json.dumps(config, sort_keys=True)}:{signal_data.get('pts', '')}"
        return hashlib.sha256(data.encode()).hexdigest()

    def get_rate_limit(self) -> Optional[Tuple[int, int]]:
        return None


# Feature: external-actions, Property 31: Metrics Emission
@settings(max_examples=100, deadline=None)
@given(
    action_type=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll")),
    ),
    channel_id=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")),
    ),
    success=st.booleans(),
    duration_ms=st.integers(min_value=0, max_value=10000),
    retry_count=st.integers(min_value=0, max_value=5),
)
@pytest.mark.asyncio
async def test_property_metrics_emitted_for_action_execution(
    action_type: str, channel_id: str, success: bool, duration_ms: int, retry_count: int
):
    """
    Property 31: Metrics Emission

    For any action execution, metrics should be emitted for execution count,
    success/failure status, duration, and retry count, tagged with channel_id
    and action_type.

    Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6
    """
    # Arrange
    emitter = InMemoryMetricsEmitter()

    # Act
    emitter.emit_action_metric(
        action_type=action_type,
        channel_id=channel_id,
        success=success,
        duration_ms=duration_ms,
        retry_count=retry_count,
    )

    # Assert
    metrics = emitter.get_action_metrics()
    assert len(metrics) == 1, "Should emit exactly one metric"

    metric = metrics[0]

    # Verify all required fields are present
    assert metric["action_type"] == action_type, "Metric should include action_type"
    assert metric["channel_id"] == channel_id, "Metric should include channel_id"
    assert metric["success"] == success, "Metric should include success status"
    assert metric["duration_ms"] == duration_ms, "Metric should include duration"
    assert metric["retry_count"] == retry_count, "Metric should include retry count"
    assert "timestamp" in metric, "Metric should include timestamp"


@settings(max_examples=100, deadline=None)
@given(
    action_type=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll")),
    ),
    channel_id=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")),
    ),
    num_successes=st.integers(min_value=0, max_value=10),
    num_failures=st.integers(min_value=0, max_value=10),
)
@pytest.mark.asyncio
async def test_property_metrics_track_success_failure_counts(
    action_type: str, channel_id: str, num_successes: int, num_failures: int
):
    """
    Property 31: Metrics Emission - Success/Failure Tracking

    For any series of action executions, metrics should accurately track
    the count of successful and failed executions.

    Validates: Requirements 13.2, 13.3
    """
    # Arrange
    emitter = InMemoryMetricsEmitter()

    # Act - Emit success metrics
    for _ in range(num_successes):
        emitter.emit_action_metric(
            action_type=action_type,
            channel_id=channel_id,
            success=True,
            duration_ms=100,
            retry_count=0,
        )

    # Act - Emit failure metrics
    for _ in range(num_failures):
        emitter.emit_action_metric(
            action_type=action_type,
            channel_id=channel_id,
            success=False,
            duration_ms=100,
            retry_count=0,
        )

    # Assert
    success_count = emitter.get_success_count(action_type, channel_id)
    failure_count = emitter.get_failure_count(action_type, channel_id)

    assert (
        success_count == num_successes
    ), f"Expected {num_successes} successes, got {success_count}"
    assert (
        failure_count == num_failures
    ), f"Expected {num_failures} failures, got {failure_count}"


@settings(max_examples=100, deadline=None)
@given(
    action_type=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll")),
    ),
    channel_id=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")),
    ),
    durations=st.lists(
        st.integers(min_value=0, max_value=5000), min_size=1, max_size=20
    ),
)
@pytest.mark.asyncio
async def test_property_metrics_track_total_duration(
    action_type: str, channel_id: str, durations: list[int]
):
    """
    Property 31: Metrics Emission - Duration Tracking

    For any series of action executions, metrics should accurately track
    the total duration across all executions.

    Validates: Requirements 13.4
    """
    # Arrange
    emitter = InMemoryMetricsEmitter()

    # Act
    for duration in durations:
        emitter.emit_action_metric(
            action_type=action_type,
            channel_id=channel_id,
            success=True,
            duration_ms=duration,
            retry_count=0,
        )

    # Assert
    total_duration = emitter.get_total_duration(action_type, channel_id)
    expected_duration = sum(durations)

    assert (
        total_duration == expected_duration
    ), f"Expected total duration {expected_duration}ms, got {total_duration}ms"


@settings(max_examples=100, deadline=None)
@given(
    action_type=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll")),
    ),
    channel_id=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")),
    ),
    retry_counts=st.lists(
        st.integers(min_value=0, max_value=5), min_size=1, max_size=20
    ),
)
@pytest.mark.asyncio
async def test_property_metrics_track_total_retries(
    action_type: str, channel_id: str, retry_counts: list[int]
):
    """
    Property 31: Metrics Emission - Retry Tracking

    For any series of action executions, metrics should accurately track
    the total number of retries across all executions.

    Validates: Requirements 13.5
    """
    # Arrange
    emitter = InMemoryMetricsEmitter()

    # Act
    for retry_count in retry_counts:
        emitter.emit_action_metric(
            action_type=action_type,
            channel_id=channel_id,
            success=True,
            duration_ms=100,
            retry_count=retry_count,
        )

    # Assert
    total_retries = emitter.get_total_retries(action_type, channel_id)
    expected_retries = sum(retry_counts)

    assert (
        total_retries == expected_retries
    ), f"Expected total retries {expected_retries}, got {total_retries}"


@settings(max_examples=100, deadline=None)
@given(
    action_type1=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll")),
    ),
    action_type2=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll")),
    ),
    channel_id=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")),
    ),
    count1=st.integers(min_value=1, max_value=10),
    count2=st.integers(min_value=1, max_value=10),
)
@pytest.mark.asyncio
async def test_property_metrics_filtered_by_action_type(
    action_type1: str, action_type2: str, channel_id: str, count1: int, count2: int
):
    """
    Property 31: Metrics Emission - Action Type Filtering

    For any metrics query filtered by action type, only metrics for that
    specific action type should be returned.

    Validates: Requirements 13.6
    """
    # Make action types different
    action_type2 = action_type1 + "_different"

    # Arrange
    emitter = InMemoryMetricsEmitter()

    # Act - Emit metrics for action_type1
    for _ in range(count1):
        emitter.emit_action_metric(
            action_type=action_type1,
            channel_id=channel_id,
            success=True,
            duration_ms=100,
            retry_count=0,
        )

    # Act - Emit metrics for action_type2
    for _ in range(count2):
        emitter.emit_action_metric(
            action_type=action_type2,
            channel_id=channel_id,
            success=True,
            duration_ms=100,
            retry_count=0,
        )

    # Assert
    metrics1 = emitter.get_action_metrics(action_type=action_type1)
    metrics2 = emitter.get_action_metrics(action_type=action_type2)

    assert (
        len(metrics1) == count1
    ), f"Expected {count1} metrics for {action_type1}, got {len(metrics1)}"
    assert (
        len(metrics2) == count2
    ), f"Expected {count2} metrics for {action_type2}, got {len(metrics2)}"

    # Verify all metrics have correct action type
    assert all(
        m["action_type"] == action_type1 for m in metrics1
    ), "All metrics should have correct action_type"
    assert all(
        m["action_type"] == action_type2 for m in metrics2
    ), "All metrics should have correct action_type"


@settings(max_examples=100, deadline=None)
@given(
    action_type=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll")),
    ),
    channel_id1=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")),
    ),
    channel_id2=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")),
    ),
    count1=st.integers(min_value=1, max_value=10),
    count2=st.integers(min_value=1, max_value=10),
)
@pytest.mark.asyncio
async def test_property_metrics_filtered_by_channel_id(
    action_type: str, channel_id1: str, channel_id2: str, count1: int, count2: int
):
    """
    Property 31: Metrics Emission - Channel ID Filtering

    For any metrics query filtered by channel ID, only metrics for that
    specific channel should be returned.

    Validates: Requirements 13.6
    """
    # Make channel IDs different
    channel_id2 = channel_id1 + "_different"

    # Arrange
    emitter = InMemoryMetricsEmitter()

    # Act - Emit metrics for channel_id1
    for _ in range(count1):
        emitter.emit_action_metric(
            action_type=action_type,
            channel_id=channel_id1,
            success=True,
            duration_ms=100,
            retry_count=0,
        )

    # Act - Emit metrics for channel_id2
    for _ in range(count2):
        emitter.emit_action_metric(
            action_type=action_type,
            channel_id=channel_id2,
            success=True,
            duration_ms=100,
            retry_count=0,
        )

    # Assert
    metrics1 = emitter.get_action_metrics(channel_id=channel_id1)
    metrics2 = emitter.get_action_metrics(channel_id=channel_id2)

    assert (
        len(metrics1) == count1
    ), f"Expected {count1} metrics for {channel_id1}, got {len(metrics1)}"
    assert (
        len(metrics2) == count2
    ), f"Expected {count2} metrics for {channel_id2}, got {len(metrics2)}"

    # Verify all metrics have correct channel ID
    assert all(
        m["channel_id"] == channel_id1 for m in metrics1
    ), "All metrics should have correct channel_id"
    assert all(
        m["channel_id"] == channel_id2 for m in metrics2
    ), "All metrics should have correct channel_id"


@settings(max_examples=100, deadline=None)
@given(
    action_type=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll")),
    ),
    channel_id=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")),
    ),
    delay_seconds=st.floats(min_value=0.0, max_value=10.0),
)
@pytest.mark.asyncio
async def test_property_rate_limit_metrics_emitted(
    action_type: str, channel_id: str, delay_seconds: float
):
    """
    Property 31: Metrics Emission - Rate Limit Metrics

    For any rate limiting event, metrics should be emitted with the
    action type, channel ID, and delay duration.

    Validates: Requirements 13.1, 13.6
    """
    # Arrange
    emitter = InMemoryMetricsEmitter()

    # Act
    emitter.emit_rate_limit_metric(
        action_type=action_type, channel_id=channel_id, delay_seconds=delay_seconds
    )

    # Assert
    metrics = emitter.get_rate_limit_metrics()
    assert len(metrics) == 1, "Should emit exactly one rate limit metric"

    metric = metrics[0]
    assert metric["action_type"] == action_type
    assert metric["channel_id"] == channel_id
    assert metric["delay_seconds"] == delay_seconds
    assert "timestamp" in metric


@settings(max_examples=50, deadline=None)
@given(
    action_type=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll")),
    ),
    channel_id=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")),
    ),
    num_metrics=st.integers(min_value=1, max_value=20),
)
@pytest.mark.asyncio
async def test_property_metrics_timestamp_ordering(
    action_type: str, channel_id: str, num_metrics: int
):
    """
    Property 31: Metrics Emission - Timestamp Ordering

    For any series of metrics emitted sequentially, the timestamps should
    be in chronological order (non-decreasing).

    Validates: Requirements 13.1
    """
    # Arrange
    emitter = InMemoryMetricsEmitter()

    # Act
    for _ in range(num_metrics):
        emitter.emit_action_metric(
            action_type=action_type,
            channel_id=channel_id,
            success=True,
            duration_ms=100,
            retry_count=0,
        )

    # Assert
    metrics = emitter.get_action_metrics()
    timestamps = [m["timestamp"] for m in metrics]

    # Verify timestamps are non-decreasing
    for i in range(len(timestamps) - 1):
        assert (
            timestamps[i] <= timestamps[i + 1]
        ), f"Timestamps should be non-decreasing: {timestamps[i]} > {timestamps[i + 1]}"
