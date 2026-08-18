# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Unit tests for descriptor priority parsing functionality."""

from domain.services.rule_evaluator import _parse_descriptor_priority


class TestDescriptorPriorityParsing:
    """Test cases for _parse_descriptor_priority function."""

    def test_parse_valid_priority_string(self):
        """Test parsing a valid priority string."""
        result = _parse_descriptor_priority("52,34,48")
        assert result == [52, 34, 48]

    def test_parse_priority_string_with_whitespace(self):
        """Test parsing priority string with whitespace around values."""
        result = _parse_descriptor_priority("52, 34, 48")
        assert result == [52, 34, 48]

        result = _parse_descriptor_priority(" 52 , 34 , 48 ")
        assert result == [52, 34, 48]

    def test_parse_null_input(self):
        """Test that null input returns empty list."""
        result = _parse_descriptor_priority(None)
        assert result == []

    def test_parse_empty_string(self):
        """Test that empty string returns empty list."""
        result = _parse_descriptor_priority("")
        assert result == []

    def test_parse_whitespace_only_string(self):
        """Test that whitespace-only string returns empty list."""
        result = _parse_descriptor_priority("   ")
        assert result == []

    def test_parse_invalid_format_with_non_numeric(self):
        """Test that invalid format with non-numeric values returns empty list."""
        result = _parse_descriptor_priority("52,abc,48")
        assert result == []

    def test_parse_single_value(self):
        """Test parsing a single value."""
        result = _parse_descriptor_priority("52")
        assert result == [52]

    def test_parse_with_trailing_comma(self):
        """Test parsing with trailing comma."""
        result = _parse_descriptor_priority("52,34,")
        assert result == [52, 34]

    def test_parse_with_leading_comma(self):
        """Test parsing with leading comma."""
        result = _parse_descriptor_priority(",52,34")
        assert result == [52, 34]

    def test_parse_with_multiple_commas(self):
        """Test parsing with multiple consecutive commas."""
        result = _parse_descriptor_priority("52,,34")
        assert result == [52, 34]
