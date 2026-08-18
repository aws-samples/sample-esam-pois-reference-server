# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Structured logging for Lambda functions."""

import json
import logging
import uuid
from datetime import datetime
from typing import Optional, Dict, Any


def generate_correlation_id() -> str:
    """Generate a unique correlation ID."""
    return str(uuid.uuid4())


class StructuredLogger:
    """
    Structured logger that outputs JSON-formatted logs.

    Includes correlation ID support and context fields for debugging.
    """

    def __init__(
        self, name: str, correlation_id: Optional[str] = None, level: str = "INFO"
    ):
        """
        Initialize structured logger.

        Args:
            name: Logger name
            correlation_id: Optional correlation ID for request tracking
            level: Log level (DEBUG, INFO, WARN, ERROR)
        """
        self.logger = logging.getLogger(name)
        self.correlation_id = correlation_id or generate_correlation_id()
        self.set_level(level)

        # Configure JSON formatter if not already configured
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            handler.setFormatter(JsonFormatter())
            self.logger.addHandler(handler)
            self.logger.propagate = False

    def set_level(self, level: str) -> None:
        """Set log level."""
        level_map = {
            "DEBUG": logging.DEBUG,
            "INFO": logging.INFO,
            "WARN": logging.WARNING,
            "WARNING": logging.WARNING,
            "ERROR": logging.ERROR,
            "CRITICAL": logging.CRITICAL,
        }
        self.logger.setLevel(level_map.get(level.upper(), logging.INFO))

    def debug(self, message: str, **context: Any) -> None:
        """Log debug message."""
        self._log(logging.DEBUG, message, context)

    def info(self, message: str, **context: Any) -> None:
        """Log info message."""
        self._log(logging.INFO, message, context)

    def warn(self, message: str, **context: Any) -> None:
        """Log warning message."""
        self._log(logging.WARNING, message, context)

    def warning(self, message: str, **context: Any) -> None:
        """Log warning message."""
        self._log(logging.WARNING, message, context)

    def error(self, message: str, **context: Any) -> None:
        """Log error message."""
        self._log(logging.ERROR, message, context)

    def _log(self, level: int, message: str, context: Dict[str, Any]) -> None:
        """
        Internal log method that adds correlation ID and context.

        Args:
            level: Log level
            message: Log message
            context: Additional context fields
        """
        # Add correlation ID to context
        log_context = {"correlationId": self.correlation_id, **context}

        # Log with extra context
        self.logger.log(level, message, extra=log_context)


class JsonFormatter(logging.Formatter):
    """
    JSON formatter for structured logging.

    Outputs logs in JSON format with timestamp, level, message, and context fields.
    """

    # Standard fields extracted from LogRecord extra dict.
    # Order matters - this defines the JSON field order.
    _KNOWN_FIELDS = [
        "correlationId",
        "channelId",
        "commandType",
        "action",
        "ruleId",
        "processingTimeMs",
        "xml",
        "scte35Binary",
        "error",
        # External actions
        "actionId",
        "actionType",
        "dryRun",
        "durationMs",
        "retryCount",
        "actionsCount",
        "actionsSucceeded",
        "actionsFailed",
        # Rule evaluation
        "matched",
        "matchedRuleId",
        "channelName",
        "rulesCount",
        # Signal details
        "modificationsCount",
        "details",
        # Audit trail
        "performedBy",
        "targetId",
        "targetType",
        "requestData",
    ]

    # LogRecord internal attributes to exclude from extra fields
    _INTERNAL_ATTRS = frozenset(
        {
            "name",
            "msg",
            "args",
            "created",
            "filename",
            "funcName",
            "levelname",
            "levelno",
            "lineno",
            "module",
            "msecs",
            "message",
            "pathname",
            "process",
            "processName",
            "relativeCreated",
            "thread",
            "threadName",
            "exc_info",
            "exc_text",
            "stack_info",
            "taskName",
        }
    )

    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON with standardized field order."""

        log_data: Dict[str, Any] = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "message": record.getMessage(),
        }

        # Extract known fields in consistent order
        for field in self._KNOWN_FIELDS:
            val = getattr(record, field, None)
            if val is not None:
                log_data[field] = val

        # Add exception info
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        # Capture any remaining extra fields not in known list
        skip = self._INTERNAL_ATTRS | set(self._KNOWN_FIELDS)
        for key, value in record.__dict__.items():
            if key not in skip and not key.startswith("_"):
                log_data[key] = value

        return json.dumps(log_data, default=str)


def configure_logging(level: str = "INFO") -> None:
    """
    Configure root logger for structured logging.

    Args:
        level: Log level (DEBUG, INFO, WARN, ERROR)
    """
    root_logger = logging.getLogger()

    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Add JSON formatter handler
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root_logger.addHandler(handler)

    # Set level
    level_map = {
        "DEBUG": logging.DEBUG,
        "INFO": logging.INFO,
        "WARN": logging.WARNING,
        "WARNING": logging.WARNING,
        "ERROR": logging.ERROR,
        "CRITICAL": logging.CRITICAL,
    }
    root_logger.setLevel(level_map.get(level.upper(), logging.INFO))
