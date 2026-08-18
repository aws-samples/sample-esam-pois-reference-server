# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Property tests for blocking action behavior.

Feature: external-actions
Property 23: Non-Blocking Concurrent Execution
Property 24: Blocking Failure Cascade
Validates: Requirements 16.4, 16.5
"""

import pytest
from hypothesis import given, strategies as st, settings
from typing import Dict, Any, Optional, Tuple
import asyncio

from domain.models.external_actions import ExternalAction, ActionResult, TriggerMode
from domain.services.action_executor import ActionExecutor
from domain.services.plugin_registry import PluginRegistry
from domain.services.credential_store import CredentialStore
from domain.services.action_plugin import ActionPlugin
from tests.property.strategies import signal_data_strategy, channel_id_strategy


class MockCredentialStore(CredentialStore):
    """Mock credential store for testing."""

    async def get_credentials(self, credential_id: Optional[str]) -> Dict[str, Any]:
        return {"mock": "credentials"}

    def sanitize_error(self, error_message: str, credentials: Dict[str, Any]) -> str:
        return error_message


class FailingActionPlugin(ActionPlugin):
    """Mock plugin that always fails."""

    @property
    def action_type(self) -> str:
        return "failing_action"

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
        """Always fail."""
        return ActionResult(
            success=False,
            message="Intentional failure",
            response_data={"action_id": config.get("action_id")},
        )

    def supports_cleanup(self) -> bool:
        return False


class SuccessActionPlugin(ActionPlugin):
    """Mock plugin that always succeeds."""

    def __init__(self):
        self.executed_actions = []

    @property
    def action_type(self) -> str:
        return "success_action"

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
        """Always succeed."""
        action_id = config.get("action_id", "unknown")
        self.executed_actions.append(action_id)
        return ActionResult(
            success=True, message="Success", response_data={"action_id": action_id}
        )

    def supports_cleanup(self) -> bool:
        return False


# Feature: external-actions, Property 24: Blocking Failure Cascade
@settings(max_examples=100)
@given(
    num_actions_after_failure=st.integers(min_value=1, max_value=5),
    signal_data=signal_data_strategy(),
    channel_id=channel_id_strategy(),
)
@pytest.mark.asyncio
async def test_blocking_failure_cascade(
    num_actions_after_failure: int, signal_data: Dict[str, Any], channel_id: str
):
    """
    Property: For any blocking action that fails, all subsequent actions
    in the sequence should be skipped.
    """
    # Setup
    registry = PluginRegistry()
    credential_store = MockCredentialStore()
    failing_plugin = FailingActionPlugin()
    success_plugin = SuccessActionPlugin()
    registry.register(failing_plugin)
    registry.register(success_plugin)
    executor = ActionExecutor(registry, credential_store)

    # Create actions: one failing blocking action followed by success actions
    actions = []

    # First action: blocking and fails. Retries are disabled so each
    # Hypothesis example runs fast - the property under test is the failure
    # cascade, not the retry/backoff behavior.
    actions.append(
        ExternalAction(
            action_id="failing_action",
            action_type="failing_action",
            target={"credential_id": None},
            trigger_mode=TriggerMode.ON_MATCH,
            action_config={"action_id": "failing_action"},
            retry_config={"max_retries": 0},
            order=0,
            enabled=True,
            blocking=True,
        )
    )

    # Subsequent actions: should be skipped
    for i in range(num_actions_after_failure):
        actions.append(
            ExternalAction(
                action_id=f"success_action_{i}",
                action_type="success_action",
                target={"credential_id": None},
                trigger_mode=TriggerMode.ON_MATCH,
                action_config={"action_id": f"success_action_{i}"},
                order=i + 1,
                enabled=True,
                blocking=False,
            )
        )

    # Execute
    results = await executor.execute_actions(
        actions=actions, signal_data=signal_data, channel_id=channel_id, dry_run=False
    )

    # Property: Only the failing action should have executed
    assert (
        len(results) == 1
    ), f"Expected 1 result (failing action only), got {len(results)}"

    assert not results[0].success, "First result should be a failure"

    # Property: Subsequent actions should not have executed
    assert (
        len(success_plugin.executed_actions) == 0
    ), f"Expected 0 subsequent actions to execute, got {len(success_plugin.executed_actions)}"


# Feature: external-actions, Property 23: Non-Blocking Concurrent Execution
@settings(max_examples=50)  # Reduced due to async complexity
@given(
    num_actions=st.integers(min_value=2, max_value=5),
    signal_data=signal_data_strategy(),
    channel_id=channel_id_strategy(),
)
@pytest.mark.asyncio
async def test_non_blocking_concurrent_execution(
    num_actions: int, signal_data: Dict[str, Any], channel_id: str
):
    """
    Property: For any action marked as non-blocking, subsequent actions
    should begin execution without waiting for completion.

    Note: This is difficult to test deterministically, so we verify that
    non-blocking actions don't prevent subsequent actions from executing.
    """
    # Setup
    registry = PluginRegistry()
    credential_store = MockCredentialStore()
    success_plugin = SuccessActionPlugin()
    registry.register(success_plugin)
    executor = ActionExecutor(registry, credential_store)

    # Create non-blocking actions
    actions = []
    for i in range(num_actions):
        actions.append(
            ExternalAction(
                action_id=f"action_{i}",
                action_type="success_action",
                target={"credential_id": None},
                trigger_mode=TriggerMode.ON_MATCH,
                action_config={"action_id": f"action_{i}"},
                order=i,
                enabled=True,
                blocking=False,  # Non-blocking
            )
        )

    # Execute
    # Results are not inspected here: non-blocking actions may still be
    # running; the assertion below waits on the plugin's side effects instead.
    await executor.execute_actions(
        actions=actions, signal_data=signal_data, channel_id=channel_id, dry_run=False
    )

    # Give background tasks time to complete
    await asyncio.sleep(0.1)

    # Property: All actions should eventually execute (non-blocking doesn't skip)
    # Note: Results list may not contain all results immediately due to async execution
    assert (
        len(success_plugin.executed_actions) == num_actions
    ), f"Expected {num_actions} actions to execute, got {len(success_plugin.executed_actions)}"
