# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""SCTE-35 encoder wrapper using threefive library."""

import base64
import logging
from typing import Optional

import threefive

from domain.models.scte35 import (
    SpliceInfoSection,
    SpliceCommandType,
    SpliceInsert,
    TimeSignal,
    SCTE35EncodeError,
)

logger = logging.getLogger(__name__)


def encode_scte35(
    signal: SpliceInfoSection, original_base64: Optional[str] = None
) -> str:
    """
    Encode SCTE-35 signal to base64 using threefive library.

    Strategy: Parse the original signal with threefive, modify the Cue object,
    then re-encode it. This ensures compatibility with threefive's encoding.

    Args:
        signal: SCTE-35 signal to encode (with modifications)
        original_base64: Original base64 data (required for proper encoding)

    Returns:
        Base64-encoded SCTE-35 data

    Raises:
        SCTE35EncodeError: If encoding fails
    """
    if not original_base64:
        raise SCTE35EncodeError("Original base64 data is required for encoding")

    try:
        # Parse original signal with threefive to get a valid Cue object
        cue = threefive.Cue(original_base64)
        cue.decode()

        # Apply modifications from our signal model to the threefive Cue
        _apply_modifications_to_cue(cue, signal)

        # Re-encode the modified cue
        cue.encode()

        # Get base64 encoded data
        if hasattr(cue, "bites") and cue.bites:
            encoded_bytes = cue.bites
            encoded_b64 = base64.b64encode(encoded_bytes).decode("utf-8")
            logger.debug(f"Successfully encoded SCTE-35: {len(encoded_bytes)} bytes")
            return encoded_b64
        else:
            raise SCTE35EncodeError("threefive encoding produced no output")

    except Exception as e:
        logger.error(f"Failed to encode SCTE-35: {e}", exc_info=True)

        # Return original signal on encoding failure
        if original_base64:
            logger.warning("Returning original signal due to encoding failure")
            return original_base64

        raise SCTE35EncodeError(f"SCTE-35 encoding failed: {str(e)}") from e


def _apply_modifications_to_cue(cue: threefive.Cue, signal: SpliceInfoSection) -> None:
    """
    Apply modifications from our signal model to the threefive Cue object.

    This modifies the Cue in-place, updating fields that were changed in our signal model.

    Args:
        cue: threefive Cue object to modify
        signal: Our signal model with modifications
    """
    # Update info section fields
    if hasattr(cue, "info_section"):
        info = cue.info_section
        info.pts_adjustment = signal.pts_adjustment
        info.tier = signal.tier

    # Update command fields based on command type
    if signal.splice_command_type == SpliceCommandType.SPLICE_INSERT:
        if isinstance(signal.splice_command, SpliceInsert) and hasattr(cue, "command"):
            cmd = cue.command

            # Update splice insert fields
            cmd.splice_event_id = signal.splice_command.splice_event_id
            cmd.splice_event_cancel_indicator = (
                signal.splice_command.splice_event_cancel_indicator
            )
            cmd.out_of_network_indicator = (
                signal.splice_command.out_of_network_indicator
            )
            cmd.program_splice_flag = signal.splice_command.program_splice_flag
            cmd.duration_flag = signal.splice_command.duration_flag
            cmd.splice_immediate_flag = signal.splice_command.splice_immediate_flag
            cmd.unique_program_id = signal.splice_command.unique_program_id
            cmd.avail_num = signal.splice_command.avail_num
            cmd.avails_expected = signal.splice_command.avails_expected

            # Update break duration if present
            if signal.splice_command.break_duration:
                # In threefive, break_duration is stored as a float value (the duration)
                # The auto_return flag is stored separately
                cmd.break_duration = float(
                    signal.splice_command.break_duration.duration
                )

                # Set auto_return flag if it exists as a separate attribute
                if hasattr(cmd, "auto_return"):
                    cmd.auto_return = signal.splice_command.break_duration.auto_return

                cmd.duration_flag = True
                logger.debug(
                    f"Updated break_duration to {signal.splice_command.break_duration.duration}"
                )

    elif signal.splice_command_type == SpliceCommandType.TIME_SIGNAL:
        if isinstance(signal.splice_command, TimeSignal) and hasattr(cue, "command"):
            cmd = cue.command
            cmd.time_specified_flag = signal.splice_command.time_specified_flag
            if signal.splice_command.pts_time is not None:
                cmd.pts_time = signal.splice_command.pts_time

    # Update descriptors
    if signal.splice_descriptors and hasattr(cue, "descriptors"):
        # Match descriptors by index and update fields
        for i, signal_desc in enumerate(signal.splice_descriptors):
            if i < len(cue.descriptors):
                cue_desc = cue.descriptors[i]

                # Update segmentation descriptor fields
                if signal_desc.descriptor_tag == 0x02:
                    cue_desc.segmentation_event_id = signal_desc.segmentation_event_id
                    cue_desc.segmentation_event_cancel_indicator = (
                        signal_desc.segmentation_event_cancel_indicator
                    )
                    cue_desc.program_segmentation_flag = (
                        signal_desc.program_segmentation_flag
                    )
                    cue_desc.segmentation_duration_flag = (
                        signal_desc.segmentation_duration_flag
                    )
                    cue_desc.delivery_not_restricted_flag = (
                        signal_desc.delivery_not_restricted_flag
                    )
                    cue_desc.web_delivery_allowed_flag = (
                        signal_desc.web_delivery_allowed_flag
                    )
                    cue_desc.no_regional_blackout_flag = (
                        signal_desc.no_regional_blackout_flag
                    )
                    cue_desc.archive_allowed_flag = signal_desc.archive_allowed_flag
                    cue_desc.device_restrictions = signal_desc.device_restrictions

                    if signal_desc.segmentation_duration is not None:
                        cue_desc.segmentation_duration = (
                            signal_desc.segmentation_duration
                        )
                        cue_desc.segmentation_duration_flag = True
                        logger.debug(
                            f"Updated segmentation_duration to {signal_desc.segmentation_duration}"
                        )

                    cue_desc.segmentation_upid_type = signal_desc.segmentation_upid_type
                    cue_desc.segmentation_upid_length = (
                        signal_desc.segmentation_upid_length
                    )
                    cue_desc.segmentation_upid = signal_desc.segmentation_upid
                    cue_desc.segmentation_type_id = signal_desc.segmentation_type_id
                    cue_desc.segment_num = signal_desc.segment_num
                    cue_desc.segments_expected = signal_desc.segments_expected
