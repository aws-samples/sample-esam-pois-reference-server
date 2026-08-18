# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Timestamp validation utilities for MediaLive Fixed Mode scheduling.

This module provides functions to validate and normalize timestamps for use with
AWS MediaLive BatchUpdateSchedule API, which requires strict timestamp formatting.
"""

import re
import logging
from datetime import datetime, timezone, timedelta
from typing import Tuple, Optional

logger = logging.getLogger(__name__)


# MediaLive expects: yyyy-mm-ddThh:mm:ss.nnnZ
# Example: 2026-02-02T20:00:00.000Z
TIMESTAMP_PATTERN = re.compile(
    r"^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z$"
)


def validate_and_normalize_timestamp(
    timestamp: str,
) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Validate and normalize timestamp for MediaLive Fixed Mode.

    MediaLive requires timestamps in the format: yyyy-mm-ddThh:mm:ss.nnnZ
    where all letters are digits, T is a separator, Z indicates UTC, and
    .nnn represents milliseconds (3 digits).

    Args:
        timestamp: ISO 8601 timestamp string

    Returns:
        Tuple of (is_valid, normalized_timestamp, error_message)
        - is_valid: True if timestamp is valid
        - normalized_timestamp: Normalized timestamp in MediaLive format, or None if invalid
        - error_message: Error description if invalid, or None if valid
    """
    if not timestamp:
        return False, None, "Timestamp is empty or None"

    # Check basic format
    match = TIMESTAMP_PATTERN.match(timestamp)
    if not match:
        return (
            False,
            None,
            f"Timestamp does not match required format yyyy-mm-ddThh:mm:ss.nnnZ: {timestamp}",
        )

    # Extract components
    year, month, day, hour, minute, second, milliseconds = match.groups()

    # Add milliseconds if missing
    if milliseconds is None:
        milliseconds = "000"
        normalized = f"{year}-{month}-{day}T{hour}:{minute}:{second}.{milliseconds}Z"
        logger.debug(
            f"Added missing milliseconds to timestamp: {timestamp} -> {normalized}"
        )
    else:
        normalized = timestamp

    # Validate date/time components
    try:
        year_int = int(year)
        month_int = int(month)
        day_int = int(day)
        hour_int = int(hour)
        minute_int = int(minute)
        second_int = int(second)

        # Validate ranges
        if not (1 <= month_int <= 12):
            return False, None, f"Invalid month: {month_int} (must be 01-12)"

        if not (1 <= day_int <= 31):
            return False, None, f"Invalid day: {day_int} (must be 01-31)"

        if not (0 <= hour_int <= 23):
            return False, None, f"Invalid hour: {hour_int} (must be 00-23)"

        if not (0 <= minute_int <= 59):
            return False, None, f"Invalid minute: {minute_int} (must be 00-59)"

        if not (0 <= second_int <= 59):
            return False, None, f"Invalid second: {second_int} (must be 00-59)"

        # Try to create a datetime object to validate the date is real
        datetime(
            year_int,
            month_int,
            day_int,
            hour_int,
            minute_int,
            second_int,
            tzinfo=timezone.utc,
        )

    except ValueError as e:
        return False, None, f"Invalid date/time components: {e}"

    return True, normalized, None


def validate_timestamp_temporal(timestamp: str) -> Tuple[bool, Optional[str], bool]:
    """
    Validate timestamp is within acceptable temporal range.

    MediaLive may reject timestamps that are too far in the past or future.
    This function checks if the timestamp is within acceptable bounds.

    Args:
        timestamp: Normalized timestamp string (yyyy-mm-ddThh:mm:ss.nnnZ)

    Returns:
        Tuple of (is_valid, error_message, should_warn)
        - is_valid: True if timestamp is acceptable
        - error_message: Error description if invalid, or None if valid
        - should_warn: True if timestamp is acceptable but warrants a warning
    """
    try:
        # Parse the timestamp
        dt = parse_iso8601_timestamp(timestamp)
        if dt is None:
            return False, "Failed to parse timestamp", False

        # Get current time in UTC
        now = datetime.now(timezone.utc)

        # Calculate time difference
        delta = dt - now
        delta_seconds = delta.total_seconds()

        # Check if timestamp is too far in the past (>5 minutes)
        if delta_seconds < -300:  # 5 minutes = 300 seconds
            minutes_past = abs(delta_seconds) / 60
            return (
                False,
                f"Timestamp is {minutes_past:.1f} minutes in the past (max 5 minutes allowed)",
                False,
            )

        # Warn if timestamp is in the past but within 5 minutes
        if delta_seconds < 0:
            seconds_past = abs(delta_seconds)
            logger.warning(
                f"Timestamp is {seconds_past:.1f} seconds in the past: {timestamp}"
            )
            return True, None, True

        # Warn if timestamp is more than 24 hours in the future
        if delta_seconds > 86400:  # 24 hours = 86400 seconds
            hours_future = delta_seconds / 3600
            logger.warning(
                f"Timestamp is {hours_future:.1f} hours in the future: {timestamp}"
            )
            return True, None, True

        # Timestamp is within acceptable range
        return True, None, False

    except Exception as e:
        return False, f"Error validating timestamp temporal range: {e}", False


def parse_iso8601_timestamp(timestamp: str) -> Optional[datetime]:
    """
    Parse ISO 8601 timestamp string to datetime object.

    Args:
        timestamp: ISO 8601 timestamp string (yyyy-mm-ddThh:mm:ss.nnnZ)

    Returns:
        datetime object in UTC timezone, or None if parsing fails
    """
    try:
        # Remove the 'Z' suffix and parse
        if timestamp.endswith("Z"):
            timestamp_without_z = timestamp[:-1]
            dt = datetime.fromisoformat(timestamp_without_z)
            # Ensure timezone is UTC
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        else:
            return None
    except Exception as e:
        logger.error(f"Failed to parse timestamp {timestamp}: {e}")
        return None


def calculate_time_delta(
    timestamp: str, reference_time: Optional[datetime] = None
) -> Optional[timedelta]:
    """
    Calculate time delta between timestamp and reference time.

    Args:
        timestamp: ISO 8601 timestamp string
        reference_time: Reference datetime (defaults to current UTC time)

    Returns:
        timedelta object, or None if calculation fails
    """
    try:
        dt = parse_iso8601_timestamp(timestamp)
        if dt is None:
            return None

        if reference_time is None:
            reference_time = datetime.now(timezone.utc)

        return dt - reference_time
    except Exception as e:
        logger.error(f"Failed to calculate time delta for {timestamp}: {e}")
        return None
