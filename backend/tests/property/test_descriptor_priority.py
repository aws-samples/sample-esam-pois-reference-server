# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Property-based tests for descriptor priority functionality."""

from hypothesis import given, strategies as st, settings, assume
from typing import List
from dataclasses import dataclass

from domain.services.rule_evaluator import (
    _parse_descriptor_priority,
    _get_segmentation_type_id_by_priority,
)


# Mock descriptor class for testing
@dataclass
class MockDescriptor:
    descriptor_tag: int
    segmentation_type_id: int


# Feature: descriptor-priority, Property 1: Valid Priority String Parsing
@settings(max_examples=100)
@given(
    priority_ids=st.lists(
        st.integers(min_value=0, max_value=255), min_size=1, max_size=10, unique=True
    ),
    whitespace_before=st.lists(
        st.sampled_from(["", " ", "  ", "\t"]), min_size=1, max_size=10
    ),
    whitespace_after=st.lists(
        st.sampled_from(["", " ", "  ", "\t"]), min_size=1, max_size=10
    ),
)
def test_property_valid_priority_string_parsing(
    priority_ids: List[int], whitespace_before: List[str], whitespace_after: List[str]
):
    """
    Property 1: Valid Priority String Parsing

    For any valid comma-separated string of numeric values (with or without whitespace),
    parsing the descriptor priority should produce a list of integers in the same order,
    with whitespace trimmed.

    Validates: Requirements 1.1, 1.4
    """
    # Ensure we have matching whitespace lists
    while len(whitespace_before) < len(priority_ids):
        whitespace_before.append("")
    while len(whitespace_after) < len(priority_ids):
        whitespace_after.append("")

    # Build priority string with random whitespace
    parts = []
    for i, priority_id in enumerate(priority_ids):
        parts.append(f"{whitespace_before[i]}{priority_id}{whitespace_after[i]}")

    priority_str = ",".join(parts)

    # Parse the priority string
    result = _parse_descriptor_priority(priority_str)

    # Assert: parsed list matches expected integers in order
    assert result == priority_ids, (
        f"Expected {priority_ids} but got {result} "
        f"from priority string: '{priority_str}'"
    )


# Feature: descriptor-priority, Property 2: Invalid Priority String Handling
@settings(max_examples=100)
@given(
    valid_ids=st.lists(st.integers(min_value=0, max_value=255), min_size=0, max_size=5),
    invalid_values=st.lists(
        st.one_of(
            st.text(
                alphabet="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
                min_size=1,
                max_size=5,
            ),
            st.sampled_from(["abc", "xyz", "invalid", "test"]),
        ),
        min_size=1,
        max_size=3,
    ),
)
def test_property_invalid_priority_string_handling(
    valid_ids: List[int], invalid_values: List[str]
):
    """
    Property 2: Invalid Priority String Handling

    For any descriptor priority string containing non-numeric values,
    the system should log a warning and return an empty priority list,
    resulting in fallback to first descriptor behavior.

    Validates: Requirements 1.2
    """
    # Build a priority string with mix of valid and invalid values
    all_values = [str(id) for id in valid_ids] + invalid_values
    priority_str = ",".join(all_values)

    # Parse the priority string
    result = _parse_descriptor_priority(priority_str)

    # Assert: returns empty list for invalid input
    assert result == [], (
        f"Expected empty list for invalid priority string '{priority_str}', "
        f"but got {result}"
    )


# Feature: descriptor-priority, Property 3: Priority-Based Descriptor Selection
@settings(max_examples=100)
@given(
    descriptor_type_ids=st.lists(
        st.integers(min_value=0, max_value=255), min_size=2, max_size=10, unique=True
    ),
    priority_list=st.lists(
        st.integers(min_value=0, max_value=255), min_size=1, max_size=5, unique=True
    ),
)
def test_property_priority_based_descriptor_selection(
    descriptor_type_ids: List[int], priority_list: List[int]
):
    """
    Property 3: Priority-Based Descriptor Selection

    For any list of descriptors and any non-empty priority list,
    the system should select the first descriptor whose segmentation_type_id
    appears in the priority list, checking priorities in order from first to last.

    Validates: Requirements 2.1, 2.2, 2.3
    """
    # Ensure at least one descriptor matches a priority
    # by adding the first descriptor's type_id to the priority list
    if not any(type_id in priority_list for type_id in descriptor_type_ids):
        priority_list = [descriptor_type_ids[0]] + priority_list

    # Create mock descriptors
    descriptors = [
        MockDescriptor(descriptor_tag=0x02, segmentation_type_id=type_id)
        for type_id in descriptor_type_ids
    ]

    # Get the selected type ID
    result = _get_segmentation_type_id_by_priority(descriptors, priority_list)

    # Find the expected result: first priority that matches any descriptor
    expected = None
    for priority_id in priority_list:
        if priority_id in descriptor_type_ids:
            expected = priority_id
            break

    # Assert: selected descriptor matches first priority match
    assert result == expected, (
        f"Expected {expected} but got {result}. "
        f"Descriptors: {descriptor_type_ids}, Priority: {priority_list}"
    )


# Feature: descriptor-priority, Property 4: Fallback to First Descriptor
@settings(max_examples=100)
@given(
    descriptor_type_ids=st.lists(
        st.integers(min_value=0, max_value=255), min_size=1, max_size=10, unique=True
    ),
    priority_list=st.lists(
        st.integers(min_value=0, max_value=255), min_size=1, max_size=5, unique=True
    ),
)
def test_property_fallback_to_first_descriptor(
    descriptor_type_ids: List[int], priority_list: List[int]
):
    """
    Property 4: Fallback to First Descriptor

    For any list of descriptors and any priority list where no descriptor's
    segmentation_type_id matches any priority value, the system should select
    the first descriptor in the array.

    Validates: Requirements 2.4
    """
    # Ensure NO descriptor matches any priority
    # by filtering out any matching IDs from priority list
    priority_list = [p for p in priority_list if p not in descriptor_type_ids]

    # Skip if we couldn't create a non-matching priority list
    assume(len(priority_list) > 0)

    # Create mock descriptors
    descriptors = [
        MockDescriptor(descriptor_tag=0x02, segmentation_type_id=type_id)
        for type_id in descriptor_type_ids
    ]

    # Get the selected type ID
    result = _get_segmentation_type_id_by_priority(descriptors, priority_list)

    # Assert: selected descriptor is the first one (fallback)
    expected = descriptor_type_ids[0]
    assert result == expected, (
        f"Expected fallback to first descriptor {expected} but got {result}. "
        f"Descriptors: {descriptor_type_ids}, Priority: {priority_list}"
    )


# Feature: descriptor-priority, Property 5: Single Descriptor Selection
@settings(max_examples=100)
@given(
    descriptor_type_id=st.integers(min_value=0, max_value=255),
    priority_config=st.one_of(
        st.none(),
        st.just([]),
        st.lists(st.integers(min_value=0, max_value=255), min_size=1, max_size=5),
    ),
)
def test_property_single_descriptor_selection(
    descriptor_type_id: int, priority_config: List[int]
):
    """
    Property 5: Single Descriptor Selection

    For any signal containing exactly one descriptor, the system should select
    that descriptor regardless of the descriptor_priority configuration
    (including null, empty, or non-matching priorities).

    Validates: Requirements 3.3
    """
    # Create a single mock descriptor
    descriptors = [
        MockDescriptor(descriptor_tag=0x02, segmentation_type_id=descriptor_type_id)
    ]

    # Get the selected type ID
    result = _get_segmentation_type_id_by_priority(descriptors, priority_config or [])

    # Assert: the single descriptor is always selected
    assert result == descriptor_type_id, (
        f"Expected single descriptor {descriptor_type_id} to be selected "
        f"but got {result}. Priority config: {priority_config}"
    )
