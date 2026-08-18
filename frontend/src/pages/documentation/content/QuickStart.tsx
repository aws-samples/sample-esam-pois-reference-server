// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React from 'react';
import { CodeBlock, Callout } from '../components/DocComponents';
import { useDeploymentInfo } from '../components/useDeploymentInfo';
import { useDocNavigation } from '../components/NavigationContext';
import { Terminal, Package, Rocket } from 'lucide-react';

export const QuickStart: React.FC = () => {
  const { apiUrl, esamEndpoint } = useDeploymentInfo();
  const { navigateTo } = useDocNavigation();
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="p-8 border-b border-slate-200">
        <h1 className="text-3xl font-bold text-slate-900 mb-3">Quick Start</h1>
        <p className="text-lg text-slate-600">
          Set up and run POIS Reference Server in minutes
        </p>
      </div>

      <div className="p-8 space-y-8">
        {/* Prerequisites */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Package className="w-6 h-6 text-indigo-600" />
            Prerequisites
          </h2>
          <ul className="space-y-2 text-slate-700">
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 mt-1">•</span>
              <span>AWS Account with appropriate permissions</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 mt-1">•</span>
              <span>Node.js 20+ and npm</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 mt-1">•</span>
              <span>Python 3.12+</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 mt-1">•</span>
              <span>AWS CDK installed globally</span>
            </li>
          </ul>
        </section>

        {/* Installation Steps */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Terminal className="w-6 h-6 text-indigo-600" />
            Installation
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3">1. Clone the repository</h3>
              <CodeBlock code={`git clone https://github.com/aws-samples/sample-esam-pois-reference-server.git
cd sample-esam-pois-reference-server`} />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3">2. Install dependencies</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Backend</p>
                  <CodeBlock code={`cd backend
pip install -r requirements-dev.txt`} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Frontend</p>
                  <CodeBlock code={`cd ../frontend
npm install`} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Infrastructure</p>
                  <CodeBlock code={`cd ../infrastructure
npm install`} />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3">3. Deploy infrastructure</h3>
              <CodeBlock code={`cd infrastructure
npx cdk deploy --all -c adminEmail=you@example.com`} />
              <Callout type="info" title="Initial admin">
                The adminEmail context creates the first admin user: Cognito emails an invitation
                with a temporary password, and the dashboard asks for a permanent one on first
                login. No other configuration is needed — the frontend discovers the API and
                Cognito settings at runtime. The deployment region follows your AWS CLI
                configuration (override with AWS_REGION).
              </Callout>
            </div>
          </div>
        </section>

        {/* First Use */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Rocket className="w-6 h-6 text-indigo-600" />
            First Use
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Create a Channel</h3>
              <CodeBlock code={`curl -X POST ${apiUrl}/channels \\
  -H "Authorization: Bearer <id-token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "channelId": "my-channel",
    "name": "my-channel",
    "enabled": true,
    "defaultAction": "noop",
    "rules": []
  }'`} />
              <Callout type="info" title="Authentication">
                Management endpoints require a Cognito JWT (the dashboard handles this
                automatically). The /esam endpoint is called by encoders and uses optional
                per-channel HTTP Basic Auth instead.
              </Callout>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Process a SCTE-35 Signal</h3>
              <CodeBlock code={`curl -X POST ${esamEndpoint} \\
  -H "Content-Type: application/xml" \\
  -d @signal.xml`} />
            </div>
          </div>
        </section>

        {/* Next Steps */}
        <section className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Next Steps</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => navigateTo('how-to-create-channel')}
              className="p-4 bg-white rounded-lg hover:shadow-md transition-shadow text-left"
            >
              <h4 className="font-semibold text-indigo-700 mb-1">Create Your First Channel</h4>
              <p className="text-sm text-slate-600">Step-by-step channel and rules setup</p>
            </button>
            <button
              type="button"
              onClick={() => navigateTo('api-overview')}
              className="p-4 bg-white rounded-lg hover:shadow-md transition-shadow text-left"
            >
              <h4 className="font-semibold text-indigo-700 mb-1">Explore the API</h4>
              <p className="text-sm text-slate-600">See all endpoints</p>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
