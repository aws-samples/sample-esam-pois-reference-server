# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Signal processor for SCTE-35 signal processing and modification."""

import logging
import time
from dataclasses import dataclass
from typing import Optional
from copy import deepcopy
from datetime import datetime

from domain.models.scte35 import (
    SpliceInfoSection,
    SpliceCommandType,
    SpliceInsert,
    SegmentationDescriptor,
    BreakDuration,
    SCTE35ParseError,
)
from domain.models.channel import (
    Channel,
    ChannelState,
    ProcessingOptions,
    Modification,
    ModificationTarget,
    ModificationOperation,
)
from domain.services.scte35_parser import parse_scte35
from domain.services.scte35_encoder import encode_scte35
from domain.services.rule_evaluator import evaluate_rules

logger = logging.getLogger(__name__)


def _serialize_signal_data(signal: SpliceInfoSection) -> dict:
    """Convert SpliceInfoSection to a JSON/DynamoDB-safe dict."""
    from enum import Enum
    from dataclasses import fields, is_dataclass

    def _convert(obj):
        if obj is None:
            return None
        if isinstance(obj, (str, int, float, bool)):
            return obj
        if isinstance(obj, bytes):
            return obj.hex()
        if isinstance(obj, Enum):
            return obj.value
        if is_dataclass(obj) and not isinstance(obj, type):
            return {f.name: _convert(getattr(obj, f.name)) for f in fields(obj)}
        if isinstance(obj, list):
            return [_convert(item) for item in obj]
        if isinstance(obj, dict):
            return {k: _convert(v) for k, v in obj.items()}
        return str(obj)

    return _convert(signal)


@dataclass
class ProcessingResult:
    """Result of signal processing."""

    action: str  # 'delete', 'noop', or 'replace'
    modified_signal: Optional[str] = None  # Base64 encoded SCTE-35
    matched_rule_id: Optional[str] = None
    details: str = ""
    error: Optional[str] = None
    external_actions_triggered: int = 0  # Count of external actions triggered


def process_signal(
    scte35_binary: str,
    channel: Channel,
    channel_state: Optional[ChannelState] = None,
    options: Optional[ProcessingOptions] = None,
    action_executor: Optional[any] = None,
    acquisition_time: Optional[str] = None,
    correlation_id: Optional[str] = None,
    zone_identity: Optional[str] = None,
) -> tuple[ProcessingResult, Optional[ChannelState]]:
    """
    Process SCTE-35 signal and return action to take.

    Args:
        scte35_binary: Base64-encoded SCTE-35 data
        channel: Channel configuration with rules
        channel_state: Optional stateful mode state
        options: Processing options
        action_executor: Optional action executor for external actions
        acquisition_time: Optional acquisition time from ESAM (ISO format)

    Returns:
        Tuple of (processing result, updated channel state or None)
    """
    start_time = time.time()

    # Context fields injected into every log call via extra dict
    ctx = {"correlationId": correlation_id or "", "channelId": channel.channel_id}

    try:
        # Parse SCTE-35 signal
        try:
            signal = parse_scte35(scte35_binary)
            logger.debug(
                "Parsed SCTE-35 signal",
                extra={
                    **ctx,
                    "commandType": int(signal.splice_command_type),
                    "ptsAdjustment": signal.pts_adjustment,
                    "descriptorCount": len(signal.splice_descriptors),
                },
            )
        except SCTE35ParseError as e:
            logger.error(f"Failed to parse SCTE-35: {e}", extra=ctx)
            return (
                ProcessingResult(
                    action=channel.default_action,
                    details="Failed to parse SCTE-35 signal",
                    error=str(e),
                ),
                None,
            )

        # Check stateful mode - if in break, delete all signals EXCEPT break end signals
        if channel.stateful_mode and channel_state and channel_state.in_break:
            if not is_break_end(signal):
                now = int(time.time() * 1000)
                if (
                    channel_state.break_expiry_time
                    and now < channel_state.break_expiry_time
                ):
                    logger.info(
                        "In active break - deleting signal (stateful mode)", extra=ctx
                    )
                    return (
                        ProcessingResult(
                            action="delete",
                            details="In active break - signal deleted (stateful mode)",
                        ),
                        None,
                    )
            else:
                logger.info("Break end signal detected during active break", extra=ctx)

        # Auto-add descriptors feature
        if channel.auto_add_descriptors:
            signal = auto_add_descriptors(signal)
            logger.debug("Auto-add descriptors applied", extra=ctx)

        # Evaluate rules
        evaluation = evaluate_rules(
            signal,
            channel.rules,
            channel.default_action,
            descriptor_priority=channel.descriptor_priority,
            channel_id=channel.channel_id,
            zone_identity=zone_identity,
        )

        logger.info(
            "Rule evaluation complete",
            extra={
                **ctx,
                "matched": evaluation.matched,
                "action": evaluation.action,
                "matchedRuleId": (
                    evaluation.matched_rule.rule_id if evaluation.matched_rule else None
                ),
            },
        )

        # Trigger external actions if rule matched and actions are enabled
        external_actions_count = 0
        external_actions_succeeded = 0
        external_actions_failed = 0
        if (
            evaluation.matched
            and evaluation.matched_rule
            and channel.actions_enabled
            and action_executor
        ):
            try:
                if (
                    hasattr(evaluation.matched_rule, "external_actions")
                    and evaluation.matched_rule.external_actions
                ):
                    external_actions_count = len(
                        evaluation.matched_rule.external_actions
                    )
                    logger.info(
                        "External actions triggered",
                        extra={
                            **ctx,
                            "actionsCount": external_actions_count,
                            "dryRun": channel.actions_dry_run,
                            "ruleId": evaluation.matched_rule.rule_id,
                        },
                    )

                    signal_data_dict = _serialize_signal_data(signal)
                    if acquisition_time:
                        signal_data_dict["acquisition_time"] = acquisition_time

                    import asyncio

                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    try:
                        results = loop.run_until_complete(
                            action_executor.execute_actions(
                                actions=evaluation.matched_rule.external_actions,
                                signal_data=signal_data_dict,
                                channel_id=channel.channel_id,
                                dry_run=channel.actions_dry_run,
                                rule_id=evaluation.matched_rule.rule_id,
                            )
                        )
                        external_actions_succeeded = sum(
                            1 for r in (results or []) if r.success
                        )
                        external_actions_failed = sum(
                            1 for r in (results or []) if not r.success
                        )
                    finally:
                        loop.close()

                    logger.info(
                        "External actions completed",
                        extra={
                            **ctx,
                            "actionsCount": external_actions_count,
                            "actionsSucceeded": external_actions_succeeded,
                            "actionsFailed": external_actions_failed,
                        },
                    )

            except Exception as e:
                external_actions_failed = external_actions_count
                logger.error(
                    "External actions failed",
                    extra={
                        **ctx,
                        "actionsCount": external_actions_count,
                        "error": str(e),
                    },
                    exc_info=True,
                )

        # Update channel state if stateful mode enabled
        updated_state = None
        if channel.stateful_mode:
            updated_state = update_channel_state(
                signal, channel_state, channel.channel_id
            )

        # Execute action
        if evaluation.action == "delete":
            processing_time = (time.time() - start_time) * 1000
            logger.info(
                "Signal deleted",
                extra={**ctx, "action": "delete", "processingTimeMs": processing_time},
            )
            return (
                ProcessingResult(
                    action="delete",
                    matched_rule_id=(
                        evaluation.matched_rule.rule_id
                        if evaluation.matched_rule
                        else None
                    ),
                    details=evaluation.details or "Signal deleted",
                    external_actions_triggered=external_actions_count,
                ),
                updated_state,
            )

        elif evaluation.action == "noop":
            processing_time = (time.time() - start_time) * 1000
            logger.info(
                "Signal passed through",
                extra={**ctx, "action": "noop", "processingTimeMs": processing_time},
            )
            return (
                ProcessingResult(
                    action="noop",
                    modified_signal=scte35_binary,
                    matched_rule_id=(
                        evaluation.matched_rule.rule_id
                        if evaluation.matched_rule
                        else None
                    ),
                    details=evaluation.details or "Signal passed through unchanged",
                    external_actions_triggered=external_actions_count,
                ),
                updated_state,
            )

        elif evaluation.action == "replace":
            if not evaluation.modifications:
                logger.warning(
                    "Replace action with no modifications - treating as noop", extra=ctx
                )
                return (
                    ProcessingResult(
                        action="noop",
                        modified_signal=scte35_binary,
                        details="Replace action with no modifications - treating as noop",
                        external_actions_triggered=external_actions_count,
                    ),
                    updated_state,
                )

            try:
                modified_signal = apply_modifications(signal, evaluation.modifications)
                modified_binary = encode_scte35(
                    modified_signal, original_base64=scte35_binary
                )

                processing_time = (time.time() - start_time) * 1000
                logger.info(
                    "Signal modified",
                    extra={
                        **ctx,
                        "action": "replace",
                        "processingTimeMs": processing_time,
                        "modificationsCount": len(evaluation.modifications),
                    },
                )

                return (
                    ProcessingResult(
                        action="replace",
                        modified_signal=modified_binary,
                        matched_rule_id=(
                            evaluation.matched_rule.rule_id
                            if evaluation.matched_rule
                            else None
                        ),
                        details=f"Signal modified by rule: {evaluation.matched_rule.name if evaluation.matched_rule else 'unknown'}",
                        external_actions_triggered=external_actions_count,
                    ),
                    updated_state,
                )
            except Exception as e:
                logger.error(f"Failed to apply modifications: {e}", extra=ctx)
                return (
                    ProcessingResult(
                        action="noop",
                        modified_signal=scte35_binary,
                        details="Failed to apply modifications - returning original signal",
                        error=str(e),
                        external_actions_triggered=external_actions_count,
                    ),
                    updated_state,
                )

        else:
            logger.warning(f"Unknown action: {evaluation.action}", extra=ctx)
            return (
                ProcessingResult(
                    action=channel.default_action,
                    details="Unknown action - using default",
                ),
                updated_state,
            )

    except Exception as e:
        logger.error(f"Error processing signal: {e}", extra=ctx, exc_info=True)
        return (
            ProcessingResult(
                action=channel.default_action,
                details="Error processing signal - using default action",
                error=str(e),
            ),
            None,
        )


def apply_modifications(
    signal: SpliceInfoSection, modifications: list[Modification]
) -> SpliceInfoSection:
    """
    Apply modifications to SCTE-35 signal.

    Args:
        signal: Original SCTE-35 signal
        modifications: List of modifications to apply

    Returns:
        Modified SCTE-35 signal
    """
    # Deep copy to avoid modifying original
    modified_signal = deepcopy(signal)

    for mod in modifications:
        modified_signal = _apply_single_modification(modified_signal, mod)

    return modified_signal


def _apply_single_modification(
    signal: SpliceInfoSection, mod: Modification
) -> SpliceInfoSection:
    """Apply a single modification to the signal."""

    if mod.target == ModificationTarget.PTS_ADJUSTMENT:
        if mod.operation == ModificationOperation.SET and isinstance(mod.value, int):
            signal.pts_adjustment = mod.value
            logger.debug(f"Modified PTS adjustment to {mod.value}")

    elif mod.target == ModificationTarget.BREAK_DURATION:
        if signal.splice_command_type == SpliceCommandType.SPLICE_INSERT:
            if isinstance(signal.splice_command, SpliceInsert):
                if mod.operation == ModificationOperation.SET and isinstance(
                    mod.value, int
                ):
                    # threefive expects break_duration in seconds (not ticks)
                    # The library handles the conversion to ticks internally during encoding
                    if signal.splice_command.break_duration:
                        signal.splice_command.break_duration.duration = float(mod.value)
                    else:
                        signal.splice_command.break_duration = BreakDuration(
                            auto_return=True,
                            duration=float(mod.value),
                        )
                    signal.splice_command.duration_flag = True
                    logger.debug(f"Modified break duration to {mod.value} seconds")

    elif mod.target == ModificationTarget.SEGMENTATION_DURATION:
        if signal.splice_descriptors:
            for desc in signal.splice_descriptors:
                if desc.descriptor_tag == 0x02:
                    if mod.operation == ModificationOperation.SET and isinstance(
                        mod.value, int
                    ):
                        # threefive expects segmentation_duration in seconds (not ticks)
                        # The library handles the conversion to ticks internally during encoding
                        desc.segmentation_duration = float(mod.value)
                        desc.segmentation_duration_flag = True
                        logger.debug(
                            f"Modified segmentation duration to {mod.value} seconds"
                        )

    elif mod.target == ModificationTarget.SEGMENTATION_TYPE_ID:
        if signal.splice_descriptors:
            for desc in signal.splice_descriptors:
                if desc.descriptor_tag == 0x02:
                    if mod.operation == ModificationOperation.SET and isinstance(
                        mod.value, int
                    ):
                        desc.segmentation_type_id = mod.value
                        logger.debug(f"Modified segmentation type ID to {mod.value}")

    elif mod.target == ModificationTarget.WEB_DELIVERY_ALLOWED:
        if signal.splice_descriptors:
            for desc in signal.splice_descriptors:
                if desc.descriptor_tag == 0x02:
                    if mod.operation == ModificationOperation.SET and isinstance(
                        mod.value, bool
                    ):
                        desc.web_delivery_allowed_flag = mod.value
                        logger.debug(f"Modified web delivery allowed to {mod.value}")

    elif mod.target == ModificationTarget.NO_REGIONAL_BLACKOUT:
        if signal.splice_descriptors:
            for desc in signal.splice_descriptors:
                if desc.descriptor_tag == 0x02:
                    if mod.operation == ModificationOperation.SET and isinstance(
                        mod.value, bool
                    ):
                        desc.no_regional_blackout_flag = mod.value
                        logger.debug(f"Modified no regional blackout to {mod.value}")

    elif mod.target == ModificationTarget.ARCHIVE_ALLOWED:
        if signal.splice_descriptors:
            for desc in signal.splice_descriptors:
                if desc.descriptor_tag == 0x02:
                    if mod.operation == ModificationOperation.SET and isinstance(
                        mod.value, bool
                    ):
                        desc.archive_allowed_flag = mod.value
                        logger.debug(f"Modified archive allowed to {mod.value}")

    return signal


def auto_add_descriptors(signal: SpliceInfoSection) -> SpliceInfoSection:
    """
    Auto-add segmentation descriptors to Splice Insert commands without descriptors.

    Args:
        signal: SCTE-35 signal

    Returns:
        Signal with descriptor added (if applicable)
    """
    # Only apply to Splice Insert commands
    if signal.splice_command_type != SpliceCommandType.SPLICE_INSERT:
        return signal

    # Only if no descriptors exist
    if signal.splice_descriptors:
        return signal

    # Must be a SpliceInsert command
    if not isinstance(signal.splice_command, SpliceInsert):
        return signal

    command = signal.splice_command

    # Determine segmentation type based on out_of_network_indicator
    segmentation_type_id = 0x34 if command.out_of_network_indicator else 0x35

    # Get duration from break_duration
    duration = command.break_duration.duration if command.break_duration else 0

    # Create segmentation descriptor
    descriptor = SegmentationDescriptor(
        descriptor_tag=0x02,
        descriptor_length=0,  # Will be calculated during encoding
        identifier=0x43554549,  # 'CUEI'
        segmentation_event_id=command.splice_event_id,
        segmentation_event_cancel_indicator=False,
        program_segmentation_flag=True,
        segmentation_duration_flag=duration > 0,
        delivery_not_restricted_flag=False,
        web_delivery_allowed_flag=False,
        no_regional_blackout_flag=False,
        archive_allowed_flag=True,
        device_restrictions=0x03,  # No restrictions
        segmentation_duration=duration if duration > 0 else None,
        segmentation_upid_type=0x09,  # ADI
        segmentation_upid_length=0,
        segmentation_upid=b"",
        segmentation_type_id=segmentation_type_id,
        segment_num=0,
        segments_expected=0,
    )

    # Add descriptor to signal
    signal.splice_descriptors = [descriptor]
    logger.debug(f"Added segmentation descriptor with type ID {segmentation_type_id}")

    return signal


# Segmentation type IDs that mark a break start (CUE-OUT):
# 0x34 Provider Placement Opportunity Start, 0x36 Distributor Placement
# Opportunity Start, 0x38 Provider Overlay PO Start, 0x3A Distributor
# Overlay PO Start.
_BREAK_START_SEGMENTATION_TYPE_IDS = frozenset({0x34, 0x36, 0x38, 0x3A})

# Segmentation type IDs that mark a break end (CUE-IN): the corresponding
# *End types for the IDs above.
_BREAK_END_SEGMENTATION_TYPE_IDS = frozenset({0x35, 0x37, 0x39, 0x3B})


def _has_segmentation_type(signal: SpliceInfoSection, type_ids: frozenset[int]) -> bool:
    """Check if any segmentation descriptor (tag 0x02) carries one of type_ids."""
    for descriptor in signal.splice_descriptors or []:
        if (
            getattr(descriptor, "descriptor_tag", None) == 0x02
            and getattr(descriptor, "segmentation_type_id", None) in type_ids
        ):
            return True
    return False


def is_break_start(signal: SpliceInfoSection) -> bool:
    """
    Check if signal is a break start (CUE-OUT).

    Break start is either:
    - Splice Insert (type 5) with out_of_network=true, or
    - a segmentation descriptor with a *Start placement-opportunity type
      (0x34, 0x36, 0x38, 0x3A).

    Args:
        signal: SCTE-35 signal

    Returns:
        True if signal indicates break start
    """
    # CUE-OUT: Splice Insert with out_of_network=true
    if signal.splice_command_type == SpliceCommandType.SPLICE_INSERT:
        if isinstance(signal.splice_command, SpliceInsert):
            if signal.splice_command.out_of_network_indicator:
                return True

    return _has_segmentation_type(signal, _BREAK_START_SEGMENTATION_TYPE_IDS)


def is_break_end(signal: SpliceInfoSection) -> bool:
    """
    Check if signal is a break end (CUE-IN).

    Break end is either:
    - Splice Insert (type 5) with out_of_network=false and no duration, or
    - a segmentation descriptor with a *End placement-opportunity type
      (0x35, 0x37, 0x39, 0x3B).

    Args:
        signal: SCTE-35 signal

    Returns:
        True if signal indicates break end
    """
    # CUE-IN: Splice Insert with out_of_network=false and no duration
    if signal.splice_command_type == SpliceCommandType.SPLICE_INSERT:
        if isinstance(signal.splice_command, SpliceInsert):
            if (
                not signal.splice_command.out_of_network_indicator
                and not signal.splice_command.duration_flag
            ):
                return True

    return _has_segmentation_type(signal, _BREAK_END_SEGMENTATION_TYPE_IDS)


def update_channel_state(
    signal: SpliceInfoSection, current_state: Optional[ChannelState], channel_id: str
) -> Optional[ChannelState]:
    """
    Update channel state based on signal.

    Args:
        signal: Parsed SCTE-35 signal
        current_state: Current channel state (or None)
        channel_id: Channel ID

    Returns:
        Updated channel state or None if no change
    """
    now_iso = datetime.utcnow().isoformat() + "Z"

    # Check for break start
    if is_break_start(signal):
        # Extract event ID
        event_id = None
        if signal.splice_command_type == SpliceCommandType.SPLICE_INSERT:
            if isinstance(signal.splice_command, SpliceInsert):
                event_id = signal.splice_command.splice_event_id

        # Try to get from descriptor if not in command
        if event_id is None:
            for desc in signal.splice_descriptors:
                if desc.descriptor_tag == 0x02:
                    event_id = desc.segmentation_event_id
                    break

        # Ensure event_id is an integer (convert from hex string if needed)
        if event_id is not None:
            if isinstance(event_id, str):
                try:
                    # Handle hex format like '0x08e76b5e'
                    event_id = (
                        int(event_id, 16)
                        if event_id.startswith("0x")
                        else int(event_id)
                    )
                except (ValueError, TypeError) as e:
                    logger.warning(
                        f"Failed to convert event_id '{event_id}' to int: {e}"
                    )
                    event_id = None
            elif not isinstance(event_id, int):
                # Try to convert other types to int
                try:
                    event_id = int(event_id)
                except (ValueError, TypeError) as e:
                    logger.warning(
                        f"Failed to convert event_id '{event_id}' (type: {type(event_id)}) to int: {e}"
                    )
                    event_id = None

        # Calculate expiry time
        expiry_time = calculate_break_expiry_time(
            signal, signal.pts_adjustment // 90000
        )

        logger.info(
            "Break start detected - updating state",
            extra={
                "channelId": channel_id,
                "eventId": event_id,
                "expiryTime": expiry_time,
            },
        )

        return ChannelState(
            channelId=channel_id,
            inBreak=True,
            breakStartTime=now_iso,
            breakEventId=event_id,
            breakExpiryTime=expiry_time,
            lastProcessedTime=now_iso,
        )

    # Check for break end
    if is_break_end(signal):
        logger.info(
            "Break end detected - updating state", extra={"channelId": channel_id}
        )

        return ChannelState(
            channelId=channel_id,
            inBreak=False,
            breakStartTime=None,
            breakEventId=None,
            breakExpiryTime=None,
            lastProcessedTime=now_iso,
        )

    # No state change
    return None


def calculate_break_expiry_time(
    signal: SpliceInfoSection, pts_adjustment_seconds: int
) -> Optional[int]:
    """
    Calculate break expiry time for stateful mode.

    Args:
        signal: SCTE-35 signal
        pts_adjustment_seconds: PTS adjustment in seconds

    Returns:
        Break expiry time in milliseconds (Unix timestamp) or None
    """
    duration_seconds = 0

    # Get duration from Splice Insert command, stored as 90kHz ticks
    if signal.splice_command_type == SpliceCommandType.SPLICE_INSERT:
        if isinstance(signal.splice_command, SpliceInsert):
            if signal.splice_command.break_duration:
                duration_seconds = (
                    signal.splice_command.break_duration.duration // 90000
                )

    # Get duration from segmentation descriptor, already in seconds
    if duration_seconds == 0 and signal.splice_descriptors:
        for desc in signal.splice_descriptors:
            if desc.descriptor_tag == 0x02 and desc.segmentation_duration:
                duration_seconds = int(desc.segmentation_duration)
                break

    if duration_seconds == 0:
        return None

    # Calculate expiry time
    now = int(time.time() * 1000)  # Current time in milliseconds
    expiry_time = now + (duration_seconds + pts_adjustment_seconds) * 1000

    return expiry_time
