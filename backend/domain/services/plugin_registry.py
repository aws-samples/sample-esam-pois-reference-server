# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Plugin registry for managing action plugins.

This module provides a central registry for discovering and managing action plugins.
Plugins are registered at startup and can be retrieved by their action type.
"""

from typing import Dict, Optional, List
import logging

from domain.services.action_plugin import ActionPlugin

logger = logging.getLogger(__name__)


class PluginRegistry:
    """Central registry for action plugins."""

    def __init__(self):
        """Initialize the plugin registry."""
        self._plugins: Dict[str, ActionPlugin] = {}
        logger.info("Plugin registry initialized")

    def register(self, plugin: ActionPlugin) -> None:
        """
        Register a plugin.

        Args:
            plugin: The plugin instance to register

        Raises:
            ValueError: If a plugin with the same action_type is already registered
        """
        action_type = plugin.action_type

        if action_type in self._plugins:
            raise ValueError(f"Plugin {action_type} already registered")

        self._plugins[action_type] = plugin
        logger.info(f"Registered plugin: {action_type}")

    def unregister(self, action_type: str) -> bool:
        """
        Unregister a plugin.

        Args:
            action_type: The action type to unregister

        Returns:
            bool: True if plugin was unregistered, False if not found
        """
        if action_type in self._plugins:
            del self._plugins[action_type]
            logger.info(f"Unregistered plugin: {action_type}")
            return True
        return False

    def get(self, action_type: str) -> Optional[ActionPlugin]:
        """
        Get plugin by action type.

        Args:
            action_type: The action type identifier

        Returns:
            Optional[ActionPlugin]: The plugin instance or None if not found
        """
        return self._plugins.get(action_type)

    def list_types(self) -> List[str]:
        """
        List all registered action types.

        Returns:
            List[str]: List of action type identifiers
        """
        return list(self._plugins.keys())

    def get_config_schema(self, action_type: str) -> Optional[Dict]:
        """
        Get configuration schema for an action type.

        Args:
            action_type: The action type identifier

        Returns:
            Optional[Dict]: The configuration schema or None if plugin not found
        """
        plugin = self.get(action_type)
        return plugin.config_schema if plugin else None

    def is_registered(self, action_type: str) -> bool:
        """
        Check if an action type is registered.

        Args:
            action_type: The action type identifier

        Returns:
            bool: True if registered, False otherwise
        """
        return action_type in self._plugins

    def count(self) -> int:
        """
        Get the number of registered plugins.

        Returns:
            int: Number of registered plugins
        """
        return len(self._plugins)


# Global plugin registry instance
_global_registry: Optional[PluginRegistry] = None


def get_global_registry() -> PluginRegistry:
    """
    Get the global plugin registry instance.

    Returns:
        PluginRegistry: The global registry instance
    """
    global _global_registry
    if _global_registry is None:
        _global_registry = PluginRegistry()
    return _global_registry


def reset_global_registry() -> None:
    """Reset the global plugin registry (useful for testing)."""
    global _global_registry
    _global_registry = None
