# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Webhook action plugin.

This plugin enables calling arbitrary HTTP APIs when SCTE-35 signals are detected,
supporting various authentication methods and request customization.

Uses urllib.request (standard library) instead of aiohttp to avoid extra
Lambda layer dependencies. The async execute() signature is preserved for
compatibility with the ActionPlugin interface, but the HTTP call itself is
synchronous (acceptable in Lambda's single-request-per-invocation model).
"""

import urllib.request
import urllib.error
import base64
import ssl
from typing import Dict, Any, Optional, Tuple
import json
import logging
from datetime import datetime

from domain.services.action_plugin import ActionPlugin
from domain.models.external_actions import ActionResult

logger = logging.getLogger(__name__)

# Default timeout for webhook calls (seconds)
DEFAULT_TIMEOUT_SECONDS = 10


class WebhookActionPlugin(ActionPlugin):
    """Plugin for generic webhook calls."""

    @property
    def action_type(self) -> str:
        return "webhook"

    @property
    def config_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "required": ["url", "method"],
            "properties": {
                "url": {"type": "string", "format": "uri"},
                "method": {"type": "string", "enum": ["GET", "POST", "PUT", "DELETE"]},
                "headers": {"type": "object"},
                "body_template": {"type": "string"},
                "auth_type": {
                    "type": "string",
                    "enum": ["none", "basic", "bearer", "aws_sig_v4"],
                },
                "verify_ssl": {"type": "boolean", "default": True},
                "timeout_seconds": {
                    "type": "integer",
                    "default": DEFAULT_TIMEOUT_SECONDS,
                },
            },
        }

    def validate_config(self, config: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate webhook configuration."""
        if "url" not in config:
            return False, "Missing required field: url"
        if "method" not in config:
            return False, "Missing required field: method"

        if config["method"] not in ["GET", "POST", "PUT", "DELETE"]:
            return False, f"Invalid method: {config['method']}"

        # Validate auth_type if present
        if "auth_type" in config:
            valid_auth_types = ["none", "basic", "bearer", "aws_sig_v4"]
            if config["auth_type"] not in valid_auth_types:
                return False, f"Invalid auth_type: {config['auth_type']}"

        return True, None

    async def execute(
        self,
        config: Dict[str, Any],
        signal_data: Dict[str, Any],
        channel_id: str,
        credentials: Dict[str, Any],
    ) -> ActionResult:
        """
        Execute webhook call using urllib.request (standard library).

        The method is async to satisfy the ActionPlugin interface, but the
        underlying HTTP call is synchronous — this is fine for Lambda where
        each invocation handles a single request.
        """
        try:
            url = config["url"]
            method = config["method"]
            headers = config.get("headers", {}).copy()
            timeout_seconds = config.get("timeout_seconds", DEFAULT_TIMEOUT_SECONDS)
            verify_ssl = config.get("verify_ssl", True)

            # --- Authentication ---
            auth_type = config.get("auth_type", "none")

            if auth_type == "basic":
                username = credentials.get("username")
                password = credentials.get("password")
                if username and password:
                    basic_credentials = base64.b64encode(
                        f"{username}:{password}".encode("utf-8")
                    ).decode("utf-8")
                    headers["Authorization"] = f"Basic {basic_credentials}"
                else:
                    logger.warning("Basic auth configured but credentials missing")

            elif auth_type == "bearer":
                token = credentials.get("token")
                if token:
                    headers["Authorization"] = f"Bearer {token}"
                else:
                    logger.warning("Bearer auth configured but token missing")

            elif auth_type == "aws_sig_v4":
                # AWS SigV4 signing is complex and requires botocore internals.
                # For now, log a warning and skip auth — callers should use IAM
                # role-based auth via the Lambda execution role instead.
                logger.warning(
                    "aws_sig_v4 auth_type is not yet supported for webhook plugin. "
                    "Proceeding without authentication. Consider using IAM role-based "
                    "access or a different auth_type."
                )

            # --- Build body from template ---
            data = None
            if config.get("body_template") and method in ("POST", "PUT"):
                body = self._render_template(
                    config["body_template"], signal_data, channel_id
                )
                data = json.dumps(body).encode("utf-8")
                headers.setdefault("Content-Type", "application/json")

            # Log SSL warning if disabled
            if not verify_ssl:
                logger.warning(
                    f"SSL verification disabled for webhook: {url} "
                    "(SECURITY WARNING)"
                )

            logger.info(f"Calling webhook: {method} {url}")

            # --- Build and execute request ---
            req = urllib.request.Request(
                url=url, data=data, headers=headers, method=method
            )

            # SSL context
            ssl_context = None
            if not verify_ssl:
                ssl_context = ssl.create_default_context()
                ssl_context.check_hostname = False
                ssl_context.verify_mode = ssl.CERT_NONE

            response = urllib.request.urlopen(
                req, timeout=timeout_seconds, context=ssl_context
            )

            response_text = response.read().decode("utf-8")
            status_code = response.getcode()

            if 200 <= status_code < 300:
                logger.info(f"Webhook succeeded: {status_code}")
                return ActionResult(
                    success=True,
                    message=f"Webhook call succeeded: {status_code}",
                    response_data={"status": status_code, "body": response_text},
                )
            else:
                logger.warning(f"Webhook failed: {status_code}")
                return ActionResult(
                    success=False,
                    message=f"Webhook call failed: {status_code}",
                    response_data={"status": status_code, "body": response_text},
                )

        except urllib.error.HTTPError as e:
            error_body = ""
            try:
                error_body = e.read().decode("utf-8")
            except Exception:
                pass
            logger.warning(f"Webhook HTTP error: {e.code} - {error_body[:200]}")
            return ActionResult(
                success=False,
                message=f"Webhook call failed: HTTP {e.code}",
                response_data={"status": e.code, "body": error_body},
            )

        except urllib.error.URLError as e:
            logger.error(
                f"Webhook request failed (URL error): {e.reason}", exc_info=True
            )
            return ActionResult(
                success=False,
                message=f"Webhook request failed: {str(e.reason)}",
                error=e,
            )

        except Exception as e:
            logger.error(f"Webhook action failed: {e}", exc_info=True)
            return ActionResult(
                success=False, message=f"Webhook action failed: {str(e)}", error=e
            )

    def supports_cleanup(self) -> bool:
        return False

    def _render_template(
        self, template: str, signal_data: Dict[str, Any], channel_id: str
    ) -> Dict[str, Any]:
        """
        Render body template with signal data.

        Simple template rendering using string replacement.
        Supports {{channel_id}}, {{signal}}, {{timestamp}} placeholders.
        """
        context = {
            "channel_id": channel_id,
            "signal": signal_data,
            "timestamp": datetime.utcnow().isoformat(),
        }

        rendered = template
        for key, value in context.items():
            placeholder = f"{{{{{key}}}}}"
            if placeholder in rendered:
                rendered = rendered.replace(placeholder, json.dumps(value))

        try:
            return json.loads(rendered)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse template: {e}")
            # Return as-is if not valid JSON
            return {"raw": rendered}
