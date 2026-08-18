// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useState } from 'react';
import { ExternalAction } from '../../types/channel';
import MediaLiveActionForm from './MediaLiveActionForm';
import WebhookActionForm from './WebhookActionForm';

interface AddActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (action: ExternalAction) => void;
  editingAction?: ExternalAction;
}

type ActionType = 'medialive_schedule_action' | 'webhook' | null;

export default function AddActionModal({
  isOpen,
  onClose,
  onSave,
  editingAction,
}: AddActionModalProps) {
  const [selectedType, setSelectedType] = useState<ActionType>(
    editingAction?.actionType || null
  );

  if (!isOpen) return null;

  const handleSave = (action: ExternalAction) => {
    onSave(action);
    onClose();
  };

  const handleCancel = () => {
    setSelectedType(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">
              {editingAction ? 'Edit External Action' : 'Add External Action'}
            </h3>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Action Type Selection */}
          {!selectedType && !editingAction && (
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Select an action type to configure:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* MediaLive */}
                <button
                  type="button"
                  onClick={() => setSelectedType('medialive_schedule_action')}
                  className="group p-6 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition text-center"
                >
                  <div className="text-4xl mb-3">📺</div>
                  <div className="font-medium text-gray-900 mb-1">MediaLive</div>
                  <div className="text-xs text-gray-500">
                    Control AWS MediaLive channels with schedule actions
                  </div>
                  <div className="mt-3 text-xs text-gray-400">
                    • Insert logos
                    <br />
                    • Switch inputs
                    <br />• Motion graphics
                  </div>
                </button>

                {/* Webhook */}
                <button
                  type="button"
                  onClick={() => setSelectedType('webhook')}
                  className="group p-6 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition text-center"
                >
                  <div className="text-4xl mb-3">🌐</div>
                  <div className="font-medium text-gray-900 mb-1">Webhook</div>
                  <div className="text-xs text-gray-500">
                    Call any HTTP API endpoint
                  </div>
                  <div className="mt-3 text-xs text-gray-400">
                    • Custom integrations
                    <br />
                    • REST APIs
                    <br />• Flexible payloads
                  </div>
                </button>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-blue-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">
                      About External Actions
                    </h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <p>
                        External actions allow you to trigger API calls to external services
                        when SCTE-35 signals match your rules. Actions execute asynchronously
                        and support automatic cleanup, retries, and rate limiting.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MediaLive Form */}
          {(selectedType === 'medialive_schedule_action' || editingAction?.actionType === 'medialive_schedule_action') && (
            <MediaLiveActionForm
              action={editingAction}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          )}

          {/* Webhook Form */}
          {(selectedType === 'webhook' || editingAction?.actionType === 'webhook') && (
            <WebhookActionForm
              action={editingAction}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          )}
        </div>
      </div>
    </div>
  );
}
