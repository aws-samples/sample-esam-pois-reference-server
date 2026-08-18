// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Amplify } from 'aws-amplify';

// The API is served from the same origin under /api (CloudFront proxies it to
// API Gateway), so no build-time configuration is required. VITE_API_BASE_URL
// remains as an optional override for pointing directly at an API Gateway URL.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export async function initializeAuth(): Promise<void> {
  // Cognito configuration is fetched at runtime from the (unauthenticated)
  // /auth/config endpoint, so the same frontend build works for any
  // deployment - no user pool IDs are baked into the bundle.
  const response = await fetch(`${API_BASE_URL}/auth/config`);
  if (!response.ok) {
    throw new Error(
      `Could not load authentication configuration from ${API_BASE_URL}/auth/config ` +
        `(HTTP ${response.status}). Verify the API stack is deployed and reachable.`
    );
  }

  const config = await response.json();
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: config.userPoolId,
        userPoolClientId: config.userPoolClientId,
        signUpVerificationMethod: 'code',
        loginWith: { email: true },
      },
    },
  });
}
