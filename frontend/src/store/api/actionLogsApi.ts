// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { apiSlice } from './apiSlice';

export interface ActionLogEntry {
  entry_id: string;
  timestamp: string;
  channel_id: string;
  rule_id: string;
  action_id: string;
  action_type: string;
  execution_result: 'SUCCESS' | 'FAILURE' | 'SKIPPED';
  duration_ms: number;
  retry_count: number;
  signal_data: Record<string, any>;
  error_message?: string;
  schedule_action_type?: string;
}

export interface ActionLogDetails extends ActionLogEntry {
  request_payload?: Record<string, any>;
  response_payload?: Record<string, any>;
}

export interface ActionLogsQuery {
  channelId: string;
  startTime?: string;
  endTime?: string;
  actionType?: string;
  executionResult?: string;
  limit?: number;
}

export interface ActionLogsResponse {
  logs: ActionLogEntry[];
  total: number;
  has_more: boolean;
}

export const actionLogsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getActionLogs: builder.query<ActionLogsResponse, ActionLogsQuery>({
      query: ({ channelId, ...params }) => ({
        url: `/channels/${channelId}/actions/logs`,
        params: {
          start_time: params.startTime,
          end_time: params.endTime,
          action_type: params.actionType,
          execution_result: params.executionResult,
          limit: params.limit,
        },
      }),
    }),
    getActionLogDetails: builder.query<ActionLogDetails, { channelId: string; entryId: string }>({
      query: ({ channelId, entryId }) => ({
        url: `/channels/${channelId}/actions/logs/${entryId}`,
      }),
    }),
  }),
});

export const {
  useGetActionLogsQuery,
  useGetActionLogDetailsQuery,
} = actionLogsApi;
