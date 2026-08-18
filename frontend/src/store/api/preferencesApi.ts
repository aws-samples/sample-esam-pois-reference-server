// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { apiSlice } from './apiSlice';

export interface SystemDefaults {
  defaultAction: string;
  defaultMode: string;
  descriptorPriority: string;
  actionsEnabled: boolean;
  actionsDryRun: boolean;
  esamEndpoint?: string;
  apiUrl?: string;
  awsRegion?: string;
  logRetentionDays?: number;
  logPollingIntervalMs?: number;
  esamLogGroup?: string;
  defaultActionTimeoutMs?: number;
  defaultActionMaxRetries?: number;
  visibleLogTypes?: string[];
  visibleLogSources?: string[];
}

export const preferencesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getSystemDefaults: builder.query<SystemDefaults, void>({
      query: () => '/preferences/defaults',
      providesTags: ['Preferences'],
    }),
    updateSystemDefaults: builder.mutation<SystemDefaults, Partial<SystemDefaults>>({
      query: (body) => ({
        url: '/preferences/defaults',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Preferences'],
    }),
  }),
});

export const {
  useGetSystemDefaultsQuery,
  useUpdateSystemDefaultsMutation,
} = preferencesApi;
