# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Audit Logger service for External Actions.

This module provides comprehensive audit logging for all action executions,
including payload sanitization to prevent credential exposure.
"""

import uuid
import re
from typing import Dict, Any, Optional
from datetime import datetime
from domain.models.external_actions import (
    ActionAuditEntry,
    ExecutionResult,
    ExternalAction,
    ActionResult,
)
from domain.repositories.action_audit_repository import ActionAuditRepository


class AuditLogger:
    """Service for logging action executions with payload sanitization."""

    # Patterns for detecting sensitive data
    SENSITIVE_PATTERNS = [
        r"password",
        r"secret",
        r"token",
        r"api[_-]?key",
        r"access[_-]?key",
        r"private[_-]?key",
        r"auth",
        r"credential",
        r"bearer",
        r"authorization",
    ]

    def __init__(self, repository: ActionAuditRepository):
        """
        Initialize the audit logger.

        Args:
            repository: Repository for persisting audit logs
        """
        self.repository = repository

    async def log_execution(
        self,
        channel_id: str,
        rule_id: str,
        action: ExternalAction,
        signal_data: Dict[str, Any],
        result: ActionResult,
        retry_count: int = 0,
        duration_ms: int = 0,
    ) -> str:
        """
        Log an action execution with sanitized payloads.

        Args:
            channel_id: The channel ID
            rule_id: The rule ID that triggered the action
            action: The action configuration
            signal_data: The SCTE-35 signal that triggered the action
            result: The execution result
            retry_count: Number of retry attempts
            duration_ms: Execution duration in milliseconds

        Returns:
            The entry ID of the created audit log
        """
        entry_id = str(uuid.uuid4())

        # Determine execution result
        execution_result = (
            ExecutionResult.SUCCESS if result.success else ExecutionResult.FAILURE
        )

        # Sanitize payloads
        sanitized_request = self._sanitize_payload(action.action_config)
        sanitized_response = (
            self._sanitize_payload(result.response_data)
            if result.response_data
            else None
        )

        # Create audit entry
        entry = ActionAuditEntry(
            entry_id=entry_id,
            timestamp=datetime.utcnow(),
            channel_id=channel_id,
            rule_id=rule_id,
            action_id=action.action_id,
            action_type=action.action_type,
            signal_data=signal_data,
            execution_result=execution_result,
            error_message=result.message if not result.success else None,
            request_payload=sanitized_request,
            response_payload=sanitized_response,
            retry_count=retry_count,
            duration_ms=duration_ms,
        )

        # Save to repository
        await self.repository.save(entry)

        return entry_id

    async def log_skipped(
        self,
        channel_id: str,
        rule_id: str,
        action: ExternalAction,
        signal_data: Dict[str, Any],
        skip_reason: str,
    ) -> str:
        """
        Log a skipped action execution.

        Args:
            channel_id: The channel ID
            rule_id: The rule ID
            action: The action configuration
            signal_data: The SCTE-35 signal
            skip_reason: Reason why the action was skipped

        Returns:
            The entry ID of the created audit log
        """
        entry_id = str(uuid.uuid4())

        # Sanitize request payload
        sanitized_request = self._sanitize_payload(action.action_config)

        # Create audit entry
        entry = ActionAuditEntry(
            entry_id=entry_id,
            timestamp=datetime.utcnow(),
            channel_id=channel_id,
            rule_id=rule_id,
            action_id=action.action_id,
            action_type=action.action_type,
            signal_data=signal_data,
            execution_result=ExecutionResult.SKIPPED,
            error_message=skip_reason,
            request_payload=sanitized_request,
            response_payload=None,
            retry_count=0,
            duration_ms=0,
        )

        # Save to repository
        await self.repository.save(entry)

        return entry_id

    def _sanitize_payload(
        self, payload: Optional[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """
        Sanitize a payload by redacting sensitive fields.

        Args:
            payload: The payload to sanitize

        Returns:
            Sanitized payload with sensitive fields redacted
        """
        if payload is None:
            return None

        # Deep copy to avoid modifying original
        sanitized = self._deep_copy_dict(payload)

        # Recursively sanitize
        self._sanitize_dict(sanitized)

        return sanitized

    def _sanitize_dict(self, data: Dict[str, Any]) -> None:
        """
        Recursively sanitize a dictionary in-place.

        Args:
            data: Dictionary to sanitize
        """
        for key, value in data.items():
            # Check if key matches sensitive pattern
            if self._is_sensitive_key(key):
                # If value is a dict, recursively sanitize it instead of redacting the whole thing
                if isinstance(value, dict):
                    self._sanitize_dict(value)
                # If value is a string, redact it
                elif isinstance(value, str) and len(value) > 0:
                    data[key] = self._redact_value(value)
                else:
                    data[key] = "***REDACTED***"
            elif isinstance(value, dict):
                # Recursively sanitize nested dictionaries
                self._sanitize_dict(value)
            elif isinstance(value, list):
                # Sanitize list items
                for i, item in enumerate(value):
                    if isinstance(item, dict):
                        self._sanitize_dict(item)
                    elif isinstance(item, str) and self._looks_like_credential(item):
                        value[i] = self._redact_value(item)

    def _is_sensitive_key(self, key: str) -> bool:
        """
        Check if a key name indicates sensitive data.

        Args:
            key: The key name to check

        Returns:
            True if the key appears to contain sensitive data
        """
        key_lower = key.lower()

        for pattern in self.SENSITIVE_PATTERNS:
            if re.search(pattern, key_lower):
                return True

        return False

    def _looks_like_credential(self, value: str) -> bool:
        """
        Check if a string value looks like a credential.

        Args:
            value: The string value to check

        Returns:
            True if the value appears to be a credential
        """
        # Check for common credential patterns
        # AWS access keys
        if re.match(r"^AKIA[0-9A-Z]{16}$", value):
            return True

        # JWT tokens
        if re.match(r"^eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$", value):
            return True

        # Long base64-like strings (likely tokens)
        if len(value) > 32 and re.match(r"^[A-Za-z0-9+/=_-]+$", value):
            return True

        return False

    def _redact_value(self, value: str) -> str:
        """
        Redact a sensitive value while preserving some context.

        Args:
            value: The value to redact

        Returns:
            Redacted value showing only first/last few characters
        """
        if len(value) <= 8:
            return "***REDACTED***"

        # Show first 4 and last 4 characters
        return f"{value[:4]}...{value[-4:]}"

    def _deep_copy_dict(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a deep copy of a dictionary.

        Args:
            data: Dictionary to copy

        Returns:
            Deep copy of the dictionary
        """
        result = {}

        for key, value in data.items():
            if isinstance(value, dict):
                result[key] = self._deep_copy_dict(value)
            elif isinstance(value, list):
                result[key] = [
                    self._deep_copy_dict(item) if isinstance(item, dict) else item
                    for item in value
                ]
            else:
                result[key] = value

        return result
