# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Action executor for executing external actions asynchronously.

This module provides the core service for executing external actions,
including retry logic, rate limiting, idempotency, and state management.
"""

from typing import List, Dict, Any, Optional
import asyncio
import random
import logging
from datetime import datetime, timedelta

from domain.models.external_actions import ExternalAction, ActionResult, TriggerMode
from domain.services.plugin_registry import PluginRegistry
from domain.services.credential_store import CredentialStore
from domain.services.rate_limiter import RateLimiterManager

logger = logging.getLogger(__name__)


class ActionExecutor:
    """Executes external actions asynchronously."""

    def __init__(
        self,
        plugin_registry: PluginRegistry,
        credential_store: CredentialStore,
        state_manager: Optional[Any] = None,
        audit_logger: Optional[Any] = None,
        metrics_emitter: Optional[Any] = None,
        rate_limiter: Optional[RateLimiterManager] = None,
    ):
        """
        Initialize the action executor.

        Args:
            plugin_registry: Registry of action plugins
            credential_store: Store for retrieving credentials
            state_manager: Manager for action state (optional)
            audit_logger: Logger for audit trails (optional)
            metrics_emitter: Emitter for metrics (optional)
            rate_limiter: Rate limiter manager for throttling actions (optional)
        """
        self.registry = plugin_registry
        self.credentials = credential_store
        self.state_manager = state_manager
        self.audit_logger = audit_logger
        self.metrics_emitter = metrics_emitter
        self.rate_limiter = rate_limiter
        self._idempotency_cache: Dict[str, datetime] = {}
        logger.info("Action executor initialized")

    async def execute_actions(
        self,
        actions: List[Any],  # Can be ExternalAction objects or dicts
        signal_data: Dict[str, Any],
        channel_id: str,
        dry_run: bool = False,
        rule_id: str = "unknown",
    ) -> List[ActionResult]:
        """
        Execute a list of actions in order, respecting blocking behavior.

        Args:
            actions: List of actions (ExternalAction objects or dicts)
            signal_data: SCTE-35 signal data that triggered the actions
            channel_id: Channel ID for context
            dry_run: If True, validate but don't execute

        Returns:
            List[ActionResult]: Results of action executions
        """
        logger.info(
            f"Executing {len(actions)} actions for channel {channel_id} "
            f"(dry_run={dry_run})"
        )

        # Convert dicts to ExternalAction objects if needed
        action_objects = []
        for action in actions:
            if isinstance(action, dict):
                # Convert camelCase keys to snake_case for dataclass
                # Also convert Decimal to int/float
                from decimal import Decimal

                def convert_decimal(val):
                    """Convert Decimal to int or float."""
                    if isinstance(val, Decimal):
                        return int(val) if val % 1 == 0 else float(val)
                    return val

                converted = {
                    "action_id": action.get("actionId"),
                    "action_type": action.get("actionType"),
                    "target": action.get("target", {}),
                    "trigger_mode": TriggerMode(action.get("triggerMode", "on_match")),
                    "action_config": action.get("actionConfig", {}),
                    "cleanup_config": action.get("cleanupConfig"),
                    "retry_config": action.get("retryConfig"),
                    "timeout_ms": convert_decimal(action.get("timeoutMs", 5000)),
                    "enabled": action.get("enabled", True),
                    "conditions": action.get("conditions"),
                    "order": convert_decimal(action.get("order", 0)),
                    "blocking": action.get("blocking", False),
                }
                action_obj = ExternalAction(**converted)
                action_objects.append(action_obj)
            else:
                action_objects.append(action)

        # Sort actions by order
        sorted_actions = sorted(action_objects, key=lambda a: a.order)

        results = []
        pending_tasks = []

        for action in sorted_actions:
            # Check if action should execute
            if not self._should_execute(action, signal_data, channel_id):
                logger.info(f"Skipping action {action.action_id} (conditions not met)")
                continue

            # Execute with retry logic
            if action.blocking:
                # Blocking: wait for completion
                result = await self._execute_with_retry(
                    action, signal_data, channel_id, dry_run, rule_id
                )
                results.append(result)

                # If blocking action fails, skip remaining actions
                if not result.success:
                    logger.warning(
                        f"Blocking action {action.action_id} failed, "
                        f"skipping remaining actions"
                    )
                    break
            else:
                # Non-blocking: create task and track it
                task = asyncio.create_task(
                    self._execute_and_store(
                        action, signal_data, channel_id, dry_run, results, rule_id
                    )
                )
                pending_tasks.append(task)

        # Wait for all non-blocking tasks to complete
        if pending_tasks:
            await asyncio.gather(*pending_tasks, return_exceptions=True)

        logger.info(
            f"Completed execution: {sum(1 for r in results if r.success)} succeeded, "
            f"{sum(1 for r in results if not r.success)} failed"
        )

        return results

    async def _execute_and_store(
        self,
        action: ExternalAction,
        signal_data: Dict[str, Any],
        channel_id: str,
        dry_run: bool,
        results: List[ActionResult],
        rule_id: str = "unknown",
    ) -> None:
        """Execute action and store result (for non-blocking actions)."""
        result = await self._execute_with_retry(
            action, signal_data, channel_id, dry_run, rule_id
        )
        results.append(result)

    async def _execute_with_retry(
        self,
        action: ExternalAction,
        signal_data: Dict[str, Any],
        channel_id: str,
        dry_run: bool,
        rule_id: str = "unknown",
    ) -> ActionResult:
        """
        Execute action with exponential backoff retry.

        Args:
            action: The action to execute
            signal_data: Signal data
            channel_id: Channel ID
            dry_run: If True, simulate execution

        Returns:
            ActionResult: Result of the execution
        """
        plugin = self.registry.get(action.action_type)
        if not plugin:
            error_msg = f"Unknown action type: {action.action_type}"
            logger.error(error_msg)
            return ActionResult(success=False, message=error_msg)

        max_retries = action.retry_config.get("max_retries", 3)
        base_delay = action.retry_config.get("base_delay_seconds", 1)

        for attempt in range(max_retries + 1):
            try:
                logger.debug(
                    f"Executing action {action.action_id} "
                    f"(attempt {attempt + 1}/{max_retries + 1})"
                )

                # Check rate limit
                if self.rate_limiter:
                    allowed = await self.rate_limiter.try_acquire(action.action_type)
                    if not allowed:
                        logger.warning(
                            f"Rate limit exceeded for action {action.action_id} "
                            f"(type: {action.action_type})"
                        )
                        if self.metrics_emitter:
                            self.metrics_emitter.emit_rate_limit_metric(
                                action_type=action.action_type,
                                channel_id=channel_id,
                                delay_seconds=0.0,
                            )
                        return ActionResult(
                            success=False, message="Rate limit exceeded"
                        )

                # Get credentials
                creds = await self.credentials.get_credentials(
                    action.target.get("credential_id")
                )

                # Execute
                start_time = datetime.utcnow()
                if dry_run:
                    result = self._simulate_execution(action, signal_data)
                else:
                    result = await asyncio.wait_for(
                        plugin.execute(
                            config=action.action_config,
                            signal_data=signal_data,
                            channel_id=channel_id,
                            credentials=creds,
                        ),
                        timeout=action.timeout_ms / 1000,
                    )

                duration_ms = int(
                    (datetime.utcnow() - start_time).total_seconds() * 1000
                )

                # Log and emit metrics
                if self.audit_logger:
                    try:
                        await self.audit_logger.log_execution(
                            channel_id=channel_id,
                            rule_id=rule_id,
                            action=action,
                            signal_data=signal_data,
                            result=result,
                            retry_count=attempt,
                            duration_ms=duration_ms,
                        )
                    except Exception as audit_err:
                        logger.error(
                            f"Failed to save audit log (non-fatal): {audit_err}"
                        )

                if self.metrics_emitter:
                    self.metrics_emitter.emit_action_metric(
                        action_type=action.action_type,
                        channel_id=channel_id,
                        success=result.success,
                        duration_ms=duration_ms,
                        retry_count=attempt,
                    )

                if result.success:
                    logger.info(f"Action {action.action_id} succeeded")
                    return result

                # Check if we should retry
                if not self._should_retry(result, attempt, max_retries):
                    logger.warning(
                        f"Action {action.action_id} failed, not retrying: {result.message}"
                    )
                    return result

                # Calculate backoff delay with jitter
                delay = base_delay * (2**attempt) + random.uniform(0, 1)
                logger.info(
                    f"Action {action.action_id} failed, retrying in {delay:.2f}s"
                )
                await asyncio.sleep(delay)

            except asyncio.TimeoutError:
                error_msg = f"Action timed out after {action.timeout_ms}ms"
                logger.error(f"Action {action.action_id}: {error_msg}")
                if attempt == max_retries:
                    return ActionResult(success=False, message=error_msg)
            except Exception as e:
                error_msg = f"Action failed: {str(e)}"
                logger.error(f"Action {action.action_id}: {error_msg}", exc_info=True)
                if attempt == max_retries:
                    return ActionResult(success=False, message=error_msg, error=e)

        return ActionResult(success=False, message="Max retries exceeded")

    def _should_execute(
        self, action: ExternalAction, signal_data: Dict[str, Any], channel_id: str
    ) -> bool:
        """
        Check if action should execute based on conditions.

        Args:
            action: The action to check
            signal_data: Signal data
            channel_id: Channel ID

        Returns:
            bool: True if action should execute
        """
        # Check if enabled
        if not action.enabled:
            logger.debug(f"Action {action.action_id} is disabled")
            return False

        # Check idempotency
        plugin = self.registry.get(action.action_type)
        if plugin:
            idem_key = plugin.get_idempotency_key(
                action.action_config, signal_data, channel_id
            )
            if idem_key in self._idempotency_cache:
                # Check if still within idempotency window
                cached_time = self._idempotency_cache[idem_key]
                window_seconds = action.action_config.get(
                    "idempotency_window_seconds", 60
                )
                window = timedelta(seconds=window_seconds)

                if datetime.utcnow() - cached_time < window:
                    logger.info(
                        f"Action {action.action_id} skipped due to idempotency "
                        f"(key: {idem_key[:8]}...)"
                    )
                    return False

            # Store idempotency key
            self._idempotency_cache[idem_key] = datetime.utcnow()

        # Check conditional execution
        if action.conditions:
            return self._evaluate_conditions(action.conditions, signal_data)

        return True

    def _evaluate_conditions(
        self, conditions: List[Dict[str, Any]], signal_data: Dict[str, Any]
    ) -> bool:
        """
        Evaluate conditional execution rules.

        Args:
            conditions: List of conditions to evaluate
            signal_data: Signal data to evaluate against

        Returns:
            bool: True if all conditions are met
        """
        for condition in conditions:
            field = condition.get("field")
            operator = condition.get("operator")
            expected_value = condition.get("value")

            # Get actual value from signal data
            actual_value = signal_data.get(field)

            # Evaluate condition with type safety
            try:
                if operator == "eq" and actual_value != expected_value:
                    logger.debug(
                        f"Condition failed: {field} {operator} {expected_value}"
                    )
                    return False
                elif operator == "ne" and actual_value == expected_value:
                    logger.debug(
                        f"Condition failed: {field} {operator} {expected_value}"
                    )
                    return False
                elif operator == "gt":
                    # Type check for comparison operators
                    if not isinstance(actual_value, (int, float)) or not isinstance(
                        expected_value, (int, float)
                    ):
                        logger.debug(
                            f"Condition failed: {field} {operator} {expected_value} (type mismatch)"
                        )
                        return False
                    if not (actual_value > expected_value):
                        logger.debug(
                            f"Condition failed: {field} {operator} {expected_value}"
                        )
                        return False
                elif operator == "lt":
                    # Type check for comparison operators
                    if not isinstance(actual_value, (int, float)) or not isinstance(
                        expected_value, (int, float)
                    ):
                        logger.debug(
                            f"Condition failed: {field} {operator} {expected_value} (type mismatch)"
                        )
                        return False
                    if not (actual_value < expected_value):
                        logger.debug(
                            f"Condition failed: {field} {operator} {expected_value}"
                        )
                        return False
                elif operator == "in":
                    # Type check for 'in' operator - expected_value should be iterable
                    if not isinstance(expected_value, (list, tuple, set, str)):
                        logger.debug(
                            f"Condition failed: {field} {operator} {expected_value} (expected_value not iterable)"
                        )
                        return False
                    if actual_value not in expected_value:
                        logger.debug(
                            f"Condition failed: {field} {operator} {expected_value}"
                        )
                        return False
            except (TypeError, ValueError) as e:
                logger.debug(
                    f"Condition evaluation error: {field} {operator} {expected_value}: {e}"
                )
                return False

        return True

    def _should_retry(
        self, result: ActionResult, attempt: int, max_retries: int
    ) -> bool:
        """
        Determine if we should retry based on the result.

        Args:
            result: The action result
            attempt: Current attempt number (0-indexed)
            max_retries: Maximum number of retries

        Returns:
            bool: True if should retry
        """
        if attempt >= max_retries:
            return False

        # Don't retry client errors (4xx)
        if result.error and hasattr(result.error, "status_code"):
            status_code = result.error.status_code
            if 400 <= status_code < 500:
                logger.debug(f"Not retrying client error: {status_code}")
                return False

        return True

    def _simulate_execution(
        self, action: ExternalAction, signal_data: Dict[str, Any]
    ) -> ActionResult:
        """
        Simulate action execution for dry-run mode.

        Args:
            action: The action to simulate
            signal_data: Signal data

        Returns:
            ActionResult: Simulated success result
        """
        logger.info(
            f"[DRY RUN] Would execute action {action.action_id} "
            f"of type {action.action_type}"
        )

        return ActionResult(
            success=True,
            message=f"[DRY RUN] Action {action.action_id} would be executed",
            response_data={
                "dry_run": True,
                "action_type": action.action_type,
                "signal_pts": signal_data.get("pts"),
            },
        )
