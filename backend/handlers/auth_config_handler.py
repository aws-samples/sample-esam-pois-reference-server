# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Lambda handler for auth configuration endpoint."""

import json
import os
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for GET /auth/config.

    Returns Cognito User Pool configuration so the frontend can
    dynamically discover auth settings without hardcoded values.
    """
    try:
        logger.info("Auth config request received")

        user_pool_id = os.environ.get("USER_POOL_ID")
        user_pool_client_id = os.environ.get("USER_POOL_CLIENT_ID")
        region = os.environ.get("REGION")

        if not all([user_pool_id, user_pool_client_id, region]):
            missing = []
            if not user_pool_id:
                missing.append("USER_POOL_ID")
            if not user_pool_client_id:
                missing.append("USER_POOL_CLIENT_ID")
            if not region:
                missing.append("REGION")
            logger.error(
                f"Missing required environment variables: {', '.join(missing)}"
            )
            return response(500, {"error": "Auth configuration not available"})

        return response(
            200,
            {
                "userPoolId": user_pool_id,
                "userPoolClientId": user_pool_client_id,
                "region": region,
            },
        )

    except Exception as e:
        logger.error(f"Error in auth config handler: {e}", exc_info=True)
        return response(500, {"error": str(e)})


def response(status_code: int, body: Any) -> Dict[str, Any]:
    """Build API Gateway response."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,OPTIONS",
        },
        "body": json.dumps(body),
    }
