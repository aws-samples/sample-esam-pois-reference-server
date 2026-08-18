# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Service for managing audit log retention and cleanup.

This module provides automated cleanup of old audit logs based on
configurable retention policies.
"""

from datetime import datetime, timedelta
import asyncio
import logging

from domain.repositories.action_audit_repository import ActionAuditRepository

logger = logging.getLogger(__name__)


class AuditRetentionService:
    """Service for managing audit log retention."""

    def __init__(self, repository: ActionAuditRepository, retention_days: int = 30):
        """
        Initialize the audit retention service.

        Args:
            repository: The audit log repository
            retention_days: Number of days to retain audit logs (default: 30)
        """
        self.repository = repository
        self.retention_days = retention_days

    async def cleanup_old_logs(self) -> int:
        """
        Delete audit logs older than the retention period.

        Returns:
            Number of entries deleted
        """
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=self.retention_days)

            logger.info(
                f"Starting audit log cleanup for entries before {cutoff_date.isoformat()}"
            )

            deleted_count = await self.repository.delete_old_entries(cutoff_date)

            logger.info(
                f"Audit log cleanup completed. Deleted {deleted_count} entries."
            )

            return deleted_count

        except Exception as e:
            logger.error(f"Failed to cleanup old audit logs: {str(e)}", exc_info=True)
            raise

    async def run_periodic_cleanup(self, interval_hours: int = 24) -> None:
        """
        Run periodic cleanup of old audit logs.

        This method runs indefinitely, performing cleanup at the specified interval.
        Intended to be run as a background task.

        Args:
            interval_hours: Hours between cleanup runs (default: 24)
        """
        logger.info(
            f"Starting periodic audit log cleanup (every {interval_hours} hours, "
            f"retention: {self.retention_days} days)"
        )

        while True:
            try:
                await self.cleanup_old_logs()
            except Exception as e:
                logger.error(f"Periodic cleanup failed: {str(e)}", exc_info=True)

            # Wait for next cleanup cycle
            await asyncio.sleep(interval_hours * 3600)

    def get_retention_cutoff_date(self) -> datetime:
        """
        Get the cutoff date for retention.

        Returns:
            The datetime before which logs should be deleted
        """
        return datetime.utcnow() - timedelta(days=self.retention_days)

    def set_retention_days(self, days: int) -> None:
        """
        Update the retention period.

        Args:
            days: New retention period in days
        """
        if days < 1:
            raise ValueError("Retention days must be at least 1")

        logger.info(
            f"Updating audit log retention from {self.retention_days} to {days} days"
        )
        self.retention_days = days
