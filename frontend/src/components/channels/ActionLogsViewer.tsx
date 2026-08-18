// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useState } from 'react';
import { useGetActionLogsQuery } from '../../store/api/actionLogsApi';
import { useGetSystemDefaultsQuery } from '../../store/api/preferencesApi';
import ActionLogEntry from './ActionLogEntry';
import { Activity } from 'lucide-react';
import Button from '../common/Button';
import LoadingState from '../common/LoadingState';

interface ActionLogsViewerProps {
  channelId: string;
}

export default function ActionLogsViewer({ channelId }: ActionLogsViewerProps) {
  const [paused, setPaused] = useState(false);
  const [filters, setFilters] = useState<{
    actionType?: string;
    executionResult?: string;
    timeRange: string;
  }>({
    timeRange: 'last_24_hours',
  });

  const { data: systemDefaults } = useGetSystemDefaultsQuery();
  const pollingInterval = systemDefaults?.logPollingIntervalMs ?? 5000;

  const [startTime, setStartTime] = useState(() => {
    const offsets: Record<string, number> = { last_hour: 3600000, last_24_hours: 86400000, last_7_days: 7 * 86400000 };
    const offset = offsets['last_24_hours'] || 86400000;
    return new Date(Date.now() - offset).toISOString();
  });

  const handleTimeRangeChange = (range: string) => {
    const offsets: Record<string, number> = { last_hour: 3600000, last_24_hours: 86400000, last_7_days: 7 * 86400000 };
    setFilters({ ...filters, timeRange: range });
    setStartTime(new Date(Date.now() - (offsets[range] || 86400000)).toISOString());
  };

  const { data, isLoading, error } = useGetActionLogsQuery(
    {
      channelId,
      actionType: filters.actionType,
      executionResult: filters.executionResult,
      startTime: filters.timeRange !== 'last_24_hours' ? startTime : undefined,
      limit: 100,
    },
    {
      skip: paused,
      pollingInterval,
    }
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">External Action Logs</h3>
          <p className="text-sm text-gray-500 mt-1">Real-time monitoring of action executions</p>
        </div>
        <div className="flex items-center gap-3">
          {!paused && (
            <span className="flex items-center gap-2 text-sm text-green-600">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              Live
            </span>
          )}
          <Button
            variant={paused ? 'accent' : 'ghost'}
            size="sm"
            onClick={() => setPaused(!paused)}
          >
            {paused ? '▶ Resume' : '⏸ Pause'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-3 flex-wrap">
        <select
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          value={filters.actionType || ''}
          onChange={(e) => setFilters({ ...filters, actionType: e.target.value || undefined })}
        >
          <option value="">All Action Types</option>
          <option value="medialive_schedule_action">MediaLive</option>
          <option value="webhook">Webhook</option>
        </select>

        <select
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          value={filters.executionResult || ''}
          onChange={(e) => setFilters({ ...filters, executionResult: e.target.value || undefined })}
        >
          <option value="">All Statuses</option>
          <option value="SUCCESS">Success</option>
          <option value="FAILURE">Failure</option>
          <option value="SKIPPED">Skipped</option>
        </select>

        <select
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          value={filters.timeRange}
          onChange={(e) => handleTimeRangeChange(e.target.value)}
        >
          <option value="last_hour">Last Hour</option>
          <option value="last_24_hours">Last 24 Hours</option>
          <option value="last_7_days">Last 7 Days</option>
        </select>
      </div>

      {/* Log Entries */}
      <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2">
        {isLoading ? (
          <div className="text-center py-12">
            <LoadingState size="md" message="Loading action logs..." />
          </div>
        ) : error ? (
          <div className="text-center py-16 bg-red-50 rounded-xl border-2 border-red-200">
            <p className="text-red-600 font-medium">Failed to load action logs</p>
            <p className="text-sm text-red-500 mt-1">Please try again</p>
            <Button variant="accent" size="sm" className="mt-4" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        ) : !data || data.logs.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <Activity className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No action logs yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Logs will appear when external actions execute
            </p>
          </div>
        ) : (
          data.logs.map((log) => (
            <ActionLogEntry
              key={log.entry_id}
              log={log}
              channelId={channelId}
            />
          ))
        )}
      </div>
    </div>
  );
}
