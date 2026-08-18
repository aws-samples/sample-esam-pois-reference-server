# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
MediaLive Schedule Action Builders.

Each builder function takes action_settings (dict) and returns the
PascalCase dict structure expected by the AWS MediaLive BatchUpdateSchedule API.
"""

from typing import Dict, Any, Optional

# =============================================================================
# Static Image
# =============================================================================


def build_static_image_activate(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Build StaticImageActivateSettings."""
    image_location: Dict[str, Any] = {"Uri": settings["image_uri"]}
    if settings.get("username"):
        image_location["Username"] = settings["username"]
    if settings.get("password_param"):
        image_location["PasswordParam"] = settings["password_param"]

    result: Dict[str, Any] = {
        "Image": image_location,
        "Layer": settings.get("layer", 0),
        "Opacity": settings.get("opacity", 100),
        "ImageX": settings.get("imageX", 0),
        "ImageY": settings.get("imageY", 0),
        "FadeIn": settings.get("fadeIn", 0),
        "FadeOut": settings.get("fadeOut", 0),
    }
    if settings.get("width"):
        result["Width"] = settings["width"]
    if settings.get("height"):
        result["Height"] = settings["height"]
    if settings.get("duration"):
        result["Duration"] = settings["duration"]
    return {"StaticImageActivateSettings": result}


def build_static_image_deactivate(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Build StaticImageDeactivateSettings."""
    result: Dict[str, Any] = {"Layer": settings.get("layer", 0)}
    if settings.get("fadeOut"):
        result["FadeOut"] = settings["fadeOut"]
    return {"StaticImageDeactivateSettings": result}


def build_static_image_output_activate(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Build StaticImageOutputActivateSettings (per-output overlay)."""
    image_location: Dict[str, Any] = {"Uri": settings["image_uri"]}
    if settings.get("username"):
        image_location["Username"] = settings["username"]
    if settings.get("password_param"):
        image_location["PasswordParam"] = settings["password_param"]

    result: Dict[str, Any] = {
        "OutputNames": settings["output_names"],
        "Image": image_location,
        "Layer": settings.get("layer", 0),
        "Opacity": settings.get("opacity", 100),
        "ImageX": settings.get("imageX", 0),
        "ImageY": settings.get("imageY", 0),
        "FadeIn": settings.get("fadeIn", 0),
        "FadeOut": settings.get("fadeOut", 0),
    }
    if settings.get("width"):
        result["Width"] = settings["width"]
    if settings.get("height"):
        result["Height"] = settings["height"]
    if settings.get("duration"):
        result["Duration"] = settings["duration"]
    return {"StaticImageOutputActivateSettings": result}


def build_static_image_output_deactivate(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Build StaticImageOutputDeactivateSettings."""
    result: Dict[str, Any] = {
        "OutputNames": settings["output_names"],
        "Layer": settings.get("layer", 0),
    }
    if settings.get("fadeOut"):
        result["FadeOut"] = settings["fadeOut"]
    return {"StaticImageOutputDeactivateSettings": result}


# =============================================================================
# Motion Graphics
# =============================================================================


def build_motion_graphics_activate(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Build MotionGraphicsImageActivateSettings."""
    result: Dict[str, Any] = {}
    if settings.get("graphics_uri"):
        result["Url"] = settings["graphics_uri"]
    if settings.get("duration_ms"):
        result["Duration"] = settings["duration_ms"]
    if settings.get("username"):
        result["Username"] = settings["username"]
    if settings.get("password_param"):
        result["PasswordParam"] = settings["password_param"]
    return {"MotionGraphicsImageActivateSettings": result}


def build_motion_graphics_deactivate(_settings: Dict[str, Any]) -> Dict[str, Any]:
    """Build MotionGraphicsImageDeactivateSettings."""
    return {"MotionGraphicsImageDeactivateSettings": {}}


# =============================================================================
# Input Switch / Prepare
# =============================================================================


def _build_input_clipping(settings: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Build optional InputClippingSettings."""
    if not settings.get("input_clipping_enabled"):
        return None
    clipping: Dict[str, Any] = {
        "InputTimecodeSource": settings.get("input_timecode_source", "ZEROBASED"),
    }
    if settings.get("start_timecode"):
        clipping["StartTimecode"] = {"Timecode": settings["start_timecode"]}
    if settings.get("stop_timecode"):
        stop: Dict[str, Any] = {"Timecode": settings["stop_timecode"]}
        if settings.get("last_frame_clipping_behavior"):
            stop["LastFrameClippingBehavior"] = settings["last_frame_clipping_behavior"]
        clipping["StopTimecode"] = stop
    return clipping


def build_input_switch(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Build InputSwitchSettings."""
    result: Dict[str, Any] = {
        "InputAttachmentNameReference": settings["input_attachment_name"],
    }
    clipping = _build_input_clipping(settings)
    if clipping:
        result["InputClippingSettings"] = clipping
    if settings.get("url_path"):
        result["UrlPath"] = settings["url_path"]
    return {"InputSwitchSettings": result}


def build_input_prepare(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Build InputPrepareSettings."""
    result: Dict[str, Any] = {}
    if settings.get("input_attachment_name"):
        result["InputAttachmentNameReference"] = settings["input_attachment_name"]
    clipping = _build_input_clipping(settings)
    if clipping:
        result["InputClippingSettings"] = clipping
    if settings.get("url_path"):
        result["UrlPath"] = settings["url_path"]
    return {"InputPrepareSettings": result}


# =============================================================================
# SCTE-35
# =============================================================================


def build_scte35_splice_insert(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Build Scte35SpliceInsertSettings."""
    result: Dict[str, Any] = {
        "SpliceEventId": settings["splice_event_id"],
    }
    if settings.get("duration"):
        result["Duration"] = settings["duration"]
    return {"Scte35SpliceInsertSettings": result}


def build_scte35_return_to_network(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Build Scte35ReturnToNetworkSettings."""
    return {
        "Scte35ReturnToNetworkSettings": {
            "SpliceEventId": settings["splice_event_id"],
        }
    }


def build_scte35_time_signal(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Build Scte35TimeSignalSettings with full descriptor support."""
    return {
        "Scte35TimeSignalSettings": {
            "Scte35Descriptors": settings.get("descriptors", []),
        }
    }


def build_scte35_input(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Build Scte35InputSettings."""
    result: Dict[str, Any] = {
        "InputAttachmentNameReference": settings["input_attachment_name"],
    }
    if settings.get("mode"):
        result["Mode"] = settings["mode"]
    return {"Scte35InputSettings": result}


# =============================================================================
# HLS / ID3 / Timed Metadata
# =============================================================================


def build_hls_id3_segment_tagging(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Build HlsId3SegmentTaggingSettings."""
    result: Dict[str, Any] = {}
    if settings.get("tag"):
        result["Tag"] = settings["tag"]
    return {"HlsId3SegmentTaggingSettings": result}


def build_hls_timed_metadata(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Build HlsTimedMetadataSettings."""
    return {"HlsTimedMetadataSettings": {"Id3": settings["id3"]}}


def build_id3_segment_tagging(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Build Id3SegmentTaggingSettings."""
    result: Dict[str, Any] = {}
    if settings.get("tag"):
        result["Tag"] = settings["tag"]
    if settings.get("id3"):
        result["Id3"] = settings["id3"]
    return {"Id3SegmentTaggingSettings": result}


def build_timed_metadata(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Build TimedMetadataSettings."""
    return {"TimedMetadataSettings": {"Id3": settings["id3"]}}


# =============================================================================
# Pause State
# =============================================================================


def build_pause_state(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Build PauseStateSettings with multi-pipeline support."""
    pipelines = settings.get("pipelines", [])
    if not pipelines:
        # Legacy single pipeline_id field
        pipeline_id = settings.get("pipeline_id", "PIPELINE_0")
        pipelines = [{"PipelineId": pipeline_id}]
    else:
        pipelines = [{"PipelineId": p} for p in pipelines]
    return {"PauseStateSettings": {"Pipelines": pipelines}}


# =============================================================================
# Registry: action_type -> builder function
# =============================================================================

ACTION_BUILDERS = {
    "static_image_activate": build_static_image_activate,
    "static_image_deactivate": build_static_image_deactivate,
    "static_image_output_activate": build_static_image_output_activate,
    "static_image_output_deactivate": build_static_image_output_deactivate,
    "motion_graphics_activate": build_motion_graphics_activate,
    "motion_graphics_deactivate": build_motion_graphics_deactivate,
    "input_switch": build_input_switch,
    "input_prepare": build_input_prepare,
    "scte35_splice_insert": build_scte35_splice_insert,
    "scte35_return_to_network": build_scte35_return_to_network,
    "scte35_time_signal": build_scte35_time_signal,
    "scte35_input": build_scte35_input,
    "hls_id3_segment_tagging": build_hls_id3_segment_tagging,
    "hls_timed_metadata": build_hls_timed_metadata,
    "id3_segment_tagging": build_id3_segment_tagging,
    "timed_metadata": build_timed_metadata,
    "pause_state": build_pause_state,
}
