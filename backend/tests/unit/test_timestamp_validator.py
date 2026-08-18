# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Unit tests for timestamp validation utilities.

Tests the timestamp validation and normalization functions used by
the MediaLive plugin for Fixed Mode scheduling.
"""

from datetime import datetime, timezone, timedelta

from domain.services.timestamp_validator import (
    validate_and_normalize_timestamp,
    validate_timestamp_temporal,
    parse_iso8601_timestamp,
    calculate_time_delta,
)


class TestValidateAndNormalizeTimestamp:
    """Tests for validate_and_normalize_timestamp function."""

    def test_valid_timestamp_with_milliseconds(self):
        """Test valid timestamp with milliseconds is accepted."""
        timestamp = "2026-02-02T20:00:00.000Z"
        is_valid, normalized, error = validate_and_normalize_timestamp(timestamp)

        assert is_valid is True
        assert normalized == timestamp
        assert error is None

    def test_valid_timestamp_without_milliseconds(self):
        """Test valid timestamp without milliseconds is normalized."""
        timestamp = "2026-02-02T20:00:00Z"
        is_valid, normalized, error = validate_and_normalize_timestamp(timestamp)

        assert is_valid is True
        assert normalized == "2026-02-02T20:00:00.000Z"
        assert error is None

    def test_invalid_timestamp_missing_z(self):
        """Test timestamp missing Z is rejected."""
        timestamp = "2026-02-02T20:00:00.000"
        is_valid, normalized, error = validate_and_normalize_timestamp(timestamp)

        assert is_valid is False
        assert normalized is None
        assert "does not match required format" in error

    def test_invalid_timestamp_space_instead_of_t(self):
        """Test timestamp with space instead of T is rejected."""
        timestamp = "2026-02-02 20:00:00.000Z"
        is_valid, normalized, error = validate_and_normalize_timestamp(timestamp)

        assert is_valid is False
        assert normalized is None
        assert "does not match required format" in error

    def test_invalid_month(self):
        """Test timestamp with invalid month is rejected."""
        timestamp = "2026-13-02T20:00:00.000Z"
        is_valid, normalized, error = validate_and_normalize_timestamp(timestamp)

        assert is_valid is False
        assert normalized is None
        assert "Invalid month" in error

    def test_invalid_day(self):
        """Test timestamp with invalid day is rejected."""
        timestamp = "2026-02-32T20:00:00.000Z"
        is_valid, normalized, error = validate_and_normalize_timestamp(timestamp)

        assert is_valid is False
        assert normalized is None
        assert "Invalid" in error

    def test_invalid_hour(self):
        """Test timestamp with invalid hour is rejected."""
        timestamp = "2026-02-02T25:00:00.000Z"
        is_valid, normalized, error = validate_and_normalize_timestamp(timestamp)

        assert is_valid is False
        assert normalized is None
        assert "Invalid hour" in error

    def test_empty_timestamp(self):
        """Test empty timestamp is rejected."""
        is_valid, normalized, error = validate_and_normalize_timestamp("")

        assert is_valid is False
        assert normalized is None
        assert "empty" in error.lower()


class TestValidateTimestampTemporal:
    """Tests for validate_timestamp_temporal function."""

    def test_future_timestamp_within_24_hours(self):
        """Test future timestamp within 24 hours is accepted without warning."""
        # Create timestamp 1 hour in the future
        future_time = datetime.now(timezone.utc) + timedelta(hours=1)
        timestamp = future_time.strftime("%Y-%m-%dT%H:%M:%S.000Z")

        is_valid, error, should_warn = validate_timestamp_temporal(timestamp)

        assert is_valid is True
        assert error is None
        assert should_warn is False

    def test_future_timestamp_beyond_24_hours(self):
        """Test future timestamp beyond 24 hours triggers warning."""
        # Create timestamp 25 hours in the future
        future_time = datetime.now(timezone.utc) + timedelta(hours=25)
        timestamp = future_time.strftime("%Y-%m-%dT%H:%M:%S.000Z")

        is_valid, error, should_warn = validate_timestamp_temporal(timestamp)

        assert is_valid is True
        assert error is None
        assert should_warn is True

    def test_past_timestamp_within_5_minutes(self):
        """Test past timestamp within 5 minutes triggers warning but is accepted."""
        # Create timestamp 2 minutes in the past
        past_time = datetime.now(timezone.utc) - timedelta(minutes=2)
        timestamp = past_time.strftime("%Y-%m-%dT%H:%M:%S.000Z")

        is_valid, error, should_warn = validate_timestamp_temporal(timestamp)

        assert is_valid is True
        assert error is None
        assert should_warn is True

    def test_past_timestamp_beyond_5_minutes(self):
        """Test past timestamp beyond 5 minutes is rejected."""
        # Create timestamp 6 minutes in the past
        past_time = datetime.now(timezone.utc) - timedelta(minutes=6)
        timestamp = past_time.strftime("%Y-%m-%dT%H:%M:%S.000Z")

        is_valid, error, should_warn = validate_timestamp_temporal(timestamp)

        assert is_valid is False
        assert error is not None
        assert "minutes in the past" in error
        assert should_warn is False


class TestParseIso8601Timestamp:
    """Tests for parse_iso8601_timestamp function."""

    def test_parse_valid_timestamp(self):
        """Test parsing valid ISO 8601 timestamp."""
        timestamp = "2026-02-02T20:00:00.000Z"
        dt = parse_iso8601_timestamp(timestamp)

        assert dt is not None
        assert dt.year == 2026
        assert dt.month == 2
        assert dt.day == 2
        assert dt.hour == 20
        assert dt.minute == 0
        assert dt.second == 0
        assert dt.tzinfo == timezone.utc

    def test_parse_timestamp_without_z(self):
        """Test parsing timestamp without Z returns None."""
        timestamp = "2026-02-02T20:00:00.000"
        dt = parse_iso8601_timestamp(timestamp)

        assert dt is None


class TestCalculateTimeDelta:
    """Tests for calculate_time_delta function."""

    def test_calculate_delta_future(self):
        """Test calculating delta for future timestamp."""
        # Create timestamp 1 hour in the future
        future_time = datetime.now(timezone.utc) + timedelta(hours=1)
        timestamp = future_time.strftime("%Y-%m-%dT%H:%M:%S.000Z")

        delta = calculate_time_delta(timestamp)

        assert delta is not None
        # Should be approximately 1 hour (3600 seconds), allow 1 second tolerance
        assert 3599 <= delta.total_seconds() <= 3601

    def test_calculate_delta_past(self):
        """Test calculating delta for past timestamp."""
        # Create timestamp 1 hour in the past
        past_time = datetime.now(timezone.utc) - timedelta(hours=1)
        timestamp = past_time.strftime("%Y-%m-%dT%H:%M:%S.000Z")

        delta = calculate_time_delta(timestamp)

        assert delta is not None
        # Should be approximately -1 hour (-3600 seconds), allow 1 second tolerance
        assert -3601 <= delta.total_seconds() <= -3599
