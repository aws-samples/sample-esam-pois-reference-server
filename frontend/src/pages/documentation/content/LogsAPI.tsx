// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React from 'react';
import { CodeBlock, Callout, MethodBadge, EndpointCard, Table } from '../components/DocComponents';
import { useDeploymentInfo } from '../components/useDeploymentInfo';
import { FileText } from 'lucide-react';

export const LogsAPI: React.FC = () => {
  const { apiUrl } = useDeploymentInfo();
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="p-8 border-b border-slate-200">
        <h1 className="text-3xl font-bold text-slate-900 mb-3 flex items-center gap-3">
          <FileText className="w-8 h-8 text-indigo-600" />
          Logs API
        </h1>
        <p className="text-lg text-slate-600">
          Query ESAM signal processing logs and audit trail
        </p>
      </div>

      <div className="p-8 space-y-8">
        {/* Endpoints Overview */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Endpoints</h2>
          <div className="grid gap-3">
            <EndpointCard method="GET" path="/logs" description="Query all signal processing logs with filters" />
            <EndpointCard method="GET" path="/logs/sources" description="List available log sources" />
            <EndpointCard method="GET" path="/channels/{id}/logs" description="Query logs for a specific channel" />
          </div>
        </section>

        {/* GET /logs */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
            <MethodBadge method="GET" />
            <code className="text-xl font-mono">/logs</code>
          </h2>
          <p className="text-slate-700 mb-4">
            Query signal processing logs with optional filters for channel, action, time range, and text search.
            Results are returned from CloudWatch Logs Insights queries.
          </p>

          <h3 className="text-lg font-semibold text-slate-900 mb-2">Query Parameters</h3>
          <Table
            headers={['Parameter', 'Type', 'Default', 'Description']}
            rows={[
              [<code className="text-xs">channelId</code>, 'string', '-', 'Filter by channel ID'],
              [<code className="text-xs">action</code>, 'string', '-', 'Filter by action taken (delete, noop, replace)'],
              [<code className="text-xs">source</code>, 'string', '-', 'Filter by log source (e.g., "esam")'],
              [<code className="text-xs">limit</code>, 'integer', '100', 'Maximum number of events to return'],
              [<code className="text-xs">startTime</code>, 'string', '-', 'Start time (ISO 8601 or epoch ms)'],
              [<code className="text-xs">endTime</code>, 'string', '-', 'End time (ISO 8601 or epoch ms)'],
              [<code className="text-xs">search</code>, 'string', '-', 'Free-text search across log messages'],
              [<code className="text-xs">nextToken</code>, 'string', '-', 'Pagination token from previous response'],
            ]}
          />

          <h3 className="text-lg font-semibold text-slate-900 mb-2 mt-4">Response (200 OK)</h3>
          <CodeBlock code={`{
  "events": [
    {
      "timestamp": "2024-01-15T10:30:01.234Z",
      "channelId": "sports-live-east",
      "correlationId": "corr-abc-123",
      "action": "replace",
      "message": "Rule evaluation complete",
      "level": "INFO",
      "matchedRuleId": "provider-ad-start",
      "commandType": 6,
      "segmentationTypeId": 48,
      "processingTimeMs": 45.2,
      "source": "esam"
    },
    {
      "timestamp": "2024-01-15T10:30:00.891Z",
      "channelId": "sports-live-east",
      "correlationId": "corr-abc-123",
      "action": "delete",
      "message": "In active break - signal deleted (stateful mode)",
      "level": "INFO",
      "processingTimeMs": 12.1,
      "source": "esam"
    }
  ],
  "count": 2,
  "nextToken": "eyJ0b2tlbiI6Ijk4NzY1..."
}`} language="json" />
          <Callout type="info" title="Pagination">
            If more results are available, the response includes a <code>nextToken</code> field.
            Pass this value as a query parameter in the next request to retrieve the next page.
          </Callout>
        </section>

        {/* GET /logs/sources */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
            <MethodBadge method="GET" />
            <code className="text-xl font-mono">/logs/sources</code>
          </h2>
          <p className="text-slate-700 mb-4">
            Returns the configured log sources (CloudWatch Log Groups) available for querying.
          </p>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Response (200 OK)</h3>
          <CodeBlock code={`[
  {
    "logGroupName": "/aws/lambda/pois-esam-handler",
    "sourceLabel": "esam",
    "displayName": "ESAM Signals"
  },
  {
    "logGroupName": "/aws/lambda/pois-external-actions",
    "sourceLabel": "actions",
    "displayName": "External Actions"
  }
]`} language="json" />
        </section>

        {/* GET /channels/{id}/logs */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
            <MethodBadge method="GET" />
            <code className="text-xl font-mono">/channels/{'{id}'}/logs</code>
          </h2>
          <p className="text-slate-700 mb-4">
            Query logs for a specific channel. This is a convenience endpoint that automatically
            filters by the specified channel ID.
          </p>

          <h3 className="text-lg font-semibold text-slate-900 mb-2">Path Parameters</h3>
          <Table
            headers={['Parameter', 'Type', 'Description']}
            rows={[
              ['id', 'string', 'The channel ID to query logs for'],
            ]}
          />

          <h3 className="text-lg font-semibold text-slate-900 mb-2 mt-4">Query Parameters</h3>
          <Table
            headers={['Parameter', 'Type', 'Default', 'Description']}
            rows={[
              [<code className="text-xs">limit</code>, 'integer', '100', 'Maximum events to return'],
              [<code className="text-xs">startTime</code>, 'string', '-', 'Start time filter'],
              [<code className="text-xs">endTime</code>, 'string', '-', 'End time filter'],
              [<code className="text-xs">nextToken</code>, 'string', '-', 'Pagination token'],
            ]}
          />

          <h3 className="text-lg font-semibold text-slate-900 mb-2 mt-4">Response (200 OK)</h3>
          <CodeBlock code={`{
  "events": [
    {
      "timestamp": "2024-01-15T10:30:01.234Z",
      "channelId": "sports-live-east",
      "correlationId": "corr-def-456",
      "action": "noop",
      "message": "Signal passed through",
      "level": "INFO",
      "commandType": 5,
      "processingTimeMs": 23.7,
      "source": "esam"
    }
  ],
  "count": 1
}`} language="json" />
        </section>

        {/* Log Entry Schema */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Log Entry Schema</h2>
          <p className="text-slate-700 mb-4">
            Each log event contains structured data about the signal processing operation:
          </p>
          <Table
            headers={['Field', 'Type', 'Description']}
            rows={[
              [<code className="text-xs">timestamp</code>, 'string (ISO)', 'When the event occurred'],
              [<code className="text-xs">channelId</code>, 'string', 'Channel that processed the signal'],
              [<code className="text-xs">correlationId</code>, 'string', 'Unique ID linking related log entries'],
              [<code className="text-xs">action</code>, 'string', 'Action taken: "delete", "noop", or "replace"'],
              [<code className="text-xs">message</code>, 'string', 'Human-readable log message'],
              [<code className="text-xs">level</code>, 'string', 'Log level (INFO, WARNING, ERROR)'],
              [<code className="text-xs">matchedRuleId</code>, 'string?', 'Rule that matched (if any)'],
              [<code className="text-xs">commandType</code>, 'integer?', 'SCTE-35 command type (5=splice_insert, 6=time_signal)'],
              [<code className="text-xs">segmentationTypeId</code>, 'integer?', 'Segmentation type from descriptor'],
              [<code className="text-xs">processingTimeMs</code>, 'number', 'Time taken to process signal (ms)'],
              [<code className="text-xs">source</code>, 'string', 'Log source label (e.g., "esam", "actions")'],
            ]}
          />
        </section>

        {/* Time Parameters */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Time Parameter Formats</h2>
          <p className="text-slate-700 mb-4">
            The <code className="px-2 py-1 bg-slate-100 rounded text-sm">startTime</code> and <code className="px-2 py-1 bg-slate-100 rounded text-sm">endTime</code> parameters
            accept multiple formats:
          </p>
          <Table
            headers={['Format', 'Example', 'Description']}
            rows={[
              ['ISO 8601', <code className="text-xs">2024-01-15T10:30:00Z</code>, 'UTC timestamp'],
              ['Epoch seconds', <code className="text-xs">1705318200</code>, 'Unix timestamp in seconds'],
              ['Epoch milliseconds', <code className="text-xs">1705318200000</code>, 'Unix timestamp in milliseconds (auto-detected if &gt; 1 trillion)'],
            ]}
          />
        </section>

        {/* Examples */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Examples</h2>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Query Recent Logs</h3>
          <CodeBlock code={`curl -X GET "${apiUrl}/logs?limit=50" \\
  -H "Authorization: Bearer <token>"`} />

          <h3 className="text-lg font-semibold text-slate-900 mb-2 mt-4">Filter by Channel and Action</h3>
          <CodeBlock code={`curl -X GET "${apiUrl}/logs?channelId=sports-live-east&action=delete&limit=20" \\
  -H "Authorization: Bearer <token>"`} />

          <h3 className="text-lg font-semibold text-slate-900 mb-2 mt-4">Time Range Query</h3>
          <CodeBlock code={`curl -X GET "${apiUrl}/logs?startTime=2024-01-15T10:00:00Z&endTime=2024-01-15T11:00:00Z" \\
  -H "Authorization: Bearer <token>"`} />

          <h3 className="text-lg font-semibold text-slate-900 mb-2 mt-4">Channel-Specific Logs</h3>
          <CodeBlock code={`curl -X GET "${apiUrl}/channels/sports-live-east/logs?limit=25" \\
  -H "Authorization: Bearer <token>"`} />
        </section>

        {/* Error Responses */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Error Responses</h2>
          <Table
            headers={['Status Code', 'Reason', 'Example']}
            rows={[
              ['400', 'Invalid source parameter', <code className="text-xs">Invalid source. Valid sources: esam, actions</code>],
              ['405', 'Method not allowed', <code className="text-xs">Only GET is supported</code>],
              ['500', 'Internal error', <code className="text-xs">Failed to query logs</code>],
            ]}
          />
          <Callout type="warning" title="CloudWatch Logs Latency">
            Log events may take 1-5 seconds to appear in query results after the signal is processed.
            This is due to CloudWatch Logs ingestion latency.
          </Callout>
        </section>
      </div>
    </div>
  );
};
