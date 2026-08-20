# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Rule evaluator for SCTE-35 signal processing."""

import logging
from dataclasses import dataclass, field
from typing import Optional, List, Any

from domain.models.scte35 import (
    SpliceInfoSection,
    SpliceCommandType,
    SpliceInsert,
)

from domain.models.channel import (
    Rule,
    Condition,
    ConditionOperator,
    ConditionTarget,
    Modification,
)

logger = logging.getLogger(__name__)


@dataclass
class RuleEvaluation:
    """Result of rule evaluation."""

    matched: bool
    action: str  # 'delete', 'noop', or 'replace'
    matched_rule: Optional[Rule] = None
    modifications: List[Modification] = field(default_factory=list)
    details: str = ""


def evaluate_rules(
    signal: SpliceInfoSection,
    rules: List[Rule],
    default_action: str,
    descriptor_priority: Optional[str] = None,
    channel_id: Optional[str] = None,
    zone_identity: Optional[str] = None,
) -> RuleEvaluation:
    """
    Evaluate all rules against a SCTE-35 signal.

    Returns the first matching rule (by priority) or default action.

    Args:
        signal: Parsed SCTE-35 signal
        rules: List of rules to evaluate
        default_action: Action if no rules match
        descriptor_priority: Optional comma-separated priority list
        channel_id: Optional channel identifier for logging

    Returns:
        Rule evaluation result
    """
    # Sort rules by priority (lower number = higher priority)
    sorted_rules = sorted([r for r in rules if r.enabled], key=lambda r: r.priority)

    # Evaluate each rule in priority order
    for rule in sorted_rules:
        if evaluate_rule(signal, rule, descriptor_priority, channel_id, zone_identity):
            logger.info(
                f"Rule matched: {rule.name} (priority {rule.priority})",
                extra={
                    "ruleId": rule.rule_id,
                    "action": rule.action,
                    "channelId": channel_id,
                },
            )

            return RuleEvaluation(
                matched=True,
                action=rule.action,
                matched_rule=rule,
                modifications=rule.modifications if rule.action == "replace" else [],
                details=f"Matched rule: {rule.name} (priority {rule.priority})",
            )

    # No rules matched - use default action
    logger.debug(
        "No rules matched, using default action", extra={"action": default_action}
    )

    return RuleEvaluation(
        matched=False,
        action=default_action,
        details="No rules matched, using default action",
    )


def evaluate_rule(
    signal: SpliceInfoSection,
    rule: Rule,
    descriptor_priority: Optional[str] = None,
    channel_id: Optional[str] = None,
    zone_identity: Optional[str] = None,
) -> bool:
    """
    Evaluate a single rule against a SCTE-35 signal.

    Returns True if ALL conditions match (AND logic).

    Args:
        signal: Parsed SCTE-35 signal
        rule: Rule to evaluate
        descriptor_priority: Optional comma-separated priority list
        channel_id: Optional channel identifier for logging

    Returns:
        True if rule matches, False otherwise
    """
    if not rule.enabled:
        return False

    if not rule.conditions:
        return False

    # All conditions must match (AND logic)
    for condition in rule.conditions:
        if not evaluate_condition(
            signal, condition, descriptor_priority, channel_id, zone_identity
        ):
            logger.debug(
                f"Condition failed for rule {rule.name}",
                extra={
                    "ruleId": rule.rule_id,
                    "field": condition.target,
                    "operator": condition.operator,
                    "value": condition.value,
                },
            )
            return False

    return True


def evaluate_condition(
    signal: SpliceInfoSection,
    condition: Condition,
    descriptor_priority: Optional[str] = None,
    channel_id: Optional[str] = None,
    zone_identity: Optional[str] = None,
) -> bool:
    """
    Evaluate a single condition against a SCTE-35 signal.

    Args:
        signal: Parsed SCTE-35 signal
        condition: Condition to evaluate
        descriptor_priority: Optional comma-separated priority list
        channel_id: Optional channel identifier for logging

    Returns:
        True if condition matches, False otherwise
    """
    # Skip conditions with empty values — these are phantom conditions
    # from the UI that were not properly filled in
    if condition.value == "" or condition.value is None:
        logger.debug(
            "Skipping condition with empty value",
            extra={"field": condition.target, "channelId": channel_id},
        )
        return True  # Treat empty conditions as always-true (don't block matching)

    actual_value = extract_field_value(
        signal, condition.target, descriptor_priority, channel_id, zone_identity
    )

    logger.debug(
        "Evaluating condition",
        extra={
            "field": condition.target,
            "actualValue": actual_value,
            "expectedValue": condition.value,
            "operator": condition.operator,
        },
    )

    if actual_value is None:
        logger.debug("Actual value is None - condition failed")
        return False

    result = compare_values(actual_value, condition.operator, condition.value)
    logger.debug(f"Comparison result: {result}")

    return result


def extract_field_value(
    signal: SpliceInfoSection,
    field: ConditionTarget,
    descriptor_priority: Optional[str] = None,
    channel_id: Optional[str] = None,
    zone_identity: Optional[str] = None,
) -> Any:
    """
    Extract field value from SCTE-35 signal.

    Args:
        signal: Parsed SCTE-35 signal
        field: Field to extract
        descriptor_priority: Optional comma-separated priority list
        channel_id: Optional channel identifier for logging

    Returns:
        Field value or None if not found
    """
    if field == ConditionTarget.COMMAND_TYPE:
        return int(signal.splice_command_type)

    elif field == ConditionTarget.SEGMENTATION_TYPE_ID:
        return _get_first_segmentation_type_id(signal, descriptor_priority, channel_id)

    elif field == ConditionTarget.DURATION:
        return _get_duration(signal)

    elif field == ConditionTarget.PTS_ADJUSTMENT:
        return signal.pts_adjustment

    elif field == ConditionTarget.TIER:
        return signal.tier

    elif field == ConditionTarget.UPID_TYPE:
        return _get_first_upid_type(signal)

    elif field == ConditionTarget.UPID_VALUE:
        return _get_first_upid_value(signal)

    elif field == ConditionTarget.EVENT_ID:
        return _get_event_id(signal)

    elif field == ConditionTarget.DESCRIPTOR_COUNT:
        return len(signal.splice_descriptors)

    elif field == ConditionTarget.OUT_OF_NETWORK:
        return _get_out_of_network(signal)

    elif field == ConditionTarget.ZONE_IDENTITY:
        return zone_identity if zone_identity is not None else ""

    return None


def _parse_descriptor_priority(priority_str: Optional[str]) -> List[int]:
    """
    Parse descriptor priority string into list of integers.

    Args:
        priority_str: Comma-separated string like "52,34,48" or None

    Returns:
        List of integer segmentation type IDs, or empty list if invalid/None

    Examples:
        "52,34,48" -> [52, 34, 48]
        "52, 34, 48" -> [52, 34, 48] (whitespace trimmed)
        "52,abc,48" -> [] (invalid, logs warning)
        None -> []
        "" -> []
    """
    if not priority_str:
        return []

    try:
        # Split by comma, strip whitespace, and convert to integers
        # If ANY value fails to convert, return empty list
        priority_list = []
        for value in priority_str.split(","):
            stripped = value.strip()
            if stripped:  # Only process non-empty strings
                priority_list.append(int(stripped))
        return priority_list
    except (ValueError, UnicodeDecodeError):
        logger.warning(
            f"Invalid descriptor_priority format: '{priority_str}'. "
            "Expected comma-separated numeric values. Falling back to first descriptor."
        )
        return []


def _get_segmentation_type_id_by_priority(
    descriptors: List[Any], priority_list: List[int], channel_id: Optional[str] = None
) -> Optional[int]:
    """
    Get segmentation type ID from descriptors based on priority order.

    Args:
        descriptors: List of segmentation descriptors from SCTE-35 signal
        priority_list: Ordered list of segmentation type IDs to check
        channel_id: Optional channel identifier for logging

    Returns:
        Segmentation type ID of the selected descriptor, or None if no descriptors

    Logic:
        1. If priority_list is empty, return first descriptor's type ID
        2. For each priority type ID, check if any descriptor matches
        3. Return first matching descriptor's type ID
        4. If no matches, return first descriptor's type ID (fallback)

    Examples:
        descriptors = [
            {"segmentation_type_id": 48},
            {"segmentation_type_id": 52}
        ]
        priority_list = [52, 34, 48]
        -> Returns 52 (matches first priority)

        priority_list = [34]
        -> Returns 48 (no match, fallback to first)

        priority_list = []
        -> Returns 48 (empty priority, use first)
    """
    if not descriptors:
        return None

    # Filter to only segmentation descriptors (tag 0x02)
    seg_descriptors = [d for d in descriptors if d.descriptor_tag == 0x02]

    if not seg_descriptors:
        return None

    # If no priority list, use first descriptor
    if not priority_list:
        first_type_id = seg_descriptors[0].segmentation_type_id
        logger.debug(
            "No descriptor priority configured, using first descriptor",
            extra={
                "channelId": channel_id,
                "selectedTypeId": first_type_id,
                "reason": "no_priority_configured",
            },
        )
        return first_type_id

    # Try to find descriptor matching priority order
    for priority_type_id in priority_list:
        for descriptor in seg_descriptors:
            if descriptor.segmentation_type_id == priority_type_id:
                logger.info(
                    "Selected descriptor by priority match",
                    extra={
                        "channelId": channel_id,
                        "selectedTypeId": priority_type_id,
                        "priorityList": priority_list,
                        "reason": "priority_match",
                    },
                )
                return priority_type_id

    # No priority match - fall back to first descriptor
    first_type_id = seg_descriptors[0].segmentation_type_id
    logger.info(
        "No descriptor matched priority list, falling back to first descriptor",
        extra={
            "channelId": channel_id,
            "selectedTypeId": first_type_id,
            "priorityList": priority_list,
            "availableTypeIds": [d.segmentation_type_id for d in seg_descriptors],
            "reason": "fallback_to_first",
        },
    )
    return first_type_id


def _get_first_segmentation_type_id(
    signal: SpliceInfoSection,
    descriptor_priority: Optional[str] = None,
    channel_id: Optional[str] = None,
) -> Optional[int]:
    """
    Get segmentation type ID from descriptors.

    Args:
        signal: Parsed SCTE-35 signal
        descriptor_priority: Optional priority configuration
        channel_id: Optional channel identifier for logging

    Returns:
        Segmentation type ID based on priority or first descriptor
    """
    # Parse descriptor_priority if provided
    priority_list = _parse_descriptor_priority(descriptor_priority)

    # Call priority-based selection
    return _get_segmentation_type_id_by_priority(
        signal.splice_descriptors, priority_list, channel_id
    )


def _get_first_upid_type(signal: SpliceInfoSection) -> Optional[int]:
    """Get first UPID type from descriptors."""
    for desc in signal.splice_descriptors:
        if desc.descriptor_tag == 0x02:
            return desc.segmentation_upid_type
    return None


def _get_first_upid_value(signal: SpliceInfoSection) -> Optional[str]:
    """Get first UPID value from descriptors."""
    for desc in signal.splice_descriptors:
        if desc.descriptor_tag == 0x02:
            return desc.segmentation_upid.hex()
    return None


def _get_event_id(signal: SpliceInfoSection) -> Optional[int]:
    """Get event ID from command or descriptor."""
    if signal.splice_command_type == SpliceCommandType.SPLICE_INSERT:
        if isinstance(signal.splice_command, SpliceInsert):
            return signal.splice_command.splice_event_id

    # Try descriptor
    for desc in signal.splice_descriptors:
        if desc.descriptor_tag == 0x02:
            return desc.segmentation_event_id

    return None


def _get_duration(signal: SpliceInfoSection) -> Optional[int]:
    """
    Get duration from command or descriptor, in seconds.

    The two carriers use different units in this model: BreakDuration.duration
    holds 90kHz ticks, while SegmentationDescriptor.segmentation_duration holds
    seconds, as parsed from threefive.
    """
    # Break duration from Splice Insert, stored as 90kHz ticks
    if signal.splice_command_type == SpliceCommandType.SPLICE_INSERT:
        if isinstance(signal.splice_command, SpliceInsert):
            if signal.splice_command.break_duration:
                return signal.splice_command.break_duration.duration // 90000

    # Segmentation duration from descriptor, already in seconds
    for desc in signal.splice_descriptors:
        if desc.descriptor_tag == 0x02 and desc.segmentation_duration:
            return int(desc.segmentation_duration)

    return None


def _get_out_of_network(signal: SpliceInfoSection) -> Optional[bool]:
    """Get out of network indicator from Splice Insert command."""
    if signal.splice_command_type == SpliceCommandType.SPLICE_INSERT:
        if isinstance(signal.splice_command, SpliceInsert):
            return signal.splice_command.out_of_network_indicator
    return None


def compare_values(actual: Any, operator: ConditionOperator, expected: Any) -> bool:
    """
    Compare values using the specified operator.

    Args:
        actual: Actual value from signal
        operator: Comparison operator
        expected: Expected value from condition

    Returns:
        True if comparison succeeds, False otherwise
    """
    # Normalize expected value to match actual value type
    normalized_expected = expected

    if isinstance(actual, bool) and isinstance(expected, str):
        normalized_expected = expected.lower() in ("true", "1", "yes")

    elif isinstance(actual, int) and isinstance(expected, str):
        try:
            normalized_expected = int(expected)
        except ValueError:
            pass

    logger.debug(
        "Comparing values",
        extra={
            "actual": actual,
            "actualType": type(actual).__name__,
            "expected": expected,
            "expectedType": type(expected).__name__,
            "normalized": normalized_expected,
            "operator": operator,
        },
    )

    if operator == ConditionOperator.EQ:
        return actual == normalized_expected

    elif operator == ConditionOperator.NE:
        return actual != normalized_expected

    elif operator == ConditionOperator.GT:
        return actual > normalized_expected

    elif operator == ConditionOperator.LT:
        return actual < normalized_expected

    elif operator == ConditionOperator.GTE:
        return actual >= normalized_expected

    elif operator == ConditionOperator.LTE:
        return actual <= normalized_expected

    elif operator == ConditionOperator.RANGE:
        if isinstance(expected, str) and "-" in expected:
            try:
                min_val, max_val = map(int, expected.split("-"))
                return min_val <= actual <= max_val
            except ValueError:
                return False
        return False

    elif operator == ConditionOperator.IN:
        if isinstance(expected, list):
            # Normalize list values to match actual type
            normalized_list = []
            for v in expected:
                if isinstance(actual, int) and isinstance(v, str):
                    try:
                        normalized_list.append(int(v))
                    except ValueError:
                        normalized_list.append(v)
                else:
                    normalized_list.append(v)
            return actual in normalized_list

        elif isinstance(expected, str):
            values = [v.strip() for v in expected.split(",")]
            # Normalize values to match actual type
            normalized_values = []
            for v in values:
                if isinstance(actual, int):
                    try:
                        normalized_values.append(int(v))
                    except ValueError:
                        normalized_values.append(v)
                else:
                    normalized_values.append(v)
            return actual in normalized_values

        return False

    elif operator == ConditionOperator.NOT_IN:
        if isinstance(expected, list):
            # Normalize list values to match actual type
            normalized_list = []
            for v in expected:
                if isinstance(actual, int) and isinstance(v, str):
                    try:
                        normalized_list.append(int(v))
                    except ValueError:
                        normalized_list.append(v)
                else:
                    normalized_list.append(v)
            return actual not in normalized_list

        elif isinstance(expected, str):
            values = [v.strip() for v in expected.split(",")]
            # Normalize values to match actual type
            normalized_values = []
            for v in values:
                if isinstance(actual, int):
                    try:
                        normalized_values.append(int(v))
                    except ValueError:
                        normalized_values.append(v)
                else:
                    normalized_values.append(v)
            return actual not in normalized_values

        return False

    return False
