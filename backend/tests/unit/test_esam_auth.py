# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Unit tests for ESAM handler Basic Auth validation."""

import base64
import json
import os
import sys
from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError

from domain.models.channel import Channel


def _make_channel(
    auth_enabled=True, username="esam-123", ssm_path="/pois/channels/123/esam-password"
):
    """Create a minimal Channel object for testing."""
    return Channel(
        channelId="123",
        name="test-channel",
        defaultAction="noop",
        createdAt="2024-01-01T00:00:00Z",
        updatedAt="2024-01-01T00:00:00Z",
        authConfig={
            "authEnabled": auth_enabled,
            "username": username,
            "ssmParameterPath": ssm_path,
        },
    )


def _make_event(auth_header=None, source_ip="10.0.0.1"):
    """Create a minimal API Gateway event dict."""
    headers = {"Content-Type": "application/xml"}
    if auth_header is not None:
        headers["Authorization"] = auth_header
    return {
        "headers": headers,
        "requestContext": {"identity": {"sourceIp": source_ip}},
    }


def _basic_header(username, password):
    """Build a Basic auth header value."""
    token = base64.b64encode(f"{username}:{password}".encode()).decode()
    return f"Basic {token}"


@pytest.fixture
def mock_credential_service():
    svc = MagicMock()
    svc.get_password.return_value = "correct-password"
    return svc


@pytest.fixture
def mock_logger():
    logger = MagicMock()
    logger.correlation_id = "test-corr-id"
    return logger


# ── Patch boto3 before importing esam_handler (module-level AWS calls) ──
# We need to set AWS_DEFAULT_REGION and mock boto3 before the handler module
# is imported, because it calls boto3.resource('dynamodb') at import time.

_mock_boto3 = MagicMock()
_mock_table = MagicMock()
_mock_boto3.resource.return_value.Table.return_value = _mock_table


@pytest.fixture(autouse=True, scope="session")
def _set_aws_env():
    """Set AWS region env var so boto3 doesn't fail at import time."""
    os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")
    os.environ.setdefault("AWS_ACCESS_KEY_ID", "testing")
    os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "testing")


# Force-remove cached module so we can re-import with env set
if "handlers.esam_handler" in sys.modules:
    del sys.modules["handlers.esam_handler"]

# Now import with env vars set
with patch.dict(
    os.environ,
    {
        "AWS_DEFAULT_REGION": "us-east-1",
        "AWS_ACCESS_KEY_ID": "testing",
        "AWS_SECRET_ACCESS_KEY": "testing",
    },
):
    from handlers.esam_handler import (
        _validate_basic_auth,
        _build_401_response,
    )


# ── Tests: _build_401_response ───────────────────────────────────────


class TestBuild401Response:
    def test_status_code(self):
        resp = _build_401_response("corr-1")
        assert resp["statusCode"] == 401

    def test_www_authenticate_header(self):
        resp = _build_401_response("corr-1")
        assert resp["headers"]["WWW-Authenticate"] == 'Basic realm="ESAM"'

    def test_correlation_id_header(self):
        resp = _build_401_response("corr-1")
        assert resp["headers"]["X-Correlation-ID"] == "corr-1"

    def test_body_is_json_unauthorized(self):
        resp = _build_401_response("corr-1")
        body = json.loads(resp["body"])
        assert body == {"error": "Unauthorized"}


# ── Tests: _validate_basic_auth ──────────────────────────────────────


class TestValidateBasicAuthDisabled:
    """When auth is disabled, validation should be skipped."""

    def test_returns_none_when_disabled(self, mock_credential_service, mock_logger):
        channel = _make_channel(auth_enabled=False)
        event = _make_event()  # no auth header
        result = _validate_basic_auth(
            event, channel, mock_credential_service, mock_logger
        )
        assert result is None

    def test_does_not_call_ssm_when_disabled(
        self, mock_credential_service, mock_logger
    ):
        channel = _make_channel(auth_enabled=False)
        event = _make_event(auth_header=_basic_header("user", "pass"))
        _validate_basic_auth(event, channel, mock_credential_service, mock_logger)
        mock_credential_service.get_password.assert_not_called()


class TestValidateBasicAuthMissingHeader:
    """When auth is enabled but no Authorization header is present."""

    def test_returns_401(self, mock_credential_service, mock_logger):
        channel = _make_channel()
        event = _make_event()  # no auth header
        result = _validate_basic_auth(
            event, channel, mock_credential_service, mock_logger
        )
        assert result["statusCode"] == 401

    def test_logs_missing_credentials(self, mock_credential_service, mock_logger):
        channel = _make_channel()
        event = _make_event()
        _validate_basic_auth(event, channel, mock_credential_service, mock_logger)
        mock_logger.warn.assert_called_once()
        call_kwargs = mock_logger.warn.call_args
        assert "missing_credentials" in str(call_kwargs)


class TestValidateBasicAuthInvalidCredentials:
    """When auth header has wrong username or password."""

    def test_wrong_username_returns_401(self, mock_credential_service, mock_logger):
        channel = _make_channel(username="esam-123")
        event = _make_event(auth_header=_basic_header("wrong-user", "correct-password"))
        result = _validate_basic_auth(
            event, channel, mock_credential_service, mock_logger
        )
        assert result["statusCode"] == 401

    def test_wrong_password_returns_401(self, mock_credential_service, mock_logger):
        channel = _make_channel(username="esam-123")
        event = _make_event(auth_header=_basic_header("esam-123", "wrong-password"))
        result = _validate_basic_auth(
            event, channel, mock_credential_service, mock_logger
        )
        assert result["statusCode"] == 401

    def test_invalid_scheme_returns_401(self, mock_credential_service, mock_logger):
        channel = _make_channel()
        event = _make_event(auth_header="Bearer some-token")
        result = _validate_basic_auth(
            event, channel, mock_credential_service, mock_logger
        )
        assert result["statusCode"] == 401

    def test_malformed_base64_returns_401(self, mock_credential_service, mock_logger):
        channel = _make_channel()
        event = _make_event(auth_header="Basic !!!not-base64!!!")
        result = _validate_basic_auth(
            event, channel, mock_credential_service, mock_logger
        )
        assert result["statusCode"] == 401

    def test_logs_invalid_credentials_with_username(
        self, mock_credential_service, mock_logger
    ):
        channel = _make_channel(username="esam-123")
        event = _make_event(auth_header=_basic_header("esam-123", "wrong"))
        _validate_basic_auth(event, channel, mock_credential_service, mock_logger)
        # Should log with username but NOT the password
        call_kwargs = mock_logger.warn.call_args
        assert "invalid_credentials" in str(call_kwargs)
        assert "esam-123" in str(call_kwargs)
        assert "wrong" not in str(call_kwargs)


class TestValidateBasicAuthValidCredentials:
    """When correct credentials are provided."""

    def test_returns_none(self, mock_credential_service, mock_logger):
        channel = _make_channel(username="esam-123")
        event = _make_event(auth_header=_basic_header("esam-123", "correct-password"))
        result = _validate_basic_auth(
            event, channel, mock_credential_service, mock_logger
        )
        assert result is None

    def test_calls_ssm_with_correct_path(self, mock_credential_service, mock_logger):
        channel = _make_channel(
            username="esam-123", ssm_path="/pois/channels/123/esam-password"
        )
        event = _make_event(auth_header=_basic_header("esam-123", "correct-password"))
        _validate_basic_auth(event, channel, mock_credential_service, mock_logger)
        mock_credential_service.get_password.assert_called_once_with(
            "/pois/channels/123/esam-password"
        )

    def test_no_warn_logs(self, mock_credential_service, mock_logger):
        channel = _make_channel(username="esam-123")
        event = _make_event(auth_header=_basic_header("esam-123", "correct-password"))
        _validate_basic_auth(event, channel, mock_credential_service, mock_logger)
        mock_logger.warn.assert_not_called()


class TestValidateBasicAuthSSMError:
    """When SSM is unreachable during password retrieval."""

    def test_returns_500(self, mock_credential_service, mock_logger):
        mock_credential_service.get_password.side_effect = ClientError(
            {"Error": {"Code": "InternalServerError", "Message": "SSM down"}},
            "GetParameter",
        )
        channel = _make_channel(username="esam-123")
        event = _make_event(auth_header=_basic_header("esam-123", "any-pass"))
        result = _validate_basic_auth(
            event, channel, mock_credential_service, mock_logger
        )
        assert result["statusCode"] == 500

    def test_500_includes_correlation_id(self, mock_credential_service, mock_logger):
        mock_credential_service.get_password.side_effect = ClientError(
            {"Error": {"Code": "InternalServerError", "Message": "SSM down"}},
            "GetParameter",
        )
        channel = _make_channel(username="esam-123")
        event = _make_event(auth_header=_basic_header("esam-123", "any-pass"))
        result = _validate_basic_auth(
            event, channel, mock_credential_service, mock_logger
        )
        body = json.loads(result["body"])
        assert body["correlationId"] == "test-corr-id"

    def test_logs_error_not_warn(self, mock_credential_service, mock_logger):
        mock_credential_service.get_password.side_effect = ClientError(
            {"Error": {"Code": "InternalServerError", "Message": "SSM down"}},
            "GetParameter",
        )
        channel = _make_channel(username="esam-123")
        event = _make_event(auth_header=_basic_header("esam-123", "any-pass"))
        _validate_basic_auth(event, channel, mock_credential_service, mock_logger)
        mock_logger.error.assert_called_once()
        # Password should NOT appear in error log
        assert "any-pass" not in str(mock_logger.error.call_args)


class TestPasswordNeverLogged:
    """Ensure the password and Authorization header value never appear in logs."""

    def test_password_not_in_warn_log_on_failure(
        self, mock_credential_service, mock_logger
    ):
        channel = _make_channel(username="esam-123")
        event = _make_event(auth_header=_basic_header("esam-123", "super-secret-pw"))
        _validate_basic_auth(event, channel, mock_credential_service, mock_logger)
        for call in mock_logger.warn.call_args_list + mock_logger.error.call_args_list:
            assert "super-secret-pw" not in str(call)

    def test_auth_header_not_in_log(self, mock_credential_service, mock_logger):
        channel = _make_channel(username="esam-123")
        header = _basic_header("esam-123", "super-secret-pw")
        event = _make_event(auth_header=header)
        _validate_basic_auth(event, channel, mock_credential_service, mock_logger)
        b64_token = header.split(" ")[1]
        for call in mock_logger.warn.call_args_list + mock_logger.error.call_args_list:
            assert b64_token not in str(call)
