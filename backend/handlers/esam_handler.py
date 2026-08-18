# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""ESAM Lambda handler - SCTE-130 Part 9 compliant."""

import base64
import datetime
import hmac
import json
import os
import time
from typing import Dict, Any, Optional

import boto3
from botocore.exceptions import ClientError

from infrastructure.logging.structured_logger import (
    StructuredLogger,
    generate_correlation_id,
    configure_logging,
)
from infrastructure.parsers.esam_xml_parser import (
    parse_esam_request,
    build_esam_response,
    detect_esam_message_type,
    parse_psn_request,
    AlternateContentConfig,
)
from domain.models.channel import Channel, ChannelState
from domain.services.signal_processor import process_signal
from domain.repositories.channel_state_repository import ChannelStateRepository
from domain.repositories.ack_repository import AckRepository, create_ack_record
from domain.services.action_executor import ActionExecutor
from domain.services.plugin_registry import PluginRegistry
from domain.services.credential_store import create_credential_store
from domain.services.plugins.medialive_plugin import MediaLiveActionPlugin
from domain.services.audit_logger import AuditLogger
from domain.services.credential_service import CredentialService
from domain.repositories.action_audit_repository import DynamoDBActionAuditRepository
from domain.services.plugins.webhook_plugin import WebhookActionPlugin
from domain.services.rate_limiter import RateLimiterManager

# Initialize AWS clients
dynamodb = boto3.resource("dynamodb")
table_name = os.environ.get("CHANNELS_TABLE_NAME", "pois-channels")
channels_table = dynamodb.Table(table_name)

# Initialize state repository
state_repository = ChannelStateRepository(table_name)

# Initialize ack repository for PSN records
ack_repository = AckRepository(table_name)

# Initialize audit repository and logger
audit_repository = DynamoDBActionAuditRepository(table_name=table_name)
audit_logger = AuditLogger(repository=audit_repository)

# Initialize action executor with plugins
plugin_registry = PluginRegistry()
plugin_registry.register(MediaLiveActionPlugin())
plugin_registry.register(WebhookActionPlugin())

credential_store = create_credential_store(store_type="iam_role")

# Initialize metrics emitter (optional, enabled via env var)
metrics_emitter = None
if os.environ.get("ENABLE_METRICS", "false").lower() == "true":
    from domain.services.metrics_emitter import CloudWatchMetricsEmitter

    metrics_emitter = CloudWatchMetricsEmitter(namespace="POIS/Actions")

# Initialize rate limiter (optional, enabled via env var)
rate_limiter = None
if os.environ.get("ENABLE_RATE_LIMITING", "false").lower() == "true":
    rate_limiter = RateLimiterManager()
    # Register default rate limits per action type
    rate_limiter.register_limiter("medialive", max_calls=10, per_seconds=1)
    rate_limiter.register_limiter("webhook", max_calls=50, per_seconds=1)

action_executor = ActionExecutor(
    plugin_registry=plugin_registry,
    credential_store=credential_store,
    audit_logger=audit_logger,
    metrics_emitter=metrics_emitter,
    rate_limiter=rate_limiter,
)

# Initialize credential service for ESAM Basic Auth
credential_service = CredentialService()

# In-memory state cache to handle rapid successive requests
# Key: channel_id, Value: (state, timestamp)
state_cache: Dict[str, tuple[ChannelState, float]] = {}
CACHE_TTL_SECONDS = 5  # Cache states for 5 seconds

# Configure logging
log_level = os.environ.get("LOG_LEVEL", "INFO")
configure_logging(log_level)


def get_cached_state(channel_id: str) -> Optional[ChannelState]:
    """
    Get channel state from cache if available and not expired.

    Args:
        channel_id: Channel ID

    Returns:
        Cached ChannelState or None if not in cache or expired
    """
    if channel_id not in state_cache:
        return None

    state, timestamp = state_cache[channel_id]
    now = time.time()

    # Check if cache entry is expired
    if now - timestamp > CACHE_TTL_SECONDS:
        # Remove expired entry
        del state_cache[channel_id]
        return None

    return state


def update_cache(channel_id: str, state: ChannelState) -> None:
    """
    Update cache with new state.

    Args:
        channel_id: Channel ID
        state: Channel state to cache
    """
    state_cache[channel_id] = (state, time.time())


def _build_401_response(correlation_id: str) -> Dict[str, Any]:
    """Build a 401 Unauthorized response with WWW-Authenticate header."""
    return {
        "statusCode": 401,
        "headers": {
            "Content-Type": "application/json",
            "WWW-Authenticate": 'Basic realm="ESAM"',
            "X-Correlation-ID": correlation_id,
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps({"error": "Unauthorized"}),
    }


def _build_500_response(correlation_id: str) -> Dict[str, Any]:
    """Build a 500 Internal Server Error response."""
    return {
        "statusCode": 500,
        "headers": {
            "Content-Type": "application/json",
            "X-Correlation-ID": correlation_id,
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(
            {"error": "Internal server error", "correlationId": correlation_id}
        ),
    }


def _validate_basic_auth(
    event: Dict[str, Any],
    channel,
    cred_service: CredentialService,
    logger: StructuredLogger,
) -> Optional[Dict[str, Any]]:
    """
    Validate Basic Auth credentials if auth is enabled for the channel.

    Returns None when auth passes (or is disabled), otherwise returns an
    error response dict (401 or 500).
    """
    auth_config = channel.auth_config
    if not auth_config.auth_enabled:
        return None  # Auth disabled — skip

    correlation_id = logger.correlation_id
    source_ip = (
        event.get("requestContext", {}).get("identity", {}).get("sourceIp", "unknown")
    )

    # --- Check for Authorization header ---
    headers = event.get("headers") or {}
    auth_header = headers.get("Authorization") or headers.get("authorization")

    if not auth_header:
        logger.warn(
            "Auth failed: missing_credentials",
            channelId=channel.channel_id,
            channelName=channel.name,
            sourceIp=source_ip,
            reason="missing_credentials",
        )
        return _build_401_response(correlation_id)

    if not auth_header.startswith("Basic "):
        logger.warn(
            "Auth failed: invalid_credentials",
            channelId=channel.channel_id,
            channelName=channel.name,
            sourceIp=source_ip,
            reason="invalid_credentials",
        )
        return _build_401_response(correlation_id)

    # --- Decode Base64 payload ---
    try:
        decoded = base64.b64decode(auth_header[6:]).decode("utf-8")
        username, _, password = decoded.partition(":")
    except Exception:
        logger.warn(
            "Auth failed: invalid_credentials",
            channelId=channel.channel_id,
            channelName=channel.name,
            sourceIp=source_ip,
            reason="invalid_credentials",
        )
        return _build_401_response(correlation_id)

    # --- Validate username ---
    if not auth_config.username or username != auth_config.username:
        logger.warn(
            "Auth failed: invalid_credentials",
            channelId=channel.channel_id,
            channelName=channel.name,
            sourceIp=source_ip,
            username=username,
            reason="invalid_credentials",
        )
        return _build_401_response(correlation_id)

    # --- Retrieve stored password from SSM ---
    try:
        stored_password = cred_service.get_password(auth_config.ssm_parameter_path)
    except Exception as exc:
        logger.error(
            "Auth failed: SSM error retrieving password",
            channelId=channel.channel_id,
            error=str(exc),
        )
        return _build_500_response(correlation_id)

    # --- Constant-time password comparison ---
    if not hmac.compare_digest(password, stored_password):
        logger.warn(
            "Auth failed: invalid_credentials",
            channelId=channel.channel_id,
            channelName=channel.name,
            sourceIp=source_ip,
            username=username,
            reason="invalid_credentials",
        )
        return _build_401_response(correlation_id)

    return None  # Auth OK


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for ESAM requests (SCTE-130 Part 9).

    Receives ESAM XML (SignalProcessingEvent) and returns ESAM XML (SignalProcessingNotification).

    Args:
        event: API Gateway event with ESAM XML in body
        context: Lambda context

    Returns:
        API Gateway response with ESAM XML
    """
    correlation_id = generate_correlation_id()
    logger = StructuredLogger(__name__, correlation_id=correlation_id, level=log_level)

    start_time = time.time()

    try:
        # Validate HTTP method
        if event.get("httpMethod") != "POST":
            return {
                "statusCode": 405,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                    "Access-Control-Allow-Methods": "POST,OPTIONS",
                },
                "body": '{"error": "Method not allowed"}',
            }

        # Validate body
        if not event.get("body"):
            return {
                "statusCode": 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                    "Access-Control-Allow-Methods": "POST,OPTIONS",
                },
                "body": '{"error": "Request body is required"}',
            }

        esam_xml = event["body"]

        # Detect message type (SPE vs PSN)
        try:
            msg_type = detect_esam_message_type(esam_xml)
        except ValueError as e:
            logger.error(f"Unrecognized ESAM message: {e}")
            return {
                "statusCode": 400,
                "headers": {
                    "Content-Type": "application/json",
                    "X-Correlation-ID": correlation_id,
                    "Access-Control-Allow-Origin": "*",
                },
                "body": f'{{"error": "Invalid ESAM XML", "details": "{str(e)}"}}',
            }

        # Route PSN to dedicated handler
        if msg_type == "PSN":
            return _handle_psn(esam_xml, correlation_id, logger)

        # --- SPE processing below ---

        # Parse ESAM XML
        try:
            esam_request = parse_esam_request(esam_xml)
        except Exception as e:
            logger.error(f"Failed to parse ESAM XML: {e}")
            return {
                "statusCode": 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                    "Access-Control-Allow-Methods": "POST,OPTIONS",
                },
                "body": f'{{"error": "Invalid ESAM XML", "details": "{str(e)}"}}',
            }

        # Get channel by name (acquisitionPointIdentity)
        try:
            channel = _get_channel_by_name(esam_request.acquisition_point_identity)
        except ChannelNotFoundError:
            logger.warn(f"Channel not found: {esam_request.acquisition_point_identity}")
            # Return NOOP for unknown channels
            response_xml = build_esam_response(
                action="noop",
                acquisition_point_identity=esam_request.acquisition_point_identity,
                acquisition_signal_id=esam_request.acquisition_signal_id,
                acquisition_time=esam_request.acquisition_time,
                zone_identity=esam_request.zone_identity,
                utc_point=esam_request.utc_point,
                scte35_binary=esam_request.scte35_binary,
                stream_times=esam_request.stream_times,
                status_note="Channel not registered with POIS",
            )
            logger.info("SignalProcessingNotification (SPN)", xml=response_xml)
            return {
                "statusCode": 200,
                "headers": {
                    "Content-Type": "application/xml",
                    "X-Correlation-ID": correlation_id,
                },
                "body": response_xml,
            }
        except Exception as e:
            logger.error(f"Failed to get channel: {e}")
            response_xml = build_esam_response(
                action="noop",
                acquisition_point_identity=esam_request.acquisition_point_identity,
                acquisition_signal_id=esam_request.acquisition_signal_id,
                acquisition_time=esam_request.acquisition_time,
                zone_identity=esam_request.zone_identity,
                utc_point=esam_request.utc_point,
                scte35_binary=esam_request.scte35_binary,
                stream_times=esam_request.stream_times,
                status_note="Unable to retrieve channel config",
            )
            return {
                "statusCode": 200,
                "headers": {
                    "Content-Type": "application/xml",
                    "X-Correlation-ID": correlation_id,
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                    "Access-Control-Allow-Methods": "POST,OPTIONS",
                },
                "body": response_xml,
            }

        logger.info(
            "Channel loaded",
            channelId=channel.channel_id,
            channelName=channel.name,
            rulesCount=len(channel.rules),
        )

        # Log incoming ESAM XML (SPE) with actual channel ID from DynamoDB
        logger.info(
            "SignalProcessingEvent (SPE)", xml=esam_xml, channelId=channel.channel_id
        )

        # Validate Basic Auth if enabled for this channel
        auth_error = _validate_basic_auth(event, channel, credential_service, logger)
        if auth_error is not None:
            return auth_error

        # Check if channel is enabled
        if not channel.enabled:
            logger.warn(f"Channel is disabled: {channel.name}")
            response_xml = build_esam_response(
                action="noop",
                acquisition_point_identity=esam_request.acquisition_point_identity,
                acquisition_signal_id=esam_request.acquisition_signal_id,
                acquisition_time=esam_request.acquisition_time,
                zone_identity=esam_request.zone_identity,
                utc_point=esam_request.utc_point,
                scte35_binary=esam_request.scte35_binary,
                stream_times=esam_request.stream_times,
                status_note="Channel is disabled",
            )
            logger.info("SignalProcessingNotification (SPN)", xml=response_xml)
            return {
                "statusCode": 200,
                "headers": {
                    "Content-Type": "application/xml",
                    "X-Correlation-ID": correlation_id,
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                    "Access-Control-Allow-Methods": "POST,OPTIONS",
                },
                "body": response_xml,
            }

        # Load channel state if stateful mode enabled
        channel_state = None
        if channel.stateful_mode:
            try:
                # Check cache first
                channel_state = get_cached_state(channel.channel_id)
                if channel_state:
                    logger.debug(
                        "Loaded channel state from cache",
                        channelId=channel.channel_id,
                        inBreak=channel_state.in_break,
                    )
                else:
                    # Cache miss - load from DynamoDB
                    channel_state = state_repository.get_state(channel.channel_id)
                    if channel_state:
                        # Update cache with loaded state
                        update_cache(channel.channel_id, channel_state)
                        logger.debug(
                            "Loaded channel state from DynamoDB and cached",
                            channelId=channel.channel_id,
                            inBreak=channel_state.in_break,
                        )
                    else:
                        logger.debug(
                            "No channel state found", channelId=channel.channel_id
                        )
            except Exception as e:
                logger.error(
                    "Failed to load channel state - continuing without state",
                    channelId=channel.channel_id,
                    error=str(e),
                )

        # Process signal (now returns tuple)
        result, updated_state = process_signal(
            scte35_binary=esam_request.scte35_binary,
            channel=channel,
            channel_state=channel_state,
            options=None,
            action_executor=action_executor,
            acquisition_time=esam_request.acquisition_time,
            correlation_id=correlation_id,
            zone_identity=esam_request.zone_identity,
        )

        # Save updated state if changed
        if updated_state is not None:
            try:
                # Update cache immediately (synchronous)
                update_cache(channel.channel_id, updated_state)
                logger.debug(
                    "Updated cache with new state",
                    channelId=channel.channel_id,
                    inBreak=updated_state.in_break,
                )

                # Save to DynamoDB (asynchronous persistence)
                state_repository.save_state(updated_state)
                logger.info(
                    "Saved updated channel state",
                    channelId=channel.channel_id,
                    inBreak=updated_state.in_break,
                )
            except Exception as e:
                logger.error(
                    "Failed to save channel state - continuing",
                    channelId=channel.channel_id,
                    error=str(e),
                )

        processing_time = (time.time() - start_time) * 1000

        logger.info(
            "Signal processed",
            channelId=channel.channel_id,
            action=result.action,
            ruleId=result.matched_rule_id,
            details=result.details,
            processingTimeMs=processing_time,
        )

        # Build AlternateContent config if matched rule has it configured
        alt_content = None
        if result.matched_rule_id and hasattr(result, "matched_rule_id"):
            # Find the matched rule to check for alt content config
            for rule in channel.rules:
                if rule.rule_id == result.matched_rule_id and rule.alt_content_identity:
                    alt_content = AlternateContentConfig(
                        alt_content_identity=rule.alt_content_identity,
                        zone_identity=rule.alt_content_zone_identity or "",
                    )
                    break

        # Build ESAM XML response
        response_xml = build_esam_response(
            action=result.action,
            acquisition_point_identity=esam_request.acquisition_point_identity,
            acquisition_signal_id=esam_request.acquisition_signal_id,
            acquisition_time=esam_request.acquisition_time,
            zone_identity=esam_request.zone_identity,
            utc_point=esam_request.utc_point,
            scte35_binary=result.modified_signal or esam_request.scte35_binary,
            stream_times=esam_request.stream_times,
            status_note=result.details,
            alt_content=alt_content,
        )

        logger.info(
            "SignalProcessingNotification (SPN)",
            xml=response_xml,
            channelId=channel.channel_id,
        )

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/xml",
                "X-Correlation-ID": correlation_id,
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                "Access-Control-Allow-Methods": "POST,OPTIONS",
            },
            "body": response_xml,
        }

    except Exception as e:
        logger.error(f"Unexpected error: {e}", error=str(e))
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "X-Correlation-ID": correlation_id,
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                "Access-Control-Allow-Methods": "POST,OPTIONS",
            },
            "body": f'{{"error": "Internal server error", "correlationId": "{correlation_id}"}}',
        }


def _handle_psn(
    xml: str, correlation_id: str, logger: StructuredLogger
) -> Dict[str, Any]:
    """
    Handle ProcessStatusNotification from encoder.

    Parses PSN, logs it, stores ack record, returns HTTP 200 empty body.
    No authentication required.
    """
    try:
        psn = parse_psn_request(xml)
    except ValueError as e:
        logger.error(f"Failed to parse PSN XML: {e}")
        return {
            "statusCode": 400,
            "headers": {
                "Content-Type": "application/json",
                "X-Correlation-ID": correlation_id,
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(
                {"error": "Invalid ProcessStatusNotification XML", "details": str(e)}
            ),
        }

    # Resolve channel
    channel_id = "UNKNOWN"
    try:
        channel = _get_channel_by_name(psn.acquisition_point_identity)
        channel_id = channel.channel_id
    except Exception:
        logger.warn(
            "PSN channel not found",
            acquisitionPointIdentity=psn.acquisition_point_identity,
        )

    timestamp = datetime.datetime.utcnow().isoformat() + "Z"

    # Structured log
    logger.info(
        "ProcessStatusNotification (PSN)",
        acquisitionPointIdentity=psn.acquisition_point_identity,
        acquisitionSignalID=psn.acquisition_signal_id,
        classCode=psn.class_code,
        detailCode=psn.detail_code,
        note=psn.note,
        timestamp=timestamp,
        channelId=channel_id,
    )

    # Store ack record (best-effort)
    try:
        record = create_ack_record(
            channel_id=channel_id,
            acquisition_point_identity=psn.acquisition_point_identity,
            acquisition_signal_id=psn.acquisition_signal_id,
            class_code=psn.class_code,
            detail_code=psn.detail_code,
            note=psn.note,
            timestamp=timestamp,
        )
        ack_repository.store_ack(record)
    except Exception as e:
        logger.error(f"Failed to store ack record: {e}", error=str(e))

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/xml",
            "X-Correlation-ID": correlation_id,
            "Access-Control-Allow-Origin": "*",
        },
        "body": "",
    }


def _get_channel_by_name(channel_name: str) -> Channel:
    """
    Get channel from DynamoDB by name.

    Args:
        channel_name: Channel name (acquisitionPointIdentity)

    Returns:
        Channel configuration

    Raises:
        ChannelNotFoundError: If channel not found
    """
    try:
        # Scan table to find channel by name
        response = channels_table.scan(
            FilterExpression="#name = :name",
            ExpressionAttributeNames={"#name": "name"},
            ExpressionAttributeValues={":name": channel_name},
        )

        items = response.get("Items", [])

        if not items:
            raise ChannelNotFoundError(f"Channel not found: {channel_name}")

        # Return first match
        item = items[0]
        channel = Channel(**item)

        return channel

    except ClientError as e:
        raise Exception(f"DynamoDB error: {e}")


class ChannelNotFoundError(Exception):
    """Exception raised when channel is not found."""

    pass
