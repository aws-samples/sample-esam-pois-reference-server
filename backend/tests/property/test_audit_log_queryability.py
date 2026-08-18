# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Property-based tests for audit log queryability."""

import pytest
from hypothesis import given, strategies as st, settings, assume
from datetime import datetime, timedelta
import uuid

from domain.models.external_actions import ActionAuditEntry, ExecutionResult
from domain.repositories.action_audit_repository import InMemoryActionAuditRepository


# Strategies for generating test data
@st.composite
def audit_entry_with_channel_strategy(draw, channel_id: str):
    """Generate ActionAuditEntry with specific channel_id."""
    execution_results = [
        ExecutionResult.SUCCESS,
        ExecutionResult.FAILURE,
        ExecutionResult.SKIPPED,
    ]

    entry = ActionAuditEntry(
        entry_id=str(uuid.uuid4()),
        timestamp=datetime.utcnow()
        - timedelta(days=draw(st.integers(min_value=0, max_value=30))),
        channel_id=channel_id,
        rule_id=draw(
            st.text(
                min_size=1,
                max_size=20,
                alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")),
            )
        ),
        action_id=draw(
            st.text(
                min_size=1,
                max_size=20,
                alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")),
            )
        ),
        action_type=draw(
            st.sampled_from(
                ["medialive_schedule_action", "webhook", "sns_notification"]
            )
        ),
        signal_data=draw(
            st.dictionaries(
                keys=st.text(min_size=1, max_size=10),
                values=st.one_of(st.integers(), st.text(max_size=20)),
            )
        ),
        execution_result=draw(st.sampled_from(execution_results)),
        retry_count=draw(st.integers(min_value=0, max_value=5)),
        duration_ms=draw(st.integers(min_value=0, max_value=10000)),
    )

    return entry


# Feature: external-actions, Property 14: Audit Log Queryability
@settings(max_examples=100)
@given(
    channel_id=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")),
    ),
    num_entries=st.integers(min_value=1, max_value=10),
)
@pytest.mark.asyncio
async def test_property_query_by_channel_returns_only_matching_entries(
    channel_id: str, num_entries: int
):
    """
    Property 14: Audit Log Queryability - Channel Filter

    For any query to the audit log with channel_id filter, only entries
    matching that channel_id should be returned.

    Validates: Requirements 7.6
    """
    repo = InMemoryActionAuditRepository()

    # Create entries for the target channel
    target_entries = []
    for _ in range(num_entries):
        entry = ActionAuditEntry(
            entry_id=str(uuid.uuid4()),
            timestamp=datetime.utcnow(),
            channel_id=channel_id,
            rule_id=f"rule_{uuid.uuid4().hex[:8]}",
            action_id=f"action_{uuid.uuid4().hex[:8]}",
            action_type="medialive_schedule_action",
            signal_data={"test": "data"},
            execution_result=ExecutionResult.SUCCESS,
            retry_count=0,
            duration_ms=100,
        )
        target_entries.append(entry)
        await repo.save(entry)

    # Create entries for other channels
    other_channel_id = f"other_{channel_id}"
    for _ in range(num_entries):
        entry = ActionAuditEntry(
            entry_id=str(uuid.uuid4()),
            timestamp=datetime.utcnow(),
            channel_id=other_channel_id,
            rule_id=f"rule_{uuid.uuid4().hex[:8]}",
            action_id=f"action_{uuid.uuid4().hex[:8]}",
            action_type="webhook",
            signal_data={"test": "data"},
            execution_result=ExecutionResult.SUCCESS,
            retry_count=0,
            duration_ms=100,
        )
        await repo.save(entry)

    # Query by channel
    results = await repo.query_by_channel(channel_id=channel_id)

    # Verify only matching entries returned
    assert (
        len(results) == num_entries
    ), f"Expected {num_entries} results, got {len(results)}"
    for result in results:
        assert (
            result.channel_id == channel_id
        ), f"Result has wrong channel_id: {result.channel_id}"


# Feature: external-actions, Property 14: Audit Log Queryability - Time Range Filter
@settings(max_examples=100)
@given(
    channel_id=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")),
    ),
    days_ago=st.integers(min_value=1, max_value=10),
)
@pytest.mark.asyncio
async def test_property_query_by_time_range_filters_correctly(
    channel_id: str, days_ago: int
):
    """
    Property 14: Audit Log Queryability - Time Range Filter

    For any query with start_time and end_time filters, only entries
    within that time range should be returned.

    Validates: Requirements 7.6
    """
    repo = InMemoryActionAuditRepository()

    now = datetime.utcnow()
    cutoff_date = now - timedelta(days=days_ago)

    # Create entries before cutoff
    old_entries = []
    for i in range(3):
        entry = ActionAuditEntry(
            entry_id=str(uuid.uuid4()),
            timestamp=cutoff_date - timedelta(days=i + 1),
            channel_id=channel_id,
            rule_id=f"rule_{i}",
            action_id=f"action_{i}",
            action_type="medialive_schedule_action",
            signal_data={"test": "old"},
            execution_result=ExecutionResult.SUCCESS,
            retry_count=0,
            duration_ms=100,
        )
        old_entries.append(entry)
        await repo.save(entry)

    # Create entries after cutoff
    new_entries = []
    for i in range(3):
        entry = ActionAuditEntry(
            entry_id=str(uuid.uuid4()),
            timestamp=cutoff_date + timedelta(hours=i + 1),
            channel_id=channel_id,
            rule_id=f"rule_new_{i}",
            action_id=f"action_new_{i}",
            action_type="webhook",
            signal_data={"test": "new"},
            execution_result=ExecutionResult.SUCCESS,
            retry_count=0,
            duration_ms=100,
        )
        new_entries.append(entry)
        await repo.save(entry)

    # Query with start_time filter
    results = await repo.query_by_channel(channel_id=channel_id, start_time=cutoff_date)

    # Verify only entries after cutoff are returned
    assert len(results) == 3, f"Expected 3 results after cutoff, got {len(results)}"
    for result in results:
        assert (
            result.timestamp >= cutoff_date
        ), f"Result timestamp {result.timestamp} is before cutoff {cutoff_date}"


# Feature: external-actions, Property 14: Audit Log Queryability - Action Type Filter
@settings(max_examples=100)
@given(
    channel_id=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")),
    ),
    target_action_type=st.sampled_from(
        ["medialive_schedule_action", "webhook", "sns_notification"]
    ),
)
@pytest.mark.asyncio
async def test_property_query_by_action_type_filters_correctly(
    channel_id: str, target_action_type: str
):
    """
    Property 14: Audit Log Queryability - Action Type Filter

    For any query with action_type filter, only entries matching
    that action type should be returned.

    Validates: Requirements 7.6
    """
    repo = InMemoryActionAuditRepository()

    action_types = ["medialive_schedule_action", "webhook", "sns_notification"]

    # Create entries for each action type
    entries_by_type = {action_type: [] for action_type in action_types}

    for action_type in action_types:
        for i in range(3):
            entry = ActionAuditEntry(
                entry_id=str(uuid.uuid4()),
                timestamp=datetime.utcnow(),
                channel_id=channel_id,
                rule_id=f"rule_{action_type}_{i}",
                action_id=f"action_{action_type}_{i}",
                action_type=action_type,
                signal_data={"test": action_type},
                execution_result=ExecutionResult.SUCCESS,
                retry_count=0,
                duration_ms=100,
            )
            entries_by_type[action_type].append(entry)
            await repo.save(entry)

    # Query by action type
    results = await repo.query_by_channel(
        channel_id=channel_id, action_type=target_action_type
    )

    # Verify only matching action type returned
    assert (
        len(results) == 3
    ), f"Expected 3 results for {target_action_type}, got {len(results)}"
    for result in results:
        assert (
            result.action_type == target_action_type
        ), f"Result has wrong action_type: {result.action_type}, expected {target_action_type}"


# Feature: external-actions, Property 14: Audit Log Queryability - Combined Filters
@settings(max_examples=100)
@given(
    channel_id=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")),
    ),
    action_type=st.sampled_from(["medialive_schedule_action", "webhook"]),
    days_ago=st.integers(min_value=1, max_value=5),
)
@pytest.mark.asyncio
async def test_property_query_with_multiple_filters_applies_all(
    channel_id: str, action_type: str, days_ago: int
):
    """
    Property 14: Audit Log Queryability - Combined Filters

    For any query with multiple filters (channel_id, time_range, action_type),
    only entries matching ALL filters should be returned.

    Validates: Requirements 7.6
    """
    repo = InMemoryActionAuditRepository()

    now = datetime.utcnow()
    cutoff_date = now - timedelta(days=days_ago)

    # Create matching entry (all filters match)
    matching_entry = ActionAuditEntry(
        entry_id=str(uuid.uuid4()),
        timestamp=cutoff_date + timedelta(hours=1),
        channel_id=channel_id,
        rule_id="matching_rule",
        action_id="matching_action",
        action_type=action_type,
        signal_data={"test": "matching"},
        execution_result=ExecutionResult.SUCCESS,
        retry_count=0,
        duration_ms=100,
    )
    await repo.save(matching_entry)

    # Create non-matching entries
    # Wrong channel
    await repo.save(
        ActionAuditEntry(
            entry_id=str(uuid.uuid4()),
            timestamp=cutoff_date + timedelta(hours=1),
            channel_id=f"other_{channel_id}",
            rule_id="rule1",
            action_id="action1",
            action_type=action_type,
            signal_data={"test": "wrong_channel"},
            execution_result=ExecutionResult.SUCCESS,
            retry_count=0,
            duration_ms=100,
        )
    )

    # Wrong time
    await repo.save(
        ActionAuditEntry(
            entry_id=str(uuid.uuid4()),
            timestamp=cutoff_date - timedelta(hours=1),
            channel_id=channel_id,
            rule_id="rule2",
            action_id="action2",
            action_type=action_type,
            signal_data={"test": "wrong_time"},
            execution_result=ExecutionResult.SUCCESS,
            retry_count=0,
            duration_ms=100,
        )
    )

    # Wrong action type
    other_action_type = (
        "sns_notification" if action_type != "sns_notification" else "webhook"
    )
    await repo.save(
        ActionAuditEntry(
            entry_id=str(uuid.uuid4()),
            timestamp=cutoff_date + timedelta(hours=1),
            channel_id=channel_id,
            rule_id="rule3",
            action_id="action3",
            action_type=other_action_type,
            signal_data={"test": "wrong_type"},
            execution_result=ExecutionResult.SUCCESS,
            retry_count=0,
            duration_ms=100,
        )
    )

    # Query with all filters
    results = await repo.query_by_channel(
        channel_id=channel_id, start_time=cutoff_date, action_type=action_type
    )

    # Verify only matching entry returned
    assert len(results) == 1, f"Expected 1 matching result, got {len(results)}"
    assert results[0].entry_id == matching_entry.entry_id
    assert results[0].channel_id == channel_id
    assert results[0].action_type == action_type
    assert results[0].timestamp >= cutoff_date


# Feature: external-actions, Property 14: Audit Log Queryability - Limit Parameter
@settings(max_examples=100)
@given(
    channel_id=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")),
    ),
    total_entries=st.integers(min_value=5, max_value=20),
    limit=st.integers(min_value=1, max_value=10),
)
@pytest.mark.asyncio
async def test_property_query_respects_limit_parameter(
    channel_id: str, total_entries: int, limit: int
):
    """
    Property 14: Audit Log Queryability - Limit Parameter

    For any query with a limit parameter, at most limit entries
    should be returned, even if more match the filters.

    Validates: Requirements 7.6
    """
    assume(limit < total_entries)  # Only test when limit is less than total

    repo = InMemoryActionAuditRepository()

    # Create entries
    for i in range(total_entries):
        entry = ActionAuditEntry(
            entry_id=str(uuid.uuid4()),
            timestamp=datetime.utcnow() - timedelta(minutes=i),
            channel_id=channel_id,
            rule_id=f"rule_{i}",
            action_id=f"action_{i}",
            action_type="medialive_schedule_action",
            signal_data={"index": i},
            execution_result=ExecutionResult.SUCCESS,
            retry_count=0,
            duration_ms=100,
        )
        await repo.save(entry)

    # Query with limit
    results = await repo.query_by_channel(channel_id=channel_id, limit=limit)

    # Verify limit is respected
    assert (
        len(results) <= limit
    ), f"Expected at most {limit} results, got {len(results)}"
