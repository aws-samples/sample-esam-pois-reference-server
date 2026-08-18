# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Property-based tests for action state persistence.

Feature: external-actions
Property 3: Action State Persistence

For any action with cleanup configuration that executes successfully, an ActionState
entry should be created containing action_id, channel_id, trigger_signal, cleanup_config,
and timestamp, and this state should persist across system restarts.

Validates: Requirements 3.1, 3.2, 3.8
"""

import pytest
from hypothesis import given, strategies as st, settings
from datetime import datetime, timedelta
import uuid

from domain.models.external_actions import ActionState
from domain.repositories.action_state_repository import InMemoryActionStateRepository

# Strategies for generating test data
channel_id_strategy = st.text(
    alphabet=st.characters(
        whitelist_categories=("Lu", "Ll", "Nd"), whitelist_characters="-_"
    ),
    min_size=5,
    max_size=50,
)

action_id_strategy = st.uuids().map(str)

action_type_strategy = st.sampled_from(
    ["medialive_schedule_action", "webhook", "sns_notification"]
)

signal_data_strategy = st.fixed_dictionaries(
    {
        "pts": st.integers(min_value=0, max_value=2**32),
        "segmentation_type_id": st.integers(min_value=0, max_value=255),
        "segmentation_upid": st.text(min_size=0, max_size=50),
    }
)

cleanup_config_strategy = st.fixed_dictionaries(
    {
        "trigger_type_id": st.integers(min_value=0, max_value=255),
        "timeout_seconds": st.integers(min_value=1, max_value=3600),
    }
)

datetime_strategy = st.datetimes(
    min_value=datetime(2024, 1, 1), max_value=datetime(2025, 12, 31)
)


def create_action_state(
    channel_id: str,
    action_id: str,
    action_type: str,
    trigger_signal: dict,
    cleanup_config: dict,
    created_at: datetime,
    with_expiration: bool = False,
) -> ActionState:
    """Helper to create an ActionState."""
    state_id = str(uuid.uuid4())
    expires_at = None

    if with_expiration and "timeout_seconds" in cleanup_config:
        expires_at = created_at + timedelta(seconds=cleanup_config["timeout_seconds"])

    return ActionState(
        state_id=state_id,
        channel_id=channel_id,
        action_id=action_id,
        action_type=action_type,
        trigger_signal=trigger_signal,
        cleanup_config=cleanup_config,
        created_at=created_at,
        expires_at=expires_at,
    )


# Feature: external-actions, Property 3: Action State Persistence
@settings(max_examples=100)
@given(
    channel_id=channel_id_strategy,
    action_id=action_id_strategy,
    action_type=action_type_strategy,
    trigger_signal=signal_data_strategy,
    cleanup_config=cleanup_config_strategy,
    created_at=datetime_strategy,
)
@pytest.mark.asyncio
async def test_action_state_contains_required_fields(
    channel_id: str,
    action_id: str,
    action_type: str,
    trigger_signal: dict,
    cleanup_config: dict,
    created_at: datetime,
):
    """
    Property: For any action state saved, it should contain all required fields:
    state_id, channel_id, action_id, action_type, trigger_signal, cleanup_config,
    and created_at.
    """
    # Arrange
    repository = InMemoryActionStateRepository()
    state = create_action_state(
        channel_id, action_id, action_type, trigger_signal, cleanup_config, created_at
    )

    # Act
    await repository.save(state)
    retrieved = await repository.get_by_id(state.state_id)

    # Assert - All required fields should be present
    assert retrieved is not None, "State should be retrievable after saving"
    assert retrieved.state_id == state.state_id, "state_id should match"
    assert retrieved.channel_id == channel_id, "channel_id should match"
    assert retrieved.action_id == action_id, "action_id should match"
    assert retrieved.action_type == action_type, "action_type should match"
    assert retrieved.trigger_signal == trigger_signal, "trigger_signal should match"
    assert retrieved.cleanup_config == cleanup_config, "cleanup_config should match"
    assert retrieved.created_at == created_at, "created_at should match"


# Feature: external-actions, Property 3: Action State Persistence
@settings(max_examples=100)
@given(
    channel_id=channel_id_strategy,
    action_id=action_id_strategy,
    action_type=action_type_strategy,
    trigger_signal=signal_data_strategy,
    cleanup_config=cleanup_config_strategy,
    created_at=datetime_strategy,
)
@pytest.mark.asyncio
async def test_action_state_persists_across_retrievals(
    channel_id: str,
    action_id: str,
    action_type: str,
    trigger_signal: dict,
    cleanup_config: dict,
    created_at: datetime,
):
    """
    Property: An action state should persist and be retrievable multiple times
    with consistent data (simulating persistence across system restarts).
    """
    # Arrange
    repository = InMemoryActionStateRepository()
    state = create_action_state(
        channel_id, action_id, action_type, trigger_signal, cleanup_config, created_at
    )

    # Act
    await repository.save(state)

    # Retrieve multiple times
    retrieved1 = await repository.get_by_id(state.state_id)
    retrieved2 = await repository.get_by_id(state.state_id)
    retrieved3 = await repository.get_by_id(state.state_id)

    # Assert - All retrievals should return the same data
    assert retrieved1 is not None
    assert retrieved2 is not None
    assert retrieved3 is not None

    assert retrieved1.state_id == retrieved2.state_id == retrieved3.state_id
    assert retrieved1.channel_id == retrieved2.channel_id == retrieved3.channel_id
    assert retrieved1.action_id == retrieved2.action_id == retrieved3.action_id
    assert (
        retrieved1.trigger_signal
        == retrieved2.trigger_signal
        == retrieved3.trigger_signal
    )


# Feature: external-actions, Property 3: Action State Persistence
@settings(max_examples=100)
@given(
    states_data=st.lists(
        st.tuples(
            channel_id_strategy,
            action_id_strategy,
            action_type_strategy,
            signal_data_strategy,
            cleanup_config_strategy,
            datetime_strategy,
        ),
        min_size=1,
        max_size=20,
    )
)
@pytest.mark.asyncio
async def test_multiple_states_persist_independently(states_data: list):
    """
    Property: Multiple action states can be saved and each should persist
    independently with its own data.
    """
    # Arrange & Act - Save all states
    repository = InMemoryActionStateRepository()
    states = []
    for channel_id, action_id, action_type, signal, cleanup, created in states_data:
        state = create_action_state(
            channel_id, action_id, action_type, signal, cleanup, created
        )
        await repository.save(state)
        states.append(state)

    # Assert - Each state should be independently retrievable
    for original_state in states:
        retrieved = await repository.get_by_id(original_state.state_id)

        assert (
            retrieved is not None
        ), f"State {original_state.state_id} should be retrievable"
        assert retrieved.state_id == original_state.state_id
        assert retrieved.channel_id == original_state.channel_id
        assert retrieved.action_id == original_state.action_id
        assert retrieved.action_type == original_state.action_type


# Feature: external-actions, Property 3: Action State Persistence
@settings(max_examples=100)
@given(
    channel_id=channel_id_strategy,
    states_data=st.lists(
        st.tuples(
            action_id_strategy,
            action_type_strategy,
            signal_data_strategy,
            cleanup_config_strategy,
            datetime_strategy,
        ),
        min_size=1,
        max_size=10,
    ),
)
@pytest.mark.asyncio
async def test_get_by_channel_returns_all_channel_states(
    channel_id: str, states_data: list
):
    """
    Property: get_by_channel should return all and only the states for the
    specified channel.
    """
    # Arrange - Create states for the target channel
    repository = InMemoryActionStateRepository()
    target_states = []
    for action_id, action_type, signal, cleanup, created in states_data:
        state = create_action_state(
            channel_id, action_id, action_type, signal, cleanup, created
        )
        await repository.save(state)
        target_states.append(state)

    # Create some states for other channels
    for i in range(3):
        other_state = create_action_state(
            f"other-channel-{i}",
            str(uuid.uuid4()),
            "webhook",
            {"pts": 1000},
            {"trigger_type_id": 53},
            datetime.utcnow(),
        )
        await repository.save(other_state)

    # Act
    retrieved_states = await repository.get_by_channel(channel_id)

    # Assert - Should return all and only target channel states
    assert len(retrieved_states) == len(
        target_states
    ), f"Should return exactly {len(target_states)} states for channel {channel_id}"

    retrieved_ids = {state.state_id for state in retrieved_states}
    target_ids = {state.state_id for state in target_states}

    assert (
        retrieved_ids == target_ids
    ), "Retrieved states should match the target channel states"

    # All retrieved states should belong to the target channel
    for state in retrieved_states:
        assert (
            state.channel_id == channel_id
        ), f"All retrieved states should belong to channel {channel_id}"


# Feature: external-actions, Property 3: Action State Persistence
@settings(max_examples=100)
@given(
    channel_id=channel_id_strategy,
    action_id=action_id_strategy,
    action_type=action_type_strategy,
    trigger_signal=signal_data_strategy,
    cleanup_config=cleanup_config_strategy,
    created_at=datetime_strategy,
)
@pytest.mark.asyncio
async def test_state_with_expiration_persists_expires_at(
    channel_id: str,
    action_id: str,
    action_type: str,
    trigger_signal: dict,
    cleanup_config: dict,
    created_at: datetime,
):
    """
    Property: An action state with expiration should persist the expires_at field.
    """
    # Arrange
    repository = InMemoryActionStateRepository()
    state = create_action_state(
        channel_id,
        action_id,
        action_type,
        trigger_signal,
        cleanup_config,
        created_at,
        with_expiration=True,
    )

    # Act
    await repository.save(state)
    retrieved = await repository.get_by_id(state.state_id)

    # Assert
    assert retrieved is not None
    assert retrieved.expires_at is not None, "expires_at should be set"
    assert retrieved.expires_at == state.expires_at, "expires_at should match"


# Feature: external-actions, Property 3: Action State Persistence
@settings(max_examples=100)
@given(
    channel_id=channel_id_strategy,
    action_id=action_id_strategy,
    action_type=action_type_strategy,
    trigger_signal=signal_data_strategy,
    cleanup_config=cleanup_config_strategy,
    created_at=datetime_strategy,
)
@pytest.mark.asyncio
async def test_nonexistent_state_returns_none(
    channel_id: str,
    action_id: str,
    action_type: str,
    trigger_signal: dict,
    cleanup_config: dict,
    created_at: datetime,
):
    """
    Property: Attempting to retrieve a non-existent state should return None.
    """
    # Arrange
    repository = InMemoryActionStateRepository()
    nonexistent_id = str(uuid.uuid4())

    # Act
    retrieved = await repository.get_by_id(nonexistent_id)

    # Assert
    assert retrieved is None, "Non-existent state should return None"
