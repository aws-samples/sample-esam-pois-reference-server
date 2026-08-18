// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React from 'react';
import { CodeBlock, Callout } from '../components/DocComponents';
import { Layers } from 'lucide-react';

export const DescriptorPriority: React.FC = () => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="p-8 border-b border-slate-200">
        <h1 className="text-3xl font-bold text-slate-900 mb-3 flex items-center gap-3">
          <Layers className="w-8 h-8 text-indigo-600" />
          Descriptor Priority
        </h1>
        <p className="text-lg text-slate-600">
          Control which SCTE-35 segmentation descriptor is used for rule evaluation
        </p>
      </div>

      <div className="p-8 space-y-8">
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Overview</h2>
          <p className="text-slate-700 leading-relaxed mb-4">
            A single SCTE-35 signal can contain multiple segmentation descriptors. By default, the POIS server 
            evaluates rules against the <strong>first</strong> descriptor found. The Descriptor Priority feature 
            allows you to specify which descriptor type should be evaluated first, regardless of its position in 
            the signal.
          </p>
          <p className="text-slate-700 leading-relaxed">
            This is configured as a comma-separated list of segmentation type IDs in priority order. The server 
            will use the first descriptor whose type matches any ID in your priority list.
          </p>
        </section>

        {/* How it Works */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">How It Works</h2>
          <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
            <ol className="list-decimal list-inside space-y-2 text-slate-700 text-sm">
              <li>POIS receives a SCTE-35 signal with multiple segmentation descriptors</li>
              <li>If <code className="px-1 bg-slate-200 rounded text-xs">descriptorPriority</code> is configured, the server scans descriptors in order</li>
              <li>The first descriptor whose <code className="px-1 bg-slate-200 rounded text-xs">segmentation_type_id</code> matches an ID in the priority list is selected</li>
              <li>Rules are evaluated against this selected descriptor</li>
              <li>If no descriptor matches the priority list, the first descriptor in the signal is used (fallback)</li>
            </ol>
          </div>
        </section>

        {/* UI Configuration */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Configuration</h2>
          <p className="text-slate-700 mb-4">
            In the channel form, the Descriptor Priority field accepts a comma-separated list of segmentation type IDs 
            (decimal values). The order determines priority: the first ID in the list has highest priority.
          </p>

          {/* UI Preview */}
          <div className="my-6 rounded-lg border border-slate-300 overflow-hidden shadow-md">
            <div className="bg-slate-700 px-4 py-2 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <span className="text-xs text-slate-300 ml-2">POIS Dashboard: Channel Settings</span>
            </div>
            <div className="p-6 bg-slate-50">
              <div className="max-w-lg">
                <label className="block text-xs font-medium text-slate-700 mb-1">Descriptor Priority</label>
                <div className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-sm font-mono text-slate-900">
                  52,34,48,50
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Comma-separated segmentation type IDs in priority order. Leave empty to use default (first descriptor).
                </p>
              </div>
            </div>
          </div>
          <p className="text-center text-sm text-slate-500 italic">Descriptor Priority field in the Processing Settings section</p>
        </section>

        {/* Reference Table */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Segmentation Type ID Reference</h2>
          <p className="text-slate-700 mb-4">
            Common segmentation type IDs defined in SCTE-35:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">Hex</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">Decimal</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">Name</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">Description</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                <tr className="border-b border-slate-100"><td className="py-2 px-4 font-mono text-xs">0x30</td><td className="py-2 px-4">48</td><td className="py-2 px-4 font-medium">Provider Advertisement Start</td><td className="py-2 px-4 text-slate-500">Ad break start from provider</td></tr>
                <tr className="border-b border-slate-100"><td className="py-2 px-4 font-mono text-xs">0x31</td><td className="py-2 px-4">49</td><td className="py-2 px-4 font-medium">Provider Advertisement End</td><td className="py-2 px-4 text-slate-500">Ad break end from provider</td></tr>
                <tr className="border-b border-slate-100"><td className="py-2 px-4 font-mono text-xs">0x32</td><td className="py-2 px-4">50</td><td className="py-2 px-4 font-medium">Distributor Advertisement Start</td><td className="py-2 px-4 text-slate-500">Ad break start from distributor</td></tr>
                <tr className="border-b border-slate-100"><td className="py-2 px-4 font-mono text-xs">0x34</td><td className="py-2 px-4">52</td><td className="py-2 px-4 font-medium">Provider Placement Opportunity Start</td><td className="py-2 px-4 text-slate-500">Opportunity for ad placement</td></tr>
                <tr className="border-b border-slate-100"><td className="py-2 px-4 font-mono text-xs">0x36</td><td className="py-2 px-4">54</td><td className="py-2 px-4 font-medium">Distributor Placement Opportunity Start</td><td className="py-2 px-4 text-slate-500">Distributor ad opportunity</td></tr>
                <tr className="border-b border-slate-100"><td className="py-2 px-4 font-mono text-xs">0x40</td><td className="py-2 px-4">64</td><td className="py-2 px-4 font-medium">Unscheduled Event Start</td><td className="py-2 px-4 text-slate-500">Network-originated signal</td></tr>
                <tr><td className="py-2 px-4 font-mono text-xs">0x41</td><td className="py-2 px-4">65</td><td className="py-2 px-4 font-medium">Unscheduled Event End</td><td className="py-2 px-4 text-slate-500">End of network signal</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Example */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Example</h2>
          <p className="text-slate-700 mb-4">
            Channel configured with priority <code className="px-1.5 py-0.5 bg-slate-100 rounded text-sm font-mono">52,34,48</code>:
          </p>

          <CodeBlock language="json" code={`{
  "channelId": "channel-001",
  "name": "my-channel",
  "descriptorPriority": "52,34,48",
  "rules": [
    {
      "conditions": [
        { "field": "segmentationTypeId", "operator": "eq", "value": "52" }
      ],
      "action": "replace",
      "modifications": [
        { "target": "breakDuration", "operation": "set", "value": "30000" }
      ]
    }
  ]
}`} />

          <h3 className="text-lg font-semibold text-slate-900 mb-3 mt-6">
            A signal arrives carrying three descriptors
          </h3>
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex flex-wrap items-center gap-x-8 gap-y-3">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Signal descriptors</div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-white border border-slate-300 font-mono text-sm text-slate-700">48</span>
                  <span className="px-2.5 py-1 rounded-md bg-green-50 border border-green-400 font-mono text-sm font-semibold text-green-700 ring-2 ring-green-100">52</span>
                  <span className="px-2.5 py-1 rounded-md bg-white border border-slate-300 font-mono text-sm text-slate-700">64</span>
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Priority list</div>
                <div className="flex items-center gap-1.5 font-mono text-sm text-slate-700">
                  <span className="px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-300 text-indigo-700 font-semibold">52</span>
                  <span className="text-slate-400">→</span>
                  <span className="px-2.5 py-1 rounded-md bg-white border border-slate-300">34</span>
                  <span className="text-slate-400">→</span>
                  <span className="px-2.5 py-1 rounded-md bg-white border border-slate-300">48</span>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-3 bg-white">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">1</div>
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    Priority 52 — Provider Placement Opportunity Start —{' '}
                    <span className="text-green-600 font-semibold">match</span>
                  </div>
                  <div className="text-xs text-slate-600">
                    The signal contains a type 52 descriptor, so it is selected. Types 34 and 48 are never checked.
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">2</div>
                <div>
                  <div className="text-sm font-medium text-slate-900">Rules evaluated against descriptor 52</div>
                  <div className="text-xs text-slate-600">
                    The condition <code className="px-1 bg-slate-100 rounded">segmentationTypeId == 52</code> matches the selected descriptor.
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 bg-green-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">✓</div>
                <div>
                  <div className="text-sm font-medium text-slate-900">Action applied: replace</div>
                  <div className="text-xs text-slate-600">
                    The signal is returned with <code className="px-1 bg-slate-100 rounded">breakDuration</code> set to 30000 (a 30-second break).
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <Callout type="info" title="Fallback behavior">
              If none of the descriptors in the signal match any ID in your priority list, the server falls back
              to using the first descriptor in the signal (position 0).
            </Callout>
          </div>
        </section>
      </div>
    </div>
  );
};
