# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Repository interface and implementation for action state persistence.

This module provides the interface and DynamoDB implementation for storing
and retrieving action states for cleanup tracking.
"""

from abc import ABC, abstractmethod
from typing import List, Optional
from datetime import datetime
import logging
import os

from domain.models.external_actions import ActionState

logger = logging.getLogger(__name__)


class ActionStateRepository(ABC):
    """Abstract repository for action state persistence."""

    @abstractmethod
    async def save(self, state: ActionState) -> None:
        """
        Save an action state.

        Args:
            state: The action state to save
        """
        pass

    @abstractmethod
    async def get_by_id(self, state_id: str) -> Optional[ActionState]:
        """
        Get an action state by ID.

        Args:
            state_id: The state ID

        Returns:
            Optional[ActionState]: The action state or None if not found
        """
        pass

    @abstractmethod
    async def get_by_channel(self, channel_id: str) -> List[ActionState]:
        """
        Get all active action states for a channel.

        Args:
            channel_id: The channel ID

        Returns:
            List[ActionState]: List of active action states
        """
        pass

    @abstractmethod
    async def delete(self, state_id: str) -> bool:
        """
        Delete an action state.

        Args:
            state_id: The state ID to delete

        Returns:
            bool: True if deleted, False if not found
        """
        pass

    @abstractmethod
    async def get_expired_states(self, current_time: datetime) -> List[ActionState]:
        """
        Get all action states that have expired.

        Args:
            current_time: The current time to compare against

        Returns:
            List[ActionState]: List of expired action states
        """
        pass


class DynamoDBActionStateRepository(ActionStateRepository):
    """DynamoDB implementation of action state repository."""

    def __init__(self, table_name: Optional[str] = None):
        """
        Initialize the DynamoDB repository.

        Args:
            table_name: Name of the DynamoDB table (defaults to env var)
        """
        import boto3

        self.table_name = table_name or os.environ.get(
            "ACTION_STATE_TABLE_NAME", "pois-action-states"
        )

        self.dynamodb = boto3.resource("dynamodb")
        self.table = self.dynamodb.Table(self.table_name)

        logger.info(f"Initialized DynamoDB action state repository: {self.table_name}")

    async def save(self, state: ActionState) -> None:
        """Save an action state to DynamoDB."""
        try:
            item = {
                "state_id": state.state_id,
                "channel_id": state.channel_id,
                "action_id": state.action_id,
                "action_type": state.action_type,
                "trigger_signal": state.trigger_signal,
                "cleanup_config": state.cleanup_config,
                "created_at": state.created_at.isoformat(),
            }

            if state.expires_at:
                item["expires_at"] = state.expires_at.isoformat()
                # Set TTL for automatic cleanup (DynamoDB TTL uses Unix timestamp)
                item["ttl"] = int(state.expires_at.timestamp())

            self.table.put_item(Item=item)
            logger.debug(f"Saved action state: {state.state_id}")

        except Exception as e:
            logger.error(f"Failed to save action state: {e}", exc_info=True)
            raise

    async def get_by_id(self, state_id: str) -> Optional[ActionState]:
        """Get an action state by ID from DynamoDB."""
        try:
            response = self.table.get_item(Key={"state_id": state_id})

            if "Item" not in response:
                return None

            return self._item_to_state(response["Item"])

        except Exception as e:
            logger.error(f"Failed to get action state {state_id}: {e}", exc_info=True)
            raise

    async def get_by_channel(self, channel_id: str) -> List[ActionState]:
        """Get all active action states for a channel from DynamoDB."""
        try:
            # Use GSI on channel_id
            response = self.table.query(
                IndexName="channel_id-index",
                KeyConditionExpression="channel_id = :channel_id",
                ExpressionAttributeValues={":channel_id": channel_id},
            )

            states = [self._item_to_state(item) for item in response.get("Items", [])]
            logger.debug(f"Retrieved {len(states)} states for channel {channel_id}")

            return states

        except Exception as e:
            logger.error(
                f"Failed to get action states for channel {channel_id}: {e}",
                exc_info=True,
            )
            raise

    async def delete(self, state_id: str) -> bool:
        """Delete an action state from DynamoDB."""
        try:
            response = self.table.delete_item(
                Key={"state_id": state_id}, ReturnValues="ALL_OLD"
            )

            deleted = "Attributes" in response
            if deleted:
                logger.debug(f"Deleted action state: {state_id}")
            else:
                logger.debug(f"Action state not found for deletion: {state_id}")

            return deleted

        except Exception as e:
            logger.error(
                f"Failed to delete action state {state_id}: {e}", exc_info=True
            )
            raise

    async def get_expired_states(self, current_time: datetime) -> List[ActionState]:
        """Get all expired action states from DynamoDB."""
        try:
            # Scan for expired states (in production, consider using a GSI on expires_at)
            response = self.table.scan(
                FilterExpression="expires_at < :current_time",
                ExpressionAttributeValues={":current_time": current_time.isoformat()},
            )

            states = [self._item_to_state(item) for item in response.get("Items", [])]
            logger.debug(f"Found {len(states)} expired states")

            return states

        except Exception as e:
            logger.error(f"Failed to get expired states: {e}", exc_info=True)
            raise

    def _item_to_state(self, item: dict) -> ActionState:
        """Convert DynamoDB item to ActionState."""
        return ActionState(
            state_id=item["state_id"],
            channel_id=item["channel_id"],
            action_id=item["action_id"],
            action_type=item["action_type"],
            trigger_signal=item["trigger_signal"],
            cleanup_config=item["cleanup_config"],
            created_at=datetime.fromisoformat(item["created_at"]),
            expires_at=(
                datetime.fromisoformat(item["expires_at"])
                if "expires_at" in item
                else None
            ),
        )


class InMemoryActionStateRepository(ActionStateRepository):
    """In-memory implementation for testing."""

    def __init__(self):
        """Initialize the in-memory repository."""
        self._states: dict[str, ActionState] = {}
        logger.info("Initialized in-memory action state repository")

    async def save(self, state: ActionState) -> None:
        """Save an action state to memory."""
        self._states[state.state_id] = state
        logger.debug(f"Saved action state: {state.state_id}")

    async def get_by_id(self, state_id: str) -> Optional[ActionState]:
        """Get an action state by ID from memory."""
        return self._states.get(state_id)

    async def get_by_channel(self, channel_id: str) -> List[ActionState]:
        """Get all active action states for a channel from memory."""
        return [
            state for state in self._states.values() if state.channel_id == channel_id
        ]

    async def delete(self, state_id: str) -> bool:
        """Delete an action state from memory."""
        if state_id in self._states:
            del self._states[state_id]
            logger.debug(f"Deleted action state: {state_id}")
            return True
        return False

    async def get_expired_states(self, current_time: datetime) -> List[ActionState]:
        """Get all expired action states from memory."""
        return [
            state
            for state in self._states.values()
            if state.expires_at and state.expires_at <= current_time
        ]

    def clear(self) -> None:
        """Clear all states (for testing)."""
        self._states.clear()
