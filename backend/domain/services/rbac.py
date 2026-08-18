# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""RBAC (Role-Based Access Control) utilities for Lambda handlers.

Extracts Cognito group claims from API Gateway request context and
enforces role-based access on protected endpoints.
"""

import json
import functools
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class CallerIdentity:
    """Identity extracted from Cognito JWT claims in the API Gateway context."""

    sub: str
    email: str
    groups: List[str] = field(default_factory=list)


def get_caller_identity(event: Dict[str, Any]) -> CallerIdentity:
    """Extract caller identity from the API Gateway authorizer claims.

    Args:
        event: API Gateway Lambda proxy event.

    Returns:
        CallerIdentity with sub, email, and groups parsed from claims.
        Missing or empty values default to empty strings / empty list.
    """
    claims = (
        event.get("requestContext", {}).get("authorizer", {}).get("claims", {})
    ) or {}

    sub = claims.get("sub", "") or ""
    email = claims.get("email", "") or ""
    groups_str = claims.get("cognito:groups", "") or ""
    groups = [g.strip() for g in groups_str.split(",") if g.strip()]

    return CallerIdentity(sub=sub, email=email, groups=groups)


def check_role(event: Dict[str, Any], *allowed_groups: str) -> Optional[Dict[str, Any]]:
    """Check whether the caller belongs to at least one of *allowed_groups*.

    Call this inside a handler for write operations that require elevated
    permissions.  If the caller is authorised the function returns ``None``;
    otherwise it returns a ready-made 403 API Gateway response that the
    handler should return immediately.

    Args:
        event: API Gateway Lambda proxy event.
        *allowed_groups: One or more group names that are permitted.

    Returns:
        ``None`` if the caller is authorised, or a 403 response dict.
    """
    identity = get_caller_identity(event)

    if any(g in allowed_groups for g in identity.groups):
        return None  # authorised

    return _forbidden_response()


def require_role(*allowed_groups: str):
    """Decorator that enforces group membership on a Lambda handler.

    Wraps a ``handler(event, context)`` function.  If the caller's
    ``cognito:groups`` claim does not intersect with *allowed_groups*,
    the decorator short-circuits with a 403 response.

    Usage::

        @require_role('admin')
        def handler(event, context):
            ...
    """

    def decorator(func):
        @functools.wraps(func)
        def wrapper(event, context):
            denied = check_role(event, *allowed_groups)
            if denied is not None:
                return denied
            return func(event, context)

        return wrapper

    return decorator


def _forbidden_response() -> Dict[str, Any]:
    """Build a 403 Forbidden API Gateway response."""
    return {
        "statusCode": 403,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        },
        "body": json.dumps({"error": "Forbidden"}),
    }
