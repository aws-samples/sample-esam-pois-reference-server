# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Lambda handler for user preferences and system defaults."""

import json
import os
import logging
from typing import Dict, Any
from datetime import datetime

import boto3
from botocore.exceptions import ClientError

from domain.services.rbac import check_role, get_caller_identity
from infrastructure.logging.structured_logger import configure_logging

log_level = os.environ.get("LOG_LEVEL", "INFO")
configure_logging(log_level)
logger = logging.getLogger(__name__)

# Initialize DynamoDB
dynamodb = boto3.resource("dynamodb")
table_name = os.environ.get("PREFERENCES_TABLE_NAME", "pois-preferences")
table = dynamodb.Table(table_name)

# Initialize CloudWatch Logs client
logs_client = boto3.client("logs")

# System defaults key
SYSTEM_DEFAULTS_KEY = "SYSTEM_DEFAULTS"

# Valid CloudWatch retention values (days)
VALID_RETENTION_DAYS = [
    1,
    3,
    5,
    7,
    14,
    30,
    60,
    90,
    120,
    150,
    180,
    365,
    400,
    545,
    731,
    1096,
    1827,
    2192,
    2557,
    2922,
    3288,
    3653,
]


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for preferences API.

    Endpoints:
    - GET /preferences/defaults - Get system defaults
    - PUT /preferences/defaults - Update system defaults
    """
    try:
        method = event.get("httpMethod", "GET")
        path = event.get("path", "")

        logger.info(f"Preferences API: {method} {path}")

        if method == "GET":
            return get_defaults()
        elif method == "PUT":
            # RBAC: only admin group can update system defaults
            denied = check_role(event, "admin")
            if denied is not None:
                return denied
            return put_defaults(event)
        else:
            return response(405, {"error": "Method not allowed"})

    except Exception as e:
        logger.error(f"Error in preferences handler: {e}", exc_info=True)
        return response(500, {"error": str(e)})


def get_defaults() -> Dict[str, Any]:
    """Get system defaults."""
    try:
        result = table.get_item(Key={"userId": SYSTEM_DEFAULTS_KEY})

        if "Item" not in result:
            # Return hardcoded defaults if none saved
            defaults = {
                "defaultAction": "noop",
                "defaultMode": "stateless",
                "descriptorPriority": "",
                "autoAddDescriptors": False,
                "actionsEnabled": True,
                "actionsDryRun": False,
                "esamEndpoint": _default_esam_endpoint(),
                "apiUrl": _default_api_url(),
                "awsRegion": os.environ.get("AWS_REGION", ""),
                "logRetentionDays": 7,
                "logPollingIntervalMs": 5000,
                "esamLogGroup": os.environ.get("ESAM_LOG_GROUP", ""),
                "defaultActionTimeoutMs": 5000,
                "defaultActionMaxRetries": 3,
            }
            return response(200, defaults)

        item = result["Item"]
        # Remove internal fields
        item.pop("userId", None)
        item.pop("updatedAt", None)
        item.pop("updatedBy", None)

        # Convert Decimal to int/float for JSON serialization
        cleaned = _clean_decimals(item)

        # Fill deployment-derived values when not customized, so the ESAM tab
        # always shows working endpoints on a fresh deployment.
        if not cleaned.get("apiUrl"):
            cleaned["apiUrl"] = _default_api_url()
        if not cleaned.get("esamEndpoint"):
            cleaned["esamEndpoint"] = _default_esam_endpoint()
        if not cleaned.get("awsRegion"):
            cleaned["awsRegion"] = os.environ.get("AWS_REGION", "")
        if not cleaned.get("esamLogGroup"):
            cleaned["esamLogGroup"] = os.environ.get("ESAM_LOG_GROUP", "")

        return response(200, cleaned)

    except ClientError as e:
        logger.error(f"DynamoDB error: {e}")
        return response(500, {"error": "Failed to get defaults"})


def put_defaults(event: Dict[str, Any]) -> Dict[str, Any]:
    """Update system defaults."""
    try:
        body = json.loads(event.get("body", "{}"))

        # Validate fields
        allowed_fields = {
            "defaultAction",
            "defaultMode",
            "descriptorPriority",
            "autoAddDescriptors",
            "actionsEnabled",
            "actionsDryRun",
            "esamEndpoint",
            "apiUrl",
            "awsRegion",
            "logRetentionDays",
            "logPollingIntervalMs",
            "esamLogGroup",
            "defaultActionTimeoutMs",
            "defaultActionMaxRetries",
            "visibleLogTypes",
            "visibleLogSources",
        }

        # Filter only allowed fields
        filtered = {k: v for k, v in body.items() if k in allowed_fields}

        if not filtered:
            return response(400, {"error": "No valid fields provided"})

        # Save to DynamoDB
        item = {
            "userId": SYSTEM_DEFAULTS_KEY,
            "updatedAt": datetime.utcnow().isoformat() + "Z",
            **filtered,
        }

        table.put_item(Item=item)

        logger.info(
            "System defaults updated",
            extra={
                "action": "preferences.update",
                "performedBy": get_caller_identity(event).email,
                "targetType": "preferences",
                "requestData": filtered,
            },
        )

        # If retention or log group changed, update CloudWatch retention policy
        if "logRetentionDays" in filtered or "esamLogGroup" in filtered:
            _update_cloudwatch_retention(filtered, body)

        return response(200, filtered)

    except json.JSONDecodeError:
        return response(400, {"error": "Invalid JSON"})
    except ClientError as e:
        logger.error(f"DynamoDB error: {e}")
        return response(500, {"error": "Failed to save defaults"})


def _default_api_url() -> str:
    """Build this deployment's API base URL from environment (set by CDK)."""
    api_id = os.environ.get("API_ID", "")
    if not api_id:
        return ""
    region = os.environ.get("AWS_REGION", "")
    stage = os.environ.get("API_STAGE", "v1")
    return f"https://{api_id}.execute-api.{region}.amazonaws.com/{stage}"


def _default_esam_endpoint() -> str:
    """Build this deployment's ESAM endpoint URL."""
    api_url = _default_api_url()
    return f"{api_url}/esam" if api_url else ""


def _clean_decimals(obj):
    """Convert Decimal types to int/float for JSON serialization."""
    from decimal import Decimal

    if isinstance(obj, dict):
        return {k: _clean_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_clean_decimals(i) for i in obj]
    elif isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    elif isinstance(obj, bool):
        return obj
    return obj


def response(status_code: int, body: Any) -> Dict[str, Any]:
    """Build API Gateway response."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
        },
        "body": json.dumps(body),
    }


def _update_cloudwatch_retention(filtered: dict, full_body: dict) -> None:
    """Update CloudWatch log group retention policy when settings change."""
    try:
        logs_client = boto3.client("logs")

        retention_days = int(
            filtered.get("logRetentionDays", full_body.get("logRetentionDays", 7))
        )
        log_group = filtered.get("esamLogGroup", full_body.get("esamLogGroup", ""))

        if not log_group:
            logger.warning("No log group configured, skipping retention update")
            return

        # CloudWatch only accepts specific retention values
        valid_retentions = [
            1,
            3,
            5,
            7,
            14,
            30,
            60,
            90,
            120,
            150,
            180,
            365,
            400,
            545,
            731,
            1096,
            1827,
            2192,
            2557,
            2922,
            3288,
            3653,
        ]
        if retention_days not in valid_retentions:
            # Find closest valid value
            retention_days = min(
                valid_retentions, key=lambda x: abs(x - retention_days)
            )

        logs_client.put_retention_policy(
            logGroupName=log_group, retentionInDays=retention_days
        )

        logger.info(
            f"Updated CloudWatch retention for {log_group} to {retention_days} days"
        )

    except Exception as e:
        logger.error(f"Failed to update CloudWatch retention: {e}")
        # Don't fail the whole request - retention update is best-effort
