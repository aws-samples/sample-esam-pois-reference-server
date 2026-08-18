# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Property-based tests for idempotency handling.

Feature: external-actions
Property 28: Idempotency Key Generation
Property 29: Idempotency Deduplication
Property 30: Cleanup Idempotency Exemption
"""

import pytest
from hypothesis import given, strategies as st, settings
from domain.services.action_plugin import ActionPlugin
from domain.services.plugin_registry import PluginRegistry
from domain.services.action_executor import ActionExecutor
from domain.services.credential_store import InMemoryCredentialStore
from domain.models.external_actions import ExternalAction, ActionResult, TriggerMode
from typing import Dict, Any, Optional, Tuple
import uuid


# Mock plugin for testing
class MockActionPlugin(ActionPlugin):
    """Mock plugin for testing idempotency."""

    def __init__(self, action_type: str = "mock_action"):
        self._action_type = action_type
        self.execution_count = 0

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
        self.execution_count += 1
        return ActionResult(
            success=True, message=f"Executed (count: {self.execution_count})"
        )

    def supports_cleanup(self) -> bool:
        return False


# Strategies
@st.composite
def action_config_strategy(draw):
    """Generate random action configurations."""
    return {
        "param1": draw(st.text(min_size=1, max_size=20)),
        "param2": draw(st.integers(min_value=0, max_value=1000)),
        "idempotency_window_seconds": draw(st.integers(min_value=1, max_value=300)),
    }


@st.composite
def signal_data_strategy(draw):
    """Generate random signal data."""
    return {
        "pts": draw(st.integers(min_value=0, max_value=1000000)),
        "segmentation_type_id": draw(st.integers(min_value=0, max_value=255)),
        "duration": draw(st.integers(min_value=0, max_value=10000)),
    }


@st.composite
def external_action_strategy(draw, action_id: str = None, config: Dict = None):
    """Generate random external actions."""
    if action_id is None:
        action_id = str(uuid.uuid4())
    if config is None:
        config = draw(action_config_strategy())

    return ExternalAction(
        action_id=action_id,
        action_type="mock_action",
        target={"credential_id": "test_cred"},
        trigger_mode=TriggerMode.ON_MATCH,
        action_config=config,
        cleanup_config=None,
        retry_config={"max_retries": 0, "base_delay_seconds": 1},
        timeout_ms=5000,
        enabled=True,
        conditions=None,
        order=0,
        blocking=False,
    )


# Feature: external-actions, Property 28: Idempotency Key Generation
@settings(max_examples=100, deadline=None)
@given(
    channel_id=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")),
    ),
    config=action_config_strategy(),
    signal_data=signal_data_strategy(),
)
@pytest.mark.asyncio
async def test_property_idempotency_key_deterministic(
    channel_id: str, config: Dict[str, Any], signal_data: Dict[str, Any]
):
    """
    Property 28: Idempotency Key Generation

    For any action execution, an idempotency key should be generated from
    the hash of channel_id, rule_id, signal identifier, and action configuration.
    The key should be deterministic (same inputs = same key).

    Validates: Requirements 12.1, 12.2
    """
    plugin = MockActionPlugin()

    # Generate key twice with same inputs
    key1 = plugin.get_idempotency_key(config, signal_data, channel_id)
    key2 = plugin.get_idempotency_key(config, signal_data, channel_id)

    # Keys should be identical
    assert key1 == key2, "Idempotency key should be deterministic for same inputs"

    # Key should be a valid SHA-256 hash (64 hex characters)
    assert (
        len(key1) == 64
    ), f"Idempotency key should be 64 characters (SHA-256), got {len(key1)}"
    assert all(
        c in "0123456789abcdef" for c in key1
    ), "Idempotency key should be hexadecimal"


@settings(max_examples=100, deadline=None)
@given(
    channel_id=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")),
    ),
    config1=action_config_strategy(),
    config2=action_config_strategy(),
    signal_data=signal_data_strategy(),
)
@pytest.mark.asyncio
async def test_property_idempotency_key_unique_for_different_configs(
    channel_id: str,
    config1: Dict[str, Any],
    config2: Dict[str, Any],
    signal_data: Dict[str, Any],
):
    """
    Property 28: Idempotency Key Generation - Uniqueness

    For any two different action configurations, the idempotency keys
    should be different (assuming same channel and signal).

    Validates: Requirements 12.1, 12.2
    """
    # Make configs different
    config2["param1"] = config1["param1"] + "_different"

    plugin = MockActionPlugin()

    key1 = plugin.get_idempotency_key(config1, signal_data, channel_id)
    key2 = plugin.get_idempotency_key(config2, signal_data, channel_id)

    # Keys should be different for different configs
    assert key1 != key2, "Idempotency keys should differ for different configurations"


@settings(max_examples=100, deadline=None)
@given(
    channel_id=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")),
    ),
    config=action_config_strategy(),
    signal1=signal_data_strategy(),
    signal2=signal_data_strategy(),
)
@pytest.mark.asyncio
async def test_property_idempotency_key_unique_for_different_signals(
    channel_id: str,
    config: Dict[str, Any],
    signal1: Dict[str, Any],
    signal2: Dict[str, Any],
):
    """
    Property 28: Idempotency Key Generation - Signal Sensitivity

    For any two different signals, the idempotency keys should be different
    (assuming same channel and config).

    Validates: Requirements 12.1, 12.2
    """
    # Make signals different
    signal2["pts"] = signal1["pts"] + 1000

    plugin = MockActionPlugin()

    key1 = plugin.get_idempotency_key(config, signal1, channel_id)
    key2 = plugin.get_idempotency_key(config, signal2, channel_id)

    # Keys should be different for different signals
    assert key1 != key2, "Idempotency keys should differ for different signals"


# Feature: external-actions, Property 29: Idempotency Deduplication
@settings(max_examples=100, deadline=None)
@given(
    channel_id=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")),
    ),
    config=action_config_strategy(),
    signal_data=signal_data_strategy(),
)
@pytest.mark.asyncio
async def test_property_idempotency_prevents_duplicate_execution(
    channel_id: str, config: Dict[str, Any], signal_data: Dict[str, Any]
):
    """
    Property 29: Idempotency Deduplication

    For any action with an idempotency key that matches a recent execution
    within the idempotency window, the action should be skipped and logged
    as a duplicate.

    Validates: Requirements 12.3, 12.5
    """
    # Setup
    plugin = MockActionPlugin()
    registry = PluginRegistry()
    registry.register(plugin)

    cred_store = InMemoryCredentialStore()
    await cred_store.store_credentials("test_cred", {"key": "value"})

    executor = ActionExecutor(registry, cred_store)

    # Create action with idempotency window
    action = ExternalAction(
        action_id="test_action",
        action_type="mock_action",
        target={"credential_id": "test_cred"},
        trigger_mode=TriggerMode.ON_MATCH,
        action_config=config,
        cleanup_config=None,
        retry_config={"max_retries": 0, "base_delay_seconds": 1},
        timeout_ms=5000,
        enabled=True,
        conditions=None,
        order=0,
        blocking=False,
    )

    # Execute action first time
    results1 = await executor.execute_actions([action], signal_data, channel_id)

    # Execute action second time with same inputs (within idempotency window)
    results2 = await executor.execute_actions([action], signal_data, channel_id)

    # First execution should succeed
    assert len(results1) == 1, "First execution should return result"
    assert results1[0].success, "First execution should succeed"

    # Second execution should be skipped (no results)
    assert len(results2) == 0, "Second execution should be skipped due to idempotency"

    # Plugin should only be executed once
    assert (
        plugin.execution_count == 1
    ), f"Plugin should execute once, but executed {plugin.execution_count} times"


@settings(max_examples=50, deadline=None)
@given(
    channel_id=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")),
    ),
    config=action_config_strategy(),
    signal_data=signal_data_strategy(),
)
@pytest.mark.asyncio
async def test_property_idempotency_allows_execution_after_window(
    channel_id: str, config: Dict[str, Any], signal_data: Dict[str, Any]
):
    """
    Property 29: Idempotency Deduplication - Window Expiry

    For any action executed outside the idempotency window, the action
    should be allowed to execute again.

    Validates: Requirements 12.3, 12.5
    """
    # Setup with very short idempotency window
    config["idempotency_window_seconds"] = 1  # 1 second window

    plugin = MockActionPlugin()
    registry = PluginRegistry()
    registry.register(plugin)

    cred_store = InMemoryCredentialStore()
    await cred_store.store_credentials("test_cred", {"key": "value"})

    executor = ActionExecutor(registry, cred_store)

    action = ExternalAction(
        action_id="test_action",
        action_type="mock_action",
        target={"credential_id": "test_cred"},
        trigger_mode=TriggerMode.ON_MATCH,
        action_config=config,
        cleanup_config=None,
        retry_config={"max_retries": 0, "base_delay_seconds": 1},
        timeout_ms=5000,
        enabled=True,
        conditions=None,
        order=0,
        blocking=False,
    )

    # Execute action first time
    results1 = await executor.execute_actions([action], signal_data, channel_id)
    assert len(results1) == 1
    assert plugin.execution_count == 1

    # Wait for idempotency window to expire
    import asyncio

    await asyncio.sleep(1.5)

    # Execute action second time (after window)
    results2 = await executor.execute_actions([action], signal_data, channel_id)

    # Second execution should succeed (window expired)
    assert (
        len(results2) == 1
    ), "Second execution should succeed after idempotency window expires"
    assert results2[0].success

    # Plugin should be executed twice
    assert (
        plugin.execution_count == 2
    ), f"Plugin should execute twice, but executed {plugin.execution_count} times"


@settings(max_examples=100, deadline=None)
@given(
    channel_id=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")),
    ),
    config=action_config_strategy(),
    signal1=signal_data_strategy(),
    signal2=signal_data_strategy(),
)
@pytest.mark.asyncio
async def test_property_idempotency_allows_different_signals(
    channel_id: str,
    config: Dict[str, Any],
    signal1: Dict[str, Any],
    signal2: Dict[str, Any],
):
    """
    Property 29: Idempotency Deduplication - Different Signals

    For any two different signals, both actions should execute even if
    within the idempotency window (different idempotency keys).

    Validates: Requirements 12.3
    """
    # Make signals different
    signal2["pts"] = signal1["pts"] + 1000

    plugin = MockActionPlugin()
    registry = PluginRegistry()
    registry.register(plugin)

    cred_store = InMemoryCredentialStore()
    await cred_store.store_credentials("test_cred", {"key": "value"})

    executor = ActionExecutor(registry, cred_store)

    action = ExternalAction(
        action_id="test_action",
        action_type="mock_action",
        target={"credential_id": "test_cred"},
        trigger_mode=TriggerMode.ON_MATCH,
        action_config=config,
        cleanup_config=None,
        retry_config={"max_retries": 0, "base_delay_seconds": 1},
        timeout_ms=5000,
        enabled=True,
        conditions=None,
        order=0,
        blocking=False,
    )

    # Execute with first signal
    results1 = await executor.execute_actions([action], signal1, channel_id)

    # Execute with second signal (different idempotency key)
    results2 = await executor.execute_actions([action], signal2, channel_id)

    # Both should execute
    assert len(results1) == 1
    assert len(results2) == 1
    assert (
        plugin.execution_count == 2
    ), "Both actions should execute (different signals = different keys)"


# Feature: external-actions, Property 30: Cleanup Idempotency Exemption
@settings(max_examples=50, deadline=None)
@given(
    channel_id=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")),
    ),
    config=action_config_strategy(),
    signal_data=signal_data_strategy(),
)
@pytest.mark.asyncio
async def test_property_cleanup_actions_exempt_from_idempotency(
    channel_id: str, config: Dict[str, Any], signal_data: Dict[str, Any]
):
    """
    Property 30: Cleanup Idempotency Exemption

    For any cleanup action, idempotency checking should not prevent execution,
    allowing cleanup to run even if it matches a recent action.

    Note: This test verifies the concept. Full cleanup implementation
    will be in task 13 when cleanup execution is integrated.

    Validates: Requirements 12.6
    """
    # This property will be fully tested when cleanup actions are implemented
    # For now, we verify that the idempotency key generation works for cleanup

    plugin = MockActionPlugin()

    # Generate keys for original and cleanup actions
    original_key = plugin.get_idempotency_key(config, signal_data, channel_id)

    # Cleanup signal (different from original)
    cleanup_signal = signal_data.copy()
    cleanup_signal["segmentation_type_id"] = 53  # Provider Ad End

    cleanup_key = plugin.get_idempotency_key(config, cleanup_signal, channel_id)

    # Keys should be different (cleanup has different signal)
    assert (
        original_key != cleanup_key
    ), "Cleanup action should have different idempotency key due to different signal"

    # This ensures cleanup actions won't be blocked by idempotency
    # when they have different trigger signals
