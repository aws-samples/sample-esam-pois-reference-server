# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
CloudWatch Metrics Emitter — Optional Production Feature

This module provides custom CloudWatch metrics emission for action execution.
To enable, set ENABLE_METRICS=true in Lambda environment variables and pass
a MetricsEmitter instance to the ActionExecutor.

Not enabled by default in the reference implementation.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class MetricsEmitter(ABC):
    """Abstract base class for metrics emission."""

    @abstractmethod
    def emit_action_metric(
        self,
        action_type: str,
        channel_id: str,
        success: bool,
        duration_ms: int,
        retry_count: int = 0,
        additional_dimensions: Optional[Dict[str, str]] = None,
    ) -> None:
        """
        Emit metrics for an action execution.

        Args:
            action_type: The type of action executed
            channel_id: The channel ID
            success: Whether the action succeeded
            duration_ms: Execution duration in milliseconds
            retry_count: Number of retries attempted
            additional_dimensions: Additional metric dimensions
        """
        pass

    @abstractmethod
    def emit_rate_limit_metric(
        self, action_type: str, channel_id: str, delay_seconds: float
    ) -> None:
        """
        Emit metrics for rate limiting events.

        Args:
            action_type: The type of action rate limited
            channel_id: The channel ID
            delay_seconds: Delay applied in seconds
        """
        pass


class CloudWatchMetricsEmitter(MetricsEmitter):
    """
    CloudWatch metrics emitter implementation.

    This implementation sends metrics to AWS CloudWatch.
    """

    def __init__(
        self, namespace: str = "POIS/ExternalActions", region: str = "us-east-1"
    ):
        """
        Initialize CloudWatch metrics emitter.

        Args:
            namespace: CloudWatch namespace for metrics
            region: AWS region
        """
        self.namespace = namespace
        self.region = region
        self._cloudwatch = None
        logger.info(f"Initialized CloudWatch metrics emitter (namespace: {namespace})")

    @property
    def cloudwatch(self):
        """Lazy-load CloudWatch client."""
        if self._cloudwatch is None:
            import boto3

            self._cloudwatch = boto3.client("cloudwatch", region_name=self.region)
        return self._cloudwatch

    def emit_action_metric(
        self,
        action_type: str,
        channel_id: str,
        success: bool,
        duration_ms: int,
        retry_count: int = 0,
        additional_dimensions: Optional[Dict[str, str]] = None,
    ) -> None:
        """
        Emit action execution metrics to CloudWatch.

        Emits the following metrics:
        - ActionExecutionCount: Count of executions
        - ActionSuccess: Count of successful executions
        - ActionFailure: Count of failed executions
        - ActionDuration: Execution duration in milliseconds
        - ActionRetries: Number of retries
        """
        try:
            dimensions = [
                {"Name": "ActionType", "Value": action_type},
                {"Name": "ChannelId", "Value": channel_id},
            ]

            if additional_dimensions:
                for key, value in additional_dimensions.items():
                    dimensions.append({"Name": key, "Value": value})

            timestamp = datetime.utcnow()

            metric_data = [
                # Execution count
                {
                    "MetricName": "ActionExecutionCount",
                    "Dimensions": dimensions,
                    "Value": 1,
                    "Unit": "Count",
                    "Timestamp": timestamp,
                },
                # Success/Failure
                {
                    "MetricName": "ActionSuccess" if success else "ActionFailure",
                    "Dimensions": dimensions,
                    "Value": 1,
                    "Unit": "Count",
                    "Timestamp": timestamp,
                },
                # Duration
                {
                    "MetricName": "ActionDuration",
                    "Dimensions": dimensions,
                    "Value": duration_ms,
                    "Unit": "Milliseconds",
                    "Timestamp": timestamp,
                },
            ]

            # Add retry count if > 0
            if retry_count > 0:
                metric_data.append(
                    {
                        "MetricName": "ActionRetries",
                        "Dimensions": dimensions,
                        "Value": retry_count,
                        "Unit": "Count",
                        "Timestamp": timestamp,
                    }
                )

            # Send to CloudWatch
            self.cloudwatch.put_metric_data(
                Namespace=self.namespace, MetricData=metric_data
            )

            logger.debug(
                f"Emitted metrics for {action_type} on {channel_id}: "
                f"success={success}, duration={duration_ms}ms, retries={retry_count}"
            )

        except Exception as e:
            # Don't fail action execution if metrics fail
            logger.error(f"Failed to emit action metrics: {str(e)}", exc_info=True)

    def emit_rate_limit_metric(
        self, action_type: str, channel_id: str, delay_seconds: float
    ) -> None:
        """
        Emit rate limiting metrics to CloudWatch.

        Emits the following metrics:
        - RateLimitDelay: Delay applied in seconds
        - RateLimitEvent: Count of rate limit events
        """
        try:
            dimensions = [
                {"Name": "ActionType", "Value": action_type},
                {"Name": "ChannelId", "Value": channel_id},
            ]

            timestamp = datetime.utcnow()

            metric_data = [
                {
                    "MetricName": "RateLimitEvent",
                    "Dimensions": dimensions,
                    "Value": 1,
                    "Unit": "Count",
                    "Timestamp": timestamp,
                },
                {
                    "MetricName": "RateLimitDelay",
                    "Dimensions": dimensions,
                    "Value": delay_seconds,
                    "Unit": "Seconds",
                    "Timestamp": timestamp,
                },
            ]

            self.cloudwatch.put_metric_data(
                Namespace=self.namespace, MetricData=metric_data
            )

            logger.debug(
                f"Emitted rate limit metrics for {action_type} on {channel_id}: "
                f"delay={delay_seconds}s"
            )

        except Exception as e:
            logger.error(f"Failed to emit rate limit metrics: {str(e)}", exc_info=True)


class InMemoryMetricsEmitter(MetricsEmitter):
    """
    In-memory metrics emitter for testing.

    This implementation stores metrics in memory for verification in tests.
    """

    def __init__(self):
        """Initialize in-memory metrics emitter."""
        self.action_metrics: list[Dict[str, Any]] = []
        self.rate_limit_metrics: list[Dict[str, Any]] = []
        logger.info("Initialized in-memory metrics emitter")

    def emit_action_metric(
        self,
        action_type: str,
        channel_id: str,
        success: bool,
        duration_ms: int,
        retry_count: int = 0,
        additional_dimensions: Optional[Dict[str, str]] = None,
    ) -> None:
        """Store action metrics in memory."""
        metric = {
            "action_type": action_type,
            "channel_id": channel_id,
            "success": success,
            "duration_ms": duration_ms,
            "retry_count": retry_count,
            "timestamp": datetime.utcnow(),
            "additional_dimensions": additional_dimensions or {},
        }
        self.action_metrics.append(metric)
        logger.debug(f"Stored action metric: {metric}")

    def emit_rate_limit_metric(
        self, action_type: str, channel_id: str, delay_seconds: float
    ) -> None:
        """Store rate limit metrics in memory."""
        metric = {
            "action_type": action_type,
            "channel_id": channel_id,
            "delay_seconds": delay_seconds,
            "timestamp": datetime.utcnow(),
        }
        self.rate_limit_metrics.append(metric)
        logger.debug(f"Stored rate limit metric: {metric}")

    def get_action_metrics(
        self, action_type: Optional[str] = None, channel_id: Optional[str] = None
    ) -> list[Dict[str, Any]]:
        """
        Get stored action metrics with optional filtering.

        Args:
            action_type: Filter by action type
            channel_id: Filter by channel ID

        Returns:
            List of matching metrics
        """
        metrics = self.action_metrics

        if action_type:
            metrics = [m for m in metrics if m["action_type"] == action_type]

        if channel_id:
            metrics = [m for m in metrics if m["channel_id"] == channel_id]

        return metrics

    def get_rate_limit_metrics(
        self, action_type: Optional[str] = None, channel_id: Optional[str] = None
    ) -> list[Dict[str, Any]]:
        """
        Get stored rate limit metrics with optional filtering.

        Args:
            action_type: Filter by action type
            channel_id: Filter by channel ID

        Returns:
            List of matching metrics
        """
        metrics = self.rate_limit_metrics

        if action_type:
            metrics = [m for m in metrics if m["action_type"] == action_type]

        if channel_id:
            metrics = [m for m in metrics if m["channel_id"] == channel_id]

        return metrics

    def clear(self) -> None:
        """Clear all stored metrics."""
        self.action_metrics.clear()
        self.rate_limit_metrics.clear()
        logger.info("Cleared all in-memory metrics")

    def get_success_count(
        self, action_type: Optional[str] = None, channel_id: Optional[str] = None
    ) -> int:
        """Get count of successful actions."""
        metrics = self.get_action_metrics(action_type, channel_id)
        return sum(1 for m in metrics if m["success"])

    def get_failure_count(
        self, action_type: Optional[str] = None, channel_id: Optional[str] = None
    ) -> int:
        """Get count of failed actions."""
        metrics = self.get_action_metrics(action_type, channel_id)
        return sum(1 for m in metrics if not m["success"])

    def get_total_duration(
        self, action_type: Optional[str] = None, channel_id: Optional[str] = None
    ) -> int:
        """Get total duration of all actions in milliseconds."""
        metrics = self.get_action_metrics(action_type, channel_id)
        return sum(m["duration_ms"] for m in metrics)

    def get_total_retries(
        self, action_type: Optional[str] = None, channel_id: Optional[str] = None
    ) -> int:
        """Get total number of retries across all actions."""
        metrics = self.get_action_metrics(action_type, channel_id)
        return sum(m["retry_count"] for m in metrics)
