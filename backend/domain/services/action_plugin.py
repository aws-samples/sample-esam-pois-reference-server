# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Base interface for action plugins.

This module defines the abstract base class that all action plugins must implement,
providing a standard interface for plugin registration, validation, and execution.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Tuple
import hashlib
import json

from domain.models.external_actions import ActionResult


class ActionPlugin(ABC):
    """Base interface for all action plugins."""

    @property
    @abstractmethod
    def action_type(self) -> str:
        """
        Unique identifier for this action type.

        Returns:
            str: The action type identifier (e.g., "medialive_schedule_action", "webhook")
        """
        pass

    @property
    @abstractmethod
    def config_schema(self) -> Dict[str, Any]:
        """
        JSON schema for action configuration.

        Returns:
            Dict[str, Any]: JSON schema defining the configuration structure
        """
        pass

    @abstractmethod
    def validate_config(self, config: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """
        Validate action configuration.

        Args:
            config: Action configuration to validate

        Returns:
            Tuple[bool, Optional[str]]: (is_valid, error_message)
        """
        pass

    @abstractmethod
    async def execute(
        self,
        config: Dict[str, Any],
        signal_data: Dict[str, Any],
        channel_id: str,
        credentials: Dict[str, Any],
    ) -> ActionResult:
        """
        Execute the action.

        Args:
            config: Action-specific configuration
            signal_data: SCTE-35 signal that triggered the action
            channel_id: Channel ID for context
            credentials: Credentials from credential store

        Returns:
            ActionResult: Result of the action execution
        """
        pass

    @abstractmethod
    def supports_cleanup(self) -> bool:
        """
        Whether this action type supports cleanup actions.

        Returns:
            bool: True if cleanup is supported, False otherwise
        """
        pass

    async def execute_cleanup(
        self,
        config: Dict[str, Any],
        original_signal: Dict[str, Any],
        cleanup_signal: Dict[str, Any],
        channel_id: str,
        credentials: Dict[str, Any],
    ) -> ActionResult:
        """
        Execute cleanup action (optional, only if supports_cleanup returns True).

        Args:
            config: Action configuration
            original_signal: Original signal that triggered the action
            cleanup_signal: Signal that triggered the cleanup
            channel_id: Channel ID for context
            credentials: Credentials from credential store

        Returns:
            ActionResult: Result of the cleanup execution

        Raises:
            NotImplementedError: If cleanup is not supported
        """
        raise NotImplementedError("Cleanup not supported")

    def get_idempotency_key(
        self, config: Dict[str, Any], signal_data: Dict[str, Any], channel_id: str
    ) -> str:
        """
        Generate idempotency key for deduplication.

        Default implementation uses hash of config + signal + channel.
        Plugins can override this for custom idempotency logic.

        Args:
            config: Action configuration
            signal_data: Signal data
            channel_id: Channel ID

        Returns:
            str: Idempotency key (SHA-256 hash)
        """
        # Create a deterministic string from the inputs. The FULL signal is
        # hashed (not just pts) so that distinct signals - e.g. a cleanup
        # trigger with a different segmentation_type_id - never collide with
        # the original action's key (Requirement 12.6).
        data = (
            f"{channel_id}"
            f":{json.dumps(config, sort_keys=True)}"
            f":{json.dumps(signal_data, sort_keys=True, default=str)}"
        )
        return hashlib.sha256(data.encode()).hexdigest()

    def get_rate_limit(self) -> Optional[Tuple[int, int]]:
        """
        Return rate limit as (max_calls, per_seconds).

        Example: (100, 60) = 100 calls per 60 seconds

        Returns:
            Optional[Tuple[int, int]]: Rate limit configuration or None if no limit
        """
        return None
