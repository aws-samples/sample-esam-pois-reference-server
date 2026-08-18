# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Hypothesis strategies for property-based testing of external actions.

This module provides reusable strategies for generating test data for
property-based tests.
"""

from hypothesis import strategies as st

from domain.models.external_actions import ExternalAction, TriggerMode


# Basic strategies
def channel_id_strategy():
    """Generate valid channel IDs."""
    return st.text(
        alphabet=st.characters(
            whitelist_categories=("Lu", "Ll", "Nd"), whitelist_characters="-_"
        ),
        min_size=5,
        max_size=50,
    ).filter(lambda x: x and not x.startswith("-") and not x.endswith("-"))


def action_id_strategy():
    """Generate valid action IDs."""
    return st.text(
        alphabet=st.characters(
            whitelist_categories=("Lu", "Ll", "Nd"), whitelist_characters="-_"
        ),
        min_size=5,
        max_size=50,
    ).filter(lambda x: x and not x.startswith("-") and not x.endswith("-"))


def action_type_strategy():
    """Generate valid action type names."""
    return st.sampled_from(
        ["medialive_schedule_action", "webhook", "sns_notification", "custom_action"]
    )


def trigger_mode_strategy():
    """Generate trigger modes."""
    return st.sampled_from(
        [TriggerMode.ON_MATCH, TriggerMode.ON_NO_MATCH, TriggerMode.ALWAYS]
    )


def target_config_strategy():
    """Generate target configuration."""
    return st.fixed_dictionaries(
        {
            "credential_id": st.one_of(st.none(), st.text(min_size=5, max_size=30)),
            "endpoint": st.one_of(st.none(), st.text(min_size=10, max_size=100)),
            "region": st.one_of(
                st.none(), st.sampled_from(["us-east-1", "us-west-2", "eu-west-1"])
            ),
        }
    )


def action_config_strategy():
    """Generate action-specific configuration."""
    return st.fixed_dictionaries(
        {
            "idempotency_window_seconds": st.integers(min_value=10, max_value=300),
            "custom_field": st.one_of(st.none(), st.text(min_size=1, max_size=50)),
        }
    )


def cleanup_config_strategy():
    """Generate cleanup configuration."""
    return st.one_of(
        st.none(),
        st.fixed_dictionaries(
            {
                "trigger_type_id": st.one_of(
                    st.none(), st.integers(min_value=0, max_value=255)
                ),
                "trigger_upid": st.one_of(st.none(), st.text(min_size=1, max_size=50)),
                "timeout_seconds": st.one_of(
                    st.none(), st.integers(min_value=10, max_value=3600)
                ),
            }
        ),
    )


def retry_config_strategy():
    """Generate retry configuration."""
    return st.fixed_dictionaries(
        {
            "max_retries": st.integers(min_value=0, max_value=10),
            "base_delay_seconds": st.integers(min_value=1, max_value=10),
        }
    )


def condition_strategy():
    """Generate a single condition."""
    return st.fixed_dictionaries(
        {
            "field": st.sampled_from(
                ["segmentation_type_id", "segmentation_upid", "pts", "duration"]
            ),
            "operator": st.sampled_from(["eq", "ne", "gt", "lt", "in"]),
            "value": st.one_of(
                st.integers(min_value=0, max_value=255),
                st.text(min_size=1, max_size=50),
                st.lists(
                    st.integers(min_value=0, max_value=255), min_size=1, max_size=5
                ),
            ),
        }
    )


def conditions_strategy():
    """Generate list of conditions."""
    return st.one_of(st.none(), st.lists(condition_strategy(), min_size=0, max_size=5))


def external_action_strategy():
    """Generate ExternalAction instances."""
    return st.builds(
        ExternalAction,
        action_id=action_id_strategy(),
        action_type=action_type_strategy(),
        target=target_config_strategy(),
        trigger_mode=trigger_mode_strategy(),
        action_config=action_config_strategy(),
        cleanup_config=cleanup_config_strategy(),
        retry_config=retry_config_strategy(),
        timeout_ms=st.integers(min_value=1000, max_value=30000),
        enabled=st.booleans(),
        conditions=conditions_strategy(),
        order=st.integers(min_value=0, max_value=100),
        blocking=st.booleans(),
    )


def signal_data_strategy():
    """Generate SCTE-35 signal data."""
    return st.fixed_dictionaries(
        {
            "pts": st.integers(min_value=0, max_value=2**33 - 1),
            "segmentation_type_id": st.integers(min_value=0, max_value=255),
            "segmentation_upid": st.text(min_size=1, max_size=50),
            "segmentation_duration": st.one_of(
                st.none(), st.integers(min_value=0, max_value=2**32 - 1)
            ),
            "splice_event_id": st.integers(min_value=0, max_value=2**32 - 1),
            "unique_program_id": st.integers(min_value=0, max_value=2**16 - 1),
        }
    )


def rule_id_strategy():
    """Generate rule IDs."""
    return st.text(
        alphabet=st.characters(
            whitelist_categories=("Lu", "Ll", "Nd"), whitelist_characters="-_"
        ),
        min_size=5,
        max_size=50,
    ).filter(lambda x: x and not x.startswith("-") and not x.endswith("-"))
