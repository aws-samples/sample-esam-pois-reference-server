// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React from 'react';
import { CodeBlock, Callout } from '../components/DocComponents';
import { useDeploymentInfo } from '../components/useDeploymentInfo';
import { AlertCircle, XCircle } from 'lucide-react';

export const Troubleshooting: React.FC = () => {
  const { apiUrl } = useDeploymentInfo();
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="p-8 border-b border-slate-200">
        <h1 className="text-3xl font-bold text-slate-900 mb-3 flex items-center gap-3">
          <AlertCircle className="w-8 h-8 text-indigo-600" />
          Troubleshooting
        </h1>
        <p className="text-lg text-slate-600">
          Solutions for common problems
        </p>
      </div>

      <div className="p-8 space-y-8">
        {/* Problem 1 */}
        <section className="border border-slate-200 rounded-xl p-6">
          <div className="flex items-start gap-3 mb-4">
            <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                Signals are not being processed
              </h2>
              <p className="text-slate-600">Channel returns NOOP for all signals</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <span className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center text-red-700 text-sm">1</span>
                Symptoms
              </h3>
              <ul className="ml-8 space-y-1 text-slate-700 text-sm">
                <li>• All signals return StatusNote "Channel not registered"</li>
                <li>• Or StatusNote "Channel is disabled"</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <span className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 text-sm">2</span>
                Possible Causes
              </h3>
              <ul className="ml-8 space-y-1 text-slate-700 text-sm">
                <li>• Channel doesn't exist in DynamoDB</li>
                <li>• Channel name (AcquisitionPointIdentity) doesn't match</li>
                <li>• Channel is disabled (enabled: false)</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <span className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-green-700 text-sm">3</span>
                Solutions
              </h3>
              <div className="ml-8 space-y-3">
                <div>
                  <p className="text-sm font-medium text-slate-900 mb-1">Check if channel exists:</p>
                  <CodeBlock code={`curl -X GET ${apiUrl}/channels`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 mb-1">Enable channel:</p>
                  <CodeBlock code={`curl -X PUT ${apiUrl}/channels/{id} \\
  -H "Content-Type: application/json" \\
  -d '{"enabled": true}'`} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem 2 */}
        <section className="border border-slate-200 rounded-xl p-6">
          <div className="flex items-start gap-3 mb-4">
            <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                Rules are not matching
              </h2>
              <p className="text-slate-600">Signals don't trigger configured rules</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <span className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-green-700 text-sm">3</span>
                Solutions
              </h3>
              <div className="ml-8 space-y-3">
                <Callout type="info" title="Tip">
                  Use the SCTE-35 decoder to see all descriptors present in the signal and configure descriptor_priority appropriately.
                </Callout>
                <div>
                  <p className="text-sm font-medium text-slate-900 mb-1">Check CloudWatch logs:</p>
                  <CodeBlock code={`fields @timestamp, channelId, ruleId, action
| filter channelId = "your-channel-id"
| sort @timestamp desc
| limit 50`} language="sql" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Support Section */}
        <section className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Need More Help?</h2>
          <div className="space-y-3 text-sm text-slate-700">
            <div className="flex items-start gap-2">
              <span className="text-indigo-600 mt-1">1.</span>
              <span>Check CloudWatch logs for detailed error messages</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-indigo-600 mt-1">2.</span>
              <span>Use the correlation ID to track specific requests</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-indigo-600 mt-1">3.</span>
              <span>Consult the API documentation for correct usage examples</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
