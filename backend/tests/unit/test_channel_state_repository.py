# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Unit tests for ChannelStateRepository."""

import pytest
from unittest.mock import Mock, patch
from botocore.exceptions import ClientError

from domain.repositories.channel_state_repository import ChannelStateRepository
from domain.models.channel import ChannelState


@pytest.fixture
def mock_dynamodb_table():
    """Mock DynamoDB table."""
    with patch("boto3.resource") as mock_resource:
        mock_table = Mock()
        mock_resource.return_value.Table.return_value = mock_table
        yield mock_table


@pytest.fixture
def repository(mock_dynamodb_table):
    """Create repository with mocked table."""
    return ChannelStateRepository("test-table")


@pytest.fixture
def sample_state():
    """Create sample channel state."""
    return ChannelState(
        channelId="test-channel-1",
        inBreak=True,
        breakStartTime="2026-02-02T19:00:00Z",
        breakEventId=12345,
        breakExpiryTime=1738526400000,
        lastProcessedTime="2026-02-02T19:00:05Z",
    )


class TestChannelStateRepository:
    """Test cases for ChannelStateRepository."""

    def test_get_state_returns_none_for_nonexistent_channel(
        self, repository, mock_dynamodb_table
    ):
        """Test that get_state returns None when channel state doesn't exist."""
        mock_dynamodb_table.get_item.return_value = {}

        result = repository.get_state("nonexistent-channel")

        assert result is None
        mock_dynamodb_table.get_item.assert_called_once_with(
            Key={"PK": "CHANNEL#nonexistent-channel", "SK": "STATE"}
        )

    def test_get_state_returns_state_when_exists(self, repository, mock_dynamodb_table):
        """Test that get_state returns ChannelState when it exists."""
        mock_dynamodb_table.get_item.return_value = {
            "Item": {
                "PK": "CHANNEL#test-channel-1",
                "SK": "STATE",
                "channelId": "test-channel-1",
                "inBreak": True,
                "breakStartTime": "2026-02-02T19:00:00Z",
                "breakEventId": 12345,
                "breakExpiryTime": 1738526400000,
                "lastProcessedTime": "2026-02-02T19:00:05Z",
            }
        }

        result = repository.get_state("test-channel-1")

        assert result is not None
        assert result.channel_id == "test-channel-1"
        assert result.in_break is True
        assert result.break_event_id == 12345

    def test_save_state_creates_new_state(
        self, repository, mock_dynamodb_table, sample_state
    ):
        """Test that save_state creates a new state."""
        repository.save_state(sample_state)

        mock_dynamodb_table.put_item.assert_called_once()
        call_args = mock_dynamodb_table.put_item.call_args
        item = call_args.kwargs["Item"]

        assert item["PK"] == "CHANNEL#test-channel-1"
        assert item["SK"] == "STATE"
        assert item["channelId"] == "test-channel-1"
        assert item["inBreak"] is True

    def test_save_state_updates_existing_state(self, repository, mock_dynamodb_table):
        """Test that save_state updates an existing state."""
        updated_state = ChannelState(
            channelId="test-channel-1",
            inBreak=False,
            breakStartTime=None,
            breakEventId=None,
            breakExpiryTime=None,
            lastProcessedTime="2026-02-02T19:05:00Z",
        )

        repository.save_state(updated_state)

        mock_dynamodb_table.put_item.assert_called_once()
        call_args = mock_dynamodb_table.put_item.call_args
        item = call_args.kwargs["Item"]

        assert item["inBreak"] is False
        assert item["breakEventId"] is None

    def test_delete_state_removes_state(self, repository, mock_dynamodb_table):
        """Test that delete_state removes state from DynamoDB."""
        result = repository.delete_state("test-channel-1")

        assert result is True
        mock_dynamodb_table.delete_item.assert_called_once_with(
            Key={"PK": "CHANNEL#test-channel-1", "SK": "STATE"},
            ConditionExpression="attribute_exists(PK)",
        )

    def test_delete_state_returns_false_when_not_found(
        self, repository, mock_dynamodb_table
    ):
        """Test that delete_state returns False when state doesn't exist."""
        error_response = {"Error": {"Code": "ConditionalCheckFailedException"}}
        mock_dynamodb_table.delete_item.side_effect = ClientError(
            error_response, "DeleteItem"
        )

        result = repository.delete_state("nonexistent-channel")

        assert result is False

    def test_get_state_handles_dynamodb_error(self, repository, mock_dynamodb_table):
        """Test that get_state handles DynamoDB errors gracefully."""
        error_response = {
            "Error": {"Code": "ServiceUnavailable", "Message": "Service unavailable"}
        }
        mock_dynamodb_table.get_item.side_effect = ClientError(
            error_response, "GetItem"
        )

        result = repository.get_state("test-channel-1")

        # Should return None instead of raising
        assert result is None

    def test_save_state_handles_dynamodb_error(self, repository, mock_dynamodb_table):
        """Test that save_state handles DynamoDB errors gracefully."""
        error_response = {
            "Error": {"Code": "ServiceUnavailable", "Message": "Service unavailable"}
        }
        mock_dynamodb_table.put_item.side_effect = ClientError(
            error_response, "PutItem"
        )

        sample_state = ChannelState(
            channelId="test-channel-1",
            inBreak=True,
            breakStartTime="2026-02-02T19:00:00Z",
            breakEventId=12345,
            breakExpiryTime=1738526400000,
            lastProcessedTime="2026-02-02T19:00:05Z",
        )

        # Should not raise exception
        repository.save_state(sample_state)
