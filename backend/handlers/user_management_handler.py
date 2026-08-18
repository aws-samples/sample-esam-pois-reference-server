# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Lambda handler for user management endpoints.

All endpoints require admin group membership via RBAC.
Uses boto3 Cognito Identity Provider client to manage users.
"""

import json
import os
import logging
from typing import Any, Dict

import boto3
from botocore.exceptions import ClientError

from domain.services.rbac import require_role, get_caller_identity
from infrastructure.logging.structured_logger import configure_logging

log_level = os.environ.get("LOG_LEVEL", "INFO")
configure_logging(log_level)
logger = logging.getLogger(__name__)

USER_POOL_ID = os.environ.get("USER_POOL_ID", "")
cognito_client = boto3.client("cognito-idp")


@require_role("admin")
def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Route user management requests to the appropriate function."""
    try:
        method = event.get("httpMethod", "")
        path = event.get("path", "")
        path_params = event.get("pathParameters") or {}
        username = path_params.get("username", "")

        logger.info(f"User management request: {method} {path}")

        # POST /users/{username}/disable
        if method == "POST" and username and path.endswith("/disable"):
            return _disable_user(event, username)

        # POST /users/{username}/enable
        if method == "POST" and username and path.endswith("/enable"):
            return _enable_user(event, username)

        # POST /users/{username}/reset-password
        if method == "POST" and username and path.endswith("/reset-password"):
            return _reset_password(event, username)

        # PUT /users/{username}/group
        if method == "PUT" and username and path.endswith("/group"):
            return _change_group(event, username)

        # DELETE /users/{username}
        if method == "DELETE" and username:
            return _delete_user(event, username)

        # GET /users
        if method == "GET" and not username:
            return _list_users()

        # POST /users (create)
        if method == "POST" and not username:
            return _create_user(event)

        return response(404, {"error": "Not found"})

    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        return response(500, {"error": "Internal server error"})


def _list_users() -> Dict[str, Any]:
    """GET /users — list all Cognito users with their group memberships."""
    try:
        users = []
        paginator = cognito_client.get_paginator("list_users")
        for page in paginator.paginate(UserPoolId=USER_POOL_ID):
            for user in page.get("Users", []):
                users.append(_format_user(user))
        return response(200, users)
    except ClientError as e:
        logger.error(f"Failed to list users: {e}")
        return response(500, {"error": "Internal server error"})


def _format_user(user: dict) -> dict:
    """Convert a Cognito user record to our API response format."""
    attrs = {a["Name"]: a["Value"] for a in user.get("Attributes", [])}
    username = user.get("Username", "")

    # Fetch groups for this user
    groups = []
    try:
        resp = cognito_client.admin_list_groups_for_user(
            Username=username,
            UserPoolId=USER_POOL_ID,
        )
        groups = [g["GroupName"] for g in resp.get("Groups", [])]
    except ClientError:
        logger.warning(f"Could not fetch groups for user {username}")

    return {
        "username": username,
        "email": attrs.get("email", ""),
        "name": attrs.get("name", ""),
        "enabled": user.get("Enabled", False),
        "status": user.get("UserStatus", ""),
        "groups": groups,
        "createdAt": (
            user.get("UserCreateDate", "").isoformat()
            if hasattr(user.get("UserCreateDate", ""), "isoformat")
            else str(user.get("UserCreateDate", ""))
        ),
    }


def _create_user(event: Dict[str, Any]) -> Dict[str, Any]:
    """POST /users — create a new Cognito user and assign to a group."""
    try:
        body = json.loads(event.get("body", "{}") or "{}")
    except json.JSONDecodeError:
        return response(400, {"error": "Invalid JSON"})

    email = body.get("email", "").strip()
    name = body.get("name", "").strip()
    temp_password = body.get("temporaryPassword", "")
    group = body.get("group", "")
    # When true, Cognito generates the temporary password and emails an
    # invitation (rendered by the user pool's CustomMessage trigger, which
    # includes the dashboard URL). When false, the admin supplies the
    # temporary password and no email is sent.
    send_invitation = bool(body.get("sendInvitation", False))

    # Validate required fields
    required = [("email", email), ("name", name), ("group", group)]
    if not send_invitation:
        required.append(("temporaryPassword", temp_password))
    for field_name, value in required:
        if not value:
            return response(400, {"error": f"Missing required field: {field_name}"})

    if group not in ("admin", "user"):
        return response(400, {"error": "Group must be 'admin' or 'user'"})

    try:
        create_kwargs: Dict[str, Any] = {
            "UserPoolId": USER_POOL_ID,
            "Username": email,
            "UserAttributes": [
                {"Name": "email", "Value": email},
                {"Name": "name", "Value": name},
                {"Name": "email_verified", "Value": "true"},
            ],
        }
        if send_invitation:
            create_kwargs["DesiredDeliveryMediums"] = ["EMAIL"]
        else:
            create_kwargs["TemporaryPassword"] = temp_password
            create_kwargs["MessageAction"] = "SUPPRESS"

        cognito_client.admin_create_user(**create_kwargs)
        cognito_client.admin_add_user_to_group(
            UserPoolId=USER_POOL_ID,
            Username=email,
            GroupName=group,
        )
        caller = get_caller_identity(event)
        logger.info(
            "User created",
            extra={
                "action": "user.create",
                "performedBy": caller.email,
                "targetId": email,
                "targetType": "user",
                "requestData": {"email": email, "name": name, "group": group},
            },
        )
        return response(201, {"message": f"User {email} created", "username": email})
    except cognito_client.exceptions.UsernameExistsException:
        return response(409, {"error": "User already exists"})
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "")
        error_msg = e.response.get("Error", {}).get("Message", str(e))
        logger.error(f"Failed to create user: {e}")
        if error_code == "InvalidPasswordException":
            return response(400, {"error": error_msg})
        if error_code == "InvalidParameterException":
            return response(400, {"error": error_msg})
        return response(500, {"error": error_msg})


def _disable_user(event: Dict[str, Any], username: str) -> Dict[str, Any]:
    """POST /users/{username}/disable — disable a user account."""
    caller = get_caller_identity(event)
    if caller.sub == username or caller.email == username:
        return response(400, {"error": "Cannot disable your own account"})

    if _is_last_enabled_admin(username):
        return response(
            400,
            {
                "error": "Cannot disable the only admin. "
                "Create or promote another admin first."
            },
        )

    try:
        cognito_client.admin_disable_user(
            UserPoolId=USER_POOL_ID,
            Username=username,
        )
        caller = get_caller_identity(event)
        logger.info(
            "User disabled",
            extra={
                "action": "user.disable",
                "performedBy": caller.email,
                "targetId": username,
                "targetType": "user",
            },
        )
        return response(200, {"message": f"User {username} disabled"})
    except cognito_client.exceptions.UserNotFoundException:
        return response(404, {"error": "User not found"})
    except ClientError as e:
        logger.error(f"Failed to disable user: {e}")
        return response(500, {"error": "Internal server error"})


def _enable_user(event: Dict[str, Any], username: str) -> Dict[str, Any]:
    """POST /users/{username}/enable — enable a user account."""
    try:
        cognito_client.admin_enable_user(
            UserPoolId=USER_POOL_ID,
            Username=username,
        )
        caller = get_caller_identity(event)
        logger.info(
            "User enabled",
            extra={
                "action": "user.enable",
                "performedBy": caller.email,
                "targetId": username,
                "targetType": "user",
            },
        )
        return response(200, {"message": f"User {username} enabled"})
    except cognito_client.exceptions.UserNotFoundException:
        return response(404, {"error": "User not found"})
    except ClientError as e:
        logger.error(f"Failed to enable user: {e}")
        return response(500, {"error": "Internal server error"})


def _reset_password(event: Dict[str, Any], username: str) -> Dict[str, Any]:
    """POST /users/{username}/reset-password — reset to a temporary password."""
    try:
        body = json.loads(event.get("body", "{}") or "{}")
    except json.JSONDecodeError:
        return response(400, {"error": "Invalid JSON"})

    temp_password = body.get("temporaryPassword", "")
    if not temp_password:
        return response(400, {"error": "Missing required field: temporaryPassword"})

    try:
        cognito_client.admin_set_user_password(
            UserPoolId=USER_POOL_ID,
            Username=username,
            Password=temp_password,
            Permanent=False,
        )
        caller = get_caller_identity(event)
        logger.info(
            "User password reset",
            extra={
                "action": "user.reset_password",
                "performedBy": caller.email,
                "targetId": username,
                "targetType": "user",
            },
        )
        return response(200, {"message": f"Password reset for {username}"})
    except cognito_client.exceptions.UserNotFoundException:
        return response(404, {"error": "User not found"})
    except ClientError as e:
        logger.error(f"Failed to reset password: {e}")
        return response(500, {"error": "Internal server error"})


def _change_group(event: Dict[str, Any], username: str) -> Dict[str, Any]:
    """PUT /users/{username}/group — change group assignment."""
    caller = get_caller_identity(event)
    if caller.sub == username or caller.email == username:
        # Self-demotion would lock the caller out of user management
        return response(400, {"error": "Cannot change your own group"})

    try:
        body = json.loads(event.get("body", "{}") or "{}")
    except json.JSONDecodeError:
        return response(400, {"error": "Invalid JSON"})

    new_group = body.get("group", "")
    if new_group not in ("admin", "user"):
        return response(400, {"error": "Group must be 'admin' or 'user'"})

    # Demoting the only enabled admin would leave nobody able to manage users
    if new_group == "user" and _is_last_enabled_admin(username):
        return response(
            400,
            {
                "error": "Cannot demote the only admin. "
                "Create or promote another admin first."
            },
        )

    try:
        # Remove from all existing groups first
        existing = cognito_client.admin_list_groups_for_user(
            Username=username,
            UserPoolId=USER_POOL_ID,
        )
        for g in existing.get("Groups", []):
            cognito_client.admin_remove_user_from_group(
                UserPoolId=USER_POOL_ID,
                Username=username,
                GroupName=g["GroupName"],
            )

        # Add to new group
        cognito_client.admin_add_user_to_group(
            UserPoolId=USER_POOL_ID,
            Username=username,
            GroupName=new_group,
        )
        caller = get_caller_identity(event)
        logger.info(
            "User group changed",
            extra={
                "action": "user.change_group",
                "performedBy": caller.email,
                "targetId": username,
                "targetType": "user",
                "requestData": {"newGroup": new_group},
            },
        )
        return response(200, {"message": f"User {username} moved to {new_group} group"})
    except cognito_client.exceptions.UserNotFoundException:
        return response(404, {"error": "User not found"})
    except ClientError as e:
        logger.error(f"Failed to change group: {e}")
        return response(500, {"error": "Internal server error"})


def _delete_user(event: Dict[str, Any], username: str) -> Dict[str, Any]:
    """DELETE /users/{username} — permanently delete a user account."""
    caller = get_caller_identity(event)
    if caller.sub == username or caller.email == username:
        return response(400, {"error": "Cannot delete your own account"})

    # Deleting the only enabled admin would leave nobody able to manage users
    if _is_last_enabled_admin(username):
        return response(
            400,
            {
                "error": "Cannot delete the only admin. "
                "Create or promote another admin first."
            },
        )

    try:
        cognito_client.admin_delete_user(
            UserPoolId=USER_POOL_ID,
            Username=username,
        )
        caller = get_caller_identity(event)
        logger.info(
            "User deleted",
            extra={
                "action": "user.delete",
                "performedBy": caller.email,
                "targetId": username,
                "targetType": "user",
            },
        )
        return response(200, {"message": f"User {username} deleted"})
    except cognito_client.exceptions.UserNotFoundException:
        return response(404, {"error": "User not found"})
    except ClientError as e:
        logger.error(f"Failed to delete user: {e}")
        return response(500, {"error": "Internal server error"})


def _is_last_enabled_admin(username: str) -> bool:
    """Check whether the given user is the only ENABLED member of 'admin'.

    Guards the system invariant that at least one enabled admin must always
    remain: disabling, demoting or deleting the last one would leave nobody
    able to manage users. To remove a departed admin, first create another
    admin (or promote an existing user) - then the removal is allowed.
    """
    other_enabled_admins = 0
    target_is_enabled_admin = False

    paginator = cognito_client.get_paginator("list_users_in_group")
    for page in paginator.paginate(UserPoolId=USER_POOL_ID, GroupName="admin"):
        for user in page.get("Users", []):
            if not user.get("Enabled", False):
                continue
            if user.get("Username", "") == username:
                target_is_enabled_admin = True
            else:
                other_enabled_admins += 1

    return target_is_enabled_admin and other_enabled_admins == 0


def response(status_code: int, body: Any) -> Dict[str, Any]:
    """Build API Gateway response with CORS headers."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        },
        "body": json.dumps(body),
    }
