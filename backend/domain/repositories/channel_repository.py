# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Channel repository for DynamoDB operations."""

import logging
from typing import List, Optional
from datetime import datetime

import boto3
from botocore.exceptions import ClientError

from domain.models.channel import Channel

logger = logging.getLogger(__name__)


class ChannelRepository:
    """Repository for channel CRUD operations in DynamoDB using single-table design."""

    def __init__(self, table_name: str):
        """
        Initialize channel repository.

        Args:
            table_name: DynamoDB table name
        """
        self.dynamodb = boto3.resource("dynamodb")
        self.table = self.dynamodb.Table(table_name)
        self.table_name = table_name

    def get_all_channels(self) -> List[Channel]:
        """
        Get all channels from DynamoDB.

        Returns:
            List of channels
        """
        try:
            response = self.table.scan(
                FilterExpression="begins_with(PK, :pk) AND SK = :sk",
                ExpressionAttributeValues={
                    ":pk": "CHANNEL#",
                    ":sk": "METADATA",
                },
            )
            items = response.get("Items", [])

            # Handle pagination
            while "LastEvaluatedKey" in response:
                response = self.table.scan(
                    FilterExpression="begins_with(PK, :pk) AND SK = :sk",
                    ExpressionAttributeValues={
                        ":pk": "CHANNEL#",
                        ":sk": "METADATA",
                    },
                    ExclusiveStartKey=response["LastEvaluatedKey"],
                )
                items.extend(response.get("Items", []))

            channels = []
            for item in items:
                try:
                    channel = self._item_to_channel(item)
                    channels.append(channel)
                except Exception as e:
                    logger.warning(
                        f"Failed to parse channel: {e}", extra={"item": item}
                    )
                    continue

            logger.info(f"Retrieved {len(channels)} channels")
            return channels

        except ClientError as e:
            logger.error(f"DynamoDB error getting all channels: {e}")
            raise Exception(f"Failed to get channels: {e}")

    def get_channel(self, channel_id: str) -> Optional[Channel]:
        """
        Get specific channel by ID.

        Args:
            channel_id: Channel ID

        Returns:
            Channel or None if not found
        """
        try:
            response = self.table.get_item(
                Key={
                    "PK": f"CHANNEL#{channel_id}",
                    "SK": "METADATA",
                }
            )

            if "Item" not in response:
                logger.info(f"Channel not found: {channel_id}")
                return None

            item = response["Item"]
            channel = self._item_to_channel(item)

            logger.info(f"Retrieved channel: {channel_id}")
            return channel

        except ClientError as e:
            logger.error(f"DynamoDB error getting channel {channel_id}: {e}")
            raise Exception(f"Failed to get channel: {e}")

    def create_channel(self, channel: Channel) -> Channel:
        """
        Create a new channel.

        Args:
            channel: Channel to create

        Returns:
            Created channel
        """
        try:
            # Set timestamps
            now = datetime.utcnow().isoformat() + "Z"
            channel.created_at = now
            channel.updated_at = now

            # Convert to dict for DynamoDB
            channel_dict = channel.model_dump(by_alias=True)

            # Build DynamoDB item with PK/SK
            item = {
                "PK": f"CHANNEL#{channel.channel_id}",
                "SK": "METADATA",
                "GSI1PK": "CHANNEL",
                "GSI1SK": f"{str(channel.enabled).lower()}#{channel.name}",
                **channel_dict,
            }

            # Put item
            self.table.put_item(
                Item=item, ConditionExpression="attribute_not_exists(PK)"
            )

            logger.info(f"Created channel: {channel.channel_id}")
            return channel

        except ClientError as e:
            if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
                logger.error(f"Channel already exists: {channel.channel_id}")
                raise Exception(f"Channel already exists: {channel.channel_id}")
            else:
                logger.error(f"DynamoDB error creating channel: {e}")
                raise Exception(f"Failed to create channel: {e}")

    def update_channel(self, channel: Channel) -> Channel:
        """
        Update an existing channel.

        Args:
            channel: Channel to update

        Returns:
            Updated channel
        """
        try:
            # Update timestamp
            channel.updated_at = datetime.utcnow().isoformat() + "Z"

            # Convert to dict for DynamoDB
            channel_dict = channel.model_dump(by_alias=True)

            # Debug log
            logger.info(f"UPDATE: Saving channel {channel.channel_id}")
            logger.info(f"Channel dict keys: {list(channel_dict.keys())}")
            if "rules" in channel_dict and channel_dict["rules"]:
                for i, rule in enumerate(channel_dict["rules"]):
                    logger.info(f"Rule {i} keys: {list(rule.keys())}")
                    logger.info(
                        f"Rule {i} externalActions: {rule.get('externalActions', 'MISSING')}"
                    )

            # Build DynamoDB item with PK/SK
            item = {
                "PK": f"CHANNEL#{channel.channel_id}",
                "SK": "METADATA",
                "GSI1PK": "CHANNEL",
                "GSI1SK": f"{str(channel.enabled).lower()}#{channel.name}",
                **channel_dict,
            }

            # Put item (will overwrite)
            self.table.put_item(Item=item, ConditionExpression="attribute_exists(PK)")

            logger.info(f"Updated channel: {channel.channel_id}")
            return channel

        except ClientError as e:
            if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
                logger.error(f"Channel not found: {channel.channel_id}")
                raise Exception(f"Channel not found: {channel.channel_id}")
            else:
                logger.error(f"DynamoDB error updating channel: {e}")
                raise Exception(f"Failed to update channel: {e}")

    def delete_channel(self, channel_id: str) -> bool:
        """
        Delete a channel.

        Args:
            channel_id: Channel ID to delete

        Returns:
            True if deleted, False if not found
        """
        try:
            self.table.delete_item(
                Key={
                    "PK": f"CHANNEL#{channel_id}",
                    "SK": "METADATA",
                },
                ConditionExpression="attribute_exists(PK)",
            )

            logger.info(f"Deleted channel: {channel_id}")
            return True

        except ClientError as e:
            if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
                logger.info(f"Channel not found for deletion: {channel_id}")
                return False
            else:
                logger.error(f"DynamoDB error deleting channel: {e}")
                raise Exception(f"Failed to delete channel: {e}")

    def _item_to_channel(self, item: dict) -> Channel:
        """Convert DynamoDB item to Channel model."""
        # Remove DynamoDB-specific fields
        channel_data = {
            k: v
            for k, v in item.items()
            if k not in ["PK", "SK", "GSI1PK", "GSI1SK", "TTL"]
        }
        return Channel(**channel_data)
