// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { apiSlice } from './apiSlice';

export interface LogEvent {
  timestamp: string;
  level: string;
  message: string;
  channelId: string;
  commandType: number;
  action: string;
  ruleId?: string;
  processingTimeMs: number;
  correlationId: string;
  xml?: string;
  scte35Binary?: string;
  error?: string;
  // External actions
  actionsCount?: number;
  actionsSucceeded?: number;
  actionsFailed?: number;
  dryRun?: boolean;
  // Rule evaluation
  matched?: boolean;
  matchedRuleId?: string;
  channelName?: string;
  details?: string;
  // Unified audit logging
  source?: string;
  performedBy?: string;
  targetId?: string;
  targetType?: string;
  requestData?: Record<string, unknown>;
  // PSN fields
  classCode?: number;
  detailCode?: number;
  note?: string;
  acquisitionSignalID?: string;
  acquisitionPointIdentity?: string;
}

export interface LogsResponse {
  events: LogEvent[];
  count: number;
  nextToken?: string;
}

export interface LogsQuery {
  channelId?: string;
  startTime?: string;
  endTime?: string;
  action?: string;
  search?: string;
  limit?: number;
  nextToken?: string;
  source?: string;
}

export interface LogSource {
  sourceLabel: string;
  displayName: string;
  logGroupName: string;
}

export const logsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getLogs: builder.query<LogsResponse, LogsQuery>({
      query: (params) => ({
        url: '/logs',
        params,
      }),
    }),
    getChannelLogs: builder.query<LogsResponse, { channelId: string; limit?: number }>({
      query: ({ channelId, limit = 50 }) => ({
        url: `/channels/${channelId}/logs`,
        params: { limit },
      }),
    }),
    getLogSources: builder.query<LogSource[], void>({
      query: () => '/logs/sources',
    }),
  }),
});

export const {
  useGetLogsQuery,
  useGetChannelLogsQuery,
  useGetLogSourcesQuery,
} = logsApi;
