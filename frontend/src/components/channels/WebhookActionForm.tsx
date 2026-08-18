// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useState } from 'react';
import { ExternalAction } from '../../types/channel';

interface WebhookActionFormProps {
  action?: ExternalAction;
  onSave: (action: ExternalAction) => void;
  onCancel: () => void;
}

export default function WebhookActionForm({
  action,
  onSave,
  onCancel,
}: WebhookActionFormProps) {
  const [formData, setFormData] = useState<Partial<ExternalAction>>(
    action || {
      actionId: `action-${Date.now()}`,
      actionType: 'webhook',
      enabled: true,
      order: 0,
      triggerMode: 'on_match',
      timeoutMs: 5000,
      blocking: false,
      target: {},
      actionConfig: {
        url: '',
        method: 'POST',
        headers: {},
        auth_type: 'none',
        verify_ssl: true,
      },
      retryConfig: {
        maxRetries: 3,
        baseDelaySeconds: 1,
      },
    }
  );

  const [headerKey, setHeaderKey] = useState('');
  const [headerValue, setHeaderValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as ExternalAction);
  };

  const updateActionConfig = (key: string, value: any) => {
    setFormData({
      ...formData,
      actionConfig: {
        ...formData.actionConfig,
        [key]: value,
      },
    });
  };

  const addHeader = () => {
    if (!headerKey || !headerValue) return;

    updateActionConfig('headers', {
      ...(formData.actionConfig?.headers || {}),
      [headerKey]: headerValue,
    });

    setHeaderKey('');
    setHeaderValue('');
  };

  const removeHeader = (key: string) => {
    const headers = { ...(formData.actionConfig?.headers || {}) };
    delete headers[key];
    updateActionConfig('headers', headers);
  };

  const authType = formData.actionConfig?.auth_type || 'none';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Settings */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-3">Basic Settings</h4>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trigger Mode
            </label>
            <select
              value={formData.triggerMode}
              onChange={(e) =>
                setFormData({ ...formData, triggerMode: e.target.value as any })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="on_match">On Match</option>
              <option value="on_no_match">On No Match</option>
              <option value="always">Always</option>
            </select>
          </div>
        </div>
      </div>

      {/* HTTP Configuration */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-3">HTTP Configuration</h4>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL *</label>
            <input
              type="url"
              value={formData.actionConfig?.url || ''}
              onChange={(e) => updateActionConfig('url', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="https://api.example.com/webhook"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
            <select
              value={formData.actionConfig?.method || 'POST'}
              onChange={(e) => updateActionConfig('method', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>

          <div>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.actionConfig?.verify_ssl !== false}
                onChange={(e) => updateActionConfig('verify_ssl', e.target.checked)}
                className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Verify SSL Certificate</span>
            </label>
          </div>
        </div>
      </div>

      {/* Headers */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-3">Headers</h4>
        <div className="space-y-3">
          {/* Existing Headers */}
          {Object.entries(formData.actionConfig?.headers || {}).map(([key, value]) => (
            <div key={key} className="flex items-center space-x-2 bg-gray-50 rounded-lg p-2">
              <div className="flex-1 grid grid-cols-2 gap-2">
                <div className="text-sm font-medium text-gray-700">{key}</div>
                <div className="text-sm text-gray-600">{value as string}</div>
              </div>
              <button
                type="button"
                onClick={() => removeHeader(key)}
                className="text-red-600 hover:text-red-800"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}

          {/* Add Header */}
          <div className="flex space-x-2">
            <input
              type="text"
              value={headerKey}
              onChange={(e) => setHeaderKey(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              placeholder="Header name (e.g., Content-Type)"
            />
            <input
              type="text"
              value={headerValue}
              onChange={(e) => setHeaderValue(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              placeholder="Header value"
            />
            <button
              type="button"
              onClick={addHeader}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Authentication */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-3">Authentication</h4>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Auth Type
            </label>
            <select
              value={authType}
              onChange={(e) => updateActionConfig('auth_type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="none">None</option>
              <option value="basic">Basic Auth</option>
              <option value="bearer">Bearer Token</option>
            </select>
          </div>

          {authType === 'basic' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={formData.target?.username || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      target: { ...formData.target, username: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={formData.target?.password || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      target: { ...formData.target, password: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </>
          )}

          {authType === 'bearer' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bearer Token
              </label>
              <input
                type="password"
                value={formData.target?.token || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    target: { ...formData.target, token: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Body Template */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-3">Request Body Template</h4>
        <div>
          <textarea
            value={formData.actionConfig?.body_template || ''}
            onChange={(e) => updateActionConfig('body_template', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
            rows={8}
            placeholder={`{
  "channel_id": "{{channel_id}}",
  "signal": {{signal}},
  "timestamp": "{{timestamp}}"
}`}
          />
          <p className="text-xs text-gray-500 mt-1">
            Use template variables: <code className="bg-gray-100 px-1 rounded">{'{{channel_id}}'}</code>,{' '}
            <code className="bg-gray-100 px-1 rounded">{'{{signal}}'}</code>,{' '}
            <code className="bg-gray-100 px-1 rounded">{'{{timestamp}}'}</code>
          </p>
        </div>
      </div>

      {/* Advanced Settings */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-3">Advanced Settings</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Timeout (ms)
            </label>
            <input
              type="number"
              value={formData.timeoutMs}
              onChange={(e) =>
                setFormData({ ...formData, timeoutMs: parseInt(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              min="1000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Retries
            </label>
            <input
              type="number"
              value={formData.retryConfig?.maxRetries}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  retryConfig: {
                    ...formData.retryConfig!,
                    maxRetries: parseInt(e.target.value),
                  },
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              min="0"
              max="10"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.blocking}
              onChange={(e) => setFormData({ ...formData, blocking: e.target.checked })}
              className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">
              Blocking (wait for completion before next action)
            </span>
          </label>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          {action ? 'Update Action' : 'Add Action'}
        </button>
      </div>
    </form>
  );
}
