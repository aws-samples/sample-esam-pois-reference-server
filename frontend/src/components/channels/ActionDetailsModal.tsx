// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useGetActionLogDetailsQuery } from '../../store/api/actionLogsApi';
import { X } from 'lucide-react';
import Button from '../common/Button';

interface ActionDetailsModalProps {
  channelId: string;
  entryId: string;
  onClose: () => void;
}

export default function ActionDetailsModal({ channelId, entryId, onClose }: ActionDetailsModalProps) {
  const { data: details, isLoading } = useGetActionLogDetailsQuery({ channelId, entryId });

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 max-w-4xl w-full mx-4">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            <p className="text-sm text-gray-500 mt-3">Loading details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!details) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-xl font-semibold text-gray-900">Action Execution Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Execution Info */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Execution Info</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-gray-500 block mb-1">Action ID</span>
                  <p className="text-sm font-mono text-gray-900">{details.action_id}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block mb-1">Action Type</span>
                  <p className="text-sm text-gray-900">{details.action_type}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block mb-1">Status</span>
                  <p className={`text-sm font-semibold ${
                    details.execution_result === 'SUCCESS' ? 'text-green-600' :
                    details.execution_result === 'FAILURE' ? 'text-red-600' :
                    'text-gray-600'
                  }`}>
                    {details.execution_result}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block mb-1">Timestamp</span>
                  <p className="text-sm text-gray-900">
                    {new Date(details.timestamp).toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block mb-1">Duration</span>
                  <p className="text-sm text-gray-900">{details.duration_ms}ms</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block mb-1">Retry Count</span>
                  <p className="text-sm text-gray-900">{details.retry_count}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Trigger Signal */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Trigger Signal</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(details.signal_data, null, 2)}
              </pre>
            </div>
          </div>

          {/* Request Payload */}
          {details.request_payload && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Request</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(details.request_payload, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Response Payload */}
          {details.response_payload && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Response</h3>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(details.response_payload, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Error Message */}
          {details.error_message && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Error</h3>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700 whitespace-pre-wrap">{details.error_message}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end rounded-b-xl">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
