# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Unit tests for CredentialService."""

import time
from unittest.mock import MagicMock

import pytest
from botocore.exceptions import ClientError

from domain.services.credential_service import CredentialService


@pytest.fixture
def mock_ssm():
    """Create a mock SSM client."""
    return MagicMock()


@pytest.fixture
def service(mock_ssm):
    """Create a CredentialService with mocked SSM client."""
    return CredentialService(ssm_client=mock_ssm)


class TestGeneratePassword:
    def test_returns_string(self, service):
        password = service.generate_password()
        assert isinstance(password, str)

    def test_length_is_32(self, service):
        password = service.generate_password()
        assert len(password) == 32

    def test_unique_each_call(self, service):
        passwords = {service.generate_password() for _ in range(10)}
        assert len(passwords) == 10


class TestStorePassword:
    def test_calls_put_parameter(self, service, mock_ssm):
        path = service.store_password("chan-123", "secret")
        assert path == "/pois/channels/chan-123/esam-password"
        mock_ssm.put_parameter.assert_called_once_with(
            Name="/pois/channels/chan-123/esam-password",
            Value="secret",
            Type="SecureString",
            Overwrite=True,
        )

    def test_invalidates_cache(self, service, mock_ssm):
        # Prime the cache
        mock_ssm.get_parameter.return_value = {"Parameter": {"Value": "old"}}
        service.get_password("/pois/channels/chan-123/esam-password")
        assert "/pois/channels/chan-123/esam-password" in service._cache

        # Store should clear cache
        service.store_password("chan-123", "new")
        assert "/pois/channels/chan-123/esam-password" not in service._cache


class TestGetPassword:
    def test_fetches_from_ssm(self, service, mock_ssm):
        mock_ssm.get_parameter.return_value = {"Parameter": {"Value": "my-pass"}}
        result = service.get_password("/pois/channels/c1/esam-password")
        assert result == "my-pass"
        mock_ssm.get_parameter.assert_called_once_with(
            Name="/pois/channels/c1/esam-password", WithDecryption=True
        )

    def test_returns_cached_value(self, service, mock_ssm):
        mock_ssm.get_parameter.return_value = {"Parameter": {"Value": "cached-pass"}}
        service.get_password("/pois/channels/c1/esam-password")
        service.get_password("/pois/channels/c1/esam-password")
        # SSM should only be called once
        assert mock_ssm.get_parameter.call_count == 1

    def test_cache_expires_after_ttl(self, service, mock_ssm):
        mock_ssm.get_parameter.return_value = {"Parameter": {"Value": "pass1"}}
        service.get_password("/pois/channels/c1/esam-password")

        # Manually expire the cache entry
        path = "/pois/channels/c1/esam-password"
        service._cache[path] = (service._cache[path][0], time.time() - 61)

        mock_ssm.get_parameter.return_value = {"Parameter": {"Value": "pass2"}}
        result = service.get_password(path)
        assert result == "pass2"
        assert mock_ssm.get_parameter.call_count == 2

    def test_ssm_error_propagates(self, service, mock_ssm):
        mock_ssm.get_parameter.side_effect = ClientError(
            {"Error": {"Code": "ParameterNotFound", "Message": "not found"}},
            "GetParameter",
        )
        with pytest.raises(ClientError):
            service.get_password("/pois/channels/c1/esam-password")


class TestDeletePassword:
    def test_calls_delete_parameter(self, service, mock_ssm):
        service.delete_password("/pois/channels/c1/esam-password")
        mock_ssm.delete_parameter.assert_called_once_with(
            Name="/pois/channels/c1/esam-password"
        )

    def test_clears_cache(self, service, mock_ssm):
        # Prime cache
        mock_ssm.get_parameter.return_value = {"Parameter": {"Value": "pw"}}
        service.get_password("/pois/channels/c1/esam-password")
        assert "/pois/channels/c1/esam-password" in service._cache

        service.delete_password("/pois/channels/c1/esam-password")
        assert "/pois/channels/c1/esam-password" not in service._cache

    def test_ignores_parameter_not_found(self, service, mock_ssm):
        mock_ssm.delete_parameter.side_effect = ClientError(
            {"Error": {"Code": "ParameterNotFound", "Message": "not found"}},
            "DeleteParameter",
        )
        # Should not raise
        service.delete_password("/pois/channels/c1/esam-password")

    def test_raises_other_client_errors(self, service, mock_ssm):
        mock_ssm.delete_parameter.side_effect = ClientError(
            {"Error": {"Code": "InternalServerError", "Message": "boom"}},
            "DeleteParameter",
        )
        with pytest.raises(ClientError):
            service.delete_password("/pois/channels/c1/esam-password")


class TestPathPrefix:
    """Credentials are namespaced so environments never share a prefix."""

    def test_defaults_when_unset(self, mock_ssm, monkeypatch):
        monkeypatch.delenv("CREDENTIAL_PATH_PREFIX", raising=False)
        service = CredentialService(ssm_client=mock_ssm)

        assert (
            service.store_password("c1", "secret") == "/pois/channels/c1/esam-password"
        )

    def test_reads_the_environment_variable(self, mock_ssm, monkeypatch):
        monkeypatch.setenv("CREDENTIAL_PATH_PREFIX", "/pois/prod/channels")
        service = CredentialService(ssm_client=mock_ssm)

        assert (
            service.store_password("c1", "secret")
            == "/pois/prod/channels/c1/esam-password"
        )

    def test_explicit_argument_wins(self, mock_ssm, monkeypatch):
        monkeypatch.setenv("CREDENTIAL_PATH_PREFIX", "/pois/prod/channels")
        service = CredentialService(
            ssm_client=mock_ssm, path_prefix="/pois/staging/channels"
        )

        assert (
            service.store_password("c1", "secret")
            == "/pois/staging/channels/c1/esam-password"
        )

    def test_trailing_slash_does_not_double_up(self, mock_ssm):
        service = CredentialService(
            ssm_client=mock_ssm, path_prefix="/pois/dev/channels/"
        )

        assert (
            service.store_password("c1", "secret")
            == "/pois/dev/channels/c1/esam-password"
        )

    def test_environments_do_not_collide(self, mock_ssm):
        dev = CredentialService(ssm_client=mock_ssm, path_prefix="/pois/dev/channels")
        prod = CredentialService(ssm_client=mock_ssm, path_prefix="/pois/prod/channels")

        assert dev.store_password("same-id", "a") != prod.store_password("same-id", "b")

    def test_reads_use_the_recorded_path_not_the_prefix(self, mock_ssm):
        """A credential written under an earlier prefix stays readable."""
        mock_ssm.get_parameter.return_value = {"Parameter": {"Value": "legacy-secret"}}
        service = CredentialService(
            ssm_client=mock_ssm, path_prefix="/pois/dev/channels"
        )

        assert (
            service.get_password("/pois/channels/old/esam-password") == "legacy-secret"
        )
        mock_ssm.get_parameter.assert_called_once_with(
            Name="/pois/channels/old/esam-password", WithDecryption=True
        )
