# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""SCTE-35 parser wrapper using threefive library."""

import logging
from typing import List

import threefive

from domain.models.scte35 import (
    SpliceInfoSection,
    SpliceCommandType,
    SpliceInsert,
    TimeSignal,
    SegmentationDescriptor,
    BreakDuration,
    SCTE35ParseError,
)

logger = logging.getLogger(__name__)


def parse_scte35(base64_data: str) -> SpliceInfoSection:
    """
    Parse SCTE-35 from base64 using threefive library.

    Args:
        base64_data: Base64-encoded SCTE-35 data

    Returns:
        Parsed SCTE-35 signal as SpliceInfoSection

    Raises:
        SCTE35ParseError: If parsing fails
    """
    try:
        # Create threefive Cue object and decode
        cue = threefive.Cue(base64_data)
        cue.decode()

        # Extract splice command
        splice_command = _convert_splice_command(cue)

        # Extract descriptors
        descriptors = _extract_descriptors(cue)

        # Build SpliceInfoSection
        info = cue.info_section

        return SpliceInfoSection(
            table_id=info.table_id,
            section_syntax_indicator=info.section_syntax_indicator,
            private_indicator=info.private,
            sap_type=info.sap_type,
            section_length=info.section_length,
            protocol_version=info.protocol_version,
            encrypted_packet=info.encrypted_packet,
            encryption_algorithm=info.encryption_algorithm,
            pts_adjustment=info.pts_adjustment,
            cw_index=info.cw_index,
            tier=info.tier,
            splice_command_length=info.splice_command_length,
            splice_command_type=SpliceCommandType(info.splice_command_type),
            splice_command=splice_command,
            descriptor_loop_length=info.descriptor_loop_length,
            splice_descriptors=descriptors,
            crc32=getattr(cue, "crc", 0),
        )

    except Exception as e:
        logger.error(
            f"Failed to parse SCTE-35: {e}", extra={"scte35Binary": base64_data}
        )
        raise SCTE35ParseError(f"SCTE-35 parsing failed: {str(e)}") from e


def _convert_splice_command(cue: threefive.Cue) -> SpliceInsert | TimeSignal:
    """Convert threefive command to internal model."""
    command = cue.command
    command_type = cue.info_section.splice_command_type

    if command_type == 0x05:  # Splice Insert
        return _convert_splice_insert(command)
    elif command_type == 0x06:  # Time Signal
        return _convert_time_signal(command)
    else:
        # For unsupported command types, return a basic TimeSignal
        return TimeSignal(
            type=SpliceCommandType(command_type),
            time_specified_flag=False,
            pts_time=None,
        )


def _convert_splice_insert(command: any) -> SpliceInsert:
    """Convert threefive Splice Insert to internal model."""
    break_duration = None
    if hasattr(command, "break_duration") and command.break_duration is not None:
        # In threefive 2.3.x, break_duration is a float (seconds)
        # and break_auto_return is a separate boolean attribute
        duration_ticks = (
            int(command.break_duration * 90000)
            if isinstance(command.break_duration, (int, float))
            else 0
        )
        auto_return = getattr(command, "break_auto_return", True)

        break_duration = BreakDuration(
            auto_return=auto_return,
            duration=duration_ticks,
        )

    return SpliceInsert(
        type=SpliceCommandType.SPLICE_INSERT,
        splice_event_id=command.splice_event_id,
        splice_event_cancel_indicator=command.splice_event_cancel_indicator,
        out_of_network_indicator=command.out_of_network_indicator,
        program_splice_flag=command.program_splice_flag,
        duration_flag=command.duration_flag,
        splice_immediate_flag=command.splice_immediate_flag,
        break_duration=break_duration,
        unique_program_id=command.unique_program_id,
        avail_num=getattr(command, "avail_num", 0),
        avails_expected=getattr(command, "avails_expected", 0),
    )


def _convert_time_signal(command: any) -> TimeSignal:
    """Convert threefive Time Signal to internal model."""
    pts_time = None
    if hasattr(command, "time_specified_flag") and command.time_specified_flag:
        pts_time = getattr(command, "pts_time", None)

    return TimeSignal(
        type=SpliceCommandType.TIME_SIGNAL,
        time_specified_flag=getattr(command, "time_specified_flag", False),
        pts_time=pts_time,
    )


def _extract_descriptors(cue: threefive.Cue) -> List[SegmentationDescriptor]:
    """Extract segmentation descriptors from threefive Cue."""
    descriptors: List[SegmentationDescriptor] = []

    if not hasattr(cue, "descriptors") or not cue.descriptors:
        return descriptors

    for desc in cue.descriptors:
        # Check if it's a segmentation descriptor (tag 0x02)
        if not hasattr(desc, "tag") or desc.tag != 0x02:
            continue

        # Extract segmentation descriptor fields
        try:
            segmentation_upid = b""
            if hasattr(desc, "segmentation_upid"):
                upid = desc.segmentation_upid
                if isinstance(upid, bytes):
                    segmentation_upid = upid
                elif isinstance(upid, str):
                    segmentation_upid = upid.encode("utf-8")

            descriptor = SegmentationDescriptor(
                descriptor_tag=0x02,
                descriptor_length=getattr(desc, "descriptor_length", 0),
                identifier=0x43554549,  # 'CUEI'
                segmentation_event_id=getattr(desc, "segmentation_event_id", 0),
                segmentation_event_cancel_indicator=getattr(
                    desc, "segmentation_event_cancel_indicator", False
                ),
                program_segmentation_flag=getattr(
                    desc, "program_segmentation_flag", False
                ),
                segmentation_duration_flag=getattr(
                    desc, "segmentation_duration_flag", False
                ),
                delivery_not_restricted_flag=getattr(
                    desc, "delivery_not_restricted_flag", False
                ),
                web_delivery_allowed_flag=getattr(
                    desc, "web_delivery_allowed_flag", False
                ),
                no_regional_blackout_flag=getattr(
                    desc, "no_regional_blackout_flag", False
                ),
                archive_allowed_flag=getattr(desc, "archive_allowed_flag", False),
                device_restrictions=getattr(desc, "device_restrictions", 0),
                segmentation_duration=getattr(desc, "segmentation_duration", None),
                segmentation_upid_type=getattr(desc, "segmentation_upid_type", 0),
                segmentation_upid_length=getattr(desc, "segmentation_upid_length", 0),
                segmentation_upid=segmentation_upid,
                segmentation_type_id=getattr(desc, "segmentation_type_id", 0),
                segment_num=getattr(desc, "segment_num", 0),
                segments_expected=getattr(desc, "segments_expected", 0),
            )
            descriptors.append(descriptor)
        except Exception as e:
            logger.warning(f"Failed to extract segmentation descriptor: {e}")
            continue

    return descriptors
