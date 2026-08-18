# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Repository interface and implementation for Action Audit Logs.

This module provides persistence for action execution audit logs,
supporting queries by channel, time range, and action type.
"""

from abc import ABC, abstractmethod
from typing import List, Optional
from datetime import datetime
import boto3
from boto3.dynamodb.conditions import Key, Attr

from domain.models.external_actions import ActionAuditEntry, ExecutionResult


class ActionAuditRepository(ABC):
    """Abstract repository interface for action audit logs."""

    @abstractmethod
    async def save(self, entry: ActionAuditEntry) -> None:
        """
        Save an audit log entry.

        Args:
            entry: The audit log entry to save
        """
        pass

    @abstractmethod
    async def get_by_id(self, entry_id: str) -> Optional[ActionAuditEntry]:
        """
        Retrieve an audit log entry by ID.

        Args:
            entry_id: The unique identifier of the entry

        Returns:
            The audit log entry if found, None otherwise
        """
        pass

    @abstractmethod
    async def query_by_channel(
        self,
        channel_id: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        action_type: Optional[str] = None,
        limit: int = 100,
    ) -> List[ActionAuditEntry]:
        """
        Query audit logs by channel with optional filters.

        Args:
            channel_id: The channel ID to query
            start_time: Optional start of time range
            end_time: Optional end of time range
            action_type: Optional action type filter
            limit: Maximum number of results to return

        Returns:
            List of matching audit log entries
        """
        pass

    @abstractmethod
    async def delete_old_entries(self, before_date: datetime) -> int:
        """
        Delete audit log entries older than the specified date.

        Args:
            before_date: Delete entries with timestamp before this date

        Returns:
            Number of entries deleted
        """
        pass


class DynamoDBActionAuditRepository(ActionAuditRepository):
    """DynamoDB implementation of ActionAuditRepository using single-table design."""

    def __init__(self, table_name: str, region: str = "us-east-1"):
        """
        Initialize the DynamoDB repository.

        Args:
            table_name: Name of the DynamoDB table
            region: AWS region
        """
        self.table_name = table_name
        self.region = region
        self._dynamodb = None
        self._table = None

    @property
    def table(self):
        """Lazy-load DynamoDB table resource."""
        if self._table is None:
            if self._dynamodb is None:
                self._dynamodb = boto3.resource("dynamodb", region_name=self.region)
            self._table = self._dynamodb.Table(self.table_name)
        return self._table

    async def save(self, entry: ActionAuditEntry) -> None:
        """Save an audit log entry to DynamoDB using single-table design."""
        try:
            from decimal import Decimal

            # Helper function to convert floats to Decimal
            def convert_floats(obj):
                if isinstance(obj, float):
                    return Decimal(str(obj))
                elif isinstance(obj, dict):
                    return {k: convert_floats(v) for k, v in obj.items()}
                elif isinstance(obj, list):
                    return [convert_floats(item) for item in obj]
                return obj

            # Single-table design keys
            # PK: ACTION_AUDIT#{entry_id}
            # SK: ACTION_AUDIT#{entry_id}
            # GSI2PK: CHANNEL#{channel_id}
            # GSI2SK: ACTION_AUDIT#{timestamp}

            item = {
                "PK": f"ACTION_AUDIT#{entry.entry_id}",
                "SK": f"ACTION_AUDIT#{entry.entry_id}",
                "GSI2PK": f"CHANNEL#{entry.channel_id}",
                "GSI2SK": f"ACTION_AUDIT#{entry.timestamp.isoformat()}",
                "entry_id": entry.entry_id,
                "channel_id": entry.channel_id,
                "timestamp": entry.timestamp.isoformat(),
                "rule_id": entry.rule_id,
                "action_id": entry.action_id,
                "action_type": entry.action_type,
                "signal_data": convert_floats(entry.signal_data),
                "execution_result": entry.execution_result.value,
                "retry_count": entry.retry_count,
                "duration_ms": entry.duration_ms,
            }

            # Add optional fields if present
            if entry.error_message:
                item["error_message"] = entry.error_message
            if entry.request_payload:
                item["request_payload"] = convert_floats(entry.request_payload)
            if entry.response_payload:
                item["response_payload"] = convert_floats(entry.response_payload)

            # Add TTL for automatic cleanup (30 days default)
            ttl_timestamp = int(entry.timestamp.timestamp()) + (30 * 24 * 60 * 60)
            item["TTL"] = ttl_timestamp

            self.table.put_item(Item=item)

        except Exception as e:
            raise RuntimeError(f"Failed to save audit entry: {str(e)}") from e

    async def get_by_id(self, entry_id: str) -> Optional[ActionAuditEntry]:
        """Retrieve an audit log entry by ID from DynamoDB."""
        try:
            response = self.table.get_item(
                Key={"PK": f"ACTION_AUDIT#{entry_id}", "SK": f"ACTION_AUDIT#{entry_id}"}
            )

            if "Item" not in response:
                return None

            return self._item_to_entry(response["Item"])

        except Exception as e:
            raise RuntimeError(f"Failed to get audit entry: {str(e)}") from e

    async def query_by_channel(
        self,
        channel_id: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        action_type: Optional[str] = None,
        limit: int = 100,
    ) -> List[ActionAuditEntry]:
        """
        Query audit logs by channel using GSI2.

        GSI2PK: CHANNEL#{channel_id}
        GSI2SK: ACTION_AUDIT#{timestamp}
        """
        try:
            # Build key condition
            key_condition = Key("GSI2PK").eq(f"CHANNEL#{channel_id}")

            # Add time range to key condition if provided
            if start_time and end_time:
                key_condition = key_condition & Key("GSI2SK").between(
                    f"ACTION_AUDIT#{start_time.isoformat()}",
                    f"ACTION_AUDIT#{end_time.isoformat()}",
                )
            elif start_time:
                key_condition = key_condition & Key("GSI2SK").gte(
                    f"ACTION_AUDIT#{start_time.isoformat()}"
                )
            elif end_time:
                key_condition = key_condition & Key("GSI2SK").lte(
                    f"ACTION_AUDIT#{end_time.isoformat()}"
                )

            # Build filter expression for action_type
            filter_expr = None
            if action_type:
                filter_expr = Attr("action_type").eq(action_type)

            # Query GSI2
            query_params = {
                "IndexName": "GSI2",
                "KeyConditionExpression": key_condition,
                "Limit": limit,
                "ScanIndexForward": False,  # Descending order (newest first)
            }

            if filter_expr:
                query_params["FilterExpression"] = filter_expr

            response = self.table.query(**query_params)

            entries = []
            for item in response.get("Items", []):
                entries.append(self._item_to_entry(item))

            return entries

        except Exception as e:
            raise RuntimeError(f"Failed to query audit entries: {str(e)}") from e

    async def delete_old_entries(self, before_date: datetime) -> int:
        """
        Delete audit log entries older than the specified date.

        Note: In production, rely on DynamoDB TTL for automatic cleanup.
        This method is provided for manual cleanup if needed.
        """
        try:
            # Query old entries using GSI2
            # We need to scan all channels, so this is expensive
            # Better to rely on TTL for automatic cleanup

            filter_expr = Attr("timestamp").lt(before_date.isoformat())
            response = self.table.scan(
                FilterExpression=filter_expr, ProjectionExpression="PK, SK"
            )

            items_to_delete = response.get("Items", [])
            deleted_count = 0

            # Batch delete
            with self.table.batch_writer() as batch:
                for item in items_to_delete:
                    batch.delete_item(Key={"PK": item["PK"], "SK": item["SK"]})
                    deleted_count += 1

            return deleted_count

        except Exception as e:
            raise RuntimeError(f"Failed to delete old audit entries: {str(e)}") from e

    def _item_to_entry(self, item: dict) -> ActionAuditEntry:
        """Convert DynamoDB item to ActionAuditEntry."""
        return ActionAuditEntry(
            entry_id=item["entry_id"],
            timestamp=datetime.fromisoformat(item["timestamp"]),
            channel_id=item["channel_id"],
            rule_id=item["rule_id"],
            action_id=item["action_id"],
            action_type=item["action_type"],
            signal_data=item["signal_data"],
            execution_result=ExecutionResult(item["execution_result"]),
            error_message=item.get("error_message"),
            request_payload=item.get("request_payload"),
            response_payload=item.get("response_payload"),
            retry_count=int(item.get("retry_count", 0)),
            duration_ms=int(item.get("duration_ms", 0)),
        )


class InMemoryActionAuditRepository(ActionAuditRepository):
    """In-memory implementation for testing."""

    def __init__(self):
        """Initialize the in-memory repository."""
        self._entries: dict[str, ActionAuditEntry] = {}

    async def save(self, entry: ActionAuditEntry) -> None:
        """Save an audit log entry to memory."""
        self._entries[entry.entry_id] = entry

    async def get_by_id(self, entry_id: str) -> Optional[ActionAuditEntry]:
        """Retrieve an audit log entry by ID from memory."""
        return self._entries.get(entry_id)

    async def query_by_channel(
        self,
        channel_id: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        action_type: Optional[str] = None,
        limit: int = 100,
    ) -> List[ActionAuditEntry]:
        """Query audit logs by channel with optional filters."""
        results = []

        for entry in self._entries.values():
            # Filter by channel
            if entry.channel_id != channel_id:
                continue

            # Filter by time range
            if start_time and entry.timestamp < start_time:
                continue
            if end_time and entry.timestamp > end_time:
                continue

            # Filter by action type
            if action_type and entry.action_type != action_type:
                continue

            results.append(entry)

        # Sort by timestamp descending
        results.sort(key=lambda e: e.timestamp, reverse=True)

        # Apply limit
        return results[:limit]

    async def delete_old_entries(self, before_date: datetime) -> int:
        """Delete audit log entries older than the specified date."""
        to_delete = [
            entry_id
            for entry_id, entry in self._entries.items()
            if entry.timestamp < before_date
        ]

        for entry_id in to_delete:
            del self._entries[entry_id]

        return len(to_delete)
