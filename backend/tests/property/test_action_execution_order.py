# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Property tests for action execution order.

Feature: external-actions
Property 22: Action Execution Order
Validates: Requirements 10.5, 16.1, 16.3
"""

import pytest
from hypothesis import given, strategies as st, settings
from typing import Dict, Any, Optional, Tuple

from domain.models.external_actions import ExternalAction, ActionResult, TriggerMode
from domain.services.action_executor import ActionExecutor
from domain.services.plugin_registry import PluginRegistry
from domain.services.credential_store import CredentialStore
from domain.services.action_plugin import ActionPlugin
from tests.property.strategies import signal_data_strategy, channel_id_strategy


class MockCredentialStore(CredentialStore):
    """Mock credential store for testing."""

    async def get_credentials(self, credential_id: Optional[str]) -> Dict[str, Any]:
        """Return mock credentials."""
        return {
            "aws_access_key_id": "mock_key",
            "aws_secret_access_key": "mock_secret",
            "token": "mock_token",
        }

    def sanitize_error(self, error_message: str, credentials: Dict[str, Any]) -> str:
        """Sanitize error message."""
        sanitized = error_message
        for key, value in credentials.items():
            if value:
                sanitized = sanitized.replace(str(value), "***")
        return sanitized


class MockActionPlugin(ActionPlugin):
    """Mock plugin that tracks execution order."""

    def __init__(self, action_type: str):
        self._action_type = action_type
        self.execution_order = []

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
        """Record execution and return success."""
        action_id = config.get("action_id", "unknown")
        self.execution_order.append(action_id)
        return ActionResult(
            success=True,
            message=f"Executed {action_id}",
            response_data={"action_id": action_id},
        )

    def supports_cleanup(self) -> bool:
        return False


# Feature: external-actions, Property 22: Action Execution Order
@settings(max_examples=100)
@given(
    num_actions=st.integers(min_value=2, max_value=10),
    signal_data=signal_data_strategy(),
    channel_id=channel_id_strategy(),
)
@pytest.mark.asyncio
async def test_action_execution_order(
    num_actions: int, signal_data: Dict[str, Any], channel_id: str
):
    """
    Property: For any rule with multiple actions, actions should be executed
    in the order specified by their order field.
    """
    # Setup
    registry = PluginRegistry()
    credential_store = MockCredentialStore()
    mock_plugin = MockActionPlugin("test_action")
    registry.register(mock_plugin)
    executor = ActionExecutor(registry, credential_store)

    # Create actions with explicit order
    actions = []
    for i in range(num_actions):
        action = ExternalAction(
            action_id=f"action_{i}",
            action_type="test_action",
            target={"credential_id": None},
            trigger_mode=TriggerMode.ON_MATCH,
            action_config={"action_id": f"action_{i}"},
            order=i,
            enabled=True,
            blocking=True,  # Blocking to ensure sequential execution
        )
        actions.append(action)

    # Execute
    results = await executor.execute_actions(
        actions=actions, signal_data=signal_data, channel_id=channel_id, dry_run=False
    )

    # Property: Actions should execute in order
    assert (
        len(results) == num_actions
    ), f"Expected {num_actions} results, got {len(results)}"

    # Verify execution order from plugin
    assert (
        len(mock_plugin.execution_order) == num_actions
    ), f"Expected {num_actions} executions, got {len(mock_plugin.execution_order)}"

    for i in range(num_actions):
        assert (
            mock_plugin.execution_order[i] == f"action_{i}"
        ), f"Expected action_{i} at position {i}, got {mock_plugin.execution_order[i]}"


# Feature: external-actions, Property 22: Action Execution Order
@settings(max_examples=100)
@given(
    num_actions=st.integers(min_value=2, max_value=10),
    signal_data=signal_data_strategy(),
    channel_id=channel_id_strategy(),
)
@pytest.mark.asyncio
async def test_action_execution_respects_order_field(
    num_actions: int, signal_data: Dict[str, Any], channel_id: str
):
    """
    Property: Actions should be sorted by their order field before execution,
    regardless of the order they appear in the list.
    """
    # Setup
    registry = PluginRegistry()
    credential_store = MockCredentialStore()
    mock_plugin = MockActionPlugin("test_action")
    registry.register(mock_plugin)
    executor = ActionExecutor(registry, credential_store)

    # Create actions with reverse order
    actions = []
    for i in range(num_actions):
        action = ExternalAction(
            action_id=f"action_{i}",
            action_type="test_action",
            target={"credential_id": None},
            trigger_mode=TriggerMode.ON_MATCH,
            action_config={"action_id": f"action_{i}"},
            order=num_actions - i - 1,  # Reverse order
            enabled=True,
            blocking=True,
        )
        actions.append(action)

    # Execute
    results = await executor.execute_actions(
        actions=actions, signal_data=signal_data, channel_id=channel_id, dry_run=False
    )

    # Property: Actions should execute in order field order (not list order)
    assert len(results) == num_actions

    # Verify execution order - should be reverse of list order
    for i in range(num_actions):
        expected_action_id = f"action_{num_actions - i - 1}"
        assert (
            mock_plugin.execution_order[i] == expected_action_id
        ), f"Expected {expected_action_id} at position {i}, got {mock_plugin.execution_order[i]}"
