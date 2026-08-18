// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api-client';

export function useSystemInfo() {
  return useQuery({
    queryKey: ['systemInfo'],
    queryFn: () => apiClient.getSystemInfo(),
    staleTime: Infinity, // Never refetch
  });
}
