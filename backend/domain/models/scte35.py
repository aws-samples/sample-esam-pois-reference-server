# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""SCTE-35 data models for signal processing."""

from dataclasses import dataclass, field
from enum import IntEnum
from typing import Optional, List, Union


class SpliceCommandType(IntEnum):
    """SCTE-35 splice command types."""

    SPLICE_NULL = 0x00
    SPLICE_SCHEDULE = 0x04
    SPLICE_INSERT = 0x05
    TIME_SIGNAL = 0x06
    BANDWIDTH_RESERVATION = 0x07
    PRIVATE_COMMAND = 0xFF


@dataclass
class BreakDuration:
    """Break duration information for Splice Insert commands."""

    auto_return: bool
    duration: int  # 90kHz ticks


@dataclass
class SpliceInsert:
    """Splice Insert command (type 5)."""

    type: SpliceCommandType
    splice_event_id: int
    splice_event_cancel_indicator: bool
    out_of_network_indicator: bool
    program_splice_flag: bool
    duration_flag: bool
    splice_immediate_flag: bool
    break_duration: Optional[BreakDuration]
    unique_program_id: int
    avail_num: int
    avails_expected: int


@dataclass
class TimeSignal:
    """Time Signal command (type 6)."""

    type: SpliceCommandType
    time_specified_flag: bool
    pts_time: Optional[int]


@dataclass
class SegmentationDescriptor:
    """Segmentation descriptor for SCTE-35 signals."""

    descriptor_tag: int
    descriptor_length: int
    identifier: int
    segmentation_event_id: int
    segmentation_event_cancel_indicator: bool
    program_segmentation_flag: bool
    segmentation_duration_flag: bool
    delivery_not_restricted_flag: bool
    web_delivery_allowed_flag: bool
    no_regional_blackout_flag: bool
    archive_allowed_flag: bool
    device_restrictions: int
    segmentation_duration: Optional[int]
    segmentation_upid_type: int
    segmentation_upid_length: int
    segmentation_upid: bytes
    segmentation_type_id: int
    segment_num: int
    segments_expected: int


@dataclass
class SpliceInfoSection:
    """Complete SCTE-35 splice info section."""

    table_id: int
    section_syntax_indicator: bool
    private_indicator: bool
    sap_type: int
    section_length: int
    protocol_version: int
    encrypted_packet: bool
    encryption_algorithm: int
    pts_adjustment: int
    cw_index: int
    tier: int
    splice_command_length: int
    splice_command_type: SpliceCommandType
    splice_command: Union[SpliceInsert, TimeSignal]
    descriptor_loop_length: int
    splice_descriptors: List[SegmentationDescriptor] = field(default_factory=list)
    crc32: int = 0


class SCTE35ParseError(Exception):
    """Exception raised when SCTE-35 parsing fails."""

    pass


class SCTE35EncodeError(Exception):
    """Exception raised when SCTE-35 encoding fails."""

    pass
