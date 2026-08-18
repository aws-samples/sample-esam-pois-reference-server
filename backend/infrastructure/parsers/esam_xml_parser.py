# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""ESAM XML Parser - Parses SignalProcessingEvent XML according to SCTE-130 Part 9."""

import xmltodict
from typing import Optional, List
from dataclasses import dataclass


@dataclass
class StreamTime:
    """Stream time information."""

    time_type: str
    time_value: str


@dataclass
class AlternateContentConfig:
    """AlternateContent configuration for SPN ResponseSignal."""

    alt_content_identity: str
    zone_identity: str


@dataclass
class SignalProcessingEvent:
    """Parsed ESAM SignalProcessingEvent."""

    acquisition_point_identity: str
    acquisition_signal_id: str
    acquisition_time: str
    zone_identity: str
    utc_point: str
    scte35_binary: str
    stream_times: List[StreamTime]


def parse_esam_request(xml: str) -> SignalProcessingEvent:
    """
    Parse ESAM SignalProcessingEvent XML.

    Args:
        xml: ESAM XML string

    Returns:
        Parsed SignalProcessingEvent

    Raises:
        ValueError: If XML is invalid or missing required fields
    """
    try:
        parsed = xmltodict.parse(xml)
    except Exception as e:
        raise ValueError(f"Failed to parse XML: {e}")

    # Navigate to SignalProcessingEvent
    spe = parsed.get("SignalProcessingEvent")
    if not spe:
        raise ValueError("SignalProcessingEvent element not found")

    # Extract AcquiredSignal
    acquired_signal = spe.get("AcquiredSignal")
    if not acquired_signal:
        raise ValueError("AcquiredSignal element not found")

    # Extract required attributes
    acquisition_point_identity = acquired_signal.get("@acquisitionPointIdentity")
    acquisition_signal_id = acquired_signal.get("@acquisitionSignalID")
    acquisition_time = acquired_signal.get("@acquisitionTime")
    zone_identity = acquired_signal.get("@zoneIdentity", "")

    if not acquisition_point_identity:
        raise ValueError("acquisitionPointIdentity is required")

    if not acquisition_signal_id:
        raise ValueError("acquisitionSignalID is required")

    # Extract UTCPoint
    utc_point_element = acquired_signal.get("sig:UTCPoint", {})
    utc_point = utc_point_element.get("@utcPoint", "")

    # Extract BinaryData (SCTE-35)
    binary_data_element = acquired_signal.get("sig:BinaryData", {})
    scte35_binary = binary_data_element.get("#text", "")

    if not scte35_binary:
        raise ValueError("SCTE-35 binary data is required")

    # Extract StreamTimes
    stream_times = []
    stream_times_element = acquired_signal.get("sig:StreamTimes", {})
    stream_time_list = stream_times_element.get("sig:StreamTime", [])

    if not isinstance(stream_time_list, list):
        stream_time_list = [stream_time_list]

    for st in stream_time_list:
        if isinstance(st, dict):
            stream_times.append(
                StreamTime(
                    time_type=st.get("@timeType", ""),
                    time_value=st.get("@timeValue", ""),
                )
            )

    return SignalProcessingEvent(
        acquisition_point_identity=acquisition_point_identity,
        acquisition_signal_id=acquisition_signal_id,
        acquisition_time=acquisition_time,
        zone_identity=zone_identity,
        utc_point=utc_point,
        scte35_binary=scte35_binary,
        stream_times=stream_times,
    )


def build_esam_response(
    action: str,
    acquisition_point_identity: str,
    acquisition_signal_id: str,
    acquisition_time: str,
    zone_identity: str,
    utc_point: str,
    scte35_binary: str,
    stream_times: List[StreamTime],
    status_note: str = "",
    alt_content: Optional[AlternateContentConfig] = None,
) -> str:
    """
    Build ESAM SignalProcessingNotification XML response.

    Args:
        action: 'delete', 'noop', or 'replace'
        acquisition_point_identity: Channel identifier
        acquisition_signal_id: Signal identifier
        acquisition_time: Acquisition time
        zone_identity: Zone identifier
        utc_point: UTC point
        scte35_binary: SCTE-35 binary data (base64)
        stream_times: List of stream times
        status_note: Optional status note

    Returns:
        ESAM XML response string
    """
    # Build ResponseSignal
    resp_signal = {
        "@action": action,
        "@acquisitionPointIdentity": acquisition_point_identity,
        "@acquisitionSignalID": acquisition_signal_id,
        "@zoneIdentity": zone_identity,
        "sig:UTCPoint": {"@utcPoint": utc_point},
        "sig:BinaryData": {"@signalType": "SCTE35", "#text": scte35_binary},
    }

    # Add acquisitionTime for noop and replace
    if action in ["noop", "replace"]:
        resp_signal["@acquisitionTime"] = acquisition_time

    # Add StreamTimes
    if stream_times:
        stream_time_list = []
        for st in stream_times:
            stream_time_list.append(
                {"@timeType": st.time_type, "@timeValue": st.time_value}
            )
        resp_signal["sig:StreamTimes"] = {"sig:StreamTime": stream_time_list}

    # Add AlternateContent element when configured
    if alt_content is not None:
        resp_signal["signal:AlternateContent"] = {
            "@altContent": "true",
            "@altContentIdentity": alt_content.alt_content_identity,
            "@zoneIdentity": alt_content.zone_identity,
        }

    if alt_content is not None:
        # Use signal namespace for root element (ESAM signal:1 spec)
        # This matches the Elemental Live expected format (ESAM signal:1 spec):
        # <signal:SignalProcessingNotification xmlns:signal="..." xmlns:signaling="...">
        #   <signal:ResponseSignal ...>
        #     <signaling:UTCPoint .../>
        #     <signal:AlternateContent .../>
        #   </signal:ResponseSignal>
        # </signal:SignalProcessingNotification>

        # Re-key ResponseSignal children to use signaling: prefix
        sig_resp = {
            "@action": resp_signal["@action"],
            "@acquisitionPointIdentity": resp_signal["@acquisitionPointIdentity"],
            "@acquisitionSignalID": resp_signal["@acquisitionSignalID"],
            "@zoneIdentity": resp_signal["@zoneIdentity"],
            "signaling:UTCPoint": resp_signal["sig:UTCPoint"],
            "signaling:BinaryData": resp_signal["sig:BinaryData"],
        }
        if "@acquisitionTime" in resp_signal:
            sig_resp["@acquisitionTime"] = resp_signal["@acquisitionTime"]
        if "sig:StreamTimes" in resp_signal:
            sig_resp["signaling:StreamTimes"] = {
                "signaling:StreamTime": resp_signal["sig:StreamTimes"]["sig:StreamTime"]
            }
        # AlternateContent stays in signal: namespace
        sig_resp["signal:AlternateContent"] = resp_signal["signal:AlternateContent"]

        # ResponseSignal MUST come before StatusCode (Elemental Live parses in order)
        spn_attrs = {
            "@xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
            "@xmlns:signaling": "urn:cablelabs:md:xsd:signaling:3.0",
            "@xmlns:common": "urn:cablelabs:iptvservices:esam:xsd:common:1",
            "@xmlns:signal": "urn:cablelabs:iptvservices:esam:xsd:signal:1",
            "@xsi:schemaLocation": "urn:cablelabs:iptvservices:esam:xsd:signal:1 OC-SP-ESAM-API-I03-Signal.xsd",
            "signal:ResponseSignal": sig_resp,
            "common:StatusCode": {"@classCode": 0},
        }

        if status_note:
            spn_attrs["common:StatusCode"]["common:Note"] = status_note

        spn = {"signal:SignalProcessingNotification": spn_attrs}
    else:
        # Standard SPN without AlternateContent (common namespace)
        spn_attrs = {
            "@xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
            "@xmlns:sig": "urn:cablelabs:md:xsd:signaling:3.0",
            "@xmlns:core": "urn:cablelabs:md:xsd:core:3.0",
            "@xsi:schemaLocation": "urn:cablelabs:iptvservices:esam:xsd:common:1 OC-SP-ESAM-API-I0x-Common.xsd",
            "@xmlns": "urn:cablelabs:iptvservices:esam:xsd:common:1",
        }

        spn_attrs["ResponseSignal"] = resp_signal

        spn = {"SignalProcessingNotification": spn_attrs}

        # Add StatusCode if note provided
        if status_note:
            spn["SignalProcessingNotification"]["StatusCode"] = {
                "@classCode": 0,
                "core:Note": status_note,
            }

    # Convert to XML
    xml_output = xmltodict.unparse(spn, short_empty_elements=True, pretty=True)

    return xml_output


@dataclass
class ProcessStatusNotification:
    """Parsed ESAM ProcessStatusNotification."""

    acquisition_point_identity: str
    acquisition_signal_id: str
    class_code: int
    detail_code: int
    note: str


def detect_esam_message_type(xml: str) -> str:
    """
    Detect whether the ESAM XML is an SPE or PSN message.

    Args:
        xml: ESAM XML string

    Returns:
        "SPE" for SignalProcessingEvent, "PSN" for ProcessStatusNotification

    Raises:
        ValueError: If XML is invalid or root element is unrecognized
    """
    try:
        parsed = xmltodict.parse(xml)
    except Exception as e:
        raise ValueError(f"Failed to parse XML: {e}")

    root_key = next(iter(parsed), None)
    if root_key is None:
        raise ValueError("Empty XML document")

    if root_key == "SignalProcessingEvent":
        return "SPE"

    # Handle namespaced variants like esam:ProcessStatusNotification
    local_name = root_key.split(":")[-1] if ":" in root_key else root_key
    if local_name == "ProcessStatusNotification":
        return "PSN"

    raise ValueError(f"Unrecognized ESAM message type: {root_key}")


def parse_psn_request(xml: str) -> ProcessStatusNotification:
    """
    Parse ProcessStatusNotification XML.

    Args:
        xml: PSN XML string

    Returns:
        Parsed ProcessStatusNotification

    Raises:
        ValueError: If XML is malformed or missing required attributes
    """
    try:
        parsed = xmltodict.parse(xml)
    except Exception as e:
        raise ValueError(f"Failed to parse XML: {e}")

    # Find the PSN root element (handle namespace prefixes)
    psn = None
    for key in parsed:
        local_name = key.split(":")[-1] if ":" in key else key
        if local_name == "ProcessStatusNotification":
            psn = parsed[key]
            break

    if psn is None:
        raise ValueError("ProcessStatusNotification element not found")

    # Find AcquiredSignal (handle namespace prefixes)
    acquired_signal = None
    for key in psn:
        local_name = key.split(":")[-1] if ":" in key else key
        if local_name == "AcquiredSignal":
            acquired_signal = psn[key]
            break

    if acquired_signal is None:
        raise ValueError("AcquiredSignal element not found in PSN")

    acquisition_point_identity = acquired_signal.get("@acquisitionPointIdentity")
    acquisition_signal_id = acquired_signal.get("@acquisitionSignalID")

    if not acquisition_point_identity:
        raise ValueError("acquisitionPointIdentity is required")
    if not acquisition_signal_id:
        raise ValueError("acquisitionSignalID is required")

    # Find StatusCode (handle namespace prefixes)
    status_code = None
    for key in psn:
        local_name = key.split(":")[-1] if ":" in key else key
        if local_name == "StatusCode":
            status_code = psn[key]
            break

    class_code = 0
    detail_code = 0
    note = ""

    if status_code is not None:
        class_code = int(status_code.get("@classCode", 0))
        detail_code = int(status_code.get("@detailCode", 0))

        # Find Note element (handle namespace prefixes)
        for key in status_code:
            local_name = key.split(":")[-1] if ":" in key else key
            if local_name == "Note":
                note_val = status_code[key]
                note = (
                    note_val
                    if isinstance(note_val, str)
                    else str(note_val) if note_val else ""
                )
                break

    return ProcessStatusNotification(
        acquisition_point_identity=acquisition_point_identity,
        acquisition_signal_id=acquisition_signal_id,
        class_code=class_code,
        detail_code=detail_code,
        note=note,
    )
