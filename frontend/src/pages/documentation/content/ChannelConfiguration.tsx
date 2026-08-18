// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React from 'react';
import { CodeBlock, Callout } from '../components/DocComponents';
import { Settings, Trash2, Plus } from 'lucide-react';

export const ChannelConfiguration: React.FC = () => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="p-8 border-b border-slate-200">
        <h1 className="text-3xl font-bold text-slate-900 mb-3 flex items-center gap-3">
          <Settings className="w-8 h-8 text-indigo-600" />
          Rules and Configuration
        </h1>
        <p className="text-lg text-slate-600">
          How rules control SCTE-35 signal processing, evaluation order, conditions, and modifications
        </p>
      </div>

      <div className="p-8 space-y-10">

        {/* Overview */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Overview</h2>
          <p className="text-slate-600 mb-4">
            Rules are the core of POIS signal processing. Each channel has an ordered list of rules that
            determine what happens to incoming SCTE-35 signals. When a signal arrives, rules are evaluated
            in priority order until a match is found. The matched rule's action (delete, noop, or replace)
            is then applied to the signal.
          </p>
          <p className="text-slate-600">
            If no rule matches, the channel's <strong>Default Action</strong> is applied. This allows you
            to build either allowlist patterns (default=delete, rules allow specific signals) or
            blocklist patterns (default=noop, rules block specific signals).
          </p>
        </section>

        {/* Evaluation Order */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Evaluation Order</h2>
          <p className="text-slate-600 mb-4">
            Understanding evaluation order is critical for designing correct rule sets:
          </p>

          <div className="bg-slate-50 rounded-lg p-6 border border-slate-200 mb-6">
            <ol className="space-y-3 text-slate-700">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                <span>Rules are <strong>sorted by priority number</strong> (lower number = higher priority). Priority 1 is evaluated first.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                <span>Disabled rules (enabled=false) are <strong>skipped entirely</strong>.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                <span>For each rule, <strong>ALL conditions must match</strong> (AND logic). If any condition fails, the rule does not match.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
                <span><strong>First match wins.</strong> Once a rule matches, evaluation stops immediately. No further rules are checked.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">5</span>
                <span>If <strong>no rules match</strong>, the channel's Default Action is applied (noop or delete).</span>
              </li>
            </ol>
          </div>

          <Callout type="warning" title="First Match Wins">
            If you have Rule 1 (priority 1, action=delete) and Rule 2 (priority 2, action=noop), and a signal
            matches BOTH rules, only Rule 1's action is applied. Rule 2 is never evaluated. Order your rules
            carefully from most specific to least specific.
          </Callout>

          <div className="mt-6">
            <p className="text-sm font-medium text-slate-700 mb-3">Example scenario</p>

            {/* Channel setup */}
            <div className="rounded-lg border border-slate-200 overflow-hidden mb-4">
              <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                <span className="font-semibold text-slate-800">Channel: east-coast-linear</span>
                <span className="text-slate-600">
                  Default Action: <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs font-bold">NOOP</span> (pass everything through)
                </span>
              </div>
              <div className="divide-y divide-slate-100 text-sm">
                <div className="px-5 py-2.5 flex items-center gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  <code className="text-xs text-slate-700">segmentationTypeId eq 48</code>
                  <span className="text-slate-400">→</span>
                  <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-xs font-bold">DELETE</span>
                </div>
                <div className="px-5 py-2.5 flex items-center gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  <code className="text-xs text-slate-700">segmentationTypeId eq 52 AND duration gt 60</code>
                  <span className="text-slate-400">→</span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-bold">REPLACE</span>
                  <span className="text-xs text-slate-500">(set duration=30)</span>
                </div>
                <div className="px-5 py-2.5 flex items-center gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                  <code className="text-xs text-slate-700">commandType eq 6</code>
                  <span className="text-slate-400">→</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs font-bold">NOOP</span>
                </div>
              </div>
            </div>

            {/* Scenarios */}
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="text-sm font-medium text-slate-900 mb-1.5">
                  Signal: <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">time_signal, segmentation_type_id=48</code>
                </div>
                <div className="text-sm text-slate-600">
                  Rule 1 matches (48 eq 48) → signal is{' '}
                  <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-xs font-bold">DELETED</span>.
                  Rules 2 and 3 are never evaluated.
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="text-sm font-medium text-slate-900 mb-1.5">
                  Signal: <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">time_signal, segmentation_type_id=52, duration=90</code>
                </div>
                <div className="text-sm text-slate-600">
                  Rule 1 does not match (48 ≠ 52). Rule 2 matches (52 eq 52 AND 90 &gt; 60) → signal is{' '}
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-bold">REPLACED</span>{' '}
                  with duration=30. Rule 3 is never evaluated.
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="text-sm font-medium text-slate-900 mb-1.5">
                  Signal: <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">splice_insert (commandType=5), segmentation_type_id=34</code>
                </div>
                <div className="text-sm text-slate-600">
                  No rule matches: Rule 1 (48 ≠ 34), Rule 2 (52 ≠ 34), Rule 3 (commandType 6 ≠ 5).
                  Default Action applies → signal{' '}
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs font-bold">passes through</span>{' '}
                  unchanged.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Condition Fields */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Condition Fields</h2>
          <p className="text-slate-600 mb-4">
            Conditions compare a field extracted from the incoming SCTE-35 signal against an expected value.
            Available fields:
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 border-b border-slate-200">Field</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 border-b border-slate-200">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 border-b border-slate-200">Description</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 border-b border-slate-200">Example Values</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr><td className="px-4 py-2.5 font-mono text-xs text-indigo-700">commandType</td><td className="px-4 py-2.5 text-slate-600">Integer</td><td className="px-4 py-2.5 text-slate-600">Splice command type</td><td className="px-4 py-2.5 text-slate-500">5 (splice_insert), 6 (time_signal)</td></tr>
                <tr><td className="px-4 py-2.5 font-mono text-xs text-indigo-700">segmentationTypeId</td><td className="px-4 py-2.5 text-slate-600">Integer</td><td className="px-4 py-2.5 text-slate-600">Segmentation type from descriptor</td><td className="px-4 py-2.5 text-slate-500">48 (0x30), 49 (0x31), 52 (0x34)</td></tr>
                <tr><td className="px-4 py-2.5 font-mono text-xs text-indigo-700">duration</td><td className="px-4 py-2.5 text-slate-600">Number</td><td className="px-4 py-2.5 text-slate-600">Break or segmentation duration (seconds)</td><td className="px-4 py-2.5 text-slate-500">30, 60, 120</td></tr>
                <tr><td className="px-4 py-2.5 font-mono text-xs text-indigo-700">ptsAdjustment</td><td className="px-4 py-2.5 text-slate-600">Integer</td><td className="px-4 py-2.5 text-slate-600">PTS adjustment value</td><td className="px-4 py-2.5 text-slate-500">0, 183003</td></tr>
                <tr><td className="px-4 py-2.5 font-mono text-xs text-indigo-700">upidType</td><td className="px-4 py-2.5 text-slate-600">Integer</td><td className="px-4 py-2.5 text-slate-600">UPID type from first descriptor</td><td className="px-4 py-2.5 text-slate-500">1 (deprecated), 8 (EIDR), 9 (ISAN)</td></tr>
                <tr><td className="px-4 py-2.5 font-mono text-xs text-indigo-700">upidValue</td><td className="px-4 py-2.5 text-slate-600">String</td><td className="px-4 py-2.5 text-slate-600">UPID value (hex string)</td><td className="px-4 py-2.5 text-slate-500">"SIGNAL123", "BREAK001"</td></tr>
                <tr><td className="px-4 py-2.5 font-mono text-xs text-indigo-700">eventId</td><td className="px-4 py-2.5 text-slate-600">Integer</td><td className="px-4 py-2.5 text-slate-600">Splice event ID</td><td className="px-4 py-2.5 text-slate-500">1, 100, 65535</td></tr>
                <tr><td className="px-4 py-2.5 font-mono text-xs text-indigo-700">descriptorCount</td><td className="px-4 py-2.5 text-slate-600">Integer</td><td className="px-4 py-2.5 text-slate-600">Number of splice descriptors</td><td className="px-4 py-2.5 text-slate-500">0, 1, 2, 3</td></tr>
                <tr><td className="px-4 py-2.5 font-mono text-xs text-indigo-700">outOfNetwork</td><td className="px-4 py-2.5 text-slate-600">Boolean</td><td className="px-4 py-2.5 text-slate-600">Out-of-network indicator (splice_insert only)</td><td className="px-4 py-2.5 text-slate-500">true, false</td></tr>
                <tr><td className="px-4 py-2.5 font-mono text-xs text-indigo-700">zoneIdentity</td><td className="px-4 py-2.5 text-slate-600">String</td><td className="px-4 py-2.5 text-slate-600">Zone identity from ESAM request</td><td className="px-4 py-2.5 text-slate-500">"zone-east", "zone-west"</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Operators */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Operators</h2>
          <p className="text-slate-600 mb-4">
            Each condition uses an operator to compare the signal's field value against the expected value:
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 border-b border-slate-200">Operator</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 border-b border-slate-200">Description</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 border-b border-slate-200">Value Format</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 border-b border-slate-200">Example</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr><td className="px-4 py-2.5 font-mono text-xs text-indigo-700">eq</td><td className="px-4 py-2.5 text-slate-600">Equals</td><td className="px-4 py-2.5 text-slate-500">Single value</td><td className="px-4 py-2.5 text-slate-500 font-mono text-xs">48</td></tr>
                <tr><td className="px-4 py-2.5 font-mono text-xs text-indigo-700">ne</td><td className="px-4 py-2.5 text-slate-600">Not equals</td><td className="px-4 py-2.5 text-slate-500">Single value</td><td className="px-4 py-2.5 text-slate-500 font-mono text-xs">48</td></tr>
                <tr><td className="px-4 py-2.5 font-mono text-xs text-indigo-700">gt</td><td className="px-4 py-2.5 text-slate-600">Greater than</td><td className="px-4 py-2.5 text-slate-500">Numeric</td><td className="px-4 py-2.5 text-slate-500 font-mono text-xs">60</td></tr>
                <tr><td className="px-4 py-2.5 font-mono text-xs text-indigo-700">lt</td><td className="px-4 py-2.5 text-slate-600">Less than</td><td className="px-4 py-2.5 text-slate-500">Numeric</td><td className="px-4 py-2.5 text-slate-500 font-mono text-xs">30</td></tr>
                <tr><td className="px-4 py-2.5 font-mono text-xs text-indigo-700">gte</td><td className="px-4 py-2.5 text-slate-600">Greater than or equal</td><td className="px-4 py-2.5 text-slate-500">Numeric</td><td className="px-4 py-2.5 text-slate-500 font-mono text-xs">60</td></tr>
                <tr><td className="px-4 py-2.5 font-mono text-xs text-indigo-700">lte</td><td className="px-4 py-2.5 text-slate-600">Less than or equal</td><td className="px-4 py-2.5 text-slate-500">Numeric</td><td className="px-4 py-2.5 text-slate-500 font-mono text-xs">120</td></tr>
                <tr><td className="px-4 py-2.5 font-mono text-xs text-indigo-700">range</td><td className="px-4 py-2.5 text-slate-600">Within range (inclusive)</td><td className="px-4 py-2.5 text-slate-500">min-max</td><td className="px-4 py-2.5 text-slate-500 font-mono text-xs">30-60</td></tr>
                <tr><td className="px-4 py-2.5 font-mono text-xs text-indigo-700">in</td><td className="px-4 py-2.5 text-slate-600">Value in list</td><td className="px-4 py-2.5 text-slate-500">Comma-separated</td><td className="px-4 py-2.5 text-slate-500 font-mono text-xs">48,49,52</td></tr>
                <tr><td className="px-4 py-2.5 font-mono text-xs text-indigo-700">not_in</td><td className="px-4 py-2.5 text-slate-600">Value not in list</td><td className="px-4 py-2.5 text-slate-500">Comma-separated</td><td className="px-4 py-2.5 text-slate-500 font-mono text-xs">48,49</td></tr>
                <tr><td className="px-4 py-2.5 font-mono text-xs text-indigo-700">contains</td><td className="px-4 py-2.5 text-slate-600">String contains</td><td className="px-4 py-2.5 text-slate-500">Substring</td><td className="px-4 py-2.5 text-slate-500 font-mono text-xs">BREAK</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Descriptor Priority */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Descriptor Priority</h2>
          <p className="text-slate-600 mb-4">
            SCTE-35 signals can carry multiple segmentation descriptors. The <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">descriptorPriority</code> field
            determines which descriptor is used when evaluating conditions on <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">segmentationTypeId</code>.
          </p>

          <div className="bg-slate-50 rounded-lg p-5 border border-slate-200 mb-4">
            <p className="text-sm text-slate-700 mb-3"><strong>How it works:</strong></p>
            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600">
              <li>The priority is a comma-separated list of segmentation type IDs, e.g., <code className="text-xs bg-white px-1 py-0.5 rounded border">52,34,48</code></li>
              <li>When evaluating, the system checks descriptors in priority order</li>
              <li>The FIRST descriptor matching any priority ID is selected for rule evaluation</li>
              <li>If no descriptor matches the priority list, the first descriptor in the signal is used (fallback)</li>
              <li>If no priority is configured (empty), the first descriptor is always used</li>
            </ol>
          </div>

          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 text-sm">
              <span className="font-semibold text-slate-800">Signal carries two descriptors:</span>{' '}
              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-300 font-mono text-xs">48 provider_ad_start</span>{' '}
              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-300 font-mono text-xs">52 distributor_ad_start</span>
            </div>
            <div className="divide-y divide-slate-100 text-sm">
              <div className="px-5 py-3 grid md:grid-cols-[180px_1fr] gap-2 items-center">
                <code className="text-xs bg-slate-100 px-2 py-1 rounded w-fit">"52,34,48"</code>
                <span className="text-slate-600">
                  Type 52 exists in the signal → rules evaluate against{' '}
                  <span className="font-semibold text-green-700">segmentationTypeId = 52</span>
                </span>
              </div>
              <div className="px-5 py-3 grid md:grid-cols-[180px_1fr] gap-2 items-center">
                <code className="text-xs bg-slate-100 px-2 py-1 rounded w-fit">"34"</code>
                <span className="text-slate-600">
                  Type 34 not present → fallback to the first descriptor →{' '}
                  <span className="font-semibold text-slate-800">segmentationTypeId = 48</span>
                </span>
              </div>
              <div className="px-5 py-3 grid md:grid-cols-[180px_1fr] gap-2 items-center">
                <code className="text-xs bg-slate-100 px-2 py-1 rounded w-fit">"" (empty)</code>
                <span className="text-slate-600">
                  No priority configured → first descriptor is always used →{' '}
                  <span className="font-semibold text-slate-800">segmentationTypeId = 48</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Actions */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Actions</h2>
          <p className="text-slate-600 mb-4">
            When a rule matches, its action determines what happens to the signal:
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg border-2 border-red-200 bg-red-50">
              <div className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded">DELETE</span>
              </div>
              <p className="text-sm text-red-700">
                Signal is dropped. The encoder receives an SPN response with action="delete".
                The signal is not forwarded downstream.
              </p>
            </div>
            <div className="p-4 rounded-lg border-2 border-emerald-200 bg-emerald-50">
              <div className="font-semibold text-emerald-800 mb-2 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded">NOOP</span>
              </div>
              <p className="text-sm text-emerald-700">
                Signal passes through unchanged. The encoder receives an SPN response with
                action="noop" and the original binary data.
              </p>
            </div>
            <div className="p-4 rounded-lg border-2 border-amber-200 bg-amber-50">
              <div className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded">REPLACE</span>
              </div>
              <p className="text-sm text-amber-700">
                Signal is modified. Modifications are applied, then the encoder receives an SPN
                response with action="replace" and the new binary data.
              </p>
            </div>
          </div>
        </section>

        {/* Modifications */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Modifications (Replace Action)</h2>
          <p className="text-slate-600 mb-4">
            When action is <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">replace</code>,
            you can configure modifications to change specific fields in the SCTE-35 signal before returning it:
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 border-b border-slate-200">Target</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 border-b border-slate-200">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 border-b border-slate-200">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr><td className="px-4 py-2.5 font-mono text-xs text-indigo-700">ptsAdjustment</td><td className="px-4 py-2.5 text-slate-500">Info Section</td><td className="px-4 py-2.5 text-slate-600">PTS adjustment value (0 to 8589934591)</td></tr>
                <tr><td className="px-4 py-2.5 font-mono text-xs text-indigo-700">breakDuration</td><td className="px-4 py-2.5 text-slate-500">Splice Insert</td><td className="px-4 py-2.5 text-slate-600">Break duration in seconds</td></tr>
                <tr><td className="px-4 py-2.5 font-mono text-xs text-indigo-700">segmentationDuration</td><td className="px-4 py-2.5 text-slate-500">Descriptor</td><td className="px-4 py-2.5 text-slate-600">Segmentation duration in seconds</td></tr>
                <tr><td className="px-4 py-2.5 font-mono text-xs text-indigo-700">segmentationTypeId</td><td className="px-4 py-2.5 text-slate-500">Descriptor</td><td className="px-4 py-2.5 text-slate-600">Change the segmentation type (0-255)</td></tr>
                <tr><td className="px-4 py-2.5 font-mono text-xs text-indigo-700">upidType</td><td className="px-4 py-2.5 text-slate-500">Descriptor</td><td className="px-4 py-2.5 text-slate-600">UPID type (0-255)</td></tr>
                <tr><td className="px-4 py-2.5 font-mono text-xs text-indigo-700">upidValue</td><td className="px-4 py-2.5 text-slate-500">Descriptor</td><td className="px-4 py-2.5 text-slate-600">UPID value (string)</td></tr>
                <tr><td className="px-4 py-2.5 font-mono text-xs text-indigo-700">webDeliveryAllowed</td><td className="px-4 py-2.5 text-slate-500">Descriptor</td><td className="px-4 py-2.5 text-slate-600">Web delivery allowed flag (true/false)</td></tr>
                <tr><td className="px-4 py-2.5 font-mono text-xs text-indigo-700">noRegionalBlackout</td><td className="px-4 py-2.5 text-slate-500">Descriptor</td><td className="px-4 py-2.5 text-slate-600">No regional blackout flag (true/false)</td></tr>
                <tr><td className="px-4 py-2.5 font-mono text-xs text-indigo-700">deviceRestrictions</td><td className="px-4 py-2.5 text-slate-500">Descriptor</td><td className="px-4 py-2.5 text-slate-600">Device restrictions (0-3)</td></tr>
                <tr><td className="px-4 py-2.5 font-mono text-xs text-indigo-700">segmentNum</td><td className="px-4 py-2.5 text-slate-500">Descriptor</td><td className="px-4 py-2.5 text-slate-600">Segment number</td></tr>
                <tr><td className="px-4 py-2.5 font-mono text-xs text-indigo-700">segmentsExpected</td><td className="px-4 py-2.5 text-slate-500">Descriptor</td><td className="px-4 py-2.5 text-slate-600">Total segments expected</td></tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <p className="text-sm text-slate-600">
              Each modification has an <strong>operation</strong>: <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">set</code> (replace value),
              <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">add</code> (append), or
              <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">remove</code> (delete field).
            </p>
          </div>
        </section>

        {/* Practical Examples */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Practical Examples</h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Example 1: Delete provider ad start signals</h3>
              <p className="text-sm text-slate-600 mb-2">Block all provider_advertisement_start (0x30 = 48) signals from reaching the encoder:</p>
              <CodeBlock code={`{
  "name": "Block Provider Ad Start",
  "priority": 1,
  "enabled": true,
  "conditions": [
    { "field": "segmentationTypeId", "operator": "eq", "value": "48" }
  ],
  "action": "delete",
  "modifications": []
}`} />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Example 2: Shorten long breaks to 30 seconds</h3>
              <p className="text-sm text-slate-600 mb-2">For distributor ad signals (0x34 = 52) with duration over 60s, cap the break at 30 seconds:</p>
              <CodeBlock code={`{
  "name": "Cap Long Breaks",
  "priority": 2,
  "enabled": true,
  "conditions": [
    { "field": "segmentationTypeId", "operator": "eq", "value": "52" },
    { "field": "duration", "operator": "gt", "value": "60" }
  ],
  "action": "replace",
  "modifications": [
    { "target": "breakDuration", "operation": "set", "value": "30" },
    { "target": "segmentationDuration", "operation": "set", "value": "30" }
  ]
}`} />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Example 3: Allowlist pattern (only pass splice_inserts)</h3>
              <p className="text-sm text-slate-600 mb-2">
                Set the channel's <strong>Default Action</strong> to{' '}
                <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">delete</code> (signals that
                match no rule are dropped), then add a single rule that allows splice_insert commands through:
              </p>
              <CodeBlock language="json" code={`{
  "name": "Allow Splice Inserts",
  "priority": 1,
  "enabled": true,
  "conditions": [
    { "field": "commandType", "operator": "eq", "value": "5" }
  ],
  "action": "noop",
  "modifications": []
}`} />
              <div className="mt-2 text-sm text-slate-600">
                Result: only splice_insert (type 5) signals pass through; time_signal (type 6) and every
                other command are deleted by the default action.
              </div>
            </div>
          </div>
        </section>

        {/* UI Preview - Rule Builder */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Rule Builder Interface</h2>
          <div className="my-6 rounded-lg border border-slate-300 overflow-hidden shadow-md">
            <div className="bg-slate-700 px-4 py-2 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <span className="text-xs text-slate-300 ml-2">POIS Dashboard: Rule Builder</span>
            </div>
            <div className="p-6 bg-white">

              {/* Rule Card - REPLACE (yellow gradient) */}
              <div className="rounded-xl ring-1 ring-gray-200/60 overflow-hidden shadow-sm">
                {/* Rule Header - yellow gradient for replace */}
                <div className="px-5 py-3 flex items-center justify-between bg-gradient-to-r from-yellow-50 to-white border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold bg-yellow-100 text-yellow-700">
                      1
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Rule 1</div>
                      <div className="text-xs text-slate-500">Priority 1</div>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded font-medium bg-yellow-50 text-yellow-700">
                    REPLACE
                  </span>
                </div>

                {/* Rule Body */}
                <div className="p-5 bg-white space-y-4">
                  {/* Row 1: Rule Name | Action | Priority */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs font-medium text-slate-600 mb-1">Rule Name</div>
                      <div className="px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-400 bg-slate-50">
                        Shorten Long Breaks
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-600 mb-1">Action</div>
                      <div className="px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-900 bg-white flex items-center justify-between">
                        <span>REPLACE</span>
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
                    {/* Condition Row 1 */}
                    <div className="grid grid-cols-3 gap-3 mb-3">
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
                          <span>0x34 - Provider PO Start</span>
                          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                    </div>
                    {/* Condition Row 2 */}
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <div className="text-xs font-medium text-slate-600 mb-1">Field</div>
                        <div className="px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-900 bg-white flex items-center justify-between">
                          <span>Duration</span>
                          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-slate-600 mb-1">Operator</div>
                        <div className="px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-900 bg-white flex items-center justify-between">
                          <span>Greater Than (&gt;)</span>
                          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-slate-600 mb-1">Value</div>
                        <div className="px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-900 bg-white">
                          60
                        </div>
                      </div>
                    </div>
                    <button className="text-xs text-indigo-600 font-medium">+ Add Condition</button>
                  </div>

                  {/* Modifications section (shown because action=replace) */}
                  <div className="bg-yellow-50 rounded-xl p-4 ring-1 ring-yellow-200">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-sm font-semibold text-yellow-900">2. Signal Modifications</div>
                        <div className="text-xs text-yellow-700 mt-1">Modify SCTE-35 signal fields (only for REPLACE action)</div>
                      </div>
                      <div className="px-2 py-1 text-xs font-medium text-slate-600 border border-slate-200 rounded-md bg-white flex items-center gap-1">
                        <Plus className="h-3 w-3" />
                        Add
                      </div>
                    </div>
                    {/* Modification Row 1 */}
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <div className="text-xs font-medium text-slate-600 mb-1">Target</div>
                        <div className="px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-900 bg-white flex items-center justify-between">
                          <span>break_duration</span>
                          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-slate-600 mb-1">Operation</div>
                        <div className="px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-900 bg-white flex items-center justify-between">
                          <span>set</span>
                          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <div className="text-xs font-medium text-slate-600 mb-1">Value</div>
                          <div className="px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-900 bg-white">
                            30
                          </div>
                        </div>
                        <div className="flex items-end">
                          <div className="p-2 text-red-500 border border-red-200 rounded-md bg-white">
                            <Trash2 className="h-3 w-3" />
                          </div>
                        </div>
                      </div>
                    </div>
                    <button className="text-xs text-indigo-600 font-medium">+ Add Modification</button>
                  </div>

                  {/* External Actions section (collapsed) */}
                  <div className="bg-purple-50 rounded-xl p-4 ring-1 ring-purple-200">
                    <div className="mb-1">
                      <div className="text-sm font-semibold text-purple-900">3. External Actions</div>
                      <div className="text-xs text-purple-700 mt-1">Trigger external API calls (MediaLive, Webhooks) when this rule matches</div>
                    </div>
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
                      <Trash2 className="h-3 w-3" />
                      Remove Rule
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
          <p className="text-center text-xs text-slate-500 mt-2 italic">Rule builder interface showing conditions, action, modifications, and external actions</p>
        </section>

        {/* Tips */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Tips and Best Practices</h2>
          <div className="space-y-4">
            <Callout type="info" title="Order matters">
              Place more specific rules at higher priority (lower numbers). A catch-all rule should be at the lowest priority.
            </Callout>
            <Callout type="warning" title="Empty rules never match">
              A rule with zero conditions will never match any signal. Always add at least one condition.
            </Callout>
            <Callout type="info" title="Use Default Action strategically">
              Set Default Action to "delete" for an allowlist approach (only signals matching a noop/replace rule pass through).
              Set it to "noop" for a blocklist approach (all signals pass unless a delete rule catches them).
            </Callout>
            <Callout type="warning" title="Replace without modifications">
              A rule with action="replace" but no modifications will behave like "noop" since nothing is changed.
            </Callout>
          </div>
        </section>

      </div>
    </div>
  );
};
