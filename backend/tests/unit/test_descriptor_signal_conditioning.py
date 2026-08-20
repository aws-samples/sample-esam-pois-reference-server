# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Regression tests for conditioning descriptor-based SCTE-35 signals.

Modern SCTE-35 usually arrives as a time_signal carrying a segmentation
descriptor rather than a splice_insert, and two defects made that path behave
incorrectly:

1. ``segmentation_duration`` is stored in seconds, but the rule engine and the
   stateful break expiry divided it by 90000 as if it were 90kHz ticks, so a
   60 second break was read as 0 seconds and duration conditions never matched.

2. threefive refuses to encode a segmentation descriptor whose type is a
   placement opportunity Start (0x34, 0x36, 0x38, 0x3A) while
   ``sub_segment_num`` is unset. Sources are not required to send that field,
   so encoding raised and the encoder returned the *unmodified* signal while
   the response still reported the modification as applied.
"""

import pytest

from domain.models.channel import Channel
from domain.services.rule_evaluator import _get_duration
from domain.services.scte35_encoder import encode_scte35
from domain.services.scte35_parser import parse_scte35
from domain.services.signal_processor import calculate_break_expiry_time, process_signal

# time_signal carrying a segmentation descriptor, no sub_segment fields present.
TIME_SIGNAL_WITH_DESCRIPTOR = (
    "/DAvAAAAAAAA///wBQb+dGKQoAAZAhdDVUVJSAAAjn+fCAgAAAAALKChijUCAKnMZ1g="
)

PROVIDER_PLACEMENT_OPPORTUNITY_START = 0x34


def _signal_with_duration(seconds: float, type_id: int) -> str:
    """Build a descriptor-based signal with the given type and duration."""
    signal = parse_scte35(TIME_SIGNAL_WITH_DESCRIPTOR)
    for descriptor in signal.splice_descriptors:
        if descriptor.descriptor_tag == 0x02:
            descriptor.segmentation_type_id = type_id
            descriptor.segmentation_duration = seconds
            descriptor.segmentation_duration_flag = True
    return encode_scte35(signal, original_base64=TIME_SIGNAL_WITH_DESCRIPTOR)


def _segmentation_duration(base64_signal: str) -> float | None:
    for descriptor in parse_scte35(base64_signal).splice_descriptors:
        if descriptor.descriptor_tag == 0x02:
            return descriptor.segmentation_duration
    return None


def _channel(modification_target: str) -> Channel:
    now = "2026-01-01T00:00:00Z"
    return Channel(
        channelId="sports-live-east",
        name="sports-live-east",
        enabled=True,
        statefulMode=False,
        defaultAction="noop",
        createdAt=now,
        updatedAt=now,
        rules=[
            {
                "ruleId": "cap-long-breaks",
                "name": "Cap breaks longer than 30s",
                "priority": 1,
                "enabled": True,
                "conditions": [
                    {
                        "field": "segmentationTypeId",
                        "operator": "eq",
                        "value": PROVIDER_PLACEMENT_OPPORTUNITY_START,
                    },
                    {"field": "duration", "operator": "gt", "value": 30},
                ],
                "action": "replace",
                "modifications": [
                    {"target": modification_target, "operation": "set", "value": 30}
                ],
            }
        ],
    )


class TestDescriptorDurationUnits:
    """segmentation_duration is seconds, not 90kHz ticks."""

    def test_duration_is_read_in_seconds(self):
        signal = parse_scte35(
            _signal_with_duration(60.0, PROVIDER_PLACEMENT_OPPORTUNITY_START)
        )

        assert _get_duration(signal) == 60

    @pytest.mark.parametrize(
        "seconds,threshold,expected", [(60.0, 30, True), (10.0, 30, False)]
    )
    def test_duration_conditions_compare_against_seconds(
        self, seconds, threshold, expected
    ):
        signal = parse_scte35(
            _signal_with_duration(seconds, PROVIDER_PLACEMENT_OPPORTUNITY_START)
        )

        assert ((_get_duration(signal) or 0) > threshold) is expected

    def test_break_expiry_is_calculated_for_descriptor_breaks(self):
        signal = parse_scte35(
            _signal_with_duration(60.0, PROVIDER_PLACEMENT_OPPORTUNITY_START)
        )

        assert calculate_break_expiry_time(signal, 0) is not None


class TestPlacementOpportunityStartEncoding:
    """Descriptors of the *Start types encode without sub_segment fields."""

    @pytest.mark.parametrize("type_id", [0x34, 0x36, 0x38, 0x3A])
    def test_start_types_do_not_silently_return_the_original(self, type_id):
        encoded = _signal_with_duration(45.0, type_id)

        assert encoded != TIME_SIGNAL_WITH_DESCRIPTOR
        descriptor = next(
            d
            for d in parse_scte35(encoded).splice_descriptors
            if d.descriptor_tag == 0x02
        )
        assert descriptor.segmentation_type_id == type_id
        assert descriptor.segmentation_duration == pytest.approx(45.0)


class TestConditioningDescriptorSignals:
    """The documented rule caps a long placement opportunity."""

    def test_segmentation_duration_is_capped(self):
        original = _signal_with_duration(60.0, PROVIDER_PLACEMENT_OPPORTUNITY_START)

        result, _ = process_signal(
            scte35_binary=original, channel=_channel("segmentationDuration")
        )

        assert result.action == "replace"
        assert result.matched_rule_id == "cap-long-breaks"
        assert _segmentation_duration(result.modified_signal) == pytest.approx(30.0)

    def test_break_duration_target_leaves_a_time_signal_untouched(self):
        """breakDuration only applies to splice_insert, so the payload is unchanged."""
        original = _signal_with_duration(60.0, PROVIDER_PLACEMENT_OPPORTUNITY_START)

        result, _ = process_signal(
            scte35_binary=original, channel=_channel("breakDuration")
        )

        assert _segmentation_duration(result.modified_signal) == pytest.approx(60.0)
