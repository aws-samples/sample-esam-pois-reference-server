# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Property-based tests for plugin registration and discovery.

Feature: external-actions
Property 1: Plugin Registration and Discovery

For any action plugin implementing the ActionPlugin interface, when registered
with the plugin registry, the plugin should be discoverable by its action_type
identifier and its configuration schema should be retrievable.

Validates: Requirements 1.2
"""

import pytest
from hypothesis import given, strategies as st, settings
from typing import Dict, Any, Optional, Tuple

from domain.services.action_plugin import ActionPlugin
from domain.services.plugin_registry import PluginRegistry, reset_global_registry
from domain.models.external_actions import ActionResult

# Strategy for generating valid action type names
action_type_strategy = st.text(
    alphabet=st.characters(
        whitelist_categories=("Ll", "Nd"), whitelist_characters="_-"
    ),
    min_size=3,
    max_size=50,
).filter(lambda x: x and not x.startswith("_") and not x.endswith("_"))


# Strategy for generating configuration schemas
config_schema_strategy = st.fixed_dictionaries(
    {
        "type": st.just("object"),
        "required": st.lists(st.text(min_size=1, max_size=20), min_size=0, max_size=5),
        "properties": st.dictionaries(
            keys=st.text(min_size=1, max_size=20),
            values=st.fixed_dictionaries(
                {
                    "type": st.sampled_from(
                        ["string", "number", "boolean", "object", "array"]
                    )
                }
            ),
            min_size=0,
            max_size=10,
        ),
    }
)


class MockActionPlugin(ActionPlugin):
    """Mock plugin for testing."""

    def __init__(self, action_type: str, schema: Dict[str, Any]):
        self._action_type = action_type
        self._config_schema = schema

    @property
    def action_type(self) -> str:
        return self._action_type

    @property
    def config_schema(self) -> Dict[str, Any]:
        return self._config_schema

    def validate_config(self, config: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        return True, None

    async def execute(
        self,
        config: Dict[str, Any],
        signal_data: Dict[str, Any],
        channel_id: str,
        credentials: Dict[str, Any],
    ) -> ActionResult:
        return ActionResult(success=True, message="Mock execution")

    def supports_cleanup(self) -> bool:
        return False


@pytest.fixture(autouse=True)
def reset_registry():
    """Reset the global registry before each test."""
    reset_global_registry()
    yield
    reset_global_registry()


# Feature: external-actions, Property 1: Plugin Registration and Discovery
@settings(max_examples=100)
@given(action_type=action_type_strategy, schema=config_schema_strategy)
def test_plugin_registration_and_discovery(action_type: str, schema: Dict[str, Any]):
    """
    Property: For any action plugin, when registered, it should be discoverable
    by its action_type and its configuration schema should be retrievable.
    """
    # Arrange
    registry = PluginRegistry()
    plugin = MockActionPlugin(action_type, schema)

    # Act - Register the plugin
    registry.register(plugin)

    # Assert - Plugin should be discoverable
    assert registry.is_registered(
        action_type
    ), f"Plugin {action_type} should be registered"

    # Assert - Plugin should be retrievable
    retrieved_plugin = registry.get(action_type)
    assert retrieved_plugin is not None, f"Plugin {action_type} should be retrievable"
    assert (
        retrieved_plugin.action_type == action_type
    ), "Retrieved plugin should have the same action_type"

    # Assert - Configuration schema should be retrievable
    retrieved_schema = registry.get_config_schema(action_type)
    assert (
        retrieved_schema is not None
    ), f"Schema for {action_type} should be retrievable"
    assert (
        retrieved_schema == schema
    ), "Retrieved schema should match the original schema"

    # Assert - Plugin should appear in list of types
    assert (
        action_type in registry.list_types()
    ), f"Plugin {action_type} should appear in list of types"


# Feature: external-actions, Property 1: Plugin Registration and Discovery
@settings(max_examples=100)
@given(
    action_types=st.lists(action_type_strategy, min_size=1, max_size=20, unique=True),
    schemas=st.lists(config_schema_strategy, min_size=1, max_size=20),
)
def test_multiple_plugin_registration(
    action_types: list[str], schemas: list[Dict[str, Any]]
):
    """
    Property: Multiple plugins can be registered and each should be independently
    discoverable with its own configuration schema.
    """
    # Arrange
    registry = PluginRegistry()

    # Ensure we have enough schemas (reuse if needed)
    while len(schemas) < len(action_types):
        schemas.append(schemas[0])

    # Act - Register all plugins
    for action_type, schema in zip(action_types, schemas):
        plugin = MockActionPlugin(action_type, schema)
        registry.register(plugin)

    # Assert - All plugins should be registered
    assert registry.count() == len(
        action_types
    ), f"Registry should contain {len(action_types)} plugins"

    # Assert - Each plugin should be independently discoverable
    for action_type, schema in zip(action_types, schemas):
        assert registry.is_registered(
            action_type
        ), f"Plugin {action_type} should be registered"

        retrieved_plugin = registry.get(action_type)
        assert (
            retrieved_plugin is not None
        ), f"Plugin {action_type} should be retrievable"

        retrieved_schema = registry.get_config_schema(action_type)
        assert retrieved_schema == schema, f"Schema for {action_type} should match"

    # Assert - All action types should be in the list
    registered_types = set(registry.list_types())
    expected_types = set(action_types)
    assert (
        registered_types == expected_types
    ), "All registered action types should be in the list"


# Feature: external-actions, Property 1: Plugin Registration and Discovery
@settings(max_examples=100)
@given(action_type=action_type_strategy, schema=config_schema_strategy)
def test_duplicate_registration_fails(action_type: str, schema: Dict[str, Any]):
    """
    Property: Attempting to register a plugin with an already-registered
    action_type should raise a ValueError.
    """
    # Arrange
    registry = PluginRegistry()
    plugin1 = MockActionPlugin(action_type, schema)
    plugin2 = MockActionPlugin(action_type, schema)

    # Act - Register first plugin
    registry.register(plugin1)

    # Assert - Registering second plugin with same type should fail
    with pytest.raises(ValueError, match=f"Plugin {action_type} already registered"):
        registry.register(plugin2)

    # Assert - Only one plugin should be registered
    assert (
        registry.count() == 1
    ), "Only one plugin should be registered after duplicate attempt"


# Feature: external-actions, Property 1: Plugin Registration and Discovery
@settings(max_examples=100)
@given(action_type=action_type_strategy, schema=config_schema_strategy)
def test_unregistered_plugin_not_discoverable(action_type: str, schema: Dict[str, Any]):
    """
    Property: A plugin that has not been registered should not be discoverable.
    """
    # Arrange
    registry = PluginRegistry()

    # Assert - Plugin should not be registered
    assert not registry.is_registered(
        action_type
    ), f"Plugin {action_type} should not be registered"

    # Assert - Plugin should not be retrievable
    assert (
        registry.get(action_type) is None
    ), f"Plugin {action_type} should not be retrievable"

    # Assert - Schema should not be retrievable
    assert (
        registry.get_config_schema(action_type) is None
    ), f"Schema for {action_type} should not be retrievable"

    # Assert - Plugin should not appear in list
    assert (
        action_type not in registry.list_types()
    ), f"Plugin {action_type} should not appear in list"


# Feature: external-actions, Property 1: Plugin Registration and Discovery
@settings(max_examples=100)
@given(action_type=action_type_strategy, schema=config_schema_strategy)
def test_plugin_unregistration(action_type: str, schema: Dict[str, Any]):
    """
    Property: A registered plugin can be unregistered and should no longer
    be discoverable.
    """
    # Arrange
    registry = PluginRegistry()
    plugin = MockActionPlugin(action_type, schema)
    registry.register(plugin)

    # Verify plugin is registered
    assert registry.is_registered(action_type)

    # Act - Unregister the plugin
    result = registry.unregister(action_type)

    # Assert - Unregistration should succeed
    assert result is True, "Unregistration should return True"

    # Assert - Plugin should no longer be discoverable
    assert not registry.is_registered(
        action_type
    ), f"Plugin {action_type} should not be registered after unregistration"

    assert (
        registry.get(action_type) is None
    ), f"Plugin {action_type} should not be retrievable after unregistration"

    assert (
        action_type not in registry.list_types()
    ), f"Plugin {action_type} should not appear in list after unregistration"
