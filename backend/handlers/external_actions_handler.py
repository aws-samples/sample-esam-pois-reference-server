# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Lambda handler for external actions management API.

NOTE: This is an OPTIONAL standalone REST API for managing external actions
independently of the main channel save flow. The default POIS frontend does
NOT use these endpoints — it manages external actions via PUT /channels/{id}
(handled by channel_handler.py). This handler exists as an alternative API
for programmatic/CLI integrations that prefer fine-grained action CRUD
without replacing the entire channel document.

Endpoints:
- GET    /channels/{channelId}/rules/{ruleId}/actions                - List actions
- POST   /channels/{channelId}/rules/{ruleId}/actions                - Create action (501 - use PUT /channels/{id})
- PUT    /channels/{channelId}/rules/{ruleId}/actions/{actionId}     - Update action
- DELETE /channels/{channelId}/rules/{ruleId}/actions/{actionId}     - Delete action
- POST   /channels/{channelId}/rules/{ruleId}/actions/{actionId}/validate - Validate action config
- GET    /actions/templates                                           - List action templates
- GET    /channels/{channelId}/actions/logs                          - Get action audit logs
- GET    /channels/{channelId}/actions/logs/{entryId}                - Get log details
"""

import json
import logging
from typing import Dict, Any
from datetime import datetime

from domain.services.plugin_registry import get_global_registry
from domain.services.rbac import check_role
from domain.repositories.channel_repository import ChannelRepository

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def _json_serial(obj):
    """JSON serializer for objects not serializable by default json code."""
    from decimal import Decimal

    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    if isinstance(obj, datetime):
        return obj.isoformat() + "Z"
    if isinstance(obj, bytes):
        return obj.hex()
    raise TypeError(f"Type {type(obj)} not serializable")


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for external actions API.

    Endpoints:
    - GET /channels/{channelId}/rules/{ruleId}/actions - List actions
    - POST /channels/{channelId}/rules/{ruleId}/actions - Create action
    - PUT /channels/{channelId}/rules/{ruleId}/actions/{actionId} - Update action
    - DELETE /channels/{channelId}/rules/{ruleId}/actions/{actionId} - Delete action
    - POST /channels/{channelId}/rules/{ruleId}/actions/{actionId}/validate - Validate action
    - GET /actions/templates - List action templates
    - GET /channels/{channelId}/actions/logs - Get action audit logs
    - GET /channels/{channelId}/actions/logs/{entryId} - Get action log details
    """
    try:
        http_method = event.get("httpMethod", "GET")
        path = event.get("path", "")
        path_params = event.get("pathParameters", {})

        logger.info(f"External actions API: {http_method} {path}")

        # Route to appropriate handler
        if "/logs/" in path and path_params.get("entryId"):
            # GET /channels/{channelId}/actions/logs/{entryId}
            return handle_get_action_log_details(event, path_params)
        elif "/logs" in path:
            # GET /channels/{channelId}/actions/logs
            return handle_get_action_logs(event, path_params)
        elif "/templates" in path:
            return handle_list_templates()
        elif "/validate" in path:
            return handle_validate_action(event, path_params)
        elif http_method == "GET":
            return handle_list_actions(path_params)
        elif http_method == "POST":
            # RBAC: external actions trigger calls into external systems
            # (MediaLive, webhooks) - only admins may configure them
            denied = check_role(event, "admin")
            if denied is not None:
                return denied
            return handle_create_action(event, path_params)
        elif http_method == "PUT":
            denied = check_role(event, "admin")
            if denied is not None:
                return denied
            return handle_update_action(event, path_params)
        elif http_method == "DELETE":
            denied = check_role(event, "admin")
            if denied is not None:
                return denied
            return handle_delete_action(path_params)
        else:
            return {
                "statusCode": 405,
                "body": json.dumps({"error": "Method not allowed"}),
            }

    except Exception as e:
        logger.error(f"Error in external actions handler: {e}", exc_info=True)
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}


def handle_list_actions(path_params: Dict[str, str]) -> Dict[str, Any]:
    """List all external actions for a rule."""
    channel_id = path_params.get("channelId")
    rule_id = path_params.get("ruleId")

    if not channel_id or not rule_id:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Missing channelId or ruleId"}),
        }

    try:
        # Get channel from repository
        repo = ChannelRepository()
        channel = repo.get_channel(channel_id)

        if not channel:
            return {
                "statusCode": 404,
                "body": json.dumps({"error": "Channel not found"}),
            }

        # Find rule
        rule = next((r for r in channel.rules if r.rule_id == rule_id), None)

        if not rule:
            return {"statusCode": 404, "body": json.dumps({"error": "Rule not found"})}

        # Return actions
        actions = rule.external_actions or []

        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "actions": [action.__dict__ for action in actions],
                    "count": len(actions),
                }
            ),
        }

    except Exception as e:
        logger.error(f"Error listing actions: {e}", exc_info=True)
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}


def handle_create_action(
    event: Dict[str, Any], path_params: Dict[str, str]
) -> Dict[str, Any]:
    """
    Create a new external action for a rule.

    NOTE: This endpoint is not used by the default POIS frontend.
    The frontend manages external actions as part of the full channel
    document via PUT /channels/{channelId} (channel_handler.py).

    Returns 501 Not Implemented with guidance to use the channel API.
    """
    return {
        "statusCode": 501,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(
            {
                "error": "Not Implemented",
                "message": (
                    "Standalone action creation is not implemented. "
                    "Use PUT /channels/{channelId} to manage external actions "
                    "as part of the channel configuration. The request body should "
                    "include the full channel document with the updated "
                    "rules[].externalActions array."
                ),
                "alternative": "PUT /channels/{channelId}",
                "documentation": "See channel_handler.py for the primary API",
            }
        ),
    }


def handle_update_action(
    event: Dict[str, Any], path_params: Dict[str, str]
) -> Dict[str, Any]:
    """Update an existing external action."""
    channel_id = path_params.get("channelId")
    rule_id = path_params.get("ruleId")
    action_id = path_params.get("actionId")

    if not all([channel_id, rule_id, action_id]):
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Missing required path parameters"}),
        }

    try:
        body = json.loads(event.get("body", "{}"))

        # Get channel
        repo = ChannelRepository()
        channel = repo.get_channel(channel_id)

        if not channel:
            return {
                "statusCode": 404,
                "body": json.dumps({"error": "Channel not found"}),
            }

        # Find rule
        rule = next((r for r in channel.rules if r.rule_id == rule_id), None)

        if not rule:
            return {"statusCode": 404, "body": json.dumps({"error": "Rule not found"})}

        # Find and update action
        action_found = False
        for i, action in enumerate(rule.external_actions or []):
            if action.action_id == action_id:
                # Update action fields
                for key, value in body.items():
                    if hasattr(action, key):
                        setattr(action, key, value)
                action_found = True
                break

        if not action_found:
            return {
                "statusCode": 404,
                "body": json.dumps({"error": "Action not found"}),
            }

        # Save channel
        repo.save_channel(channel)

        return {
            "statusCode": 200,
            "body": json.dumps({"message": "Action updated successfully"}),
        }

    except json.JSONDecodeError:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Invalid JSON in request body"}),
        }
    except Exception as e:
        logger.error(f"Error updating action: {e}", exc_info=True)
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}


def handle_delete_action(path_params: Dict[str, str]) -> Dict[str, Any]:
    """Delete an external action."""
    channel_id = path_params.get("channelId")
    rule_id = path_params.get("ruleId")
    action_id = path_params.get("actionId")

    if not all([channel_id, rule_id, action_id]):
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Missing required path parameters"}),
        }

    try:
        # Get channel
        repo = ChannelRepository()
        channel = repo.get_channel(channel_id)

        if not channel:
            return {
                "statusCode": 404,
                "body": json.dumps({"error": "Channel not found"}),
            }

        # Find rule
        rule = next((r for r in channel.rules if r.rule_id == rule_id), None)

        if not rule:
            return {"statusCode": 404, "body": json.dumps({"error": "Rule not found"})}

        # Remove action
        if rule.external_actions:
            original_count = len(rule.external_actions)
            rule.external_actions = [
                a for a in rule.external_actions if a.action_id != action_id
            ]

            if len(rule.external_actions) == original_count:
                return {
                    "statusCode": 404,
                    "body": json.dumps({"error": "Action not found"}),
                }
        else:
            return {
                "statusCode": 404,
                "body": json.dumps({"error": "Action not found"}),
            }

        # Save channel
        repo.save_channel(channel)

        return {
            "statusCode": 200,
            "body": json.dumps({"message": "Action deleted successfully"}),
        }

    except Exception as e:
        logger.error(f"Error deleting action: {e}", exc_info=True)
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}


def handle_validate_action(
    event: Dict[str, Any], path_params: Dict[str, str]
) -> Dict[str, Any]:
    """Validate an action configuration."""
    try:
        body = json.loads(event.get("body", "{}"))
        action_type = body.get("action_type")
        action_config = body.get("action_config", {})

        if not action_type:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "Missing action_type"}),
            }

        # Get plugin
        registry = get_global_registry()
        plugin = registry.get(action_type)

        if not plugin:
            return {
                "statusCode": 400,
                "body": json.dumps(
                    {"valid": False, "error": f"Unknown action type: {action_type}"}
                ),
            }

        # Validate
        is_valid, error_msg = plugin.validate_config(action_config)

        return {
            "statusCode": 200,
            "body": json.dumps(
                {"valid": is_valid, "error": error_msg if not is_valid else None}
            ),
        }

    except json.JSONDecodeError:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Invalid JSON in request body"}),
        }


def handle_list_templates() -> Dict[str, Any]:
    """List available action templates."""
    templates = [
        {
            "template_id": "logo_on_ad_break",
            "name": "Logo on Ad Break",
            "description": "Insert logo when ad break starts, remove when it ends",
            "action_type": "medialive_schedule_action",
            "category": "logo_insertion",
        },
        {
            "template_id": "input_switch_on_program",
            "name": "Input Switch on Program Boundary",
            "description": "Switch input when program starts",
            "action_type": "medialive_schedule_action",
            "category": "input_switching",
        },
        {
            "template_id": "motion_graphics_on_chapter",
            "name": "Motion Graphics on Chapter",
            "description": "Show motion graphics on chapter markers",
            "action_type": "medialive_schedule_action",
            "category": "motion_graphics",
        },
        {
            "template_id": "webhook_notification",
            "name": "Webhook Notification",
            "description": "Send HTTP notification when signal is detected",
            "action_type": "webhook",
            "category": "notifications",
        },
    ]

    return {"statusCode": 200, "body": json.dumps({"templates": templates})}


def handle_get_action_logs(
    event: Dict[str, Any], path_params: Dict[str, str]
) -> Dict[str, Any]:
    """Get action audit logs for a channel."""
    # Try to get channelId from path parameters or query parameters
    channel_id = path_params.get("channelId") or path_params.get("id")

    if not channel_id:
        return {
            "statusCode": 400,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(
                {"error": "Missing channelId", "path_params": path_params}
            ),
        }

    try:
        # Parse query parameters
        query_params = event.get("queryStringParameters") or {}
        limit = int(query_params.get("limit", "100"))
        limit = min(limit, 500)  # Max 500

        start_time_str = query_params.get("start_time")
        end_time_str = query_params.get("end_time")
        action_type = query_params.get("action_type")
        execution_result = query_params.get("execution_result")

        # Parse timestamps
        start_time = None
        end_time = None

        if start_time_str:
            try:
                start_time = datetime.fromisoformat(
                    start_time_str.replace("Z", "+00:00")
                )
            except ValueError:
                return {
                    "statusCode": 400,
                    "body": json.dumps({"error": "Invalid start_time format"}),
                }

        if end_time_str:
            try:
                end_time = datetime.fromisoformat(end_time_str.replace("Z", "+00:00"))
            except ValueError:
                return {
                    "statusCode": 400,
                    "body": json.dumps({"error": "Invalid end_time format"}),
                }

        # Get repository
        import os

        table_name = os.environ.get("CHANNELS_TABLE_NAME", "pois-channels")
        from domain.repositories.action_audit_repository import (
            DynamoDBActionAuditRepository,
        )

        repo = DynamoDBActionAuditRepository(table_name=table_name)

        # Query logs
        import asyncio

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            entries = loop.run_until_complete(
                repo.query_by_channel(
                    channel_id=channel_id,
                    start_time=start_time,
                    end_time=end_time,
                    action_type=action_type,
                    limit=limit,
                )
            )
        finally:
            loop.close()

        # Filter by execution result if specified
        if execution_result:
            entries = [
                e for e in entries if e.execution_result.value == execution_result
            ]

        # Convert to response format
        logs = []
        for entry in entries:
            log_dict = {
                "entry_id": entry.entry_id,
                "timestamp": entry.timestamp.isoformat() + "Z",
                "channel_id": entry.channel_id,
                "rule_id": entry.rule_id,
                "action_id": entry.action_id,
                "action_type": entry.action_type,
                "execution_result": entry.execution_result.value,
                "duration_ms": entry.duration_ms,
                "retry_count": entry.retry_count,
                "signal_data": entry.signal_data,
            }

            # Extract schedule_action_type from request_payload for display
            if entry.request_payload and isinstance(entry.request_payload, dict):
                sat = entry.request_payload.get("schedule_action_type")
                if sat:
                    log_dict["schedule_action_type"] = sat

            if entry.error_message:
                log_dict["error_message"] = entry.error_message

            logs.append(log_dict)

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "GET,OPTIONS",
            },
            "body": json.dumps(
                {"logs": logs, "total": len(logs), "has_more": len(logs) == limit},
                default=_json_serial,
            ),
        }

    except Exception as e:
        logger.error(f"Error getting action logs: {e}", exc_info=True)
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "GET,OPTIONS",
            },
            "body": json.dumps({"error": str(e)}),
        }


def handle_get_action_log_details(
    event: Dict[str, Any], path_params: Dict[str, str]
) -> Dict[str, Any]:
    """Get detailed information for a specific action execution."""
    # Try to get channelId from path parameters
    channel_id = path_params.get("channelId") or path_params.get("id")
    entry_id = path_params.get("entryId")

    if not channel_id or not entry_id:
        return {
            "statusCode": 400,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(
                {"error": "Missing channelId or entryId", "path_params": path_params}
            ),
        }

    try:
        # Get repository
        import os

        table_name = os.environ.get("CHANNELS_TABLE_NAME", "pois-channels")
        from domain.repositories.action_audit_repository import (
            DynamoDBActionAuditRepository,
        )

        repo = DynamoDBActionAuditRepository(table_name=table_name)

        # Get entry
        import asyncio

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            entry = loop.run_until_complete(repo.get_by_id(entry_id))
        finally:
            loop.close()

        if not entry:
            return {
                "statusCode": 404,
                "body": json.dumps({"error": "Action log entry not found"}),
            }

        # Verify channel ID matches
        if entry.channel_id != channel_id:
            return {
                "statusCode": 404,
                "body": json.dumps({"error": "Action log entry not found"}),
            }

        # Return complete entry
        response_data = {
            "entry_id": entry.entry_id,
            "timestamp": entry.timestamp.isoformat() + "Z",
            "channel_id": entry.channel_id,
            "rule_id": entry.rule_id,
            "action_id": entry.action_id,
            "action_type": entry.action_type,
            "execution_result": entry.execution_result.value,
            "duration_ms": entry.duration_ms,
            "retry_count": entry.retry_count,
            "signal_data": entry.signal_data,
            "request_payload": entry.request_payload,
            "response_payload": entry.response_payload,
            "error_message": entry.error_message,
        }

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "GET,OPTIONS",
            },
            "body": json.dumps(response_data),
        }

    except Exception as e:
        logger.error(f"Error getting action log details: {e}", exc_info=True)
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}
