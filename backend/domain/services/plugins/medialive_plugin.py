# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
AWS MediaLive Schedule Action Plugin.

Supports all 17 MediaLive schedule action types via modular builders and validators.
See medialive_builders.py for action construction and medialive_validators.py for validation.
"""

import boto3
from typing import Dict, Any, Optional, Tuple
from datetime import datetime
import logging

from domain.services.action_plugin import ActionPlugin
from domain.models.external_actions import ActionResult
from domain.services.timestamp_validator import (
    validate_and_normalize_timestamp,
    validate_timestamp_temporal,
)
from domain.services.plugins.medialive_builders import ACTION_BUILDERS
from domain.services.plugins.medialive_validators import ACTION_VALIDATORS

logger = logging.getLogger(__name__)

# All supported schedule action types
VALID_ACTION_TYPES = list(ACTION_BUILDERS.keys())

# Cleanup pairs: activate -> deactivate
CLEANUP_MAP = {
    "static_image_activate": "static_image_deactivate",
    "static_image_output_activate": "static_image_output_deactivate",
    "motion_graphics_activate": "motion_graphics_deactivate",
}


class MediaLiveActionPlugin(ActionPlugin):
    """Plugin for all AWS MediaLive Schedule Actions."""

    @property
    def action_type(self) -> str:
        return "medialive_schedule_action"

    @property
    def config_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "required": ["channel_id", "region", "schedule_action_type"],
            "properties": {
                "channel_id": {"type": "string"},
                "region": {"type": "string"},
                "schedule_action_type": {"type": "string", "enum": VALID_ACTION_TYPES},
                "action_settings": {"type": "object"},
            },
        }

    # --------------------------------------------------------------------- #
    # Validation
    # --------------------------------------------------------------------- #

    def validate_config(self, config: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        for field in ("channel_id", "region", "schedule_action_type"):
            if field not in config:
                return False, f"Missing required field: {field}"

        action_type = config["schedule_action_type"]
        if action_type not in ACTION_VALIDATORS:
            return False, f"Unknown schedule_action_type: {action_type}"

        settings = config.get("action_settings", {})
        return ACTION_VALIDATORS[action_type](settings)

    # --------------------------------------------------------------------- #
    # Execution
    # --------------------------------------------------------------------- #

    async def execute(
        self,
        config: Dict[str, Any],
        signal_data: Dict[str, Any],
        channel_id: str,
        credentials: Dict[str, Any],
    ) -> ActionResult:
        try:
            client = self._create_client(config, credentials)

            try:
                schedule_action = self._build_schedule_action(config, signal_data)
            except ValueError as e:
                logger.error(f"Build failed: {e}")
                return ActionResult(success=False, message=str(e), error=e)

            logger.info(
                f"Creating schedule action {schedule_action['ActionName']} "
                f"({config['schedule_action_type']}) on channel {config['channel_id']}"
            )

            response = client.batch_update_schedule(
                ChannelId=config["channel_id"],
                Creates={"ScheduleActions": [schedule_action]},
            )

            return ActionResult(
                success=True,
                message=f"Action created: {schedule_action['ActionName']}",
                response_data=response,
            )

        except Exception as e:
            return self._handle_error(e, config, signal_data)

    # --------------------------------------------------------------------- #
    # Cleanup
    # --------------------------------------------------------------------- #

    def supports_cleanup(self) -> bool:
        return True

    async def execute_cleanup(
        self,
        config: Dict[str, Any],
        original_signal: Dict[str, Any],
        cleanup_signal: Dict[str, Any],
        channel_id: str,
        credentials: Dict[str, Any],
    ) -> ActionResult:
        cleanup_type = CLEANUP_MAP.get(config["schedule_action_type"])
        if not cleanup_type:
            return ActionResult(
                success=False,
                message=f"No cleanup for {config['schedule_action_type']}",
            )

        cleanup_config = {**config, "schedule_action_type": cleanup_type}
        return await self.execute(
            cleanup_config, cleanup_signal, channel_id, credentials
        )

    # --------------------------------------------------------------------- #
    # Rate limit
    # --------------------------------------------------------------------- #

    def get_rate_limit(self) -> Optional[Tuple[int, int]]:
        return (5, 1)  # 5 requests per second

    # --------------------------------------------------------------------- #
    # Private helpers
    # --------------------------------------------------------------------- #

    def _create_client(self, config: Dict[str, Any], credentials: Dict[str, Any]):
        kwargs: Dict[str, Any] = {"region_name": config["region"]}
        for key in ("aws_access_key_id", "aws_secret_access_key", "aws_session_token"):
            if credentials.get(key):
                kwargs[key] = credentials[key]
        return boto3.client("medialive", **kwargs)

    def _build_schedule_action(
        self,
        config: Dict[str, Any],
        signal_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Build the complete MediaLive ScheduleAction dict."""
        action_type = config["schedule_action_type"]
        settings = config.get("action_settings", {})
        ts = int(datetime.utcnow().timestamp() * 1000)
        action_name = f"pois_{action_type}_{ts}"

        schedule_action: Dict[str, Any] = {"ActionName": action_name}

        # --- Start settings ---
        schedule_action["ScheduleActionStartSettings"] = self._build_start_settings(
            config
        )

        # --- Action settings ---
        builder = ACTION_BUILDERS.get(action_type)
        if not builder:
            raise ValueError(f"No builder for action type: {action_type}")
        schedule_action["ScheduleActionSettings"] = builder(settings)

        return schedule_action

    def _build_start_settings(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Build ScheduleActionStartSettings based on scheduling_mode."""
        mode = config.get("scheduling_mode", "immediate")

        if mode == "fixed":
            start_time = config.get("start_time")
            if start_time:
                is_valid, normalized, err = validate_and_normalize_timestamp(start_time)
                if not is_valid:
                    raise ValueError(f"Invalid start_time: {err}")
                is_ok, temporal_err, warn = validate_timestamp_temporal(normalized)
                if not is_ok:
                    raise ValueError(f"start_time out of range: {temporal_err}")
                if warn:
                    logger.warning(f"start_time temporal warning: {normalized}")
                logger.info(f"Using Fixed Mode: {normalized}")
                return {"FixedModeScheduleActionStartSettings": {"Time": normalized}}
            logger.warning("Fixed mode without start_time, falling back to Immediate")

        if mode == "follow":
            ref = config.get("reference_action_name")
            if ref:
                point = config.get("follow_point", "END")
                logger.info(f"Using Follow Mode: {ref} ({point})")
                return {
                    "FollowModeScheduleActionStartSettings": {
                        "ReferenceActionName": ref,
                        "FollowPoint": point,
                    }
                }
            logger.warning("Follow mode without reference, falling back to Immediate")

        logger.info("Using Immediate Mode")
        return {"ImmediateModeScheduleActionStartSettings": {}}

    def _handle_error(
        self,
        error: Exception,
        config: Dict[str, Any],
        signal_data: Dict[str, Any],
    ) -> ActionResult:
        """Centralised error handling with enhanced logging."""
        err_name = type(error).__name__
        err_msg = str(error)

        if "BadRequest" in err_name or "UnprocessableEntity" in err_name:
            logger.error(
                f"MediaLive rejected request: {err_msg}. "
                f"action_type={config.get('schedule_action_type')}, "
                f"channel={config.get('channel_id')}"
            )
            return ActionResult(
                success=False, message=f"MediaLive error: {err_msg}", error=error
            )

        if "TooManyRequests" in err_name:
            logger.warning(f"MediaLive rate limit: {err_msg}")
            return ActionResult(
                success=False,
                message="Rate limit exceeded",
                error=error,
                retry_after_seconds=60,
            )

        logger.error(f"MediaLive action failed: {err_msg}", exc_info=True)
        return ActionResult(
            success=False, message=f"Action failed: {err_msg}", error=error
        )
