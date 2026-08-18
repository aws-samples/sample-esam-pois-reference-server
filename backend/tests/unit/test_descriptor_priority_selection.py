# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Unit tests for descriptor priority selection functionality."""

from dataclasses import dataclass

from domain.services.rule_evaluator import _get_segmentation_type_id_by_priority


# Mock descriptor class for testing
@dataclass
class MockDescriptor:
    descriptor_tag: int
    segmentation_type_id: int


class TestDescriptorPrioritySelection:
    """Test cases for _get_segmentation_type_id_by_priority function."""

    def test_multiple_descriptors_first_priority_matches(self):
        """Test that first priority match is selected when multiple descriptors exist."""
        descriptors = [
            MockDescriptor(descriptor_tag=0x02, segmentation_type_id=48),
            MockDescriptor(descriptor_tag=0x02, segmentation_type_id=52),
            MockDescriptor(descriptor_tag=0x02, segmentation_type_id=34),
        ]
        priority_list = [52, 34, 48]

        result = _get_segmentation_type_id_by_priority(descriptors, priority_list)

        assert result == 52, "Should select first priority match (52)"

    def test_multiple_descriptors_second_priority_matches(self):
        """Test that second priority match is selected when first doesn't match."""
        descriptors = [
            MockDescriptor(descriptor_tag=0x02, segmentation_type_id=48),
            MockDescriptor(descriptor_tag=0x02, segmentation_type_id=34),
            MockDescriptor(descriptor_tag=0x02, segmentation_type_id=50),
        ]
        priority_list = [52, 34, 48]

        result = _get_segmentation_type_id_by_priority(descriptors, priority_list)

        assert result == 34, "Should select second priority match (34)"

    def test_no_priority_matches_fallback_to_first(self):
        """Test fallback to first descriptor when no priorities match."""
        descriptors = [
            MockDescriptor(descriptor_tag=0x02, segmentation_type_id=48),
            MockDescriptor(descriptor_tag=0x02, segmentation_type_id=50),
            MockDescriptor(descriptor_tag=0x02, segmentation_type_id=51),
        ]
        priority_list = [52, 34]

        result = _get_segmentation_type_id_by_priority(descriptors, priority_list)

        assert result == 48, "Should fallback to first descriptor (48)"

    def test_single_descriptor_with_matching_priority(self):
        """Test single descriptor is selected when it matches priority."""
        descriptors = [MockDescriptor(descriptor_tag=0x02, segmentation_type_id=52)]
        priority_list = [52, 34, 48]

        result = _get_segmentation_type_id_by_priority(descriptors, priority_list)

        assert result == 52, "Should select the single descriptor (52)"

    def test_single_descriptor_with_non_matching_priority(self):
        """Test single descriptor is selected even when it doesn't match priority."""
        descriptors = [MockDescriptor(descriptor_tag=0x02, segmentation_type_id=48)]
        priority_list = [52, 34]

        result = _get_segmentation_type_id_by_priority(descriptors, priority_list)

        assert result == 48, "Should select the single descriptor (48)"

    def test_single_descriptor_with_empty_priority(self):
        """Test single descriptor is selected with empty priority list."""
        descriptors = [MockDescriptor(descriptor_tag=0x02, segmentation_type_id=48)]
        priority_list = []

        result = _get_segmentation_type_id_by_priority(descriptors, priority_list)

        assert result == 48, "Should select the single descriptor (48)"

    def test_empty_descriptor_list_returns_none(self):
        """Test that empty descriptor list returns None."""
        descriptors = []
        priority_list = [52, 34, 48]

        result = _get_segmentation_type_id_by_priority(descriptors, priority_list)

        assert result is None, "Should return None for empty descriptor list"

    def test_empty_priority_list_uses_first_descriptor(self):
        """Test that empty priority list uses first descriptor."""
        descriptors = [
            MockDescriptor(descriptor_tag=0x02, segmentation_type_id=48),
            MockDescriptor(descriptor_tag=0x02, segmentation_type_id=52),
        ]
        priority_list = []

        result = _get_segmentation_type_id_by_priority(descriptors, priority_list)

        assert result == 48, "Should use first descriptor (48) when priority is empty"

    def test_non_segmentation_descriptors_filtered_out(self):
        """Test that non-segmentation descriptors (tag != 0x02) are filtered out."""
        descriptors = [
            MockDescriptor(
                descriptor_tag=0x01, segmentation_type_id=99
            ),  # Not segmentation
            MockDescriptor(
                descriptor_tag=0x02, segmentation_type_id=52
            ),  # Segmentation
            MockDescriptor(
                descriptor_tag=0x03, segmentation_type_id=88
            ),  # Not segmentation
        ]
        priority_list = [52, 34, 48]

        result = _get_segmentation_type_id_by_priority(descriptors, priority_list)

        assert result == 52, "Should only consider segmentation descriptors (tag 0x02)"

    def test_only_non_segmentation_descriptors_returns_none(self):
        """Test that list with only non-segmentation descriptors returns None."""
        descriptors = [
            MockDescriptor(descriptor_tag=0x01, segmentation_type_id=99),
            MockDescriptor(descriptor_tag=0x03, segmentation_type_id=88),
        ]
        priority_list = [52, 34, 48]

        result = _get_segmentation_type_id_by_priority(descriptors, priority_list)

        assert (
            result is None
        ), "Should return None when no segmentation descriptors exist"
