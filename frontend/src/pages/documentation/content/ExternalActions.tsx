// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React from 'react';
import { CodeBlock, Callout, Table } from '../components/DocComponents';
import { useDeploymentInfo } from '../components/useDeploymentInfo';
import { Radio, Tv, Globe } from 'lucide-react';

export const ExternalActions: React.FC = () => {
  const { awsRegion } = useDeploymentInfo();
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="p-8 border-b border-slate-200">
        <h1 className="text-3xl font-bold text-slate-900 mb-3 flex items-center gap-3">
          <Radio className="w-8 h-8 text-indigo-600" />
          External Actions
        </h1>
        <p className="text-lg text-slate-600">
          Trigger actions on external systems when SCTE-35 signals match channel rules
        </p>
      </div>

      <div className="p-8 space-y-8">
        {/* Overview */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Overview</h2>
          <p className="text-slate-700 leading-relaxed mb-4">
            External Actions allow you to execute operations on external systems (such as AWS Elemental
            MediaLive or HTTP webhooks) whenever a SCTE-35 signal matches a rule. Actions are configured
            <strong>per rule</strong> and execute synchronously within the same Lambda invocation that processes the signal.
          </p>
          <Callout type="info" title="Synchronous Execution">
            External actions run within the ESAM processing Lambda. The encoder waits for the full
            response, including the time spent calling external APIs (~100-500ms for MediaLive actions).
          </Callout>
        </section>

        {/* Action Execution Flow Diagram */}
        <div className="my-6 p-6 bg-slate-50 rounded-xl border border-slate-200">
          <svg viewBox="0 0 800 220" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <marker id="ah4" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6" fill="#94A3B8" />
            </marker>
          </defs>

          {/* Row 1: Signal Received → Rule Matched → Action Executor */}
          <rect x="60" y="40" width="150" height="46" rx="6" fill="#1E293B" stroke="#334155" strokeWidth="1.5" />
          <text x="135" y="58" textAnchor="middle" fontSize="12" fontWeight="600" fill="#FFFFFF" fontFamily="system-ui">Signal Received</text>
          <text x="135" y="74" textAnchor="middle" fontSize="10" fill="#94A3B8" fontFamily="system-ui">SCTE-35 input</text>

          <line x1="210" y1="63" x2="280" y2="63" stroke="#94A3B8" strokeWidth="1.5" markerEnd="url(#ah4)" />

          <rect x="280" y="40" width="150" height="46" rx="6" fill="#EEF2FF" stroke="#4F46E5" strokeWidth="1.5" />
          <text x="355" y="58" textAnchor="middle" fontSize="12" fontWeight="500" fill="#4338CA" fontFamily="system-ui">Rule Matched</text>
          <text x="355" y="74" textAnchor="middle" fontSize="10" fill="#6366F1" fontFamily="system-ui">Condition met</text>

          <line x1="430" y1="63" x2="500" y2="63" stroke="#94A3B8" strokeWidth="1.5" markerEnd="url(#ah4)" />

          <rect x="500" y="40" width="150" height="46" rx="6" fill="#EEF2FF" stroke="#4F46E5" strokeWidth="1.5" />
          <text x="575" y="58" textAnchor="middle" fontSize="12" fontWeight="600" fill="#4338CA" fontFamily="system-ui">Action Executor</text>
          <text x="575" y="74" textAnchor="middle" fontSize="10" fill="#6366F1" fontFamily="system-ui">Dispatch + retry</text>

          {/* Row 2: MediaLive and Webhook symmetric under Action Executor (center=575) */}
          {/* L-shape arrow to MediaLive: down from 540, then left to 465 */}
          <path d="M540,86 V115 H465 V142" fill="none" stroke="#94A3B8" strokeWidth="1.5" markerEnd="url(#ah4)" />

          {/* L-shape arrow to Webhook: down from 610, then right to 685 */}
          <path d="M610,86 V115 H685 V142" fill="none" stroke="#94A3B8" strokeWidth="1.5" markerEnd="url(#ah4)" />

          {/* MediaLive: center at x=465 */}
          <rect x="390" y="142" width="150" height="46" rx="6" fill="#FFFBEB" stroke="#F59E0B" strokeWidth="1.5" />
          <text x="465" y="160" textAnchor="middle" fontSize="12" fontWeight="500" fill="#92400E" fontFamily="system-ui">MediaLive</text>
          <text x="465" y="176" textAnchor="middle" fontSize="10" fill="#B45309" fontFamily="system-ui">Schedule actions</text>

          {/* Webhook: center at x=685 */}
          <rect x="610" y="142" width="150" height="46" rx="6" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.5" />
          <text x="685" y="160" textAnchor="middle" fontSize="12" fontWeight="500" fill="#334155" fontFamily="system-ui">Webhook</text>
          <text x="685" y="176" textAnchor="middle" fontSize="10" fill="#64748B" fontFamily="system-ui">HTTP POST</text>
        </svg>
          <p className="text-center text-xs text-slate-500 mt-3">External action execution: signals trigger plugin-based side effects when rules match</p>
        </div>{/* UI Preview - External Actions List */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Dashboard View</h2>
          <div className="my-8 rounded-lg border border-slate-300 overflow-hidden shadow-md">
            <div className="bg-slate-700 px-4 py-2 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <span className="text-xs text-slate-300 ml-2">POIS Dashboard: External Actions</span>
            </div>
            <div className="p-6 bg-slate-50">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Configured Actions</h3>
                <button className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg">
                  + Add Action
                </button>
              </div>
              {/* Actions Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Type</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Name</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Trigger</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                          <Globe className="w-3 h-3" /> Webhook
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">Notify Ad Server</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Active
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs font-mono">On splice_insert</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                          <Tv className="w-3 h-3" /> MediaLive
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">Switch to Ad Slate</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Active
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs font-mono">On provider_ad_start</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Add Action Modal */}
              <div className="mt-6 border border-indigo-200 rounded-lg bg-white shadow-lg overflow-hidden">
                <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-200 flex items-center justify-between">
                  <span className="text-sm font-semibold text-indigo-900">Add External Action</span>
                  <span className="text-slate-400 cursor-pointer text-lg">×</span>
                </div>
                <div className="p-5 space-y-4">
                  {/* Type Selector */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-2">Action Type</label>
                    <div className="flex gap-2">
                      <div className="flex-1 p-3 border-2 border-orange-300 bg-orange-50 rounded-lg text-center cursor-pointer">
                        <Tv className="w-5 h-5 text-orange-600 mx-auto mb-1" />
                        <span className="text-xs font-semibold text-orange-700">MediaLive</span>
                      </div>
                      <div className="flex-1 p-3 border border-slate-200 bg-white rounded-lg text-center cursor-pointer">
                        <Globe className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                        <span className="text-xs font-medium text-slate-500">Webhook</span>
                      </div>
                    </div>
                  </div>
                  {/* MediaLive Fields */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">MediaLive Channel ID *</label>
                      <div className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 text-xs font-mono">
                        1234567
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Schedule Action Type *</label>
                        <div className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 text-xs flex items-center justify-between">
                          <span>static_image_activate</span>
                          <span className="text-slate-400">▾</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Region</label>
                        <div className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 text-xs font-mono">
                          {awsRegion}
                        </div>
                      </div>
                    </div>
                    {/* Common Fields */}
                    <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Trigger Mode</label>
                        <div className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 text-xs flex items-center justify-between">
                          <span>on_match</span>
                          <span className="text-slate-400">▾</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Timeout (ms)</label>
                        <div className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 text-xs font-mono">5000</div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Blocking</label>
                        <div className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 text-xs">No</div>
                      </div>
                    </div>
                  </div>
                  {/* Footer */}
                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                    <button className="px-4 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-md">Cancel</button>
                    <button className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-md">Save Action</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="text-center text-sm text-slate-500 mt-2 italic">External actions list and configuration modal</p>
        </section>

        {/* Plugin Types */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Plugin Types</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Tv className="w-5 h-5 text-orange-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">MediaLive</h3>
              </div>
              <p className="text-sm text-slate-700 mb-3">
                Schedule actions on AWS Elemental MediaLive channels: input switching,
                graphic overlays, motion graphics, and more.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">Input Switch</span>
                <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">Graphic Overlay</span>
                <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">Motion Graphics</span>
              </div>
            </div>

            <div className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Globe className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Webhook</h3>
              </div>
              <p className="text-sm text-slate-700 mb-3">
                Send HTTP POST requests to external URLs with signal data and custom payloads
                for integration with third-party systems.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">HTTP POST</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">Custom Headers</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">Retry Logic</span>
              </div>
            </div>
          </div>
        </section>

        {/* Configuration */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Configuration</h2>
          <p className="text-slate-700 mb-4">
            Actions are defined in the channel configuration under the <code className="px-2 py-1 bg-slate-100 rounded text-sm">external_actions</code> field:
          </p>
          <CodeBlock code={`{
  "channelId": "my-channel",
  "name": "Production Channel",
  "rules": [...],
  "external_actions": [
    {
      "action_id": "switch-to-slate",
      "action_type": "medialive",
      "trigger_mode": "on_match",
      "enabled": true,
      "blocking": false,
      "order": 1,
      "timeout_ms": 5000,
      "target": {
        "channel_id": "1234567",
        "region": "${awsRegion}"
      },
      "action_config": {
        "action_type": "input_switch",
        "input_attachment_name": "slate-input"
      },
      "retry_config": {
        "max_retries": 3,
        "base_delay_seconds": 1
      }
    }
  ]
}`} language="json" />
        </section>

        {/* Trigger Modes */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Trigger Modes</h2>
          <Table
            headers={['Mode', 'Value', 'Description']}
            rows={[
              [
                <span className="font-semibold">On Match</span>,
                <code className="text-xs">on_match</code>,
                'Execute when a rule matches the signal'
              ],
              [
                <span className="font-semibold">On No Match</span>,
                <code className="text-xs">on_no_match</code>,
                'Execute when no rule matches (default action applies)'
              ],
              [
                <span className="font-semibold">Always</span>,
                <code className="text-xs">always</code>,
                'Execute on every signal regardless of rule match'
              ]
            ]}
          />
        </section>

        {/* MediaLive Example */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">MediaLive Plugin: Input Switch</h2>
          <p className="text-slate-700 mb-4">
            Trigger an input switch on a MediaLive channel when an ad break starts:
          </p>
          <CodeBlock code={`{
  "action_id": "ad-break-switch",
  "action_type": "medialive",
  "trigger_mode": "on_match",
  "target": {
    "channel_id": "1234567",
    "region": "${awsRegion}"
  },
  "action_config": {
    "action_type": "input_switch",
    "input_attachment_name": "ad-slate",
    "start_type": "IMMEDIATE"
  }
}`} language="json" />
          <Callout type="warning" title="IAM Permissions">
            The Lambda execution role must have <code>medialive:BatchUpdateSchedule</code> permission
            on the target MediaLive channel ARN.
          </Callout>
        </section>

        {/* Webhook Example */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Webhook Plugin</h2>
          <p className="text-slate-700 mb-4">
            Send a notification to an external system when a signal is processed:
          </p>
          <CodeBlock code={`{
  "action_id": "notify-ad-server",
  "action_type": "webhook",
  "trigger_mode": "on_match",
  "target": {
    "url": "https://ad-server.example.com/api/signal-event",
    "method": "POST"
  },
  "action_config": {
    "headers": {
      "Authorization": "Bearer {{secret:ad-server-token}}",
      "Content-Type": "application/json"
    },
    "include_signal_data": true,
    "include_rule_result": true
  }
}`} language="json" />
          <Callout type="info" title="Credential References">
            Use the <code>{"{{secret:<name>}}"}</code> syntax to reference credentials stored in
            AWS Secrets Manager. The system resolves these at runtime.
          </Callout>
        </section>

        {/* Execution Order */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Execution Order & Blocking</h2>
          <div className="space-y-4">
            <p className="text-slate-700">
              Actions execute in the order defined by the <code className="px-2 py-1 bg-slate-100 rounded text-sm">order</code> field.
              Set <code className="px-2 py-1 bg-slate-100 rounded text-sm">blocking: true</code> to make subsequent actions wait
              for the current one to complete before executing.
            </p>
            <Table
              headers={['Field', 'Type', 'Description']}
              rows={[
                ['order', 'integer', 'Execution priority (lower = first)'],
                ['blocking', 'boolean', 'If true, blocks subsequent actions until this one completes'],
                ['timeout_ms', 'integer', 'Maximum execution time in milliseconds (default: 5000)'],
                ['enabled', 'boolean', 'Whether the action is active']
              ]}
            />
          </div>
        </section>

        {/* Audit Trail */}
        <section className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100">
          <h3 className="text-lg font-semibold text-slate-900 mb-3">Audit Trail</h3>
          <p className="text-sm text-slate-700 mb-3">
            Every action execution is logged with full details including request/response payloads,
            duration, retry count, and result status. View the audit trail in the channel's
            "Action Logs" tab in the dashboard.
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Success</span>
            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">Failure</span>
            <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-full">Skipped</span>
          </div>
        </section>
      </div>
    </div>
  );
};
