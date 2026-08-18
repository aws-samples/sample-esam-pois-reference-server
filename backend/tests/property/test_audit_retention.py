# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Property-based tests for audit log retention.

Feature: external-actions
Property 15: Audit Log Retention
"""

import pytest
from hypothesis import given, strategies as st, settings
from datetime import datetime, timedelta
from domain.models.external_actions import ActionAuditEntry, ExecutionResult
from domain.repositories.action_audit_repository import InMemoryActionAuditRepository
from domain.services.audit_retention_service import AuditRetentionService
import uuid


# Strategies
@st.composite
def audit_entry_strategy(draw, timestamp: datetime = None):
    """Generate random audit log entries."""
    if timestamp is None:
        # Generate timestamp within last 60 days
        days_ago = draw(st.integers(min_value=0, max_value=60))
        timestamp = datetime.utcnow() - timedelta(days=days_ago)

    return ActionAuditEntry(
        entry_id=str(uuid.uuid4()),
        timestamp=timestamp,
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
            st.sampled_from(["medialive_schedule_action", "webhook", "sns"])
        ),
        signal_data={"pts": draw(st.integers(min_value=0, max_value=1000000))},
        execution_result=draw(st.sampled_from(list(ExecutionResult))),
        error_message=draw(st.one_of(st.none(), st.text(min_size=1, max_size=100))),
        retry_count=draw(st.integers(min_value=0, max_value=5)),
        duration_ms=draw(st.integers(min_value=0, max_value=10000)),
    )


# Feature: external-actions, Property 15: Audit Log Retention
@settings(max_examples=100, deadline=None)
@given(
    retention_days=st.integers(min_value=1, max_value=90),
    num_old_entries=st.integers(min_value=0, max_value=20),
    num_recent_entries=st.integers(min_value=0, max_value=20),
)
@pytest.mark.asyncio
async def test_audit_log_retention_deletes_old_entries(
    retention_days: int, num_old_entries: int, num_recent_entries: int
):
    """
    Property 15: Audit Log Retention

    For any audit log entry older than the configured retention period,
    the entry should be automatically deleted or archived.

    This test verifies that:
    1. Entries older than retention period are deleted
    2. Entries within retention period are preserved
    3. The correct count of deleted entries is returned
    """
    # Arrange
    repository = InMemoryActionAuditRepository()
    service = AuditRetentionService(repository, retention_days=retention_days)

    # Create old entries (before cutoff)
    old_entry_ids = []
    for _ in range(num_old_entries):
        # Create entry older than retention period
        days_before_cutoff = retention_days + 1 + (_ % 10)
        old_timestamp = datetime.utcnow() - timedelta(days=days_before_cutoff)
        entry = ActionAuditEntry(
            entry_id=str(uuid.uuid4()),
            timestamp=old_timestamp,
            channel_id=f"channel_{_}",
            rule_id=f"rule_{_}",
            action_id=f"action_{_}",
            action_type="medialive_schedule_action",
            signal_data={"pts": 1000},
            execution_result=ExecutionResult.SUCCESS,
            retry_count=0,
            duration_ms=100,
        )
        await repository.save(entry)
        old_entry_ids.append(entry.entry_id)

    # Create recent entries (after cutoff)
    recent_entry_ids = []
    for _ in range(num_recent_entries):
        # Create entry within retention period
        days_within_retention = _ % retention_days if retention_days > 0 else 0
        recent_timestamp = datetime.utcnow() - timedelta(days=days_within_retention)
        entry = ActionAuditEntry(
            entry_id=str(uuid.uuid4()),
            timestamp=recent_timestamp,
            channel_id=f"channel_recent_{_}",
            rule_id=f"rule_recent_{_}",
            action_id=f"action_recent_{_}",
            action_type="webhook",
            signal_data={"pts": 2000},
            execution_result=ExecutionResult.SUCCESS,
            retry_count=0,
            duration_ms=200,
        )
        await repository.save(entry)
        recent_entry_ids.append(entry.entry_id)

    # Act
    deleted_count = await service.cleanup_old_logs()

    # Assert
    # 1. Correct number of entries deleted
    assert (
        deleted_count == num_old_entries
    ), f"Expected {num_old_entries} entries deleted, got {deleted_count}"

    # 2. Old entries should be deleted
    for entry_id in old_entry_ids:
        entry = await repository.get_by_id(entry_id)
        assert (
            entry is None
        ), f"Old entry {entry_id} should have been deleted but still exists"

    # 3. Recent entries should be preserved
    for entry_id in recent_entry_ids:
        entry = await repository.get_by_id(entry_id)
        assert (
            entry is not None
        ), f"Recent entry {entry_id} should be preserved but was deleted"


@settings(max_examples=100, deadline=None)
@given(
    initial_retention=st.integers(min_value=7, max_value=90),
    new_retention=st.integers(min_value=1, max_value=90),
)
@pytest.mark.asyncio
async def test_retention_period_update(initial_retention: int, new_retention: int):
    """
    Test that retention period can be updated dynamically.

    Verifies that:
    1. Retention period can be changed
    2. New retention period is applied to subsequent cleanups
    """
    # Arrange
    repository = InMemoryActionAuditRepository()
    service = AuditRetentionService(repository, retention_days=initial_retention)

    # Act
    service.set_retention_days(new_retention)

    # Assert
    assert service.retention_days == new_retention

    # Verify cutoff date reflects new retention
    expected_cutoff = datetime.utcnow() - timedelta(days=new_retention)
    actual_cutoff = service.get_retention_cutoff_date()

    # Allow 1 second tolerance for test execution time
    time_diff = abs((expected_cutoff - actual_cutoff).total_seconds())
    assert time_diff < 1, "Cutoff date should reflect new retention period"


@settings(max_examples=50, deadline=None)
@given(
    retention_days=st.integers(min_value=1, max_value=30),
    entries=st.lists(audit_entry_strategy(), min_size=0, max_size=50),
)
@pytest.mark.asyncio
async def test_retention_with_random_entries(retention_days: int, entries: list):
    """
    Test retention with randomly generated audit entries.

    Verifies that cleanup correctly identifies and deletes old entries
    regardless of their other attributes.
    """
    # Arrange
    repository = InMemoryActionAuditRepository()
    service = AuditRetentionService(repository, retention_days=retention_days)

    # Save all entries
    for entry in entries:
        await repository.save(entry)

    # Calculate expected deletions
    cutoff_date = service.get_retention_cutoff_date()
    expected_deletions = sum(1 for e in entries if e.timestamp < cutoff_date)
    expected_preserved = len(entries) - expected_deletions

    # Act
    deleted_count = await service.cleanup_old_logs()

    # Assert
    assert (
        deleted_count == expected_deletions
    ), f"Expected {expected_deletions} deletions, got {deleted_count}"

    # Verify preserved entries
    preserved_count = 0
    for entry in entries:
        retrieved = await repository.get_by_id(entry.entry_id)
        if entry.timestamp >= cutoff_date:
            assert retrieved is not None, f"Entry {entry.entry_id} should be preserved"
            preserved_count += 1
        else:
            assert retrieved is None, f"Entry {entry.entry_id} should be deleted"

    assert (
        preserved_count == expected_preserved
    ), f"Expected {expected_preserved} preserved entries, got {preserved_count}"


@pytest.mark.asyncio
async def test_retention_with_invalid_days():
    """Test that invalid retention days are rejected."""
    repository = InMemoryActionAuditRepository()
    service = AuditRetentionService(repository, retention_days=30)

    with pytest.raises(ValueError, match="Retention days must be at least 1"):
        service.set_retention_days(0)

    with pytest.raises(ValueError, match="Retention days must be at least 1"):
        service.set_retention_days(-5)


@settings(max_examples=50, deadline=None)
@given(retention_days=st.integers(min_value=1, max_value=90))
@pytest.mark.asyncio
async def test_cleanup_empty_repository(retention_days: int):
    """
    Test that cleanup on empty repository returns 0 deletions.
    """
    # Arrange
    repository = InMemoryActionAuditRepository()
    service = AuditRetentionService(repository, retention_days=retention_days)

    # Act
    deleted_count = await service.cleanup_old_logs()

    # Assert
    assert deleted_count == 0, "Cleanup on empty repository should delete 0 entries"


@settings(max_examples=50, deadline=None)
@given(
    retention_days=st.integers(min_value=1, max_value=30),
    num_entries=st.integers(min_value=1, max_value=20),
)
@pytest.mark.asyncio
async def test_multiple_cleanup_runs_idempotent(retention_days: int, num_entries: int):
    """
    Test that multiple cleanup runs are idempotent.

    Running cleanup multiple times should not delete additional entries
    if no new old entries have been added.
    """
    # Arrange
    repository = InMemoryActionAuditRepository()
    service = AuditRetentionService(repository, retention_days=retention_days)

    # Create old entries
    for i in range(num_entries):
        old_timestamp = datetime.utcnow() - timedelta(days=retention_days + 1)
        entry = ActionAuditEntry(
            entry_id=str(uuid.uuid4()),
            timestamp=old_timestamp,
            channel_id=f"channel_{i}",
            rule_id=f"rule_{i}",
            action_id=f"action_{i}",
            action_type="medialive_schedule_action",
            signal_data={"pts": 1000},
            execution_result=ExecutionResult.SUCCESS,
            retry_count=0,
            duration_ms=100,
        )
        await repository.save(entry)

    # Act - First cleanup
    first_deleted = await service.cleanup_old_logs()

    # Act - Second cleanup (should delete nothing)
    second_deleted = await service.cleanup_old_logs()

    # Assert
    assert (
        first_deleted == num_entries
    ), f"First cleanup should delete {num_entries} entries"
    assert second_deleted == 0, "Second cleanup should delete 0 entries (idempotent)"
