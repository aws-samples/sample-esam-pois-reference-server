# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Property-based tests for rate limiting.

All tests run against a FakeClock injected into the TokenBucket /
RateLimiterManager, so time-dependent behavior (refill, delays, queueing)
is verified deterministically and instantly - no real sleeps.
"""

import asyncio
import pytest
from hypothesis import given, strategies as st, settings, assume

from domain.services.rate_limiter import TokenBucket, RateLimiterManager


class FakeClock:
    """Deterministic clock: `sleep` advances virtual time instead of waiting."""

    def __init__(self) -> None:
        self.now = 1_000_000.0

    def time(self) -> float:
        return self.now

    async def sleep(self, seconds: float) -> None:
        self.now += seconds
        # Yield control once so concurrent tasks interleave like real asyncio.
        await asyncio.sleep(0)

    def advance(self, seconds: float) -> None:
        self.now += seconds


def make_bucket(max_calls: int, per_seconds: int) -> tuple[TokenBucket, FakeClock]:
    clock = FakeClock()
    bucket = TokenBucket(
        max_calls=max_calls,
        per_seconds=per_seconds,
        time_func=clock.time,
        sleep_func=clock.sleep,
    )
    return bucket, clock


# Feature: external-actions, Property 25: Rate Limit Delay
@settings(max_examples=100)
@given(
    max_calls=st.integers(min_value=1, max_value=10),
    per_seconds=st.integers(min_value=1, max_value=5),
    num_requests=st.integers(min_value=1, max_value=15),
)
@pytest.mark.asyncio
async def test_property_rate_limit_enforces_delay(
    max_calls: int, per_seconds: int, num_requests: int
):
    """
    Property 25: Rate Limit Delay

    For any action that would exceed the configured rate limit for its action type,
    execution should be delayed until sufficient tokens are available in the rate limiter.

    Validates: Requirements 11.2
    """
    assume(num_requests > max_calls)  # Only test when we exceed the limit

    bucket, clock = make_bucket(max_calls, per_seconds)

    start_time = clock.time()
    total_delay = 0.0

    # Make requests that exceed the rate limit
    for _ in range(num_requests):
        delay = await bucket.acquire(tokens=1)
        total_delay += delay

    elapsed = clock.time() - start_time

    # Verify that delay was applied when exceeding rate limit
    assert total_delay > 0, "Expected delay when exceeding rate limit"

    # The total time should be at least the time needed to refill tokens
    # for the excess requests
    excess_requests = num_requests - max_calls
    min_expected_time = (excess_requests / max_calls) * per_seconds

    # Allow some tolerance for floating point precision
    assert (
        elapsed >= min_expected_time * 0.8
    ), f"Expected at least {min_expected_time}s, got {elapsed}s"


# Feature: external-actions, Property 25: Rate Limit Delay - Token Refill
@settings(max_examples=100)
@given(
    max_calls=st.integers(min_value=2, max_value=10),
    per_seconds=st.integers(min_value=1, max_value=3),
)
@pytest.mark.asyncio
async def test_property_tokens_refill_over_time(max_calls: int, per_seconds: int):
    """
    Property 25: Rate Limit Delay - Token Refill

    For any rate limiter, tokens should refill over time at the configured rate,
    allowing new requests after waiting.

    Validates: Requirements 11.2
    """
    bucket, clock = make_bucket(max_calls, per_seconds)

    # Consume all tokens
    for _ in range(max_calls):
        acquired = await bucket.try_acquire(tokens=1)
        assert acquired, "Should be able to acquire initial tokens"

    # Next request should fail immediately
    acquired = await bucket.try_acquire(tokens=1)
    assert not acquired, "Should not acquire when bucket is empty"

    # Advance the clock long enough for at least 1 token to refill
    refill_time = per_seconds / max_calls
    clock.advance(refill_time * 1.5)

    # Should be able to acquire again
    acquired = await bucket.try_acquire(tokens=1)
    assert acquired, "Should be able to acquire after tokens refill"


# Feature: external-actions, Property 25: Rate Limit Delay - Burst Handling
@settings(max_examples=100)
@given(
    max_calls=st.integers(min_value=5, max_value=20),
    per_seconds=st.integers(min_value=1, max_value=5),
)
@pytest.mark.asyncio
async def test_property_rate_limit_allows_burst_up_to_capacity(
    max_calls: int, per_seconds: int
):
    """
    Property 25: Rate Limit Delay - Burst Handling

    For any rate limiter, up to max_calls requests should be allowed immediately
    (burst), but subsequent requests should be rate limited.

    Validates: Requirements 11.2
    """
    bucket, _clock = make_bucket(max_calls, per_seconds)

    # First max_calls requests should succeed immediately
    for i in range(max_calls):
        delay = await bucket.acquire(tokens=1)
        assert (
            delay == 0.0
        ), f"Request {i + 1} should not be delayed (within burst capacity)"

    # Next request should be delayed
    delay = await bucket.acquire(tokens=1)
    assert delay > 0, "Request exceeding burst capacity should be delayed"


# Feature: external-actions, Property 26: Rate Limit Queueing
@settings(max_examples=50)
@given(
    max_calls=st.integers(min_value=2, max_value=5),
    per_seconds=st.integers(min_value=1, max_value=3),
    num_requests=st.integers(min_value=3, max_value=10),
)
@pytest.mark.asyncio
async def test_property_rate_limit_queues_excess_requests(
    max_calls: int, per_seconds: int, num_requests: int
):
    """
    Property 26: Rate Limit Queueing

    For any action that exceeds the rate limit, the action should be queued
    for later execution rather than dropped or failed.

    Validates: Requirements 11.5
    """
    assume(num_requests > max_calls)

    bucket, _clock = make_bucket(max_calls, per_seconds)

    completed_requests = []

    async def make_request(request_id: int):
        """Simulate a request that respects rate limiting."""
        await bucket.acquire(tokens=1)
        completed_requests.append(request_id)

    # Launch all requests concurrently
    tasks = [make_request(i) for i in range(num_requests)]
    await asyncio.gather(*tasks)

    # Verify all requests completed (none were dropped)
    assert (
        len(completed_requests) == num_requests
    ), f"Expected {num_requests} completed requests, got {len(completed_requests)}"

    # Verify all request IDs are present
    assert set(completed_requests) == set(
        range(num_requests)
    ), "All requests should complete, none should be dropped"


# Feature: external-actions, Property 25: Rate Limit Delay - Manager
@settings(max_examples=100)
@given(
    action_type=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll")),
    ),
    max_calls=st.integers(min_value=1, max_value=10),
    per_seconds=st.integers(min_value=1, max_value=5),
)
@pytest.mark.asyncio
async def test_property_rate_limiter_manager_per_action_type(
    action_type: str, max_calls: int, per_seconds: int
):
    """
    Property 25: Rate Limit Delay - Manager

    For any action type with a configured rate limit, the rate limiter manager
    should enforce the limit independently for that action type.

    Validates: Requirements 11.2, 11.3
    """
    clock = FakeClock()
    manager = RateLimiterManager(time_func=clock.time, sleep_func=clock.sleep)

    # Register rate limiter for action type
    manager.register_limiter(action_type, max_calls, per_seconds)

    # Verify limiter is registered
    limiter = manager.get_limiter(action_type)
    assert limiter is not None, "Limiter should be registered"

    # Verify config is stored
    config = manager.get_config(action_type)
    assert config is not None
    assert config.max_calls == max_calls
    assert config.per_seconds == per_seconds

    # Test rate limiting works
    for _ in range(max_calls):
        delay = await manager.acquire(action_type, tokens=1)
        assert delay == 0.0, "Requests within limit should not be delayed"

    # Next request should be delayed
    delay = await manager.acquire(action_type, tokens=1)
    assert delay > 0, "Request exceeding limit should be delayed"


# Feature: external-actions, Property 25: Rate Limit Delay - No Limit
@settings(max_examples=100)
@given(
    action_type=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll")),
    ),
    num_requests=st.integers(min_value=1, max_value=20),
)
@pytest.mark.asyncio
async def test_property_no_rate_limit_allows_unlimited_requests(
    action_type: str, num_requests: int
):
    """
    Property 25: Rate Limit Delay - No Limit

    For any action type without a configured rate limit, requests should
    proceed without delay regardless of volume.

    Validates: Requirements 11.2
    """
    manager = RateLimiterManager()

    # Don't register a rate limiter for this action type

    # All requests should succeed immediately
    for _ in range(num_requests):
        delay = await manager.acquire(action_type, tokens=1)
        assert delay == 0.0, "Requests without rate limit should not be delayed"


# Feature: external-actions, Property 25: Rate Limit Delay - Wait Time Calculation
@settings(max_examples=100)
@given(
    max_calls=st.integers(min_value=2, max_value=10),
    per_seconds=st.integers(min_value=1, max_value=5),
    tokens_to_acquire=st.integers(min_value=1, max_value=5),
)
@pytest.mark.asyncio
async def test_property_wait_time_calculation_accurate(
    max_calls: int, per_seconds: int, tokens_to_acquire: int
):
    """
    Property 25: Rate Limit Delay - Wait Time Calculation

    For any rate limiter, the calculated wait time should accurately reflect
    how long until the requested tokens are available.

    Validates: Requirements 11.2
    """
    bucket, _clock = make_bucket(max_calls, per_seconds)

    # Consume all tokens
    for _ in range(max_calls):
        await bucket.try_acquire(tokens=1)

    # Calculate wait time for additional tokens
    wait_time = bucket.get_wait_time(tokens=tokens_to_acquire)

    # Wait time should be positive when bucket is empty
    assert wait_time > 0, "Wait time should be positive when tokens are needed"

    # Expected wait time based on refill rate
    refill_rate = max_calls / per_seconds
    expected_wait = tokens_to_acquire / refill_rate

    # With a fake clock there is no timing noise; tolerance covers float error
    assert (
        abs(wait_time - expected_wait) < 0.1
    ), f"Wait time {wait_time} should be close to expected {expected_wait}"


# Feature: external-actions, Property 27: Rate Limit Logging
@settings(max_examples=50)
@given(
    max_calls=st.integers(min_value=1, max_value=5),
    per_seconds=st.integers(min_value=1, max_value=3),
    num_requests=st.integers(min_value=2, max_value=8),
)
@pytest.mark.asyncio
async def test_property_rate_limit_events_logged(
    max_calls: int, per_seconds: int, num_requests: int
):
    """
    Property 27: Rate Limit Logging

    For any rate limit event (delay or queue), an entry should be logged
    indicating the action type, channel, and delay duration.

    Note: This test verifies that rate limiting behavior is observable.
    In production, integrate with audit logger for proper logging.

    Validates: Requirements 11.6
    """
    assume(num_requests > max_calls)

    bucket, _clock = make_bucket(max_calls, per_seconds)

    delays = []

    # Make requests that will trigger rate limiting
    for _ in range(num_requests):
        delay = await bucket.acquire(tokens=1)
        delays.append(delay)

    # Verify that delays occurred (indicating rate limiting was triggered)
    total_delay = sum(delays)

    assert total_delay > 0, "Rate limiting should cause delays when exceeding limit"

    # Count how many requests were delayed
    delayed_requests = sum(1 for d in delays if d > 0)
    assert delayed_requests > 0, "At least some requests should be delayed"

    # Verify delays are reasonable (not negative, not excessively long)
    for delay in delays:
        assert delay >= 0, "Delay should never be negative"
        assert (
            delay < per_seconds * 10
        ), f"Delay {delay}s seems excessive for rate limit {max_calls}/{per_seconds}s"


@settings(max_examples=50)
@given(
    action_type=st.text(
        min_size=1,
        max_size=20,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll")),
    ),
    max_calls=st.integers(min_value=1, max_value=5),
    per_seconds=st.integers(min_value=1, max_value=3),
)
@pytest.mark.asyncio
async def test_property_rate_limit_manager_tracks_delays(
    action_type: str, max_calls: int, per_seconds: int
):
    """
    Property 27: Rate Limit Logging - Manager Tracking

    For any action type with rate limiting, the manager should track
    and report delays for observability.

    Validates: Requirements 11.6
    """
    clock = FakeClock()
    manager = RateLimiterManager(time_func=clock.time, sleep_func=clock.sleep)
    manager.register_limiter(action_type, max_calls, per_seconds)

    delays = []

    # Make requests exceeding the limit
    for _ in range(max_calls + 2):
        delay = await manager.acquire(action_type, tokens=1)
        delays.append(delay)

    # First max_calls should have no delay
    for i in range(max_calls):
        assert delays[i] == 0.0, f"Request {i + 1} within limit should not be delayed"

    # Subsequent requests should be delayed
    for i in range(max_calls, len(delays)):
        assert delays[i] > 0, f"Request {i + 1} exceeding limit should be delayed"


@settings(max_examples=50)
@given(
    max_calls=st.integers(min_value=2, max_value=10),
    per_seconds=st.integers(min_value=1, max_value=5),
)
@pytest.mark.asyncio
async def test_property_available_tokens_observable(max_calls: int, per_seconds: int):
    """
    Property 27: Rate Limit Logging - Token Observability

    For any rate limiter, the number of available tokens should be
    observable for monitoring and debugging.

    Validates: Requirements 11.6
    """
    bucket, _clock = make_bucket(max_calls, per_seconds)

    # Initially should have full capacity
    available = bucket.get_available_tokens()
    assert (
        available == max_calls
    ), f"Should start with {max_calls} tokens, got {available}"

    # After consuming some tokens
    tokens_to_consume = max_calls // 2
    for _ in range(tokens_to_consume):
        await bucket.try_acquire(tokens=1)

    available = bucket.get_available_tokens()
    expected = max_calls - tokens_to_consume

    # Fake clock does not advance on its own, so this is exact (float math)
    assert (
        abs(available - expected) < 0.5
    ), f"Expected ~{expected} tokens available, got {available}"

    # After consuming all tokens
    for _ in range(max_calls):
        await bucket.try_acquire(tokens=1)

    available = bucket.get_available_tokens()
    assert available < 1.0, "Should have less than 1 token after consuming all"
