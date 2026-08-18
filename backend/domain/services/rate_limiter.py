# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Rate Limiter implementation using Token Bucket algorithm.

This module provides rate limiting functionality to prevent exceeding
API rate limits for external services.
"""

import asyncio
import time
from typing import Awaitable, Callable, Dict, Optional
from dataclasses import dataclass

# Injectable clock primitives. Defaults use the real clock; tests can inject
# a fake clock so time-dependent behavior is verified without real sleeps.
TimeFunc = Callable[[], float]
SleepFunc = Callable[[float], Awaitable[None]]


@dataclass
class RateLimitConfig:
    """Configuration for rate limiting."""

    max_calls: int  # Maximum number of calls
    per_seconds: int  # Time window in seconds


class TokenBucket:
    """
    Token Bucket rate limiter implementation.

    The token bucket algorithm allows bursts of requests up to the bucket capacity,
    while maintaining an average rate over time.
    """

    def __init__(
        self,
        max_calls: int,
        per_seconds: int,
        time_func: Optional[TimeFunc] = None,
        sleep_func: Optional[SleepFunc] = None,
    ):
        """
        Initialize the token bucket.

        Args:
            max_calls: Maximum number of calls allowed
            per_seconds: Time window in seconds
            time_func: Clock source (defaults to time.time; injectable for tests)
            sleep_func: Async sleep (defaults to asyncio.sleep; injectable for tests)
        """
        self.max_calls = max_calls
        self.per_seconds = per_seconds
        self._time = time_func or time.time
        self._sleep = sleep_func or asyncio.sleep
        self.tokens = float(max_calls)  # Start with full bucket
        self.last_update = self._time()
        self._lock = asyncio.Lock()

        # Calculate refill rate (tokens per second)
        self.refill_rate = max_calls / per_seconds

    async def acquire(self, tokens: int = 1) -> float:
        """
        Acquire tokens from the bucket, waiting if necessary.

        Args:
            tokens: Number of tokens to acquire (default: 1)

        Returns:
            The delay in seconds that was applied (0 if no delay)
        """
        async with self._lock:
            # Refill tokens based on time elapsed
            now = self._time()
            elapsed = now - self.last_update
            self.tokens = min(self.max_calls, self.tokens + elapsed * self.refill_rate)
            self.last_update = now

            # If we have enough tokens, consume them immediately
            if self.tokens >= tokens:
                self.tokens -= tokens
                return 0.0

            # Calculate how long to wait for tokens
            tokens_needed = tokens - self.tokens
            wait_time = tokens_needed / self.refill_rate

            # Wait for tokens to refill
            await self._sleep(wait_time)

            # Update state after waiting
            now = self._time()
            elapsed = now - self.last_update
            self.tokens = min(self.max_calls, self.tokens + elapsed * self.refill_rate)
            self.last_update = now

            # Consume tokens
            self.tokens -= tokens

            return wait_time

    async def try_acquire(self, tokens: int = 1) -> bool:
        """
        Try to acquire tokens without waiting.

        Args:
            tokens: Number of tokens to acquire (default: 1)

        Returns:
            True if tokens were acquired, False otherwise
        """
        async with self._lock:
            # Refill tokens based on time elapsed
            now = self._time()
            elapsed = now - self.last_update
            self.tokens = min(self.max_calls, self.tokens + elapsed * self.refill_rate)
            self.last_update = now

            # Check if we have enough tokens
            if self.tokens >= tokens:
                self.tokens -= tokens
                return True

            return False

    def get_available_tokens(self) -> float:
        """
        Get the current number of available tokens.

        Returns:
            Number of available tokens
        """
        now = self._time()
        elapsed = now - self.last_update
        return min(self.max_calls, self.tokens + elapsed * self.refill_rate)

    def get_wait_time(self, tokens: int = 1) -> float:
        """
        Calculate how long to wait for tokens to be available.

        Args:
            tokens: Number of tokens needed

        Returns:
            Wait time in seconds (0 if tokens are available)
        """
        available = self.get_available_tokens()

        if available >= tokens:
            return 0.0

        tokens_needed = tokens - available
        return tokens_needed / self.refill_rate


class RateLimiterManager:
    """
    Manages multiple rate limiters for different action types.
    """

    def __init__(
        self,
        time_func: Optional[TimeFunc] = None,
        sleep_func: Optional[SleepFunc] = None,
    ):
        """Initialize the rate limiter manager.

        Args:
            time_func: Clock source passed to created TokenBuckets (test hook)
            sleep_func: Async sleep passed to created TokenBuckets (test hook)
        """
        self._limiters: Dict[str, TokenBucket] = {}
        self._configs: Dict[str, RateLimitConfig] = {}
        self._time_func = time_func
        self._sleep_func = sleep_func

    def register_limiter(
        self, action_type: str, max_calls: int, per_seconds: int
    ) -> None:
        """
        Register a rate limiter for an action type.

        Args:
            action_type: The action type identifier
            max_calls: Maximum number of calls allowed
            per_seconds: Time window in seconds
        """
        self._configs[action_type] = RateLimitConfig(max_calls, per_seconds)
        self._limiters[action_type] = TokenBucket(
            max_calls,
            per_seconds,
            time_func=self._time_func,
            sleep_func=self._sleep_func,
        )

    def get_limiter(self, action_type: str) -> Optional[TokenBucket]:
        """
        Get the rate limiter for an action type.

        Args:
            action_type: The action type identifier

        Returns:
            The token bucket rate limiter, or None if not registered
        """
        return self._limiters.get(action_type)

    async def acquire(self, action_type: str, tokens: int = 1) -> float:
        """
        Acquire tokens for an action type, waiting if necessary.

        Args:
            action_type: The action type identifier
            tokens: Number of tokens to acquire

        Returns:
            The delay in seconds that was applied (0 if no delay)
        """
        limiter = self.get_limiter(action_type)

        if limiter is None:
            # No rate limit configured for this action type
            return 0.0

        return await limiter.acquire(tokens)

    async def try_acquire(self, action_type: str, tokens: int = 1) -> bool:
        """
        Try to acquire tokens for an action type without waiting.

        Args:
            action_type: The action type identifier
            tokens: Number of tokens to acquire

        Returns:
            True if tokens were acquired, False otherwise
        """
        limiter = self.get_limiter(action_type)

        if limiter is None:
            # No rate limit configured for this action type
            return True

        return await limiter.try_acquire(tokens)

    def get_config(self, action_type: str) -> Optional[RateLimitConfig]:
        """
        Get the rate limit configuration for an action type.

        Args:
            action_type: The action type identifier

        Returns:
            The rate limit configuration, or None if not registered
        """
        return self._configs.get(action_type)

    def get_wait_time(self, action_type: str, tokens: int = 1) -> float:
        """
        Calculate how long to wait for tokens to be available.

        Args:
            action_type: The action type identifier
            tokens: Number of tokens needed

        Returns:
            Wait time in seconds (0 if tokens are available or no limit configured)
        """
        limiter = self.get_limiter(action_type)

        if limiter is None:
            return 0.0

        return limiter.get_wait_time(tokens)
