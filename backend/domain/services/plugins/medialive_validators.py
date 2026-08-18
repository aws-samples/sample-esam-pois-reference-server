# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
MediaLive Schedule Action Validators.

Each validator returns (is_valid, error_message).
"""

from typing import Dict, Any, Tuple, Optional


def _require(settings: Dict[str, Any], field: str, label: str) -> Optional[str]:
    """Return error message if field is missing or empty."""
    val = settings.get(field)
    if val is None or val == "" or val == []:
        return f"{label} requires '{field}' in action_settings"
    return None


# =============================================================================
# Per-action validators
# =============================================================================


def validate_static_image_activate(s: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    err = _require(s, "image_uri", "static_image_activate")
    return (False, err) if err else (True, None)


def validate_static_image_deactivate(_s: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    return True, None


def validate_static_image_output_activate(
    s: Dict[str, Any],
) -> Tuple[bool, Optional[str]]:
    err = _require(s, "image_uri", "static_image_output_activate")
    if err:
        return False, err
    err = _require(s, "output_names", "static_image_output_activate")
    return (False, err) if err else (True, None)


def validate_static_image_output_deactivate(
    s: Dict[str, Any],
) -> Tuple[bool, Optional[str]]:
    err = _require(s, "output_names", "static_image_output_deactivate")
    return (False, err) if err else (True, None)


def validate_motion_graphics_activate(_s: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    return True, None  # URL is optional per AWS API


def validate_motion_graphics_deactivate(
    _s: Dict[str, Any],
) -> Tuple[bool, Optional[str]]:
    return True, None


def validate_input_switch(s: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    err = _require(s, "input_attachment_name", "input_switch")
    return (False, err) if err else (True, None)


def validate_input_prepare(_s: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    return True, None  # All fields optional


def validate_scte35_splice_insert(s: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    err = _require(s, "splice_event_id", "scte35_splice_insert")
    return (False, err) if err else (True, None)


def validate_scte35_return_to_network(s: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    err = _require(s, "splice_event_id", "scte35_return_to_network")
    return (False, err) if err else (True, None)


def validate_scte35_time_signal(s: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    descriptors = s.get("descriptors", [])
    if not descriptors:
        return False, "scte35_time_signal requires at least one descriptor"
    return True, None


def validate_scte35_input(s: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    err = _require(s, "input_attachment_name", "scte35_input")
    return (False, err) if err else (True, None)


def validate_hls_id3_segment_tagging(_s: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    return True, None  # Tag is optional


def validate_hls_timed_metadata(s: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    err = _require(s, "id3", "hls_timed_metadata")
    return (False, err) if err else (True, None)


def validate_id3_segment_tagging(_s: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    return True, None


def validate_timed_metadata(s: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    err = _require(s, "id3", "timed_metadata")
    return (False, err) if err else (True, None)


def validate_pause_state(s: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    pipelines = s.get("pipelines", [])
    pipeline_id = s.get("pipeline_id")
    if not pipelines and not pipeline_id:
        return False, "pause_state requires at least one pipeline"
    return True, None


# =============================================================================
# Registry: action_type -> validator function
# =============================================================================

ACTION_VALIDATORS = {
    "static_image_activate": validate_static_image_activate,
    "static_image_deactivate": validate_static_image_deactivate,
    "static_image_output_activate": validate_static_image_output_activate,
    "static_image_output_deactivate": validate_static_image_output_deactivate,
    "motion_graphics_activate": validate_motion_graphics_activate,
    "motion_graphics_deactivate": validate_motion_graphics_deactivate,
    "input_switch": validate_input_switch,
    "input_prepare": validate_input_prepare,
    "scte35_splice_insert": validate_scte35_splice_insert,
    "scte35_return_to_network": validate_scte35_return_to_network,
    "scte35_time_signal": validate_scte35_time_signal,
    "scte35_input": validate_scte35_input,
    "hls_id3_segment_tagging": validate_hls_id3_segment_tagging,
    "hls_timed_metadata": validate_hls_timed_metadata,
    "id3_segment_tagging": validate_id3_segment_tagging,
    "timed_metadata": validate_timed_metadata,
    "pause_state": validate_pause_state,
}
