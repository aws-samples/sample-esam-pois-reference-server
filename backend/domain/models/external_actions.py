# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Data models for External Actions feature.

This module defines the core data structures for the external actions system,
including action configurations, results, and state management.
"""

from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List
from datetime import datetime
from enum import Enum


class TriggerMode(str, Enum):
    """Defines when an action should be triggered."""

    ON_MATCH = "on_match"
    ON_NO_MATCH = "on_no_match"
    ALWAYS = "always"


class ExecutionResult(str, Enum):
    """Result status of action execution."""

    SUCCESS = "success"
    FAILURE = "failure"
    SKIPPED = "skipped"


@dataclass
class ActionResult:
    """Result of an action execution."""

    success: bool
    message: str
    response_data: Optional[Dict[str, Any]] = None
    error: Optional[Exception] = None
    retry_after_seconds: Optional[int] = None


@dataclass
class ExternalAction:
    """Configuration for an external action."""

    action_id: str
    action_type: str  # Plugin identifier
    target: Dict[str, Any]  # Target service configuration
    trigger_mode: TriggerMode
    action_config: Dict[str, Any]  # Action-specific configuration
    cleanup_config: Optional[Dict[str, Any]] = None
    retry_config: Optional[Dict[str, Any]] = None
    timeout_ms: int = 5000
    enabled: bool = True
    conditions: Optional[List[Dict[str, Any]]] = None
    order: int = 0
    blocking: bool = False
    order: int = 0
    blocking: bool = False

    def __post_init__(self):
        """Initialize default retry configuration if not provided."""
        if self.retry_config is None:
            self.retry_config = {"max_retries": 3, "base_delay_seconds": 1}

        # Convert string to enum if needed
        if isinstance(self.trigger_mode, str):
            self.trigger_mode = TriggerMode(self.trigger_mode)


@dataclass
class ActionState:
    """Runtime state for active actions requiring cleanup."""

    state_id: str
    channel_id: str
    action_id: str
    action_type: str
    trigger_signal: Dict[str, Any]
    cleanup_config: Dict[str, Any]
    created_at: datetime
    expires_at: Optional[datetime] = None


@dataclass
class ActionAuditEntry:
    """Audit log entry for action execution."""

    entry_id: str
    timestamp: datetime
    channel_id: str
    rule_id: str
    action_id: str
    action_type: str
    signal_data: Dict[str, Any]
    execution_result: ExecutionResult
    error_message: Optional[str] = None
    request_payload: Optional[Dict[str, Any]] = None
    response_payload: Optional[Dict[str, Any]] = None
    retry_count: int = 0
    duration_ms: int = 0

    def __post_init__(self):
        """Convert string to enum if needed."""
        if isinstance(self.execution_result, str):
            self.execution_result = ExecutionResult(self.execution_result)


@dataclass
class ActionTemplate:
    """Template for common action configurations."""

    template_id: str
    name: str
    description: str
    action_type: str
    default_config: Dict[str, Any]
    category: str  # e.g., "logo_insertion", "input_switching", "motion_graphics"
    editable_fields: List[str] = field(default_factory=list)
