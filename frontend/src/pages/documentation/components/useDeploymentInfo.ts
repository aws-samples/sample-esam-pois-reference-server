// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useGetSystemDefaultsQuery } from '../../../store/api/preferencesApi';

/**
 * Real values of the current deployment for use in documentation examples.
 *
 * Sourced from GET /preferences/defaults, which derives them from the
 * deployment itself (API Gateway ID, region, log group). Falls back to
 * generic placeholders while loading or if the request fails, so the docs
 * always render.
 */
export function useDeploymentInfo() {
  const { data } = useGetSystemDefaultsQuery();
  return {
    apiUrl: data?.apiUrl || 'https://<api-id>.execute-api.<region>.amazonaws.com/v1',
    esamEndpoint:
      data?.esamEndpoint || 'https://<api-id>.execute-api.<region>.amazonaws.com/v1/esam',
    awsRegion: data?.awsRegion || '<region>',
    esamLogGroup: data?.esamLogGroup || '/aws/lambda/<stack-name>-signal-processor',
  };
}
