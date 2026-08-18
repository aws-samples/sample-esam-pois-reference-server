# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Property-based tests for stateful mode functionality."""

from hypothesis import given, strategies as st, settings
from typing import Optional
from unittest.mock import Mock, patch

from domain.repositories.channel_state_repository import ChannelStateRepository
from domain.models.channel import ChannelState


# Feature: stateful-mode, Property 9: State Persistence Round Trip
@settings(max_examples=100)
@given(
    channel_id=st.text(
        min_size=1,
        max_size=50,
        alphabet=st.characters(blacklist_characters=["\x00", "#"]),
    ),
    in_break=st.booleans(),
    break_start_time=st.one_of(
        st.none(), st.datetimes().map(lambda dt: dt.isoformat() + "Z")
    ),
    break_event_id=st.one_of(st.none(), st.integers(min_value=0, max_value=2**32 - 1)),
    break_expiry_time=st.one_of(
        st.none(), st.integers(min_value=0, max_value=2**63 - 1)
    ),
    last_processed_time=st.datetimes().map(lambda dt: dt.isoformat() + "Z"),
)
def test_property_state_persistence_round_trip(
    channel_id: str,
    in_break: bool,
    break_start_time: Optional[str],
    break_event_id: Optional[int],
    break_expiry_time: Optional[int],
    last_processed_time: str,
):
    """
    Property 9: State Persistence Round Trip

    For any valid ChannelState, saving it to DynamoDB and then retrieving it
    should produce an equivalent ChannelState with all fields preserved.

    Validates: Requirements 6.2, 6.4
    """
    # Create a channel state with random values
    original_state = ChannelState(
        channelId=channel_id,
        inBreak=in_break,
        breakStartTime=break_start_time,
        breakEventId=break_event_id,
        breakExpiryTime=break_expiry_time,
        lastProcessedTime=last_processed_time,
    )

    # Mock DynamoDB table
    with patch("boto3.resource") as mock_resource:
        mock_table = Mock()
        mock_resource.return_value.Table.return_value = mock_table

        # Create repository
        repository = ChannelStateRepository("test-table")

        # Mock save operation
        saved_item = None

        def capture_save(Item):
            nonlocal saved_item
            saved_item = Item

        mock_table.put_item.side_effect = capture_save

        # Save the state
        repository.save_state(original_state)

        # Mock get operation to return the saved item
        mock_table.get_item.return_value = {"Item": saved_item}

        # Retrieve the state
        retrieved_state = repository.get_state(channel_id)

        # Assert: all fields are preserved
        assert retrieved_state is not None, "Retrieved state should not be None"
        assert (
            retrieved_state.channel_id == original_state.channel_id
        ), "channel_id should be preserved"
        assert (
            retrieved_state.in_break == original_state.in_break
        ), "in_break should be preserved"
        assert (
            retrieved_state.break_start_time == original_state.break_start_time
        ), "break_start_time should be preserved"
        assert (
            retrieved_state.break_event_id == original_state.break_event_id
        ), "break_event_id should be preserved"
        assert (
            retrieved_state.break_expiry_time == original_state.break_expiry_time
        ), "break_expiry_time should be preserved"
        assert (
            retrieved_state.last_processed_time == original_state.last_processed_time
        ), "last_processed_time should be preserved"
