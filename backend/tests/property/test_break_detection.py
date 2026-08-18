# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Property-based tests for break detection functionality."""

from hypothesis import given, strategies as st, settings
from dataclasses import dataclass

from domain.services.signal_processor import is_break_start, is_break_end
from domain.models.scte35 import (
    SpliceInfoSection,
    SpliceCommandType,
    SpliceInsert,
    TimeSignal,
)


# Mock descriptor for testing
@dataclass
class MockDescriptor:
    descriptor_tag: int
    segmentation_type_id: int


# Feature: stateful-mode, Property 1: Break Start Detection
@settings(max_examples=100)
@given(
    use_out_of_network=st.booleans(),
    segmentation_type_id=st.sampled_from([0x34, 0x36, 0x38, 0x3A]),
)
def test_property_break_start_detection(
    use_out_of_network: bool, segmentation_type_id: int
):
    """
    Property 1: Break Start Detection

    For any SCTE-35 signal with out_of_network_indicator=true OR
    segmentation_type_id in [0x34, 0x36, 0x38, 0x3A], is_break_start() should return true.

    Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
    """
    if use_out_of_network:
        # Test with Splice Insert out_of_network=true
        signal = SpliceInfoSection(
            table_id=0xFC,
            section_syntax_indicator=False,
            private_indicator=False,
            sap_type=0x03,
            section_length=0,
            protocol_version=0,
            encrypted_packet=False,
            encryption_algorithm=0,
            pts_adjustment=0,
            cw_index=0,
            tier=0xFFF,
            splice_command_length=0,
            splice_command_type=SpliceCommandType.SPLICE_INSERT,
            splice_command=SpliceInsert(
                type=SpliceCommandType.SPLICE_INSERT,
                splice_event_id=12345,
                splice_event_cancel_indicator=False,
                out_of_network_indicator=True,
                program_splice_flag=True,
                duration_flag=False,
                splice_immediate_flag=False,
                break_duration=None,
                unique_program_id=0,
                avail_num=0,
                avails_expected=0,
            ),
            descriptor_loop_length=0,
            splice_descriptors=[],
            crc32=0,
        )
    else:
        # Test with segmentation descriptor
        signal = SpliceInfoSection(
            table_id=0xFC,
            section_syntax_indicator=False,
            private_indicator=False,
            sap_type=0x03,
            section_length=0,
            protocol_version=0,
            encrypted_packet=False,
            encryption_algorithm=0,
            pts_adjustment=0,
            cw_index=0,
            tier=0xFFF,
            splice_command_length=0,
            splice_command_type=SpliceCommandType.TIME_SIGNAL,
            splice_command=TimeSignal(
                type=SpliceCommandType.TIME_SIGNAL,
                time_specified_flag=False,
                pts_time=None,
            ),
            descriptor_loop_length=0,
            splice_descriptors=[
                MockDescriptor(
                    descriptor_tag=0x02, segmentation_type_id=segmentation_type_id
                )
            ],
            crc32=0,
        )

    # Assert: is_break_start() returns true
    assert is_break_start(signal) is True, (
        f"Expected is_break_start() to return True for "
        f"{'out_of_network=true' if use_out_of_network else f'type_id={segmentation_type_id}'}"
    )


# Feature: stateful-mode, Property 2: Break End Detection
@settings(max_examples=100)
@given(
    use_in_network=st.booleans(),
    segmentation_type_id=st.sampled_from([0x35, 0x37, 0x39, 0x3B]),
)
def test_property_break_end_detection(use_in_network: bool, segmentation_type_id: int):
    """
    Property 2: Break End Detection

    For any SCTE-35 signal with out_of_network_indicator=false OR
    segmentation_type_id in [0x35, 0x37, 0x39, 0x3B], is_break_end() should return true.

    Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
    """
    if use_in_network:
        # Test with Splice Insert out_of_network=false
        signal = SpliceInfoSection(
            table_id=0xFC,
            section_syntax_indicator=False,
            private_indicator=False,
            sap_type=0x03,
            section_length=0,
            protocol_version=0,
            encrypted_packet=False,
            encryption_algorithm=0,
            pts_adjustment=0,
            cw_index=0,
            tier=0xFFF,
            splice_command_length=0,
            splice_command_type=SpliceCommandType.SPLICE_INSERT,
            splice_command=SpliceInsert(
                type=SpliceCommandType.SPLICE_INSERT,
                splice_event_id=12345,
                splice_event_cancel_indicator=False,
                out_of_network_indicator=False,
                program_splice_flag=True,
                duration_flag=False,
                splice_immediate_flag=False,
                break_duration=None,
                unique_program_id=0,
                avail_num=0,
                avails_expected=0,
            ),
            descriptor_loop_length=0,
            splice_descriptors=[],
            crc32=0,
        )
    else:
        # Test with segmentation descriptor
        signal = SpliceInfoSection(
            table_id=0xFC,
            section_syntax_indicator=False,
            private_indicator=False,
            sap_type=0x03,
            section_length=0,
            protocol_version=0,
            encrypted_packet=False,
            encryption_algorithm=0,
            pts_adjustment=0,
            cw_index=0,
            tier=0xFFF,
            splice_command_length=0,
            splice_command_type=SpliceCommandType.TIME_SIGNAL,
            splice_command=TimeSignal(
                type=SpliceCommandType.TIME_SIGNAL,
                time_specified_flag=False,
                pts_time=None,
            ),
            descriptor_loop_length=0,
            splice_descriptors=[
                MockDescriptor(
                    descriptor_tag=0x02, segmentation_type_id=segmentation_type_id
                )
            ],
            crc32=0,
        )

    # Assert: is_break_end() returns true
    assert is_break_end(signal) is True, (
        f"Expected is_break_end() to return True for "
        f"{'out_of_network=false' if use_in_network else f'type_id={segmentation_type_id}'}"
    )
