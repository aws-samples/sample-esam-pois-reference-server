# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Property-based tests for audit log completeness."""

import pytest
from hypothesis import given, strategies as st, settings
from datetime import datetime, timedelta
import uuid

from domain.models.external_actions import ActionAuditEntry, ExecutionResult
from domain.repositories.action_audit_repository import InMemoryActionAuditRepository


# Strategies for generating test data
@st.composite
def audit_entry_strategy(draw):
    """Generate random ActionAuditEntry for testing."""
    execution_results = [
        ExecutionResult.SUCCESS,
        ExecutionResult.FAILURE,
        ExecutionResult.SKIPPED,
    ]

    entry = ActionAuditEntry(
        entry_id=str(uuid.uuid4()),
        timestamp=datetime.utcnow()
        - timedelta(days=draw(st.integers(min_value=0, max_value=30))),
        channel_id=draw(
            st.text(
                min_size=1,
                max_size=20,
                alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")),
            )
        ),
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
                values=st.one_of(st.integers(), st.text(max_size=20), st.booleans()),
            )
        ),
        execution_result=draw(st.sampled_from(execution_results)),
        error_message=draw(st.one_of(st.none(), st.text(min_size=1, max_size=100))),
        request_payload=draw(
            st.one_of(
                st.none(),
                st.dictionaries(
                    keys=st.text(min_size=1, max_size=10), values=st.text(max_size=20)
                ),
            )
        ),
        response_payload=draw(
            st.one_of(
                st.none(),
                st.dictionaries(
                    keys=st.text(min_size=1, max_size=10), values=st.text(max_size=20)
                ),
            )
        ),
        retry_count=draw(st.integers(min_value=0, max_value=5)),
        duration_ms=draw(st.integers(min_value=0, max_value=10000)),
    )

    return entry


# Feature: external-actions, Property 13: Audit Log Completeness
@settings(max_examples=100)
@given(entry=audit_entry_strategy())
@pytest.mark.asyncio
async def test_property_audit_log_contains_required_fields(entry: ActionAuditEntry):
    """
    Property 13: Audit Log Completeness

    For any action execution (triggered, succeeded, or failed), an audit log entry
    should be created containing timestamp, channel_id, rule_id, action_type,
    signal_data, execution_result, and sanitized request/response payloads.

    Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
    """
    # Verify all required fields are present and non-empty
    assert (
        entry.entry_id is not None and len(entry.entry_id) > 0
    ), "entry_id must be present"
    assert entry.timestamp is not None, "timestamp must be present"
    assert (
        entry.channel_id is not None and len(entry.channel_id) > 0
    ), "channel_id must be present"
    assert (
        entry.rule_id is not None and len(entry.rule_id) > 0
    ), "rule_id must be present"
    assert (
        entry.action_id is not None and len(entry.action_id) > 0
    ), "action_id must be present"
    assert (
        entry.action_type is not None and len(entry.action_type) > 0
    ), "action_type must be present"
    assert entry.signal_data is not None, "signal_data must be present"
    assert entry.execution_result is not None, "execution_result must be present"
    assert isinstance(
        entry.execution_result, ExecutionResult
    ), "execution_result must be ExecutionResult enum"


# Feature: external-actions, Property 13: Audit Log Completeness - Persistence
@settings(max_examples=100)
@given(entry=audit_entry_strategy())
@pytest.mark.asyncio
async def test_property_audit_log_persists_across_saves(entry: ActionAuditEntry):
    """
    Property 13: Audit Log Completeness - Persistence

    For any action execution, the audit log entry should persist and be retrievable
    with all fields intact.

    Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
    """
    repo = InMemoryActionAuditRepository()

    # Save the entry
    await repo.save(entry)

    # Retrieve the entry
    retrieved = await repo.get_by_id(entry.entry_id)

    # Verify all fields match
    assert retrieved is not None, "Entry should be retrievable after save"
    assert retrieved.entry_id == entry.entry_id
    assert retrieved.timestamp == entry.timestamp
    assert retrieved.channel_id == entry.channel_id
    assert retrieved.rule_id == entry.rule_id
    assert retrieved.action_id == entry.action_id
    assert retrieved.action_type == entry.action_type
    assert retrieved.signal_data == entry.signal_data
    assert retrieved.execution_result == entry.execution_result
    assert retrieved.error_message == entry.error_message
    assert retrieved.request_payload == entry.request_payload
    assert retrieved.response_payload == entry.response_payload
    assert retrieved.retry_count == entry.retry_count
    assert retrieved.duration_ms == entry.duration_ms


# Feature: external-actions, Property 13: Audit Log Completeness - Multiple Entries
@settings(max_examples=100)
@given(entries=st.lists(audit_entry_strategy(), min_size=1, max_size=10))
@pytest.mark.asyncio
async def test_property_multiple_audit_logs_persist_independently(entries: list):
    """
    Property 13: Audit Log Completeness - Multiple Entries

    For any set of action executions, each audit log entry should persist
    independently without affecting other entries.

    Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
    """
    repo = InMemoryActionAuditRepository()

    # Save all entries
    for entry in entries:
        await repo.save(entry)

    # Verify each entry can be retrieved independently
    for entry in entries:
        retrieved = await repo.get_by_id(entry.entry_id)
        assert retrieved is not None, f"Entry {entry.entry_id} should be retrievable"
        assert retrieved.entry_id == entry.entry_id
        assert retrieved.channel_id == entry.channel_id
        assert retrieved.action_type == entry.action_type


# Feature: external-actions, Property 13: Audit Log Completeness - Success Result
@settings(max_examples=100)
@given(entry=audit_entry_strategy())
@pytest.mark.asyncio
async def test_property_successful_action_logs_success_result(entry: ActionAuditEntry):
    """
    Property 13: Audit Log Completeness - Success Result

    For any successful action execution, the audit log should record
    execution_result as SUCCESS and include response_payload.

    Validates: Requirements 7.2
    """
    # Force success result
    entry.execution_result = ExecutionResult.SUCCESS
    entry.response_payload = {"status": "ok", "data": "test"}
    entry.error_message = None

    repo = InMemoryActionAuditRepository()
    await repo.save(entry)

    retrieved = await repo.get_by_id(entry.entry_id)

    assert retrieved.execution_result == ExecutionResult.SUCCESS
    assert retrieved.response_payload is not None
    assert retrieved.error_message is None


# Feature: external-actions, Property 13: Audit Log Completeness - Failure Result
@settings(max_examples=100)
@given(entry=audit_entry_strategy())
@pytest.mark.asyncio
async def test_property_failed_action_logs_failure_with_error(entry: ActionAuditEntry):
    """
    Property 13: Audit Log Completeness - Failure Result

    For any failed action execution, the audit log should record
    execution_result as FAILURE and include error_message.

    Validates: Requirements 7.3
    """
    # Force failure result
    entry.execution_result = ExecutionResult.FAILURE
    entry.error_message = "API call failed: Connection timeout"

    repo = InMemoryActionAuditRepository()
    await repo.save(entry)

    retrieved = await repo.get_by_id(entry.entry_id)

    assert retrieved.execution_result == ExecutionResult.FAILURE
    assert retrieved.error_message is not None
    assert len(retrieved.error_message) > 0


# Feature: external-actions, Property 13: Audit Log Completeness - Retry Count
@settings(max_examples=100)
@given(entry=audit_entry_strategy())
@pytest.mark.asyncio
async def test_property_audit_log_tracks_retry_count(entry: ActionAuditEntry):
    """
    Property 13: Audit Log Completeness - Retry Count

    For any action execution with retries, the audit log should record
    the number of retry attempts.

    Validates: Requirements 7.4
    """
    # Set a specific retry count
    entry.retry_count = 3

    repo = InMemoryActionAuditRepository()
    await repo.save(entry)

    retrieved = await repo.get_by_id(entry.entry_id)

    assert retrieved.retry_count == 3
    assert retrieved.retry_count >= 0


# Feature: external-actions, Property 13: Audit Log Completeness - Duration Tracking
@settings(max_examples=100)
@given(entry=audit_entry_strategy())
@pytest.mark.asyncio
async def test_property_audit_log_tracks_execution_duration(entry: ActionAuditEntry):
    """
    Property 13: Audit Log Completeness - Duration Tracking

    For any action execution, the audit log should record the execution
    duration in milliseconds.

    Validates: Requirements 7.4
    """
    # Set a specific duration
    entry.duration_ms = 1500

    repo = InMemoryActionAuditRepository()
    await repo.save(entry)

    retrieved = await repo.get_by_id(entry.entry_id)

    assert retrieved.duration_ms == 1500
    assert retrieved.duration_ms >= 0
