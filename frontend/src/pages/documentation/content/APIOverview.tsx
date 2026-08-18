// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React from 'react';
import { EndpointCard, Callout, CodeBlock } from '../components/DocComponents';
import { useDeploymentInfo } from '../components/useDeploymentInfo';
import { Globe, Zap, Shield } from 'lucide-react';

export const APIOverview: React.FC = () => {
  const { apiUrl } = useDeploymentInfo();
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="p-8 border-b border-slate-200">
        <h1 className="text-3xl font-bold text-slate-900 mb-3">API Reference</h1>
        <p className="text-lg text-slate-600">
          Complete REST API for management and processing
        </p>
      </div>

      <div className="p-8 space-y-8">
        {/* Base URL */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Globe className="w-6 h-6 text-indigo-600" />
            Base URL
          </h2>
          <CodeBlock code={apiUrl} language="text" />
        </section>

        {/* Endpoints */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Available Endpoints</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Zap className="w-5 h-5 text-indigo-600" />
                ESAM Processing
              </h3>
              <EndpointCard
                method="POST"
                path="/esam"
                description="Process SCTE-35 signals via ESAM (SCTE-130 Part 9)"
              />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                Channel Management
              </h3>
              <div className="space-y-3">
                <EndpointCard method="GET" path="/channels" description="List all channels" />
                <EndpointCard method="POST" path="/channels" description="Create a new channel" />
                <EndpointCard method="GET" path="/channels/{id}" description="Get channel details" />
                <EndpointCard method="PUT" path="/channels/{id}" description="Update a channel" />
                <EndpointCard method="DELETE" path="/channels/{id}" description="Delete a channel" />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Logs</h3>
              <div className="space-y-3">
                <EndpointCard method="GET" path="/logs" description="Query system logs" />
                <EndpointCard method="GET" path="/channels/{id}/logs" description="Logs for a specific channel" />
              </div>
            </div>
          </div>
        </section>

        {/* Rate Limiting */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Rate Limiting</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-sm text-slate-600 mb-1">Burst Limit</div>
              <div className="text-2xl font-bold text-slate-900">100 requests</div>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-sm text-slate-600 mb-1">Rate Limit</div>
              <div className="text-2xl font-bold text-slate-900">50 req/s</div>
            </div>
          </div>
        </section>

        {/* Response Format */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Response Format</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Success (2xx)</h3>
              <CodeBlock code={`{
  "status": "success",
  "data": { ... }
}`} language="json" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Error (4xx, 5xx)</h3>
              <CodeBlock code={`{
  "error": "Error message",
  "details": "Additional details",
  "correlationId": "uuid"
}`} language="json" />
            </div>
          </div>
        </section>

        <Callout type="info" title="CORS Enabled">
          The API is configured with CORS for all origins in development. Configure specific origins in production.
        </Callout>
      </div>
    </div>
  );
};
