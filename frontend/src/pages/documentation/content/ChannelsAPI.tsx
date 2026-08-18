// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React from 'react';
import { CodeBlock, Callout, MethodBadge, EndpointCard, Table } from '../components/DocComponents';
import { useDeploymentInfo } from '../components/useDeploymentInfo';
import { Radio } from 'lucide-react';

export const ChannelsAPI: React.FC = () => {
  const { apiUrl, awsRegion } = useDeploymentInfo();
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="p-8 border-b border-slate-200">
        <h1 className="text-3xl font-bold text-slate-900 mb-3 flex items-center gap-3">
          <Radio className="w-8 h-8 text-indigo-600" />
          Channels API
        </h1>
        <p className="text-lg text-slate-600">
          Full CRUD operations for managing POIS channel configurations
        </p>
      </div>

      <div className="p-8 space-y-8">
        {/* Endpoints Overview */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Endpoints</h2>
          <div className="grid gap-3">
            <EndpointCard method="GET" path="/channels" description="List all channels" />
            <EndpointCard method="GET" path="/channels/{id}" description="Get a specific channel by ID" />
            <EndpointCard method="POST" path="/channels" description="Create a new channel" />
            <EndpointCard method="PUT" path="/channels/{id}" description="Update an existing channel" />
            <EndpointCard method="DELETE" path="/channels/{id}" description="Delete a channel" />
          </div>
        </section>

        {/* Authentication */}
        <section>
          <Callout type="warning" title="Authentication Required">
            All channel endpoints require a valid JWT token via the <code>Authorization</code> header.
            POST, PUT, and DELETE operations require the <strong>admin</strong> role.
            GET operations are accessible to all authenticated users.
          </Callout>
        </section>

        {/* GET /channels */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
            <MethodBadge method="GET" />
            <code className="text-xl font-mono">/channels</code>
          </h2>
          <p className="text-slate-700 mb-4">
            Returns a list of all configured channels with their rules and settings.
          </p>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Response (200 OK)</h3>
          <CodeBlock code={`{
  "channels": [
    {
      "channelId": "sports-live-east",
      "name": "Sports Live East",
      "description": "Live sports channel - Eastern feed",
      "enabled": true,
      "defaultAction": "noop",
      "statefulMode": true,
      "descriptorPriority": "48,50,52",
      "rules": [...],
      "createdAt": "2024-01-10T08:00:00Z",
      "updatedAt": "2024-01-15T14:30:00Z"
    }
  ],
  "count": 1
}`} language="json" />
        </section>

        {/* GET /channels/{id} */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
            <MethodBadge method="GET" />
            <code className="text-xl font-mono">/channels/{'{id}'}</code>
          </h2>
          <p className="text-slate-700 mb-4">
            Returns the full configuration for a specific channel, including all rules, external actions, and auth config.
          </p>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Path Parameters</h3>
          <Table
            headers={['Parameter', 'Type', 'Description']}
            rows={[
              ['id', 'string', 'The channel ID (e.g., "sports-live-east")'],
            ]}
          />
          <h3 className="text-lg font-semibold text-slate-900 mb-2 mt-4">Response (200 OK)</h3>
          <CodeBlock code={`{
  "channelId": "sports-live-east",
  "name": "Sports Live East",
  "description": "Live sports channel - Eastern feed",
  "enabled": true,
  "defaultAction": "noop",
  "statefulMode": true,
  "descriptorPriority": "48,50,52",
  "autoAddDescriptors": false,
  "actionsEnabled": true,
  "actionsDryRun": false,
  "authConfig": {
    "authEnabled": false,
    "username": null,
    "ssmParameterPath": null
  },
  "rules": [
    {
      "ruleId": "block-short-breaks",
      "name": "Block Short Breaks",
      "priority": 1,
      "enabled": true,
      "conditions": [
        {
          "field": "segmentationTypeId",
          "operator": "eq",
          "value": 48
        },
        {
          "field": "duration",
          "operator": "lt",
          "value": 30
        }
      ],
      "action": "delete",
      "modifications": [],
      "description": "Delete ad breaks shorter than 30 seconds"
    }
  ],
  "createdAt": "2024-01-10T08:00:00Z",
  "updatedAt": "2024-01-15T14:30:00Z",
  "createdBy": "admin@example.com"
}`} language="json" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2 mt-4">Error (404 Not Found)</h3>
          <CodeBlock code={`{
  "error": "Channel not found",
  "correlationId": "abc-123-def-456"
}`} language="json" />
        </section>

        {/* POST /channels */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
            <MethodBadge method="POST" />
            <code className="text-xl font-mono">/channels</code>
          </h2>
          <p className="text-slate-700 mb-4">
            Create a new channel with rules, descriptor priority, stateful mode, and external actions.
          </p>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Request Body</h3>
          <CodeBlock code={`{
  "channelId": "news-national",
  "name": "National News Channel",
  "description": "24/7 news channel with regional ad insertion",
  "enabled": true,
  "defaultAction": "noop",
  "statefulMode": true,
  "descriptorPriority": "48,50,52,54",
  "autoAddDescriptors": false,
  "actionsEnabled": true,
  "actionsDryRun": false,
  "authConfig": {
    "authEnabled": true,
    "username": "esam-encoder"
  },
  "rules": [
    {
      "ruleId": "provider-ad-start",
      "name": "Provider Ad Start",
      "priority": 1,
      "enabled": true,
      "conditions": [
        {
          "field": "segmentationTypeId",
          "operator": "eq",
          "value": 48
        },
        {
          "field": "duration",
          "operator": "gte",
          "value": 30
        }
      ],
      "action": "replace",
      "modifications": [
        {
          "target": "segmentationDuration",
          "operation": "set",
          "value": 120
        }
      ],
      "description": "Normalize provider ad breaks to 120s"
    },
    {
      "ruleId": "delete-short-signals",
      "name": "Delete Short Signals",
      "priority": 2,
      "enabled": true,
      "conditions": [
        {
          "field": "duration",
          "operator": "lt",
          "value": 10
        }
      ],
      "action": "delete",
      "modifications": [],
      "description": "Remove signals shorter than 10 seconds"
    }
  ],
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
        "input_attachment_name": "ad-slate"
      }
    }
  ]
}`} language="json" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2 mt-4">Response (201 Created)</h3>
          <CodeBlock code={`{
  "channelId": "news-national",
  "name": "National News Channel",
  "enabled": true,
  "createdAt": "2024-01-20T10:00:00Z",
  "updatedAt": "2024-01-20T10:00:00Z",
  "createdBy": "admin@example.com"
}`} language="json" />
          <Callout type="info" title="Validation">
            The API validates all rules, conditions, and modifications against the schema. Invalid
            configurations return a 400 error with details about which fields failed validation.
          </Callout>
        </section>

        {/* PUT /channels/{id} */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
            <MethodBadge method="PUT" />
            <code className="text-xl font-mono">/channels/{'{id}'}</code>
          </h2>
          <p className="text-slate-700 mb-4">
            Update an existing channel. The request body should contain the full channel configuration,
            this is a full replacement, not a partial update.
          </p>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Request Body</h3>
          <p className="text-slate-700 mb-4">
            Same schema as POST. The <code className="px-2 py-1 bg-slate-100 rounded text-sm">channelId</code> in
            the body must match the <code className="px-2 py-1 bg-slate-100 rounded text-sm">id</code> path parameter.
          </p>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Response (200 OK)</h3>
          <CodeBlock code={`{
  "channelId": "news-national",
  "name": "National News Channel (Updated)",
  "enabled": true,
  "updatedAt": "2024-01-21T09:15:00Z"
}`} language="json" />
        </section>

        {/* DELETE /channels/{id} */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
            <MethodBadge method="DELETE" />
            <code className="text-xl font-mono">/channels/{'{id}'}</code>
          </h2>
          <p className="text-slate-700 mb-4">
            Delete a channel and all its associated state (including DynamoDB state records).
          </p>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Response (200 OK)</h3>
          <CodeBlock code={`{
  "message": "Channel deleted successfully",
  "channelId": "news-national",
  "correlationId": "abc-123-def-456"
}`} language="json" />
          <Callout type="error" title="Destructive Operation">
            Deleting a channel removes all configuration and state. This action cannot be undone.
            The ESAM endpoint will return NOOP for any signals referencing the deleted channel.
          </Callout>
        </section>

        {/* Channel JSON Schema */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Channel Schema Reference</h2>
          <Table
            headers={['Field', 'Type', 'Required', 'Description']}
            rows={[
              [<code className="text-xs">channelId</code>, 'string', 'Yes', 'Unique identifier for the channel'],
              [<code className="text-xs">name</code>, 'string', 'Yes', 'Human-readable channel name'],
              [<code className="text-xs">description</code>, 'string', 'No', 'Optional description'],
              [<code className="text-xs">enabled</code>, 'boolean', 'No', 'Whether the channel is active (default: true)'],
              [<code className="text-xs">defaultAction</code>, 'string', 'Yes', 'Action when no rule matches: "noop", "delete", or "replace"'],
              [<code className="text-xs">statefulMode</code>, 'boolean', 'No', 'Enable ad break state tracking (default: false)'],
              [<code className="text-xs">descriptorPriority</code>, 'string', 'No', 'Comma-separated segmentation_type_ids for priority order'],
              [<code className="text-xs">autoAddDescriptors</code>, 'boolean', 'No', 'Auto-add missing descriptors (default: false)'],
              [<code className="text-xs">actionsEnabled</code>, 'boolean', 'No', 'Enable external actions (default: true)'],
              [<code className="text-xs">actionsDryRun</code>, 'boolean', 'No', 'Log actions without executing (default: false)'],
              [<code className="text-xs">authConfig</code>, 'object', 'No', 'Basic auth settings for ESAM endpoint'],
              [<code className="text-xs">rules</code>, 'Rule[]', 'No', 'Array of processing rules'],
              [<code className="text-xs">external_actions</code>, 'Action[]', 'No', 'Array of external action configurations'],
            ]}
          />
        </section>

        {/* Rule Schema */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Rule Schema</h2>
          <Table
            headers={['Field', 'Type', 'Required', 'Description']}
            rows={[
              [<code className="text-xs">ruleId</code>, 'string', 'Yes', 'Unique rule identifier'],
              [<code className="text-xs">name</code>, 'string', 'Yes', 'Human-readable rule name'],
              [<code className="text-xs">priority</code>, 'integer', 'No', 'Evaluation order (lower = first, default: 0)'],
              [<code className="text-xs">enabled</code>, 'boolean', 'No', 'Whether the rule is active (default: true)'],
              [<code className="text-xs">conditions</code>, 'Condition[]', 'Yes', 'Array of conditions (all must match; AND logic)'],
              [<code className="text-xs">action</code>, 'string', 'Yes', '"delete", "noop", or "replace"'],
              [<code className="text-xs">modifications</code>, 'Modification[]', 'No', 'Signal modifications (only for "replace" action)'],
              [<code className="text-xs">description</code>, 'string', 'No', 'Optional description'],
            ]}
          />
        </section>

        {/* Condition Fields */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Available Condition Fields</h2>
          <Table
            headers={['Field', 'Description', 'Operators']}
            rows={[
              [<code className="text-xs">commandType</code>, 'Splice command type (5=splice_insert, 6=time_signal)', 'eq, ne, in'],
              [<code className="text-xs">segmentationTypeId</code>, 'Segmentation type ID (e.g., 48=provider_ad_start)', 'eq, ne, gt, lt, gte, lte, in, range'],
              [<code className="text-xs">duration</code>, 'Break/segmentation duration in seconds', 'eq, ne, gt, lt, gte, lte, range'],
              [<code className="text-xs">outOfNetwork</code>, 'Whether signal is out-of-network', 'eq'],
              [<code className="text-xs">eventId</code>, 'Splice event ID', 'eq, ne, in'],
              [<code className="text-xs">upidType</code>, 'UPID type identifier', 'eq, ne, in'],
              [<code className="text-xs">upidValue</code>, 'UPID value string', 'eq, ne'],
              [<code className="text-xs">tier</code>, 'Tier value from splice_info_section', 'eq, ne, gt, lt'],
              [<code className="text-xs">descriptorCount</code>, 'Number of segmentation descriptors', 'eq, ne, gt, lt, gte, lte'],
              [<code className="text-xs">zoneIdentity</code>, 'Zone identity from ESAM acquisition point', 'eq, ne, in'],
            ]}
          />
        </section>

        {/* cURL Examples */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Examples</h2>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">List Channels</h3>
          <CodeBlock code={`curl -X GET ${apiUrl}/channels \\
  -H "Authorization: Bearer <token>"`} />
          <h3 className="text-lg font-semibold text-slate-900 mb-2 mt-4">Create Channel</h3>
          <CodeBlock code={`curl -X POST ${apiUrl}/channels \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "channelId": "my-channel",
    "name": "My Channel",
    "defaultAction": "noop",
    "statefulMode": false,
    "rules": []
  }'`} />
          <h3 className="text-lg font-semibold text-slate-900 mb-2 mt-4">Delete Channel</h3>
          <CodeBlock code={`curl -X DELETE ${apiUrl}/channels/my-channel \\
  -H "Authorization: Bearer <token>"`} />
        </section>
      </div>
    </div>
  );
};
