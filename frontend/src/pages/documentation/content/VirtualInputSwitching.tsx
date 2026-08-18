// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React from 'react';
import { CodeBlock, Callout } from '../components/DocComponents';
import { Monitor } from 'lucide-react';

export const VirtualInputSwitching: React.FC = () => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="p-8 border-b border-slate-200">
        <h1 className="text-3xl font-bold text-slate-900 mb-3 flex items-center gap-3">
          <Monitor className="w-8 h-8 text-indigo-600" />
          Virtual Input Switching (VIS)
        </h1>
        <p className="text-lg text-slate-600">
          Instruct encoders to switch video inputs based on SCTE-35 signals
        </p>
      </div>

      <div className="p-8 space-y-8">
        {/* Overview */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Overview</h2>
          <p className="text-slate-700 leading-relaxed mb-4">
            Virtual Input Switching (VIS) allows POIS to respond to ESAM requests with a
            <code className="px-2 py-1 bg-slate-100 rounded text-sm font-mono mx-1">{'<signal:AlternateContent>'}</code>
            element that tells the encoder which virtual input to switch to. The typical use case is switching
            to an ad slate on CUE-OUT and returning to the main content on CUE-IN.
          </p>
          <p className="text-slate-700 leading-relaxed mb-4">
            When a rule matches and has <code className="px-2 py-1 bg-slate-100 rounded text-sm font-mono">altContentIdentity</code> configured,
            the POIS server adds the AlternateContent element to the Signal Processing Notification (SPN) response.
            The rule action itself can be <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono">noop</code>,
            <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono mx-1">replace</code>, or
            <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono">delete</code> -- AlternateContent
            is included regardless of the action type.
          </p>
        </section>

        {/* Sequence Diagram */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Sequence Diagram</h2>
          <p className="text-slate-700 leading-relaxed mb-6">
            The VIS flow involves a message exchange between the encoder and POIS for each SCTE-35 signal event:
          </p>

          <div className="my-6 p-6 bg-slate-50 rounded-xl border border-slate-200">
                    <svg viewBox="0 0 800 580" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <marker id="ah-b" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6" fill="#4F46E5" />
            </marker>
            <marker id="ah-g" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6" fill="#16A34A" />
            </marker>
          </defs>

          {/* Column headers */}
          <text x="220" y="25" textAnchor="middle" fontSize="11" fontWeight="600" fill="#64748B" fontFamily="system-ui">ENCODER</text>
          <text x="620" y="25" textAnchor="middle" fontSize="11" fontWeight="600" fill="#64748B" fontFamily="system-ui">POIS SERVER</text>

          {/* ===== CUE-OUT PHASE ===== */}
          <text x="60" y="70" fontSize="11" fontWeight="700" fill="#DC2626" fontFamily="system-ui">CUE-OUT</text>

          {/* splice_insert box */}
          <rect x="140" y="50" width="160" height="34" rx="6" fill="#FFFBEB" stroke="#F59E0B" strokeWidth="1.5" />
          <text x="220" y="71" textAnchor="middle" fontSize="10" fontWeight="500" fill="#92400E" fontFamily="system-ui">splice_insert (out=true)</text>

          {/* SPE arrow: right from splice_insert, down, then right to Evaluate rules */}
          <path d="M300,67 H470 V130 H540" fill="none" stroke="#4F46E5" strokeWidth="1.5" markerEnd="url(#ah-b)" />
          <text x="480" y="95" textAnchor="start" fontSize="9" fontWeight="500" fill="#4F46E5" fontFamily="system-ui">SPE</text>

          {/* Evaluate rules box */}
          <rect x="540" y="113" width="160" height="34" rx="6" fill="#EEF2FF" stroke="#4F46E5" strokeWidth="1.5" />
          <text x="620" y="134" textAnchor="middle" fontSize="10" fontWeight="500" fill="#4338CA" fontFamily="system-ui">Evaluate rules</text>

          {/* SPN arrow: left from Evaluate rules, down, then left to Switch box */}
          <path d="M540,130 H470 V237 H300" fill="none" stroke="#16A34A" strokeWidth="1.5" markerEnd="url(#ah-g)" />
          <text x="480" y="215" textAnchor="start" fontSize="9" fontWeight="500" fill="#16A34A" fontFamily="system-ui">SPN + AlternateContent(CH62)</text>

          {/* Switch to CH62 box */}
          <rect x="140" y="220" width="160" height="34" rx="6" fill="#F0FDF4" stroke="#22C55E" strokeWidth="1.5" />
          <text x="220" y="241" textAnchor="middle" fontSize="10" fontWeight="500" fill="#166534" fontFamily="system-ui">Switch to CH62</text>

          {/* Separator */}
          <line x1="60" y1="280" x2="740" y2="280" stroke="#E2E8F0" strokeWidth="1" />

          {/* ===== CUE-IN PHASE ===== */}
          <text x="60" y="320" fontSize="11" fontWeight="700" fill="#16A34A" fontFamily="system-ui">CUE-IN</text>

          {/* splice_insert box */}
          <rect x="140" y="300" width="160" height="34" rx="6" fill="#FFFBEB" stroke="#F59E0B" strokeWidth="1.5" />
          <text x="220" y="321" textAnchor="middle" fontSize="10" fontWeight="500" fill="#92400E" fontFamily="system-ui">splice_insert (out=false)</text>

          {/* SPE arrow */}
          <path d="M300,317 H470 V380 H540" fill="none" stroke="#4F46E5" strokeWidth="1.5" markerEnd="url(#ah-b)" />
          <text x="480" y="345" textAnchor="start" fontSize="9" fontWeight="500" fill="#4F46E5" fontFamily="system-ui">SPE</text>

          {/* Evaluate rules box */}
          <rect x="540" y="363" width="160" height="34" rx="6" fill="#EEF2FF" stroke="#4F46E5" strokeWidth="1.5" />
          <text x="620" y="384" textAnchor="middle" fontSize="10" fontWeight="500" fill="#4338CA" fontFamily="system-ui">Evaluate rules</text>

          {/* SPN arrow */}
          <path d="M540,380 H470 V487 H300" fill="none" stroke="#16A34A" strokeWidth="1.5" markerEnd="url(#ah-g)" />
          <text x="480" y="465" textAnchor="start" fontSize="9" fontWeight="500" fill="#16A34A" fontFamily="system-ui">SPN + AlternateContent(CH61)</text>

          {/* Switch to CH61 box */}
          <rect x="140" y="470" width="160" height="34" rx="6" fill="#F0FDF4" stroke="#22C55E" strokeWidth="1.5" />
          <text x="220" y="491" textAnchor="middle" fontSize="10" fontWeight="500" fill="#166534" fontFamily="system-ui">Switch to CH61</text>

          {/* Caption */}
          <text x="400" y="540" textAnchor="middle" fontSize="9" fill="#94A3B8" fontFamily="system-ui">VIS message flow: encoder sends SPE on SCTE-35, POIS responds with SPN containing AlternateContent</text>
        </svg>
            </div>
        </section>

        {/* Configuration */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Configuration</h2>
          <p className="text-slate-700 leading-relaxed mb-4">
            To enable VIS, configure a channel with rules that have
            <code className="px-2 py-1 bg-slate-100 rounded text-sm font-mono mx-1">altContentIdentity</code> set.
            Here is a channel with two rules: one for CUE-OUT (switch to alternate content) and one for
            CUE-IN (return to main content). Note the action is
            <code className="px-2 py-1 bg-slate-100 rounded text-sm font-mono mx-1">noop</code> -- the signal
            passes through unchanged, but the AlternateContent element is added to the response.
          </p>
          <CodeBlock code={`{
  "channelId": "vis-channel",
  "name": "vis-channel",
  "defaultAction": "noop",
  "rules": [
    {
      "ruleId": "vis-cue-out",
      "name": "Switch to Ad Slate on CUE-OUT",
      "priority": 1,
      "enabled": true,
      "conditions": [
        { "field": "commandType", "operator": "eq", "value": "5" },
        { "field": "outOfNetwork", "operator": "eq", "value": "true" }
      ],
      "action": "noop",
      "modifications": [],
      "altContentIdentity": "CH62",
      "altContentZoneIdentity": "Z001"
    },
    {
      "ruleId": "vis-cue-in",
      "name": "Return to Main Content on CUE-IN",
      "priority": 2,
      "enabled": true,
      "conditions": [
        { "field": "commandType", "operator": "eq", "value": "5" },
        { "field": "outOfNetwork", "operator": "eq", "value": "false" }
      ],
      "action": "noop",
      "modifications": [],
      "altContentIdentity": "CH61",
      "altContentZoneIdentity": "Z001"
    }
  ]
}`} language="json" />
        </section>

        {/* ESAM Response XML */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">ESAM Response (SPN)</h2>
          <p className="text-slate-700 leading-relaxed mb-4">
            When a matched rule has <code className="px-2 py-1 bg-slate-100 rounded text-sm font-mono">altContentIdentity</code> configured,
            the POIS server generates a Signal Processing Notification that includes the
            <code className="px-2 py-1 bg-slate-100 rounded text-sm font-mono mx-1">{'<signal:AlternateContent>'}</code> element.
            Here is what the SPN looks like for a CUE-OUT switch to CH62:
          </p>
          <CodeBlock code={`<signal:SignalProcessingNotification
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:signaling="urn:cablelabs:md:xsd:signaling:3.0"
    xmlns:common="urn:cablelabs:iptvservices:esam:xsd:common:1"
    xmlns:signal="urn:cablelabs:iptvservices:esam:xsd:signal:1"
    xsi:schemaLocation="urn:cablelabs:iptvservices:esam:xsd:signal:1 OC-SP-ESAM-API-I03-Signal.xsd">
  <signal:ResponseSignal
      action="noop"
      acquisitionPointIdentity="vis-channel"
      acquisitionSignalID="signal-001"
      zoneIdentity="Z001"
      acquisitionTime="2026-01-01T00:00:00Z">
    <signaling:UTCPoint utcPoint="2026-01-01T00:00:00Z"/>
    <signaling:BinaryData signalType="SCTE35">
      /DAlAAAAAAAAAP/wFAUAAAABf+/+AAAAAH4AUmXAAAAAAAAMAQpDVUVJAAAAATEICAA=
    </signaling:BinaryData>
    <signal:AlternateContent
        altContent="true"
        altContentIdentity="CH62"
        zoneIdentity="Z001"/>
  </signal:ResponseSignal>
  <common:StatusCode classCode="0"/>
</signal:SignalProcessingNotification>`} language="xml" />
        </section>

        {/* Key Concepts */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Key Concepts</h2>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2" />
              <p className="text-slate-700 text-sm">
                <code className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-mono font-semibold">altContentIdentity</code>
                {' '}maps to the virtual input name on the encoder (e.g., CH61, CH62). The encoder must have a virtual input configured with this exact name.
              </p>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2" />
              <p className="text-slate-700 text-sm">
                <code className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-mono font-semibold">altContentZoneIdentity</code>
                {' '}is the zone identifier for regional targeting. It appears as <code className="px-1 py-0.5 bg-slate-100 rounded text-xs font-mono">zoneIdentity</code> in the AlternateContent element.
              </p>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2" />
              <p className="text-slate-700 text-sm">
                <strong>Multiple conditions per rule:</strong> conditions use AND logic. Combining
                <code className="px-1 py-0.5 bg-slate-100 rounded text-xs font-mono mx-1">commandType=5</code> with
                <code className="px-1 py-0.5 bg-slate-100 rounded text-xs font-mono mx-1">outOfNetwork=true/false</code>
                enables precise CUE-OUT vs. CUE-IN matching.
              </p>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2" />
              <p className="text-slate-700 text-sm">
                <strong>Any action works:</strong> the rule action can be
                <code className="px-1 py-0.5 bg-slate-100 rounded text-xs font-mono mx-1">noop</code>,
                <code className="px-1 py-0.5 bg-slate-100 rounded text-xs font-mono mx-1">replace</code>, or
                <code className="px-1 py-0.5 bg-slate-100 rounded text-xs font-mono mx-1">delete</code>.
                AlternateContent is added to the response whenever <code className="px-1 py-0.5 bg-slate-100 rounded text-xs font-mono">altContentIdentity</code> is configured on the matched rule.
              </p>
            </li>
          </ul>
        </section>

        {/* Dashboard View */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Dashboard View</h2>
          <p className="text-slate-700 leading-relaxed mb-4">
            The POIS dashboard includes Alternate Content fields in the rule editor. When creating or editing a rule,
            the "Alternate Content" section appears with Input Identity and Zone Identity fields:
          </p>
          <div className="my-8 rounded-lg border border-slate-300 overflow-hidden shadow-md">
            {/* Browser window frame */}
            <div className="bg-slate-700 px-4 py-2 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <span className="text-xs text-slate-300 ml-2">POIS Dashboard: VIS Channel Rule</span>
            </div>
            <div className="p-6 bg-white">

              {/* Single Rule Card - matches ChannelForm.tsx structure */}
              <div className="rounded-xl ring-1 ring-gray-200/60 overflow-hidden shadow-sm">
                {/* Rule Header with gradient (green for noop) */}
                <div className="px-5 py-3 flex items-center justify-between bg-gradient-to-r from-green-50 to-white border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold bg-green-100 text-green-700">
                      1
                    </span>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">Rule 1</h4>
                      <p className="text-xs text-gray-500">Priority 1</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded font-medium bg-green-50 text-green-700">
                      NOOP
                    </span>
                  </div>
                </div>

                {/* Rule Body */}
                <div className="p-5 bg-white space-y-4">
                  {/* 1. Conditions Section */}
                  <div className="bg-blue-50 rounded-xl p-4 ring-1 ring-blue-200">
                    <h4 className="text-sm font-semibold text-blue-900 mb-1">1. Match Conditions</h4>
                    <p className="text-xs text-blue-700 mb-3">Define when this rule should trigger</p>

                    {/* Condition row 1: commandType = 5 */}
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr] gap-3 mb-3 items-end">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Field</label>
                        <div className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white flex items-center justify-between">
                          <span>Command Type</span>
                          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Operator</label>
                        <div className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white flex items-center justify-between">
                          <span>Equals (=)</span>
                          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                        <div className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white flex items-center justify-between">
                          <span>5 - Splice Insert</span>
                          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                    </div>

                    {/* Condition row 2: outOfNetwork = true */}
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr] gap-3 mb-3 items-end">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Field</label>
                        <div className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white flex items-center justify-between">
                          <span>Out of Network</span>
                          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Operator</label>
                        <div className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white flex items-center justify-between">
                          <span>Equals (=)</span>
                          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                        <div className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white flex items-center justify-between">
                          <span>True (CUE-OUT)</span>
                          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                    </div>

                    {/* Add Condition link */}
                    <button type="button" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium mt-1">
                      + Add Condition
                    </button>
                  </div>

                  {/* 4. Alternate Content Section */}
                  <div className="bg-teal-50 rounded-xl p-4 ring-1 ring-teal-200">
                    <div className="mb-3">
                      <h4 className="text-sm font-semibold text-teal-900">4. Alternate Content</h4>
                      <p className="text-xs text-teal-700 mt-1">Instruct the encoder to switch inputs when this rule matches</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Input Identity</label>
                        <div className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white">
                          CH62
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Zone Identity</label>
                        <div className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white">
                          Z001
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Rule Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="relative inline-flex h-5 w-9 items-center rounded-full bg-indigo-600 transition-colors">
                        <span className="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform translate-x-4" />
                      </div>
                      <span className="text-sm font-medium text-gray-700">Rule Enabled</span>
                    </div>
                    <button type="button" className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Remove Rule
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Notes */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Notes</h2>
          <Callout type="warning" title="Encoder Configuration Required">
            The encoder must have virtual inputs configured with names matching the
            <code className="px-1.5 py-0.5 bg-yellow-100 rounded text-xs font-mono mx-1">altContentIdentity</code>
            values (e.g., CH61 and CH62). Without matching virtual inputs on the encoder side, the switch instruction will be ignored.
          </Callout>
          <Callout type="info" title="Solicited ESAM Only">
            VIS uses "solicited" ESAM: the encoder sends an SPE first, and POIS responds with an SPN containing
            switching instructions. For "unsolicited" switching without SCTE-35 triggers (e.g., emergency content
            replacement), a separate Live Resource Manager (LRM) system is needed to send commands directly to
            the encoder's unsolicited ESAM endpoint.
          </Callout>
        </section>
      </div>
    </div>
  );
};
