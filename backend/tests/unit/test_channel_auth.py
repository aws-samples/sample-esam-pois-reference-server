# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Unit tests for channel_handler.py auth endpoints (Task 3)."""

import json
import os
import sys
from unittest.mock import MagicMock, patch

import pytest

from domain.models.channel import Channel

# ── Helpers ──────────────────────────────────────────────────────────


def _make_channel(
    channel_id="ch-1",
    auth_enabled=False,
    username=None,
    ssm_path=None,
):
    """Create a minimal Channel for testing."""
    auth = {"authEnabled": auth_enabled}
    if username:
        auth["username"] = username
    if ssm_path:
        auth["ssmParameterPath"] = ssm_path
    return Channel(
        channelId=channel_id,
        name="test-channel",
        defaultAction="noop",
        createdAt="2024-01-01T00:00:00Z",
        updatedAt="2024-01-01T00:00:00Z",
        authConfig=auth,
    )


def _admin_event(method="PUT", path="/channels/ch-1", channel_id="ch-1", body=None):
    """Build an API Gateway event with admin claims."""
    event = {
        "httpMethod": method,
        "path": path,
        "pathParameters": {"id": channel_id} if channel_id else {},
        "requestContext": {
            "authorizer": {
                "claims": {
                    "sub": "admin-sub",
                    "email": "admin@example.com",
                    "cognito:groups": "admin",
                }
            }
        },
        "body": json.dumps(body) if body else None,
    }
    return event


def _non_admin_event(
    method="POST", path="/channels/ch-1/auth/regenerate", channel_id="ch-1"
):
    """Build an API Gateway event without admin group."""
    return {
        "httpMethod": method,
        "path": path,
        "pathParameters": {"id": channel_id} if channel_id else {},
        "requestContext": {
            "authorizer": {
                "claims": {
                    "sub": "user-sub",
                    "email": "user@example.com",
                    "cognito:groups": "viewer",
                }
            }
        },
        "body": None,
    }


# ── Patch boto3 before importing channel_handler ─────────────────────

_mock_boto3 = MagicMock()
_mock_table = MagicMock()
_mock_boto3.resource.return_value.Table.return_value = _mock_table


@pytest.fixture(autouse=True, scope="session")
def _set_aws_env():
    os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")
    os.environ.setdefault("AWS_ACCESS_KEY_ID", "testing")
    os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "testing")


# Remove cached modules so we can re-import with mocks
for mod_name in list(sys.modules.keys()):
    if "channel_handler" in mod_name and "test_" not in mod_name:
        del sys.modules[mod_name]

with patch.dict(
    os.environ,
    {
        "AWS_DEFAULT_REGION": "us-east-1",
        "AWS_ACCESS_KEY_ID": "testing",
        "AWS_SECRET_ACCESS_KEY": "testing",
    },
):
    with patch("domain.repositories.channel_repository.boto3", _mock_boto3):
        with patch("domain.services.credential_service.boto3", _mock_boto3):
            from handlers.channel_handler import (
                handler,
            )


# ── Fixtures ─────────────────────────────────────────────────────────


@pytest.fixture
def mock_repo(monkeypatch):
    """Mock the module-level channel_repo."""
    repo = MagicMock()
    monkeypatch.setattr("handlers.channel_handler.channel_repo", repo)
    return repo


@pytest.fixture
def mock_cred_service(monkeypatch):
    """Mock the module-level credential_service."""
    svc = MagicMock()
    svc.generate_password.return_value = "generated-pw-abc123"
    svc.store_password.return_value = "/pois/channels/ch-1/esam-password"
    svc.get_password.return_value = "stored-password-xyz"
    monkeypatch.setattr("handlers.channel_handler.credential_service", svc)
    return svc


# ── Tests: PUT /channels/{id} — enabling auth (3.1) ─────────────────


class TestUpdateChannelEnableAuth:
    """PUT with authConfig.authEnabled=true when previously disabled."""

    def test_generates_credentials_and_returns_password(
        self, mock_repo, mock_cred_service
    ):
        existing = _make_channel(auth_enabled=False)
        mock_repo.get_channel.return_value = existing
        mock_repo.update_channel.side_effect = lambda ch: ch

        body = {
            "channelId": "ch-1",
            "name": "test-channel",
            "defaultAction": "noop",
            "authConfig": {"authEnabled": True},
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-01-01T00:00:00Z",
        }
        event = _admin_event(body=body)
        resp = handler(event, None)

        assert resp["statusCode"] == 200
        resp_body = json.loads(resp["body"])
        assert resp_body["generatedPassword"] == "generated-pw-abc123"
        mock_cred_service.generate_password.assert_called_once()
        mock_cred_service.store_password.assert_called_once_with(
            "ch-1", "generated-pw-abc123"
        )

    def test_sets_username_format(self, mock_repo, mock_cred_service):
        existing = _make_channel(auth_enabled=False)
        mock_repo.get_channel.return_value = existing
        mock_repo.update_channel.side_effect = lambda ch: ch

        body = {
            "channelId": "ch-1",
            "name": "test-channel",
            "defaultAction": "noop",
            "authConfig": {"authEnabled": True},
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-01-01T00:00:00Z",
        }
        event = _admin_event(body=body)
        resp = handler(event, None)

        resp_body = json.loads(resp["body"])
        assert resp_body["authConfig"]["username"] == "esam-ch-1"


class TestUpdateChannelDisableAuth:
    """PUT with authConfig.authEnabled=false when previously enabled."""

    def test_deletes_ssm_parameter(self, mock_repo, mock_cred_service):
        existing = _make_channel(
            auth_enabled=True,
            username="esam-ch-1",
            ssm_path="/pois/channels/ch-1/esam-password",
        )
        mock_repo.get_channel.return_value = existing
        mock_repo.update_channel.side_effect = lambda ch: ch

        body = {
            "channelId": "ch-1",
            "name": "test-channel",
            "defaultAction": "noop",
            "authConfig": {"authEnabled": False},
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-01-01T00:00:00Z",
        }
        event = _admin_event(body=body)
        resp = handler(event, None)

        assert resp["statusCode"] == 200
        mock_cred_service.delete_password.assert_called_once_with(
            "/pois/channels/ch-1/esam-password"
        )

    def test_no_password_in_response_when_disabling(self, mock_repo, mock_cred_service):
        existing = _make_channel(
            auth_enabled=True,
            username="esam-ch-1",
            ssm_path="/pois/channels/ch-1/esam-password",
        )
        mock_repo.get_channel.return_value = existing
        mock_repo.update_channel.side_effect = lambda ch: ch

        body = {
            "channelId": "ch-1",
            "name": "test-channel",
            "defaultAction": "noop",
            "authConfig": {"authEnabled": False},
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-01-01T00:00:00Z",
        }
        event = _admin_event(body=body)
        resp = handler(event, None)

        resp_body = json.loads(resp["body"])
        assert "generatedPassword" not in resp_body


# ── Tests: POST /channels/{id}/auth/regenerate (3.2) ────────────────


class TestRegenerateAuth:
    def test_returns_new_password(self, mock_repo, mock_cred_service):
        existing = _make_channel(
            auth_enabled=True,
            username="esam-ch-1",
            ssm_path="/pois/channels/ch-1/esam-password",
        )
        mock_repo.get_channel.return_value = existing

        event = _admin_event(
            method="POST",
            path="/channels/ch-1/auth/regenerate",
        )
        resp = handler(event, None)

        assert resp["statusCode"] == 200
        body = json.loads(resp["body"])
        assert body["password"] == "generated-pw-abc123"
        mock_cred_service.generate_password.assert_called_once()
        mock_cred_service.store_password.assert_called_once_with(
            "ch-1", "generated-pw-abc123"
        )

    def test_returns_400_when_auth_disabled(self, mock_repo, mock_cred_service):
        existing = _make_channel(auth_enabled=False)
        mock_repo.get_channel.return_value = existing

        event = _admin_event(
            method="POST",
            path="/channels/ch-1/auth/regenerate",
        )
        resp = handler(event, None)

        assert resp["statusCode"] == 400

    def test_returns_404_when_channel_not_found(self, mock_repo, mock_cred_service):
        mock_repo.get_channel.return_value = None

        event = _admin_event(
            method="POST",
            path="/channels/ch-1/auth/regenerate",
        )
        resp = handler(event, None)

        assert resp["statusCode"] == 404

    def test_non_admin_gets_403(self, mock_repo, mock_cred_service):
        event = _non_admin_event(
            method="POST",
            path="/channels/ch-1/auth/regenerate",
        )
        resp = handler(event, None)

        assert resp["statusCode"] == 403


# ── Tests: GET /channels/{id}/auth/password (3.3) ───────────────────


class TestGetAuthPassword:
    def test_returns_password_from_ssm(self, mock_repo, mock_cred_service):
        existing = _make_channel(
            auth_enabled=True,
            username="esam-ch-1",
            ssm_path="/pois/channels/ch-1/esam-password",
        )
        mock_repo.get_channel.return_value = existing

        event = _admin_event(
            method="GET",
            path="/channels/ch-1/auth/password",
        )
        resp = handler(event, None)

        assert resp["statusCode"] == 200
        body = json.loads(resp["body"])
        assert body["password"] == "stored-password-xyz"
        mock_cred_service.get_password.assert_called_once_with(
            "/pois/channels/ch-1/esam-password"
        )

    def test_returns_400_when_auth_disabled(self, mock_repo, mock_cred_service):
        existing = _make_channel(auth_enabled=False)
        mock_repo.get_channel.return_value = existing

        event = _admin_event(
            method="GET",
            path="/channels/ch-1/auth/password",
        )
        resp = handler(event, None)

        assert resp["statusCode"] == 400

    def test_returns_404_when_channel_not_found(self, mock_repo, mock_cred_service):
        mock_repo.get_channel.return_value = None

        event = _admin_event(
            method="GET",
            path="/channels/ch-1/auth/password",
        )
        resp = handler(event, None)

        assert resp["statusCode"] == 404

    def test_non_admin_gets_403(self, mock_repo, mock_cred_service):
        event = _non_admin_event(
            method="GET",
            path="/channels/ch-1/auth/password",
        )
        resp = handler(event, None)

        assert resp["statusCode"] == 403
