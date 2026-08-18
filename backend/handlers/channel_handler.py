# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Channel Lambda handler for CRUD operations."""

import json
import os
from typing import Dict, Any
from decimal import Decimal

from pydantic import ValidationError

from infrastructure.logging.structured_logger import (
    StructuredLogger,
    generate_correlation_id,
    configure_logging,
)
from domain.models.channel import Channel
from domain.repositories.channel_repository import ChannelRepository
from domain.services.credential_service import CredentialService
from domain.services.rbac import check_role, get_caller_identity


# Custom JSON encoder for Decimal
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super().default(obj)


# Initialize repository
table_name = os.environ.get("CHANNELS_TABLE_NAME", "pois-channels")
channel_repo = ChannelRepository(table_name)

# Initialize credential service
credential_service = CredentialService()

# Configure logging
log_level = os.environ.get("LOG_LEVEL", "INFO")
configure_logging(log_level)


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for channel operations.

    Supports:
    - GET /channels - List all channels
    - GET /channels/:id - Get specific channel
    - POST /channels - Create channel
    - PUT /channels/:id - Update channel
    - DELETE /channels/:id - Delete channel

    Args:
        event: API Gateway event
        context: Lambda context

    Returns:
        API Gateway response
    """
    # Generate correlation ID
    correlation_id = generate_correlation_id()
    logger = StructuredLogger(__name__, correlation_id=correlation_id, level=log_level)

    try:
        # Get HTTP method and path
        method = event.get("httpMethod", "GET")
        path = event.get("path", "/channels")
        path_params = event.get("pathParameters") or {}

        logger.info(
            "Channel request received",
            method=method,
            path=path,
        )

        # Route request — check sub-resource paths first
        if (
            method == "POST"
            and path_params.get("id")
            and path.endswith("/auth/regenerate")
        ):
            denied = check_role(event, "admin")
            if denied is not None:
                return denied
            return _regenerate_auth(event, path_params["id"], logger, correlation_id)

        elif (
            method == "GET"
            and path_params.get("id")
            and path.endswith("/auth/password")
        ):
            denied = check_role(event, "admin")
            if denied is not None:
                return denied
            return _get_auth_password(event, path_params["id"], logger, correlation_id)

        elif method == "GET" and not path_params.get("id"):
            # GET /channels - List all
            return _list_channels(logger, correlation_id)

        elif method == "GET" and path_params.get("id"):
            # GET /channels/:id - Get specific
            return _get_channel(path_params["id"], logger, correlation_id)

        elif method == "POST":
            # RBAC: only admin group can create channels
            denied = check_role(event, "admin")
            if denied is not None:
                return denied
            # POST /channels - Create
            return _create_channel(event, event.get("body"), logger, correlation_id)

        elif method == "PUT" and path_params.get("id"):
            denied = check_role(event, "admin")
            if denied is not None:
                return denied
            return _update_channel(
                event, path_params["id"], event.get("body"), logger, correlation_id
            )

        elif method == "DELETE" and path_params.get("id"):
            denied = check_role(event, "admin")
            if denied is not None:
                return denied
            return _delete_channel(event, path_params["id"], logger, correlation_id)

        else:
            return _error_response(
                404,
                "Not found",
                correlation_id,
            )

    except Exception as e:
        logger.error(f"Unexpected error: {e}", error=str(e))
        return _error_response(
            500,
            "Internal server error",
            correlation_id,
            details=str(e),
        )


def _list_channels(logger: StructuredLogger, correlation_id: str) -> Dict[str, Any]:
    """List all channels."""
    try:
        channels = channel_repo.get_all_channels()

        logger.info(f"Retrieved {len(channels)} channels")

        # Convert to dict and add esamEndpoint
        esam_endpoint = _get_esam_endpoint()
        channels_data = []
        for channel in channels:
            channel_dict = channel.model_dump(by_alias=True)
            channel_dict["esamEndpoint"] = esam_endpoint
            channels_data.append(channel_dict)

        return _success_response(
            data=channels_data,
            correlation_id=correlation_id,
        )

    except Exception as e:
        logger.error(f"Failed to list channels: {e}")
        return _error_response(
            500,
            "Failed to list channels",
            correlation_id,
            details=str(e),
        )


def _get_channel(
    channel_id: str, logger: StructuredLogger, correlation_id: str
) -> Dict[str, Any]:
    """Get specific channel."""
    try:
        channel = channel_repo.get_channel(channel_id)

        if not channel:
            return _error_response(
                404,
                f"Channel not found: {channel_id}",
                correlation_id,
            )

        logger.info(f"Retrieved channel: {channel_id}")

        # Add esamEndpoint
        channel_dict = channel.model_dump(by_alias=True)
        channel_dict["esamEndpoint"] = _get_esam_endpoint()

        return _success_response(
            data=channel_dict,
            correlation_id=correlation_id,
        )

    except Exception as e:
        logger.error(f"Failed to get channel: {e}")
        return _error_response(
            500,
            "Failed to get channel",
            correlation_id,
            details=str(e),
        )


def _get_esam_endpoint() -> str:
    """Get ESAM endpoint URL from environment variables."""
    api_id = os.environ.get("API_ID", "")
    region = os.environ.get("REGION", "us-east-1")
    stage = os.environ.get("STAGE", "v1")

    if api_id:
        return f"https://{api_id}.execute-api.{region}.amazonaws.com/{stage}/esam"
    return ""


def _create_channel(
    event: Dict[str, Any], body: str, logger: StructuredLogger, correlation_id: str
) -> Dict[str, Any]:
    """Create new channel."""
    caller = get_caller_identity(event)
    try:
        # Parse body
        if not body:
            return _error_response(
                400,
                "Request body is required",
                correlation_id,
            )

        try:
            data = json.loads(body)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse request body: {e}")
            return _error_response(
                400,
                "Invalid JSON in request body",
                correlation_id,
            )

        # Normalize data format
        data = _normalize_channel_data(data)

        # Validate and create channel
        try:
            channel = Channel(**data)
        except ValidationError as e:
            logger.error(f"Validation error: {e}")
            return _error_response(
                400,
                "Validation error",
                correlation_id,
                details=str(e),
            )

        # Create in DynamoDB
        created_channel = channel_repo.create_channel(channel)

        caller = get_caller_identity(event)
        logger.info(
            "Channel created",
            channelId=created_channel.channel_id,
            channelName=created_channel.name,
            performedBy=caller.email,
            action="channel.create",
            targetId=created_channel.channel_id,
            targetType="channel",
            requestData={
                "name": created_channel.name,
                "defaultAction": created_channel.default_action,
                "statefulMode": created_channel.stateful_mode,
                "enabled": created_channel.enabled,
                "rulesCount": len(created_channel.rules),
            },
        )

        return _success_response(
            data=created_channel.model_dump(by_alias=True),
            correlation_id=correlation_id,
            status_code=201,
        )

    except Exception as e:
        logger.error(f"Failed to create channel: {e}")

        # Check if it's a duplicate error
        if "already exists" in str(e):
            return _error_response(
                409,
                "Channel already exists",
                correlation_id,
                details=str(e),
            )

        return _error_response(
            500,
            "Failed to create channel",
            correlation_id,
            details=str(e),
        )


def _normalize_channel_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize channel data from frontend format to backend format."""
    from datetime import datetime
    import os

    # Add timestamps if missing
    now = datetime.utcnow().isoformat() + "Z"
    if "createdAt" not in data:
        data["createdAt"] = now
    if "updatedAt" not in data:
        data["updatedAt"] = now

    # Add esamEndpoint if missing (auto-generate from API Gateway URL)
    if "esamEndpoint" not in data or not data["esamEndpoint"]:
        # Get API Gateway URL from environment or construct it
        api_url = os.environ.get("API_URL")
        if api_url:
            data["esamEndpoint"] = f"{api_url}/esam"
        else:
            # Fallback: construct from API_ID, REGION, STAGE
            api_id = os.environ.get("API_ID")
            region = os.environ.get("AWS_REGION", "us-east-1")
            stage = os.environ.get("STAGE", "v1")
            if api_id:
                data["esamEndpoint"] = (
                    f"https://{api_id}.execute-api.{region}.amazonaws.com/{stage}/esam"
                )

    # Normalize rules
    if "rules" in data:
        for rule in data["rules"]:
            # Convert action from {"type": "delete"} to "delete"
            if "action" in rule and isinstance(rule["action"], dict):
                rule["action"] = rule["action"].get("type", "noop")

    return data


def _update_channel(
    event: Dict[str, Any],
    channel_id: str,
    body: str,
    logger: StructuredLogger,
    correlation_id: str,
) -> Dict[str, Any]:
    """Update existing channel."""
    try:
        # Parse body
        if not body:
            return _error_response(
                400,
                "Request body is required",
                correlation_id,
            )

        try:
            data = json.loads(body)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse request body: {e}")
            return _error_response(
                400,
                "Invalid JSON in request body",
                correlation_id,
            )

        # Ensure channel ID matches
        if "channelId" in data and data["channelId"] != channel_id:
            return _error_response(
                400,
                "Channel ID in body does not match path parameter",
                correlation_id,
            )

        data["channelId"] = channel_id

        # Handle authConfig changes
        generated_password = None
        new_auth = data.get("authConfig", {})
        new_auth_enabled = new_auth.get("authEnabled", False)

        # Fetch existing channel to compare auth state
        existing_channel = channel_repo.get_channel(channel_id)
        if existing_channel:
            old_auth = existing_channel.auth_config
        else:
            old_auth = None

        caller = get_caller_identity(event)

        if new_auth_enabled and (old_auth is None or not old_auth.auth_enabled):
            # Enabling auth: generate credentials
            username = f"esam-{channel_id}"
            password = credential_service.generate_password()
            ssm_path = credential_service.store_password(channel_id, password)
            data["authConfig"] = {
                "authEnabled": True,
                "username": username,
                "ssmParameterPath": ssm_path,
            }
            generated_password = password
            logger.info(
                "Credentials generated for channel",
                action="auth.credentials_generated",
                channelId=channel_id,
                performedBy=caller.email,
            )
        elif not new_auth_enabled and old_auth and old_auth.auth_enabled:
            # Disabling auth: delete SSM parameter
            if old_auth.ssm_parameter_path:
                credential_service.delete_password(old_auth.ssm_parameter_path)
            data["authConfig"] = {"authEnabled": False}
            logger.info(
                "Authentication disabled for channel",
                action="auth.disabled",
                channelId=channel_id,
                performedBy=caller.email,
            )

        # Normalize data format
        data = _normalize_channel_data(data)

        # Validate and create channel
        try:
            channel = Channel(**data)
        except ValidationError as e:
            logger.error(f"Validation error: {e}")
            return _error_response(
                400,
                "Validation error",
                correlation_id,
                details=str(e),
            )

        # Update in DynamoDB
        updated_channel = channel_repo.update_channel(channel)

        logger.info(
            "Channel updated",
            channelId=updated_channel.channel_id,
            channelName=updated_channel.name,
            performedBy=caller.email,
            action="channel.update",
            targetId=updated_channel.channel_id,
            targetType="channel",
            requestData={
                "name": updated_channel.name,
                "defaultAction": updated_channel.default_action,
                "statefulMode": updated_channel.stateful_mode,
                "enabled": updated_channel.enabled,
                "rulesCount": len(updated_channel.rules),
                "actionsEnabled": updated_channel.actions_enabled,
                "actionsDryRun": updated_channel.actions_dry_run,
            },
        )

        response_data = updated_channel.model_dump(by_alias=True)
        if generated_password:
            response_data["generatedPassword"] = generated_password

        return _success_response(
            data=response_data,
            correlation_id=correlation_id,
        )

    except Exception as e:
        logger.error(f"Failed to update channel: {e}")

        # Check if it's a not found error
        if "not found" in str(e):
            return _error_response(
                404,
                f"Channel not found: {channel_id}",
                correlation_id,
            )

        return _error_response(
            500,
            "Failed to update channel",
            correlation_id,
            details=str(e),
        )


def _regenerate_auth(
    event: Dict[str, Any],
    channel_id: str,
    logger: StructuredLogger,
    correlation_id: str,
) -> Dict[str, Any]:
    """Regenerate auth password for a channel."""
    try:
        channel = channel_repo.get_channel(channel_id)
        if not channel:
            return _error_response(
                404, f"Channel not found: {channel_id}", correlation_id
            )

        if not channel.auth_config.auth_enabled:
            return _error_response(
                400, "Authentication is not enabled for this channel", correlation_id
            )

        password = credential_service.generate_password()
        credential_service.store_password(channel_id, password)

        caller = get_caller_identity(event)
        logger.info(
            "Credentials regenerated for channel",
            action="auth.credentials_regenerated",
            channelId=channel_id,
            performedBy=caller.email,
        )

        return _success_response(
            data={"password": password},
            correlation_id=correlation_id,
        )
    except Exception as e:
        logger.error(f"Failed to regenerate auth: {e}")
        return _error_response(
            500, "Failed to regenerate credentials", correlation_id, details=str(e)
        )


def _get_auth_password(
    event: Dict[str, Any],
    channel_id: str,
    logger: StructuredLogger,
    correlation_id: str,
) -> Dict[str, Any]:
    """Fetch password from SSM for the Show button (admin only)."""
    try:
        channel = channel_repo.get_channel(channel_id)
        if not channel:
            return _error_response(
                404, f"Channel not found: {channel_id}", correlation_id
            )

        if not channel.auth_config.auth_enabled:
            return _error_response(
                400, "Authentication is not enabled for this channel", correlation_id
            )

        if not channel.auth_config.ssm_parameter_path:
            return _error_response(
                400, "No SSM parameter path configured", correlation_id
            )

        password = credential_service.get_password(
            channel.auth_config.ssm_parameter_path
        )

        return _success_response(
            data={"password": password},
            correlation_id=correlation_id,
        )
    except Exception as e:
        logger.error(f"Failed to get auth password: {e}")
        return _error_response(
            500, "Failed to retrieve password", correlation_id, details=str(e)
        )


def _delete_channel(
    event: Dict[str, Any],
    channel_id: str,
    logger: StructuredLogger,
    correlation_id: str,
) -> Dict[str, Any]:
    """Delete channel."""
    try:
        deleted = channel_repo.delete_channel(channel_id)

        if not deleted:
            return _error_response(
                404,
                f"Channel not found: {channel_id}",
                correlation_id,
            )

        caller = get_caller_identity(event)
        logger.info(
            "Channel deleted",
            channelId=channel_id,
            performedBy=caller.email,
            action="channel.delete",
            targetId=channel_id,
            targetType="channel",
        )

        return _success_response(
            data={"message": f"Channel deleted: {channel_id}"},
            correlation_id=correlation_id,
        )

    except Exception as e:
        logger.error(f"Failed to delete channel: {e}")
        return _error_response(
            500,
            "Failed to delete channel",
            correlation_id,
            details=str(e),
        )


def _success_response(
    data: Any,
    correlation_id: str,
    status_code: int = 200,
) -> Dict[str, Any]:
    """Build success response."""
    # Remove null fields from response
    if isinstance(data, dict):
        data = {k: v for k, v in data.items() if v is not None}

    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
            "X-Correlation-ID": correlation_id,
        },
        "body": json.dumps(data, cls=DecimalEncoder),
    }


def _error_response(
    status_code: int,
    message: str,
    correlation_id: str,
    details: str = None,
) -> Dict[str, Any]:
    """Build error response."""
    response_body = {
        "error": message,
        "correlationId": correlation_id,
    }

    if details:
        response_body["details"] = details

    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
            "X-Correlation-ID": correlation_id,
        },
        "body": json.dumps(response_body),
    }
