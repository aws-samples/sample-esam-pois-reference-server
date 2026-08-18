# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Unit tests for AuditLogger service."""

import pytest

from domain.models.external_actions import (
    ExternalAction,
    ActionResult,
    TriggerMode,
    ExecutionResult,
)
from domain.services.audit_logger import AuditLogger
from domain.repositories.action_audit_repository import InMemoryActionAuditRepository


@pytest.mark.asyncio
async def test_log_execution_creates_audit_entry():
    """Test that log_execution creates an audit entry."""
    repo = InMemoryActionAuditRepository()
    logger = AuditLogger(repo)

    action = ExternalAction(
        action_id="test_action",
        action_type="webhook",
        target={"url": "https://example.com"},
        trigger_mode=TriggerMode.ON_MATCH,
        action_config={"method": "POST"},
    )

    result = ActionResult(
        success=True, message="Success", response_data={"status": "ok"}
    )

    entry_id = await logger.log_execution(
        channel_id="channel1",
        rule_id="rule1",
        action=action,
        signal_data={"pts": 12345},
        result=result,
        retry_count=0,
        duration_ms=100,
    )

    # Verify entry was created
    entry = await repo.get_by_id(entry_id)
    assert entry is not None
    assert entry.channel_id == "channel1"
    assert entry.rule_id == "rule1"
    assert entry.action_id == "test_action"
    assert entry.execution_result == ExecutionResult.SUCCESS


@pytest.mark.asyncio
async def test_log_execution_sanitizes_sensitive_fields():
    """Test that sensitive fields are redacted in audit logs."""
    repo = InMemoryActionAuditRepository()
    logger = AuditLogger(repo)

    action = ExternalAction(
        action_id="test_action",
        action_type="webhook",
        target={"url": "https://example.com"},
        trigger_mode=TriggerMode.ON_MATCH,
        action_config={
            "method": "POST",
            "api_key": "secret_key_12345678",
            "password": "my_password",
            "bearer_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature",
        },
    )

    result = ActionResult(
        success=True,
        message="Success",
        response_data={"status": "ok", "access_token": "AKIAIOSFODNN7EXAMPLE"},
    )

    entry_id = await logger.log_execution(
        channel_id="channel1",
        rule_id="rule1",
        action=action,
        signal_data={"pts": 12345},
        result=result,
    )

    # Verify sensitive fields are redacted
    entry = await repo.get_by_id(entry_id)
    assert entry.request_payload["api_key"] != "secret_key_12345678"
    assert (
        "***REDACTED***" in entry.request_payload["api_key"]
        or "..." in entry.request_payload["api_key"]
    )
    assert entry.request_payload["password"] != "my_password"
    assert (
        entry.request_payload["bearer_token"]
        != "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature"
    )

    # Response should also be sanitized
    assert entry.response_payload["access_token"] != "AKIAIOSFODNN7EXAMPLE"


@pytest.mark.asyncio
async def test_log_execution_preserves_non_sensitive_fields():
    """Test that non-sensitive fields are not redacted."""
    repo = InMemoryActionAuditRepository()
    logger = AuditLogger(repo)

    action = ExternalAction(
        action_id="test_action",
        action_type="webhook",
        target={"url": "https://example.com"},
        trigger_mode=TriggerMode.ON_MATCH,
        action_config={
            "method": "POST",
            "url": "https://api.example.com/webhook",
            "timeout": 5000,
        },
    )

    result = ActionResult(
        success=True,
        message="Success",
        response_data={"status": "ok", "message": "Processed"},
    )

    entry_id = await logger.log_execution(
        channel_id="channel1",
        rule_id="rule1",
        action=action,
        signal_data={"pts": 12345},
        result=result,
    )

    # Verify non-sensitive fields are preserved
    entry = await repo.get_by_id(entry_id)
    assert entry.request_payload["method"] == "POST"
    assert entry.request_payload["url"] == "https://api.example.com/webhook"
    assert entry.request_payload["timeout"] == 5000
    assert entry.response_payload["status"] == "ok"
    assert entry.response_payload["message"] == "Processed"


@pytest.mark.asyncio
async def test_log_skipped_creates_skipped_entry():
    """Test that log_skipped creates an entry with SKIPPED status."""
    repo = InMemoryActionAuditRepository()
    logger = AuditLogger(repo)

    action = ExternalAction(
        action_id="test_action",
        action_type="webhook",
        target={"url": "https://example.com"},
        trigger_mode=TriggerMode.ON_MATCH,
        action_config={"method": "POST"},
    )

    entry_id = await logger.log_skipped(
        channel_id="channel1",
        rule_id="rule1",
        action=action,
        signal_data={"pts": 12345},
        skip_reason="Condition not met",
    )

    # Verify entry was created with SKIPPED status
    entry = await repo.get_by_id(entry_id)
    assert entry is not None
    assert entry.execution_result == ExecutionResult.SKIPPED
    assert entry.error_message == "Condition not met"
    assert entry.retry_count == 0
    assert entry.duration_ms == 0


@pytest.mark.asyncio
async def test_log_execution_handles_nested_sensitive_data():
    """Test that nested sensitive data is sanitized."""
    repo = InMemoryActionAuditRepository()
    logger = AuditLogger(repo)

    action = ExternalAction(
        action_id="test_action",
        action_type="webhook",
        target={"url": "https://example.com"},
        trigger_mode=TriggerMode.ON_MATCH,
        action_config={
            "method": "POST",
            "auth": {
                "type": "bearer",
                "token": "secret_token_value",
                "credentials": {"username": "user", "password": "pass123"},
            },
        },
    )

    result = ActionResult(success=True, message="Success")

    entry_id = await logger.log_execution(
        channel_id="channel1",
        rule_id="rule1",
        action=action,
        signal_data={"pts": 12345},
        result=result,
    )

    # Verify nested sensitive fields are redacted
    entry = await repo.get_by_id(entry_id)
    assert entry.request_payload["auth"]["token"] != "secret_token_value"
    assert entry.request_payload["auth"]["credentials"]["password"] != "pass123"
    # Non-sensitive nested fields should be preserved
    assert entry.request_payload["auth"]["type"] == "bearer"
    assert entry.request_payload["auth"]["credentials"]["username"] == "user"


@pytest.mark.asyncio
async def test_log_execution_records_failure_with_error():
    """Test that failed executions are logged with error message."""
    repo = InMemoryActionAuditRepository()
    logger = AuditLogger(repo)

    action = ExternalAction(
        action_id="test_action",
        action_type="webhook",
        target={"url": "https://example.com"},
        trigger_mode=TriggerMode.ON_MATCH,
        action_config={"method": "POST"},
    )

    result = ActionResult(
        success=False,
        message="Connection timeout",
        error=Exception("Timeout after 5 seconds"),
    )

    entry_id = await logger.log_execution(
        channel_id="channel1",
        rule_id="rule1",
        action=action,
        signal_data={"pts": 12345},
        result=result,
        retry_count=3,
    )

    # Verify failure is logged
    entry = await repo.get_by_id(entry_id)
    assert entry.execution_result == ExecutionResult.FAILURE
    assert entry.error_message == "Connection timeout"
    assert entry.retry_count == 3


@pytest.mark.asyncio
async def test_sanitize_aws_access_keys():
    """Test that AWS access keys are detected and redacted."""
    repo = InMemoryActionAuditRepository()
    logger = AuditLogger(repo)

    action = ExternalAction(
        action_id="test_action",
        action_type="medialive",
        target={"channel_id": "12345"},
        trigger_mode=TriggerMode.ON_MATCH,
        action_config={
            "credentials": {
                "aws_access_key_id": "AKIAIOSFODNN7EXAMPLE",
                "aws_secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            }
        },
    )

    result = ActionResult(success=True, message="Success")

    entry_id = await logger.log_execution(
        channel_id="channel1",
        rule_id="rule1",
        action=action,
        signal_data={"pts": 12345},
        result=result,
    )

    # Verify AWS keys are redacted
    entry = await repo.get_by_id(entry_id)
    creds = entry.request_payload["credentials"]
    assert creds["aws_access_key_id"] != "AKIAIOSFODNN7EXAMPLE"
    assert creds["aws_secret_access_key"] != "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
