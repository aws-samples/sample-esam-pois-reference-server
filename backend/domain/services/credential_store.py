# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Credential store abstraction for secure credential management.

This module provides interfaces and implementations for securely storing and
retrieving credentials for external actions.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import os
import logging

logger = logging.getLogger(__name__)


class CredentialStore(ABC):
    """Abstract base class for credential storage."""

    @abstractmethod
    async def get_credentials(self, credential_id: Optional[str]) -> Dict[str, Any]:
        """
        Retrieve credentials by ID.

        Args:
            credential_id: The credential identifier, or None for default credentials

        Returns:
            Dict[str, Any]: The credentials dictionary

        Raises:
            ValueError: If credentials are not found or invalid
        """
        pass

    @abstractmethod
    def sanitize_error(self, error_message: str, credentials: Dict[str, Any]) -> str:
        """
        Sanitize error message to remove credential values.

        Args:
            error_message: The original error message
            credentials: The credentials that might appear in the error

        Returns:
            str: Sanitized error message
        """
        pass


class CachedCredentialStore(CredentialStore):
    """
    Credential store with caching support.

    This wrapper adds TTL-based caching to any credential store implementation.
    """

    def __init__(self, underlying_store: CredentialStore, ttl_seconds: int = 300):
        """
        Initialize cached credential store.

        Args:
            underlying_store: The underlying credential store
            ttl_seconds: Time-to-live for cached credentials (default: 5 minutes)
        """
        self.underlying_store = underlying_store
        self.ttl_seconds = ttl_seconds
        self._cache: Dict[str, tuple[Dict[str, Any], datetime]] = {}
        logger.info(f"Initialized cached credential store with TTL={ttl_seconds}s")

    async def get_credentials(self, credential_id: Optional[str]) -> Dict[str, Any]:
        """
        Get credentials with caching.

        Args:
            credential_id: The credential identifier

        Returns:
            Dict[str, Any]: The credentials dictionary
        """
        cache_key = credential_id or "__default__"

        # Check cache
        if cache_key in self._cache:
            credentials, cached_at = self._cache[cache_key]
            if datetime.utcnow() - cached_at < timedelta(seconds=self.ttl_seconds):
                logger.debug(f"Returning cached credentials for: {cache_key}")
                return credentials
            else:
                # Cache expired
                del self._cache[cache_key]
                logger.debug(f"Cache expired for: {cache_key}")

        # Fetch from underlying store
        credentials = await self.underlying_store.get_credentials(credential_id)

        # Cache the result
        self._cache[cache_key] = (credentials, datetime.utcnow())
        logger.debug(f"Cached credentials for: {cache_key}")

        return credentials

    def sanitize_error(self, error_message: str, credentials: Dict[str, Any]) -> str:
        """Delegate to underlying store."""
        return self.underlying_store.sanitize_error(error_message, credentials)

    def clear_cache(self, credential_id: Optional[str] = None) -> None:
        """
        Clear cached credentials.

        Args:
            credential_id: Specific credential to clear, or None to clear all
        """
        if credential_id is None:
            self._cache.clear()
            logger.info("Cleared all cached credentials")
        else:
            cache_key = credential_id or "__default__"
            if cache_key in self._cache:
                del self._cache[cache_key]
                logger.info(f"Cleared cached credentials for: {cache_key}")


class EnvironmentCredentialStore(CredentialStore):
    """
    Credential store that reads from environment variables.

    This is the simplest implementation, suitable for development and testing.
    """

    def __init__(self, prefix: str = "POIS_CRED_"):
        """
        Initialize environment credential store.

        Args:
            prefix: Prefix for environment variable names
        """
        self.prefix = prefix
        logger.info(f"Initialized environment credential store with prefix: {prefix}")

    async def get_credentials(self, credential_id: Optional[str]) -> Dict[str, Any]:
        """
        Get credentials from environment variables.

        Environment variables should be named: {prefix}{credential_id}_{key}
        Example: POIS_CRED_AWS_ACCESS_KEY_ID, POIS_CRED_AWS_SECRET_ACCESS_KEY

        Args:
            credential_id: The credential identifier (e.g., "AWS", "WEBHOOK")

        Returns:
            Dict[str, Any]: The credentials dictionary

        Raises:
            ValueError: If no credentials found for the given ID
        """
        if credential_id is None:
            credential_id = "DEFAULT"

        # Build environment variable prefix
        env_prefix = f"{self.prefix}{credential_id.upper()}_"

        # Collect all matching environment variables
        credentials = {}
        for key, value in os.environ.items():
            if key.startswith(env_prefix):
                # Remove prefix and convert to lowercase
                cred_key = key[len(env_prefix) :].lower()
                credentials[cred_key] = value

        if not credentials:
            error_msg = f"No credentials found for ID: {credential_id}"
            logger.error(error_msg)
            raise ValueError(error_msg)

        logger.debug(f"Retrieved credentials for: {credential_id}")
        return credentials

    def sanitize_error(self, error_message: str, credentials: Dict[str, Any]) -> str:
        """
        Remove credential values from error message.

        Args:
            error_message: The original error message
            credentials: The credentials that might appear in the error

        Returns:
            str: Sanitized error message
        """
        sanitized = error_message

        # Replace each credential value with [REDACTED]
        for key, value in credentials.items():
            if value and isinstance(value, str):
                sanitized = sanitized.replace(value, "[REDACTED]")

        return sanitized


class IAMRoleCredentialStore(CredentialStore):
    """
    Credential store that uses AWS IAM roles.

    This implementation retrieves temporary credentials from the EC2 instance
    metadata service or ECS task role.
    """

    def __init__(self):
        """Initialize IAM role credential store."""
        logger.info("Initialized IAM role credential store")

    async def get_credentials(self, credential_id: Optional[str]) -> Dict[str, Any]:
        """
        Get credentials from IAM role.

        This uses boto3's default credential chain, which automatically
        retrieves credentials from IAM roles.

        Args:
            credential_id: Ignored for IAM role credentials

        Returns:
            Dict[str, Any]: Empty dict (boto3 handles credentials automatically)
        """
        # For IAM roles, we return an empty dict because boto3 will
        # automatically use the instance/task role credentials
        logger.debug("Using IAM role credentials (boto3 default)")
        return {}

    def sanitize_error(self, error_message: str, credentials: Dict[str, Any]) -> str:
        """
        Sanitize error message.

        For IAM roles, there are no explicit credentials to redact.
        """
        return error_message


def create_credential_store(
    store_type: str = "environment", cache_ttl: int = 300, **kwargs
) -> CredentialStore:
    """
    Factory function to create a credential store.

    Args:
        store_type: Type of store ("environment", "iam_role")
        cache_ttl: Cache TTL in seconds (0 to disable caching)
        **kwargs: Additional arguments for the store

    Returns:
        CredentialStore: The configured credential store
    """
    if store_type == "environment":
        store = EnvironmentCredentialStore(**kwargs)
    elif store_type == "iam_role":
        store = IAMRoleCredentialStore()
    else:
        raise ValueError(f"Unknown credential store type: {store_type}")

    # Wrap with caching if TTL > 0
    if cache_ttl > 0:
        store = CachedCredentialStore(store, ttl_seconds=cache_ttl)

    return store


class InMemoryCredentialStore(CredentialStore):
    """
    In-memory credential store for testing.

    This implementation stores credentials in memory and is suitable
    for unit tests and development.
    """

    def __init__(self):
        """Initialize in-memory credential store."""
        self._credentials: Dict[str, Dict[str, Any]] = {}
        logger.info("Initialized in-memory credential store")

    async def store_credentials(
        self, credential_id: str, credentials: Dict[str, Any]
    ) -> None:
        """
        Store credentials in memory.

        Args:
            credential_id: The credential identifier
            credentials: The credentials dictionary
        """
        self._credentials[credential_id] = credentials
        logger.debug(f"Stored credentials for: {credential_id}")

    async def get_credentials(self, credential_id: Optional[str]) -> Dict[str, Any]:
        """
        Get credentials from memory.

        Args:
            credential_id: The credential identifier

        Returns:
            Dict[str, Any]: The credentials dictionary

        Raises:
            ValueError: If credentials not found
        """
        if credential_id is None:
            credential_id = "default"

        if credential_id not in self._credentials:
            error_msg = f"No credentials found for ID: {credential_id}"
            logger.error(error_msg)
            raise ValueError(error_msg)

        logger.debug(f"Retrieved credentials for: {credential_id}")
        return self._credentials[credential_id]

    def sanitize_error(self, error_message: str, credentials: Dict[str, Any]) -> str:
        """
        Remove credential values from error message.

        Args:
            error_message: The original error message
            credentials: The credentials that might appear in the error

        Returns:
            str: Sanitized error message
        """
        sanitized = error_message

        # Replace each credential value with [REDACTED]
        for key, value in credentials.items():
            if value and isinstance(value, str):
                sanitized = sanitized.replace(value, "[REDACTED]")

        return sanitized

    def clear(self) -> None:
        """Clear all stored credentials."""
        self._credentials.clear()
        logger.info("Cleared all in-memory credentials")
