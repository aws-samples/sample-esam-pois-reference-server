# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Unit tests for channel lookup by name in the ESAM handler.

The lookup runs on every ESAM request, so it must be a GSI query rather than a
table Scan. A Scan is billed for the whole table and is capped at 1 MB per
page, which means channels past that cap are invisible to the handler and the
request is silently answered as "channel not registered".

The table double below emulates that page cap so these tests fail if the
implementation goes back to scanning.
"""

import os
import sys
from unittest.mock import MagicMock, patch

import pytest

# ── Patch boto3 before importing esam_handler (module-level AWS calls) ──
_mock_boto3 = MagicMock()
_mock_table = MagicMock()
_mock_boto3.resource.return_value.Table.return_value = _mock_table

if "handlers.esam_handler" in sys.modules:
    del sys.modules["handlers.esam_handler"]

with patch.dict(
    os.environ,
    {
        "AWS_DEFAULT_REGION": "us-east-1",
        "AWS_ACCESS_KEY_ID": "testing",
        "AWS_SECRET_ACCESS_KEY": "testing",
    },
):
    from handlers import esam_handler


def _channel_item(name, channel_id, enabled=True):
    """Build a DynamoDB channel item as channel_repository writes it."""
    return {
        "PK": f"CHANNEL#{channel_id}",
        "SK": "METADATA",
        "GSI1PK": "CHANNEL",
        "GSI1SK": f"{str(enabled).lower()}#{name}",
        "channelId": channel_id,
        "name": name,
        "enabled": enabled,
        "defaultAction": "noop",
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-01T00:00:00Z",
    }


def _extract_equalities(condition):
    """Collect {attribute: value} from a boto3 key condition tree."""
    expression = condition.get_expression()
    operator = expression["operator"]

    if operator == "AND":
        found = {}
        for value in expression["values"]:
            found.update(_extract_equalities(value))
        return found

    if operator == "=":
        attribute, value = expression["values"]
        return {attribute.name: value}

    raise AssertionError(f"Unexpected key condition operator: {operator}")


class FakeChannelsTable:
    """DynamoDB table double that emulates the 1 MB response page cap.

    PAGE_LIMIT stands in for the byte cap: scan() only ever sees the first
    page, which is what makes a Scan-based lookup lose channels at scale.
    query() resolves against the full item set, the way a GSI does.
    """

    PAGE_LIMIT = 25

    def __init__(self, items):
        self.items = items
        self.scan_calls = 0
        self.query_calls = 0

    def scan(self, **kwargs):
        self.scan_calls += 1
        page = self.items[: self.PAGE_LIMIT]
        response = {"Items": list(page)}
        if len(self.items) > self.PAGE_LIMIT:
            response["LastEvaluatedKey"] = {"PK": page[-1]["PK"]}
        return response

    def query(self, **kwargs):
        self.query_calls += 1
        assert kwargs.get("IndexName") == "GSI1", "lookup must target GSI1"

        wanted = _extract_equalities(kwargs["KeyConditionExpression"])
        matches = [
            item
            for item in self.items
            if all(item.get(key) == value for key, value in wanted.items())
        ]

        start = 0
        start_key = kwargs.get("ExclusiveStartKey")
        if start_key is not None:
            start = self._index_of(matches, start_key) + 1

        page_size = min(kwargs.get("Limit", self.PAGE_LIMIT), self.PAGE_LIMIT)
        page = matches[start : start + page_size]

        response = {"Items": page}
        if page and start + len(page) < len(matches):
            response["LastEvaluatedKey"] = {
                "PK": page[-1]["PK"],
                "SK": page[-1]["SK"],
            }
        return response

    @staticmethod
    def _index_of(items, key):
        for position, item in enumerate(items):
            if item["PK"] == key["PK"] and item["SK"] == key["SK"]:
                return position
        raise AssertionError(f"ExclusiveStartKey not found: {key}")


def _build_table(target_name="target-channel", target_enabled=True, total=500):
    """Build a table where the target channel sits well past the page cap.

    Channel, state and audit items are interleaved because the table is
    single-table design: state and audit entries consume the same page budget
    a Scan would have to walk through.
    """
    items = []
    for index in range(total):
        channel_id = f"ch-{index:04d}"
        items.append(_channel_item(f"channel-{index:04d}", channel_id))
        items.append({"PK": f"CHANNEL#{channel_id}", "SK": "STATE"})
        items.append({"PK": f"ACTION_AUDIT#{channel_id}", "SK": "AUDIT#1"})

    target_id = "ch-target"
    items.append(_channel_item(target_name, target_id, enabled=target_enabled))
    return FakeChannelsTable(items)


@pytest.fixture(autouse=True)
def _clear_channel_cache():
    """Keep the module-level cache from leaking between tests."""
    esam_handler.channel_cache.clear()
    yield
    esam_handler.channel_cache.clear()


class TestChannelLookupUsesQuery:
    def test_finds_channel_beyond_first_page(self, monkeypatch):
        """A channel past the page cap must still resolve."""
        table = _build_table()
        monkeypatch.setattr(esam_handler, "channels_table", table)

        channel = esam_handler._get_channel_by_name("target-channel")

        assert channel.name == "target-channel"
        assert channel.channel_id == "ch-target"

    def test_does_not_scan(self, monkeypatch):
        table = _build_table()
        monkeypatch.setattr(esam_handler, "channels_table", table)

        esam_handler._get_channel_by_name("target-channel")

        assert table.scan_calls == 0, "lookup must not Scan the table"
        assert table.query_calls >= 1

    def test_enabled_channel_resolves_in_single_query(self, monkeypatch):
        """Enabled is the common case and must not need the second probe."""
        table = _build_table(target_enabled=True)
        monkeypatch.setattr(esam_handler, "channels_table", table)

        esam_handler._get_channel_by_name("target-channel")

        assert table.query_calls == 1

    def test_disabled_channel_is_found(self, monkeypatch):
        """Disabled channels must resolve so the caller can report why."""
        table = _build_table(target_enabled=False)
        monkeypatch.setattr(esam_handler, "channels_table", table)

        channel = esam_handler._get_channel_by_name("target-channel")

        assert channel.enabled is False
        assert table.query_calls == 2

    def test_unknown_channel_raises(self, monkeypatch):
        table = _build_table()
        monkeypatch.setattr(esam_handler, "channels_table", table)

        with pytest.raises(esam_handler.ChannelNotFoundError):
            esam_handler._get_channel_by_name("does-not-exist")

    def test_name_containing_separator(self, monkeypatch):
        """The GSI sort key joins on '#', so names with '#' must still match."""
        table = _build_table(target_name="odd#name")
        monkeypatch.setattr(esam_handler, "channels_table", table)

        channel = esam_handler._get_channel_by_name("odd#name")

        assert channel.name == "odd#name"

    def test_key_attributes_are_stripped(self, monkeypatch):
        """PK/SK/GSI attributes must not leak into the Channel model."""
        table = _build_table()
        monkeypatch.setattr(esam_handler, "channels_table", table)

        channel = esam_handler._get_channel_by_name("target-channel")

        assert not hasattr(channel, "PK")
        assert not hasattr(channel, "GSI1PK")


class TestChannelCache:
    def test_second_lookup_is_served_from_cache(self, monkeypatch):
        table = _build_table()
        monkeypatch.setattr(esam_handler, "channels_table", table)
        monkeypatch.setattr(esam_handler, "CHANNEL_CACHE_TTL_SECONDS", 30)

        first = esam_handler._get_channel_by_name("target-channel")
        assert table.query_calls == 1
        second = esam_handler._get_channel_by_name("target-channel")

        assert table.query_calls == 1, "second lookup must not hit DynamoDB"
        assert second.channel_id == first.channel_id
        assert "target-channel" in esam_handler.channel_cache

    def test_expired_entry_is_refetched(self, monkeypatch):
        table = _build_table()
        monkeypatch.setattr(esam_handler, "channels_table", table)
        monkeypatch.setattr(esam_handler, "CHANNEL_CACHE_TTL_SECONDS", 30)

        esam_handler._get_channel_by_name("target-channel")
        calls_after_first = table.query_calls

        # Age the entry past its TTL.
        channel, timestamp = esam_handler.channel_cache["target-channel"]
        esam_handler.channel_cache["target-channel"] = (channel, timestamp - 31)

        esam_handler._get_channel_by_name("target-channel")

        assert table.query_calls > calls_after_first

    def test_ttl_zero_disables_cache(self, monkeypatch):
        table = _build_table()
        monkeypatch.setattr(esam_handler, "channels_table", table)
        monkeypatch.setattr(esam_handler, "CHANNEL_CACHE_TTL_SECONDS", 0)

        esam_handler._get_channel_by_name("target-channel")
        calls_after_first = table.query_calls
        esam_handler._get_channel_by_name("target-channel")

        assert table.query_calls > calls_after_first
        assert esam_handler.channel_cache == {}

    def test_lookup_failure_is_not_cached(self, monkeypatch):
        table = _build_table()
        monkeypatch.setattr(esam_handler, "channels_table", table)

        with pytest.raises(esam_handler.ChannelNotFoundError):
            esam_handler._get_channel_by_name("does-not-exist")

        assert "does-not-exist" not in esam_handler.channel_cache


class TestChannelRepositoryList:
    """Listing channels must query GSI1 rather than scan the table."""

    def _repository(self, table):
        from domain.repositories.channel_repository import ChannelRepository

        with patch("domain.repositories.channel_repository.boto3"):
            repository = ChannelRepository("pois-channels")
        repository.table = table
        return repository

    def test_returns_channels_beyond_first_page(self):
        table = _build_table(total=200)
        repository = self._repository(table)

        channels = repository.get_all_channels()

        names = {channel.name for channel in channels}
        assert "target-channel" in names
        assert len(channels) == 201

    def test_does_not_scan(self):
        table = _build_table(total=200)
        repository = self._repository(table)

        repository.get_all_channels()

        assert table.scan_calls == 0, "listing must not Scan the table"
        assert table.query_calls >= 1

    def test_paginates(self):
        table = _build_table(total=200)
        repository = self._repository(table)

        repository.get_all_channels()

        assert table.query_calls > 1, "listing must follow LastEvaluatedKey"
