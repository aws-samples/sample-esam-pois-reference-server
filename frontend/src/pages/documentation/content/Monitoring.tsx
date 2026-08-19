// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React from 'react';
import { CodeBlock, Callout } from '../components/DocComponents';
import { Activity, Bell, FileText } from 'lucide-react';

export const Metrics: React.FC = () => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="p-8 border-b border-slate-200">
        <h1 className="text-3xl font-bold text-slate-900 mb-3 flex items-center gap-3">
          <Activity className="w-8 h-8 text-indigo-600" />
          Metrics
        </h1>
        <p className="text-lg text-slate-600">
          Monitor system health and performance
        </p>
      </div>

      <div className="p-8 space-y-8">
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Key Metrics</h2>
          <p className="text-slate-700 leading-relaxed mb-4">
            The CloudWatch dashboard created by the monitoring stack graphs API Gateway
            request count, errors and latency, Lambda duration and errors, and DynamoDB
            capacity consumption. Signal throughput and response time depend on your
            payloads, rule sets, external actions and traffic pattern.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Throughput</h3>
              <p className="text-sm text-slate-600">
                Bounded by the API Gateway stage throttling limits of the deployed
                environment profile and by your Lambda concurrency.
              </p>
            </div>

            <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Response time</h3>
              <p className="text-sm text-slate-600">
                Measure it in your own environment. External actions run inside the ESAM
                request path, so their timeouts and retries add to encoder response time.
              </p>
            </div>
          </div>
          <Callout type="info" title="No published benchmark">
            This sample does not ship latency or throughput benchmarks. Use the dashboard,
            X-Ray traces and your own load tests to establish baselines before relying on
            the service in a signal path.
          </Callout>
        </section>

        {/* UI Preview - Live Event Feed */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Live Event Feed</h2>
          <div className="my-8 rounded-lg border border-slate-300 overflow-hidden shadow-md">
            <div className="bg-slate-700 px-4 py-2 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <span className="text-xs text-slate-300 ml-2">POIS Dashboard: Signal Monitoring</span>
            </div>
            <div className="p-6 bg-slate-50">
              {/* Filter bar */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs font-medium text-green-700">Live</span>
                  <span className="text-xs text-slate-400 ml-2">Last updated: 2s ago</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1 border border-slate-300 rounded-md bg-white text-xs text-slate-700">
                    All Channels ▾
                  </div>
                  <div className="px-3 py-1 border border-slate-300 rounded-md bg-white text-xs text-slate-700">
                    Last 1 hour ▾
                  </div>
                </div>
              </div>
              {/* Events Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="text-left px-4 py-2.5 font-semibold text-slate-600 uppercase tracking-wider">Time</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-slate-600 uppercase tracking-wider">Channel</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-slate-600 uppercase tracking-wider">Signal Type</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-slate-600 uppercase tracking-wider">Action Taken</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-slate-600 uppercase tracking-wider">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-500 font-mono">14:32:08.123</td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">live-east-01</td>
                      <td className="px-4 py-2.5 text-slate-700">splice_insert (0x30)</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex px-2 py-0.5 bg-green-100 text-green-700 font-semibold rounded-full">Passed</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">30.0s</td>
                    </tr>
                    <tr className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-500 font-mono">14:31:55.890</td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">live-west-02</td>
                      <td className="px-4 py-2.5 text-slate-700">provider_ad_start (0x30)</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex px-2 py-0.5 bg-red-100 text-red-700 font-semibold rounded-full">Deleted</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">-</td>
                    </tr>
                    <tr className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-500 font-mono">14:31:42.456</td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">live-east-01</td>
                      <td className="px-4 py-2.5 text-slate-700">distributor_po_start (0x34)</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex px-2 py-0.5 bg-yellow-100 text-yellow-800 font-semibold rounded-full">Modified</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">60.0s → 45.0s</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-500 font-mono">14:31:30.012</td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">live-central-03</td>
                      <td className="px-4 py-2.5 text-slate-700">splice_insert (0x32)</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex px-2 py-0.5 bg-green-100 text-green-700 font-semibold rounded-full">Passed</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">15.0s</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {/* Summary stats */}
              <div className="mt-4 flex items-center gap-6 text-xs text-slate-500">
                <span>Total: <strong className="text-slate-700">1,247</strong> signals (last hour)</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full" /> 892 passed</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full" /> 198 deleted</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-500 rounded-full" /> 157 modified</span>
              </div>
            </div>
          </div>
          <p className="text-center text-sm text-slate-500 mt-2 italic">Real-time ESAM signal monitoring with color-coded status badges</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Access Metrics</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Via AWS Console</h3>
              <ol className="space-y-2 text-slate-700">
                <li>1. Access CloudWatch Console</li>
                <li>2. Navigate to Metrics → All metrics</li>
                <li>3. Select namespace "POIS/Processing"</li>
              </ol>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Via AWS CLI</h3>
              <CodeBlock code={`# Get processing metrics
aws cloudwatch get-metric-statistics \\
  --namespace POIS/Processing \\
  --metric-name SignalsProcessed \\
  --start-time 2024-01-15T00:00:00Z \\
  --end-time 2024-01-15T23:59:59Z \\
  --period 3600 \\
  --statistics Sum`} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export const Alarms: React.FC = () => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="p-8 border-b border-slate-200">
        <h1 className="text-3xl font-bold text-slate-900 mb-3 flex items-center gap-3">
          <Bell className="w-8 h-8 text-indigo-600" />
          Alarms
        </h1>
        <p className="text-lg text-slate-600">
          Configure alerts for critical issues
        </p>
      </div>

      <div className="p-8 space-y-8">
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Recommended Alarms</h2>
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-red-900">High Error Rate</h3>
                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">Critical</span>
              </div>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-red-700 font-medium mb-1">Condition</div>
                  <div className="text-red-800">Error rate &gt; 5%</div>
                </div>
                <div>
                  <div className="text-red-700 font-medium mb-1">Action</div>
                  <div className="text-red-800">Investigate logs immediately</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Callout type="warning" title="Notifications">
          Configure an SNS topic to receive notifications via email or SMS when alarms are triggered.
        </Callout>
      </div>
    </div>
  );
};

export const LogsMonitoring: React.FC = () => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="p-8 border-b border-slate-200">
        <h1 className="text-3xl font-bold text-slate-900 mb-3 flex items-center gap-3">
          <FileText className="w-8 h-8 text-indigo-600" />
          Logs
        </h1>
        <p className="text-lg text-slate-600">
          Access and analyze system logs
        </p>
      </div>

      <div className="p-8 space-y-8">
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Useful Queries</h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Search Errors</h3>
              <CodeBlock code={`fields @timestamp, @message, channelId, error
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100`} language="sql" />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Performance by Channel</h3>
              <CodeBlock code={`fields channelId, processingTimeMs
| stats avg(processingTimeMs) as avgTime by channelId
| sort avgTime desc`} language="sql" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
