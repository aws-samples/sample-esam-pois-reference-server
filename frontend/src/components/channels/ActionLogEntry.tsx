// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useState } from 'react';
import { ActionLogEntry as ActionLogEntryType } from '../../store/api/actionLogsApi';
import { useGetActionLogDetailsQuery } from '../../store/api/actionLogsApi';
import { CheckCircle, XCircle, MinusCircle, Tv, Globe, Bell, ChevronDown, ChevronRight } from 'lucide-react';

interface ActionLogEntryProps {
  log: ActionLogEntryType;
  channelId: string;
}

export default function ActionLogEntry({ log, channelId }: ActionLogEntryProps) {
  const [expanded, setExpanded] = useState(false);

  const { data: details, isLoading: detailsLoading } = useGetActionLogDetailsQuery(
    { channelId, entryId: log.entry_id },
    { skip: !expanded }
  );

  const getStatusIcon = () => {
    switch (log.execution_result) {
      case 'SUCCESS':
        return <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />;
      case 'FAILURE':
        return <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />;
      case 'SKIPPED':
        return <MinusCircle className="h-5 w-5 text-gray-400 flex-shrink-0" />;
    }
  };

  const getActionTypeIcon = () => {
    if (log.action_type.includes('medialive')) return <Tv className="h-4 w-4 text-blue-500" />;
    if (log.action_type.includes('webhook')) return <Globe className="h-4 w-4 text-purple-500" />;
    if (log.action_type.includes('sns')) return <Bell className="h-4 w-4 text-orange-500" />;
    return null;
  };

  const getBorderColor = () => {
    switch (log.execution_result) {
      case 'SUCCESS': return 'border-green-500';
      case 'FAILURE': return 'border-red-500';
      default: return 'border-gray-300';
    }
  };

  const formatActionType = (type: string) =>
    type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <div className={`bg-white border border-gray-200 border-l-4 ${getBorderColor()} rounded-xl shadow-sm hover:shadow-md transition-all`}>
      {/* Header - always visible */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {expanded ? <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />}
          {getStatusIcon()}
          <div className="flex items-center gap-2 min-w-0">
            {getActionTypeIcon()}
            <span className="font-medium text-gray-900 text-sm">{formatActionType(log.action_type)}</span>
            {log.schedule_action_type && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded font-mono">
                {log.schedule_action_type.replace(/_/g, ' ')}
              </span>
            )}
          </div>
          <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
            log.execution_result === 'SUCCESS' ? 'bg-green-100 text-green-800' :
            log.execution_result === 'FAILURE' ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-600'
          }`}>
            {log.execution_result}
          </span>
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold">
            {log.duration_ms}ms
          </span>
          {log.retry_count > 0 && (
            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded font-semibold">
              {log.retry_count} {log.retry_count === 1 ? 'retry' : 'retries'}
            </span>
          )}
        </div>
        <div className="text-right flex-shrink-0 ml-4">
          <div className="text-sm text-gray-700">{new Date(log.timestamp).toLocaleTimeString()}</div>
          <div className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleDateString()}</div>
        </div>
      </div>

      {/* Error summary - visible even when collapsed */}
      {!expanded && log.error_message && (
        <div className="px-4 pb-3 -mt-1">
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-1.5 truncate">
            {log.error_message}
          </div>
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
          {detailsLoading ? (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500"></div>
              <p className="text-xs text-gray-500 mt-2">Loading details...</p>
            </div>
          ) : (
            <>
              {/* Info grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <span className="text-xs text-gray-500 block">Action ID</span>
                  <p className="text-xs font-mono text-gray-800 truncate">{log.action_id}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Rule ID</span>
                  <p className="text-xs font-mono text-gray-800 truncate">{log.rule_id}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Duration</span>
                  <p className="text-xs text-gray-800">{log.duration_ms}ms</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Retries</span>
                  <p className="text-xs text-gray-800">{log.retry_count}</p>
                </div>
              </div>

              {/* Error */}
              {log.error_message && (
                <div>
                  <span className="text-xs font-semibold text-red-700 block mb-1">Error</span>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-xs text-red-700 whitespace-pre-wrap break-all">{log.error_message}</p>
                  </div>
                </div>
              )}

              {/* Signal Data */}
              {(details?.signal_data || log.signal_data) && (
                <div>
                  <span className="text-xs font-semibold text-gray-700 block mb-1">Trigger Signal</span>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                      {JSON.stringify(details?.signal_data || log.signal_data, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Request Payload */}
              {details?.request_payload && (
                <div>
                  <span className="text-xs font-semibold text-blue-700 block mb-1">Request Payload</span>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                      {JSON.stringify(details.request_payload, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Response Payload */}
              {details?.response_payload && (
                <div>
                  <span className="text-xs font-semibold text-green-700 block mb-1">Response</span>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                      {JSON.stringify(details.response_payload, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
