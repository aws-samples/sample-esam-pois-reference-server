# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Credential service for ESAM Basic Auth password management via SSM Parameter Store."""

import secrets
import time
from typing import Dict, Optional, Tuple

import boto3
from botocore.exceptions import ClientError


class CredentialService:
    """Manages ESAM encoder passwords in AWS SSM Parameter Store with in-memory caching."""

    CACHE_TTL = 60  # seconds

    def __init__(self, region: Optional[str] = None, ssm_client=None):
        # In Lambda, AWS_REGION is always set; boto3 resolves it (and any other
        # configured region) automatically when region_name is None.
        self.ssm = ssm_client or boto3.client("ssm", region_name=region)
        self._cache: Dict[str, Tuple[str, float]] = {}

    def generate_password(self) -> str:
        """Generate a random 32-character URL-safe password."""
        return secrets.token_urlsafe(24)

    def store_password(self, channel_id: str, password: str) -> str:
        """Store password as SSM SecureString. Returns the parameter path."""
        path = f"/pois/channels/{channel_id}/esam-password"
        self.ssm.put_parameter(
            Name=path,
            Value=password,
            Type="SecureString",
            Overwrite=True,
        )
        # Invalidate cache for this path
        self._cache.pop(path, None)
        return path

    def get_password(self, ssm_path: str) -> str:
        """Retrieve password from SSM with in-memory caching (60s TTL)."""
        cached = self._get_cached(ssm_path)
        if cached is not None:
            return cached

        resp = self.ssm.get_parameter(Name=ssm_path, WithDecryption=True)
        password = resp["Parameter"]["Value"]
        self._cache[ssm_path] = (password, time.time())
        return password

    def delete_password(self, ssm_path: str) -> None:
        """Delete password from SSM and clear cache."""
        try:
            self.ssm.delete_parameter(Name=ssm_path)
        except ClientError as e:
            if e.response["Error"]["Code"] != "ParameterNotFound":
                raise
        self._cache.pop(ssm_path, None)

    def _get_cached(self, ssm_path: str) -> Optional[str]:
        """Return cached password if present and not expired."""
        if ssm_path not in self._cache:
            return None
        password, timestamp = self._cache[ssm_path]
        if time.time() - timestamp > self.CACHE_TTL:
            del self._cache[ssm_path]
            return None
        return password
