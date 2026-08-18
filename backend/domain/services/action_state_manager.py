# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Action State Manager — Advanced Distributed State Tracking

This module provides persistent state management for external actions that
require cleanup (e.g., deactivating a logo overlay after an ad break ends).
It tracks which actions are "active" across multiple Lambda invocations and
matches cleanup signals (e.g., a CUE-IN SCTE-35 signal) to the original
triggering action.

This is separate from the ActionExecutor's internal per-invocation logic.
Use this when you need:
  - Cross-invocation state (action triggered in one Lambda call, cleaned up in another)
  - Timeout-based auto-cleanup for actions that never receive a matching signal
  - Distributed state across multiple concurrent channel processors

The ActionExecutor handles single-invocation action execution. This module
handles the lifecycle across invocations via DynamoDB-backed persistence.
"""

from typing import List, Dict, Any
from datetime import datetime, timedelta
import uuid
import logging

from domain.models.external_actions import ActionState, ExternalAction
from domain.repositories.action_state_repository import ActionStateRepository

logger = logging.getLogger(__name__)


class ActionStateManager:
    """Manages state for active actions requiring cleanup."""

    def __init__(self, repository: ActionStateRepository):
        """
        Initialize the action state manager.

        Args:
            repository: Repository for persisting action states
        """
        self.repo = repository
        logger.info("Action state manager initialized")

    async def store_state(
        self,
        channel_id: str,
        action: ExternalAction,
        trigger_signal: Dict[str, Any],
        timestamp: datetime,
    ) -> str:
        """
        Store action state for later cleanup.

        Args:
            channel_id: Channel ID
            action: The action that was executed
            trigger_signal: Signal that triggered the action
            timestamp: Timestamp of action execution

        Returns:
            str: The generated state ID
        """
        state_id = self._generate_state_id()

        # Calculate expiration if timeout is configured
        expires_at = None
        if action.cleanup_config and "timeout_seconds" in action.cleanup_config:
            timeout_seconds = action.cleanup_config["timeout_seconds"]
            expires_at = timestamp + timedelta(seconds=timeout_seconds)
            logger.debug(
                f"Action state {state_id} will expire at {expires_at} "
                f"(timeout: {timeout_seconds}s)"
            )

        # Create state object
        state = ActionState(
            state_id=state_id,
            channel_id=channel_id,
            action_id=action.action_id,
            action_type=action.action_type,
            trigger_signal=trigger_signal,
            cleanup_config=action.cleanup_config or {},
            created_at=timestamp,
            expires_at=expires_at,
        )

        # Persist state
        await self.repo.save(state)

        logger.info(
            f"Stored action state {state_id} for channel {channel_id}, "
            f"action {action.action_id}"
        )

        return state_id

    async def get_cleanup_actions(
        self, channel_id: str, cleanup_signal: Dict[str, Any]
    ) -> List[ActionState]:
        """
        Get actions that need cleanup based on signal.

        This method retrieves all active states for a channel and filters
        them based on cleanup trigger matching and expiration.

        Args:
            channel_id: Channel ID
            cleanup_signal: Signal that may trigger cleanup

        Returns:
            List[ActionState]: List of states requiring cleanup
        """
        # Get all active states for channel
        states = await self.repo.get_by_channel(channel_id)

        matching_states = []
        current_time = datetime.utcnow()

        for state in states:
            # Check if cleanup trigger matches
            if self._matches_cleanup_trigger(state, cleanup_signal):
                logger.debug(
                    f"State {state.state_id} matches cleanup trigger "
                    f"(signal type: {cleanup_signal.get('segmentation_type_id')})"
                )
                matching_states.append(state)
            # Check if expired
            elif state.expires_at and current_time >= state.expires_at:
                logger.debug(
                    f"State {state.state_id} has expired "
                    f"(expires_at: {state.expires_at}, current: {current_time})"
                )
                matching_states.append(state)

        if matching_states:
            logger.info(
                f"Found {len(matching_states)} states requiring cleanup "
                f"for channel {channel_id}"
            )

        return matching_states

    async def remove_state(self, state_id: str) -> bool:
        """
        Remove action state after cleanup.

        Args:
            state_id: The state ID to remove

        Returns:
            bool: True if removed, False if not found
        """
        deleted = await self.repo.delete(state_id)

        if deleted:
            logger.info(f"Removed action state {state_id}")
        else:
            logger.warning(f"Action state {state_id} not found for removal")

        return deleted

    async def get_expired_states(self) -> List[ActionState]:
        """
        Get all expired action states across all channels.

        This is useful for background cleanup jobs.

        Returns:
            List[ActionState]: List of expired states
        """
        current_time = datetime.utcnow()
        expired_states = await self.repo.get_expired_states(current_time)

        if expired_states:
            logger.info(f"Found {len(expired_states)} expired states")

        return expired_states

    def _matches_cleanup_trigger(
        self, state: ActionState, cleanup_signal: Dict[str, Any]
    ) -> bool:
        """
        Check if cleanup signal matches cleanup trigger.

        Matching logic:
        1. If trigger_type_id is configured, match by segmentation_type_id
        2. If trigger_upid is configured, match by segmentation_upid
        3. If both are configured, both must match

        Args:
            state: The action state
            cleanup_signal: The cleanup signal

        Returns:
            bool: True if signal matches cleanup trigger
        """
        cleanup_config = state.cleanup_config

        # No cleanup trigger configured
        if not cleanup_config:
            return False

        matches = []

        # Match by segmentation type ID
        if "trigger_type_id" in cleanup_config:
            signal_type_id = cleanup_signal.get("segmentation_type_id")
            trigger_type_id = cleanup_config["trigger_type_id"]

            type_matches = signal_type_id == trigger_type_id
            matches.append(type_matches)

            logger.debug(
                f"Type ID match: signal={signal_type_id}, "
                f"trigger={trigger_type_id}, matches={type_matches}"
            )

        # Match by segmentation UPID
        if "trigger_upid" in cleanup_config:
            signal_upid = cleanup_signal.get("segmentation_upid")
            trigger_upid = cleanup_config["trigger_upid"]

            upid_matches = signal_upid == trigger_upid
            matches.append(upid_matches)

            logger.debug(
                f"UPID match: signal={signal_upid}, "
                f"trigger={trigger_upid}, matches={upid_matches}"
            )

        # If no matching criteria configured, don't match
        if not matches:
            return False

        # All configured criteria must match
        return all(matches)

    def _generate_state_id(self) -> str:
        """Generate a unique state ID."""
        return str(uuid.uuid4())
