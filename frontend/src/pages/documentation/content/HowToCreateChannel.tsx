// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React from 'react';
import { Callout } from '../components/DocComponents';
import { useDeploymentInfo } from '../components/useDeploymentInfo';
import { Plus, Save, Lock, AlertTriangle } from 'lucide-react';

export const HowToCreateChannel: React.FC = () => {
  const { esamEndpoint } = useDeploymentInfo();
  return (
    <div className="space-y-8">
      {/* Introduction */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-3 flex items-center gap-3">
          <Plus className="w-8 h-8 text-indigo-600" />
          How to Create a Channel
        </h1>
        <p className="text-lg text-slate-600">
          Step-by-step guide to create and configure a POIS channel with processing rules
        </p>
      </div>

      {/* Step 1 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
            1
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Navigate to Channels</h2>
        </div>
        <p className="text-slate-700 mb-4">
          Click <strong>Channels</strong> in the sidebar, then click the <strong>Create Channel</strong> button in the top-right corner.
        </p>
      </div>

      {/* Step 2 - Form */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
            2
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Fill Out the Channel Form</h2>
        </div>

        <p className="text-slate-700 mb-6">
          The channel form is divided into four sections: Basic Information, Processing Settings, Channel Controls, and Processing Rules.
        </p>

        {/* UI Preview - Channel Creation Form */}
        <div className="my-8 rounded-lg border border-slate-300 overflow-hidden shadow-md">
          <div className="bg-slate-700 px-4 py-2 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
            <span className="text-xs text-slate-300 ml-2">POIS Dashboard: Create Channel</span>
          </div>
          <div className="p-6 bg-white space-y-6">

            {/* Section 1: Basic Information */}
            <div className="rounded-xl ring-1 ring-gray-200/60 p-5">
              <div className="text-sm font-semibold text-slate-900 mb-1">Basic Information</div>
              <div className="text-xs text-slate-500 mb-4">Configure the channel identification and basic settings</div>
              <div className="grid grid-cols-2 gap-4">
                {/* Channel ID */}
                <div>
                  <div className="text-xs font-medium text-slate-600 mb-1">Channel ID</div>
                  <div className="px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-400 bg-slate-50">
                    1717430400000
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">Auto-generated internal identifier</div>
                </div>
                {/* Channel Name */}
                <div>
                  <div className="text-xs font-medium text-slate-600 mb-1">Channel Name</div>
                  <div className="px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-900 bg-white">
                    east-coast-linear
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">Use this in your encoder's Acquisition Point Identifier</div>
                </div>
                {/* Description */}
                <div className="col-span-2">
                  <div className="text-xs font-medium text-slate-600 mb-1">Description</div>
                  <div className="px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-900 bg-white h-14">
                    Production east coast feed
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Processing Settings */}
            <div className="rounded-xl ring-1 ring-gray-200/60 p-5">
              <div className="text-sm font-semibold text-slate-900 mb-1">Processing Settings</div>
              <div className="text-xs text-slate-500 mb-4">Configure how signals are processed</div>
              <div className="grid grid-cols-2 gap-4">
                {/* Default Action */}
                <div>
                  <div className="text-xs font-medium text-slate-600 mb-1">Default Action</div>
                  <div className="px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-900 bg-white flex items-center justify-between">
                    <span>NOOP (Pass Through)</span>
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
                {/* Mode */}
                <div>
                  <div className="text-xs font-medium text-slate-600 mb-1">Mode</div>
                  <div className="px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-900 bg-white flex items-center justify-between">
                    <span>Stateful</span>
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
                {/* Descriptor Priority */}
                <div className="col-span-2">
                  <div className="text-xs font-medium text-slate-600 mb-1">Descriptor Priority</div>
                  <div className="px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-900 bg-white">
                    52,34,48
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">Comma-separated segmentation type IDs</div>
                </div>
              </div>
            </div>

            {/* Section 3: Channel Controls */}
            <div className="rounded-xl ring-1 ring-gray-200/60 p-5">
              <div className="text-sm font-semibold text-slate-900 mb-1">Channel Controls</div>
              <div className="text-xs text-slate-500 mb-4">Enable or disable channel features</div>
              <div className="grid grid-cols-3 gap-4">
                {/* Channel Enabled */}
                <div className="flex items-start gap-3 p-4 bg-white rounded-xl ring-1 ring-gray-200/60 shadow-sm">
                  <div className="w-8 h-4 bg-indigo-600 rounded-full relative flex-shrink-0 mt-0.5">
                    <div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900">Channel Enabled</div>
                    <div className="text-xs text-slate-500 mt-0.5">Enable this channel for signal processing</div>
                  </div>
                </div>
                {/* External Actions */}
                <div className="flex items-start gap-3 p-4 bg-white rounded-xl ring-1 ring-gray-200/60 shadow-sm">
                  <div className="w-8 h-4 bg-indigo-600 rounded-full relative flex-shrink-0 mt-0.5">
                    <div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900">External Actions</div>
                    <div className="text-xs text-slate-500 mt-0.5">Execute MediaLive actions and webhooks</div>
                  </div>
                </div>
                {/* Encoder Authentication */}
                <div className="flex items-start gap-3 p-4 bg-white rounded-xl ring-1 ring-gray-200/60 shadow-sm">
                  <div className="w-8 h-4 bg-indigo-600 rounded-full relative flex-shrink-0 mt-0.5">
                    <div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center">
                      <Lock className="h-4 w-4 text-slate-500 mr-1.5" />
                      <span className="text-sm font-medium text-slate-900">Encoder Authentication</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">Require Basic Auth for ESAM requests</div>
                  </div>
                </div>
              </div>
              {/* Dry Run Mode - conditional, shown when External Actions enabled */}
              <div className="mt-4 flex items-start gap-3 p-4 bg-yellow-50 rounded-xl ring-1 ring-yellow-200 shadow-sm">
                <div className="w-8 h-4 bg-slate-300 rounded-full relative flex-shrink-0 mt-0.5">
                  <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mr-1.5" />
                    <span className="text-sm font-medium text-yellow-900">Dry Run Mode</span>
                  </div>
                  <div className="text-xs text-yellow-700 mt-0.5">Simulate actions without executing them (for testing)</div>
                </div>
              </div>
            </div>

            {/* Section 4: Processing Rules */}
            <div className="rounded-xl ring-1 ring-gray-200/60 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Processing Rules</div>
                  <div className="text-xs text-slate-500 mt-1">Define conditions and actions for signal processing</div>
                </div>
                <div className="px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-300 rounded-md bg-white flex items-center gap-1">
                  <Plus className="h-3 w-3" />
                  Add Rule
                </div>
              </div>

              {/* Rule 1 - NOOP (green gradient) */}
              <div className="rounded-xl ring-1 ring-gray-200/60 overflow-hidden shadow-sm">
                {/* Rule Header - green gradient for noop */}
                <div className="px-5 py-3 flex items-center justify-between bg-gradient-to-r from-green-50 to-white border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold bg-green-100 text-green-700">
                      1
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Rule 1</div>
                      <div className="text-xs text-slate-500">Priority 1</div>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded font-medium bg-green-50 text-green-700">
                    NOOP
                  </span>
                </div>

                {/* Rule Body */}
                <div className="p-5 bg-white space-y-4">
                  {/* Row 1: Rule Name | Action | Priority */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs font-medium text-slate-600 mb-1">Rule Name</div>
                      <div className="px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-400 bg-slate-50">
                        Rule 1
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-600 mb-1">Action</div>
                      <div className="px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-900 bg-white flex items-center justify-between">
                        <span>NOOP</span>
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-600 mb-1">Priority</div>
                      <div className="px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-900 bg-white">
                        1
                      </div>
                    </div>
                  </div>

                  {/* Conditions section */}
                  <div className="bg-blue-50 rounded-xl p-4 ring-1 ring-blue-200">
                    <div className="text-sm font-semibold text-blue-900 mb-1">1. Match Conditions</div>
                    <div className="text-xs text-blue-700 mb-3">Define when this rule should trigger</div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <div className="text-xs font-medium text-slate-600 mb-1">Field</div>
                        <div className="px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-900 bg-white flex items-center justify-between">
                          <span>Segmentation Type ID</span>
                          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-slate-600 mb-1">Operator</div>
                        <div className="px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-900 bg-white flex items-center justify-between">
                          <span>Equals (=)</span>
                          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-slate-600 mb-1">Value</div>
                        <div className="px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-900 bg-white flex items-center justify-between">
                          <span>0x30 - Provider Ad Start</span>
                          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* External Actions section */}
                  <div className="bg-purple-50 rounded-xl p-4 ring-1 ring-purple-200">
                    <div className="text-sm font-semibold text-purple-900 mb-1">3. External Actions</div>
                    <div className="text-xs text-purple-700 mt-1">Trigger external API calls (MediaLive, Webhooks) when this rule matches</div>
                    <div className="mt-3 text-xs text-slate-500 text-center py-2">0 actions configured</div>
                  </div>

                  {/* Rule Settings footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-4 bg-indigo-600 rounded-full relative">
                        <div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full" />
                      </div>
                      <span className="text-xs text-slate-600">Rule Enabled</span>
                    </div>
                    <div className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-md bg-white flex items-center gap-1">
                      Remove Rule
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end">
              <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-md">
                <Save className="w-4 h-4" />
                Create Channel
              </div>
            </div>
          </div>
        </div>
        <p className="text-center text-sm text-slate-500 mt-2 italic">Channel creation form showing all four configuration sections</p>
      </div>

      {/* Step 3 - Encoder Credentials */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
            3
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Save & Get Encoder Credentials</h2>
        </div>
        <p className="text-slate-700 mb-4">
          After saving, the system generates encoder authentication credentials (if Encoder Authentication is enabled). 
          A password will be displayed once. Copy it immediately for your encoder configuration.
        </p>

        <Callout type="warning" title="Important">
          The generated password is shown only once after channel creation. Copy it immediately and store it securely. 
          You can regenerate credentials later from the channel details page if needed.
        </Callout>

        <div className="mt-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-3">Configure Your Encoder</h3>
          <p className="text-slate-700 mb-3">
            Use the channel name as the <code className="px-1.5 py-0.5 bg-slate-100 rounded text-sm">acquisitionPointIdentity</code> in 
            your encoder's ESAM configuration, along with the generated credentials for Basic Auth.
          </p>
          <div className="rounded-lg border border-slate-200 overflow-hidden mb-3">
            <div className="divide-y divide-slate-100 text-sm">
              <div className="px-5 py-3 grid md:grid-cols-[200px_1fr] gap-2 items-center">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">POIS Server URL</span>
                <code className="text-xs text-indigo-700 break-all">{esamEndpoint}</code>
              </div>
              <div className="px-5 py-3 grid md:grid-cols-[200px_1fr] gap-2 items-center">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Acquisition Point Identity</span>
                <span className="text-slate-700">
                  The channel name (must match exactly — this is how POIS finds the channel)
                </span>
              </div>
              <div className="px-5 py-3 grid md:grid-cols-[200px_1fr] gap-2 items-center">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Authentication</span>
                <span className="text-slate-700">
                  HTTP Basic Auth — username is the channel name, password is the generated credential
                </span>
              </div>
              <div className="px-5 py-3 grid md:grid-cols-[200px_1fr] gap-2 items-center">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Content type</span>
                <code className="text-xs text-slate-700">application/xml</code>
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-500">
            The same values are shown on the channel's details page under Encoder Configuration.
          </p>
        </div>
      </div>

      {/* Field Reference */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Field Reference</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Field</th>
                <th className="text-left py-2 pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Required</th>
                <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              <tr className="border-b border-slate-100"><td className="py-2 pr-4 font-mono text-xs">name</td><td className="py-2 pr-4">Yes</td><td className="py-2">Channel name. Used as the acquisition point identity in ESAM</td></tr>
              <tr className="border-b border-slate-100"><td className="py-2 pr-4 font-mono text-xs">description</td><td className="py-2 pr-4">No</td><td className="py-2">Human-readable description</td></tr>
              <tr className="border-b border-slate-100"><td className="py-2 pr-4 font-mono text-xs">defaultAction</td><td className="py-2 pr-4">Yes</td><td className="py-2">Action when no rules match: <code>noop</code> (pass-through) or <code>delete</code> (drop signal)</td></tr>
              <tr className="border-b border-slate-100"><td className="py-2 pr-4 font-mono text-xs">statefulMode</td><td className="py-2 pr-4">No</td><td className="py-2">Enable ad break state tracking across signals</td></tr>
              <tr className="border-b border-slate-100"><td className="py-2 pr-4 font-mono text-xs">descriptorPriority</td><td className="py-2 pr-4">No</td><td className="py-2">Comma-separated segmentation type IDs in priority order</td></tr>
              <tr className="border-b border-slate-100"><td className="py-2 pr-4 font-mono text-xs">actionsEnabled</td><td className="py-2 pr-4">No</td><td className="py-2">Enable external action execution</td></tr>
              <tr className="border-b border-slate-100"><td className="py-2 pr-4 font-mono text-xs">actionsDryRun</td><td className="py-2 pr-4">No</td><td className="py-2">Log actions without executing (test mode)</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-xs">authConfig.authEnabled</td><td className="py-2 pr-4">No</td><td className="py-2">Require Basic Auth on the ESAM endpoint</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
