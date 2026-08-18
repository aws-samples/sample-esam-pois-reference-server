# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Channel state repository for DynamoDB operations."""

import logging
from typing import Optional

import boto3
from botocore.exceptions import ClientError

from domain.models.channel import ChannelState

logger = logging.getLogger(__name__)


class ChannelStateRepository:
    """Repository for channel state CRUD operations in DynamoDB using single-table design."""

    def __init__(self, table_name: str):
        """
        Initialize channel state repository.

        Args:
            table_name: DynamoDB table name
        """
        self.dynamodb = boto3.resource("dynamodb")
        self.table = self.dynamodb.Table(table_name)
        self.table_name = table_name
        logger.debug(f"Initialized ChannelStateRepository with table: {table_name}")

    def get_state(self, channel_id: str) -> Optional[ChannelState]:
        """
        Get channel state from DynamoDB.

        Args:
            channel_id: Channel ID

        Returns:
            ChannelState or None if not found
        """
        try:
            response = self.table.get_item(
                Key={
                    "PK": f"CHANNEL#{channel_id}",
                    "SK": "STATE",
                }
            )

            if "Item" not in response:
                logger.debug(f"Channel state not found: {channel_id}")
                return None

            item = response["Item"]
            state = self._item_to_state(item)

            logger.debug(
                f"Retrieved channel state: {channel_id}",
                extra={
                    "channelId": channel_id,
                    "inBreak": state.in_break,
                    "breakExpiryTime": state.break_expiry_time,
                },
            )
            return state

        except ClientError as e:
            logger.error(
                f"DynamoDB error getting channel state {channel_id}: {e}",
                extra={"channelId": channel_id, "error": str(e)},
            )
            # Return None to allow processing to continue
            return None
        except Exception as e:
            logger.error(
                f"Error parsing channel state {channel_id}: {e}",
                extra={"channelId": channel_id, "error": str(e)},
            )
            # Return None to allow processing to continue
            return None

    def save_state(self, state: ChannelState) -> None:
        """
        Save channel state to DynamoDB.

        Args:
            state: Channel state to save
        """
        try:
            # Convert to dict for DynamoDB
            state_dict = state.model_dump(by_alias=True)

            # Build DynamoDB item with PK/SK
            item = {
                "PK": f"CHANNEL#{state.channel_id}",
                "SK": "STATE",
                **state_dict,
            }

            # Put item (will create or overwrite)
            self.table.put_item(Item=item)

            logger.info(
                f"Saved channel state: {state.channel_id}",
                extra={
                    "channelId": state.channel_id,
                    "inBreak": state.in_break,
                    "breakExpiryTime": state.break_expiry_time,
                },
            )

        except ClientError as e:
            logger.error(
                f"DynamoDB error saving channel state {state.channel_id}: {e}",
                extra={"channelId": state.channel_id, "error": str(e)},
            )
            # Don't raise - allow processing to continue
        except Exception as e:
            logger.error(
                f"Error saving channel state {state.channel_id}: {e}",
                extra={"channelId": state.channel_id, "error": str(e)},
            )
            # Don't raise - allow processing to continue

    def delete_state(self, channel_id: str) -> bool:
        """
        Delete channel state from DynamoDB.

        Args:
            channel_id: Channel ID

        Returns:
            True if deleted, False if not found
        """
        try:
            self.table.delete_item(
                Key={
                    "PK": f"CHANNEL#{channel_id}",
                    "SK": "STATE",
                },
                ConditionExpression="attribute_exists(PK)",
            )

            logger.info(f"Deleted channel state: {channel_id}")
            return True

        except ClientError as e:
            if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
                logger.debug(f"Channel state not found for deletion: {channel_id}")
                return False
            else:
                logger.error(
                    f"DynamoDB error deleting channel state: {e}",
                    extra={"channelId": channel_id, "error": str(e)},
                )
                return False

    def _item_to_state(self, item: dict) -> ChannelState:
        """Convert DynamoDB item to ChannelState model."""
        # Remove DynamoDB-specific fields
        state_data = {k: v for k, v in item.items() if k not in ["PK", "SK", "TTL"]}
        return ChannelState(**state_data)
