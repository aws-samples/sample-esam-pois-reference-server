# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Example usage of the External Actions system.

This script demonstrates how to:
1. Register plugins
2. Create action configurations
3. Execute actions
4. Handle cleanup
"""

import asyncio

from domain.services.plugin_registry import get_global_registry
from domain.services.plugins.medialive_plugin import MediaLiveActionPlugin
from domain.services.plugins.webhook_plugin import WebhookActionPlugin
from domain.services.credential_store import create_credential_store
from domain.services.action_executor import ActionExecutor
from domain.services.action_state_manager import ActionStateManager
from domain.repositories.action_state_repository import InMemoryActionStateRepository
from domain.models.external_actions import ExternalAction, TriggerMode


async def main():
    """Run example."""

    # 1. Setup: Register plugins
    print("=== Setting up External Actions System ===\n")

    registry = get_global_registry()
    registry.register(MediaLiveActionPlugin())
    registry.register(WebhookActionPlugin())

    print(f"Registered plugins: {registry.list_types()}\n")

    # 2. Setup: Create credential store and executor
    cred_store = create_credential_store(store_type="environment", cache_ttl=300)
    state_repo = InMemoryActionStateRepository()
    state_manager = ActionStateManager(state_repo)

    executor = ActionExecutor(
        plugin_registry=registry,
        credential_store=cred_store,
        state_manager=state_manager,
    )

    # 3. Create example actions
    print("=== Creating Example Actions ===\n")

    # MediaLive action: Insert logo on ad break
    medialive_action = ExternalAction(
        action_id="action-logo-insert",
        action_type="medialive_schedule_action",
        target={"credential_id": "AWS"},
        trigger_mode=TriggerMode.ON_MATCH,
        action_config={
            "channel_id": "channel-123",
            "region": "us-east-1",
            "schedule_action_type": "static_image_activate",
            "action_settings": {
                "image_uri": "s3://my-bucket/logo.png",
                "layer": 1,
                "opacity": 80,
            },
        },
        cleanup_config={
            "trigger_type_id": 53,  # Provider Ad End
            "timeout_seconds": 300,
        },
    )

    # Webhook action: Notify monitoring system
    webhook_action = ExternalAction(
        action_id="action-webhook-notify",
        action_type="webhook",
        target={"credential_id": "WEBHOOK"},
        trigger_mode=TriggerMode.ON_MATCH,
        action_config={
            "url": "https://monitoring.example.com/api/events",
            "method": "POST",
            "auth_type": "bearer",
            "body_template": '{"channel": "{{channel_id}}", "signal": {{signal}}, "timestamp": "{{timestamp}}"}',
        },
    )

    print(f"Created {len([medialive_action, webhook_action])} actions\n")

    # 4. Execute actions (dry-run mode)
    print("=== Executing Actions (Dry-Run) ===\n")

    signal_data = {
        "pts": 123456789,
        "segmentation_type_id": 52,  # Provider Ad Start
        "segmentation_upid": "ad-12345",
    }

    results = await executor.execute_actions(
        actions=[medialive_action, webhook_action],
        signal_data=signal_data,
        channel_id="channel-123",
        dry_run=True,
    )

    for i, result in enumerate(results, 1):
        print(f"Action {i}: {'✓ Success' if result.success else '✗ Failed'}")
        print(f"  Message: {result.message}\n")

    # 5. Check stored states
    print("=== Checking Stored States ===\n")

    states = await state_repo.get_by_channel("channel-123")
    print(f"Active states for channel-123: {len(states)}\n")

    # 6. Simulate cleanup
    print("=== Simulating Cleanup ===\n")

    cleanup_signal = {
        "pts": 123556789,
        "segmentation_type_id": 53,  # Provider Ad End
        "segmentation_upid": "ad-12345",
    }

    cleanup_states = await state_manager.get_cleanup_actions(
        channel_id="channel-123", cleanup_signal=cleanup_signal
    )

    print(f"States requiring cleanup: {len(cleanup_states)}\n")

    print("=== Example Complete ===")


if __name__ == "__main__":
    asyncio.run(main())
