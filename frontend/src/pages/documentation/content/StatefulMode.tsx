// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React from 'react';
import { CodeBlock, Callout, Table } from '../components/DocComponents';
import { Shield, Clock, Database, ToggleRight } from 'lucide-react';

export const StatefulMode: React.FC = () => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="p-8 border-b border-slate-200">
        <h1 className="text-3xl font-bold text-slate-900 mb-3 flex items-center gap-3">
          <Shield className="w-8 h-8 text-indigo-600" />
          Stateful Mode
        </h1>
        <p className="text-lg text-slate-600">
          Intelligent ad break tracking with state persistence across multiple SCTE-35 signals
        </p>
      </div>

      <div className="p-8 space-y-8">
        {/* Overview */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Overview</h2>
          <p className="text-slate-700 leading-relaxed mb-4">
            Stateful Mode tracks ad break state across multiple SCTE-35 signals, enabling the POIS server
            to understand the full lifecycle of an ad break, from cue-out to cue-in. When enabled,
            the system suppresses redundant signals during an active break. Break boundaries are detected
            from splice_insert commands via <code className="px-2 py-1 bg-slate-100 rounded text-sm">out_of_network_indicator</code>,
            and from placement opportunity segmentation types (0x34, 0x36, 0x38, 0x3A for a start and
            0x35, 0x37, 0x39, 0x3B for an end). One active break is tracked per channel.
          </p>
          <Callout type="info" title="When to Use Stateful Mode">
            Enable stateful mode when your workflow sends multiple SCTE-35 signals during an ad break
            and you want the POIS server to automatically manage break state, suppressing duplicate
            cue-outs and detecting when a break ends.
          </Callout>
        </section>

        {/* State Machine Diagram */}
        <div className="my-6 p-6 bg-slate-50 rounded-xl border border-slate-200">
          <svg viewBox="0 0 800 240" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <marker id="ah3" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <path d="M0,0 L8,3 L0,6" fill="#94A3B8" />
              </marker>
            </defs>

            {/* Row 1: 3 states equally spaced */}
            {/* State 1: IDLE */}
            <rect x="80" y="47" width="130" height="46" rx="6" fill="#F0FDF4" stroke="#22C55E" strokeWidth="1.5" />
            <text x="145" y="67" textAnchor="middle" fontSize="12" fontWeight="600" fill="#166534" fontFamily="system-ui">IDLE</text>
            <text x="145" y="82" textAnchor="middle" fontSize="10" fill="#15803D" fontFamily="system-ui">No active break</text>

            {/* Arrow 1→2 with label above */}
            <line x1="210" y1="70" x2="310" y2="70" stroke="#94A3B8" strokeWidth="1.5" markerEnd="url(#ah3)" />
            <text x="260" y="58" textAnchor="middle" fontSize="10" fill="#64748B" fontFamily="system-ui">out_of_network</text>

            {/* State 2: IN_BREAK */}
            <rect x="310" y="47" width="130" height="46" rx="6" fill="#FEF2F2" stroke="#EF4444" strokeWidth="1.5" />
            <text x="375" y="67" textAnchor="middle" fontSize="12" fontWeight="600" fill="#DC2626" fontFamily="system-ui">IN_BREAK</text>
            <text x="375" y="82" textAnchor="middle" fontSize="10" fill="#B91C1C" fontFamily="system-ui">Ad break active</text>

            {/* Arrow 2→3 with label above */}
            <line x1="440" y1="70" x2="540" y2="70" stroke="#94A3B8" strokeWidth="1.5" markerEnd="url(#ah3)" />
            <text x="490" y="58" textAnchor="middle" fontSize="10" fill="#64748B" fontFamily="system-ui">in_network</text>

            {/* State 3: IDLE (returned) */}
            <rect x="540" y="47" width="130" height="46" rx="6" fill="#F0FDF4" stroke="#22C55E" strokeWidth="1.5" />
            <text x="605" y="67" textAnchor="middle" fontSize="12" fontWeight="600" fill="#166534" fontFamily="system-ui">IDLE</text>
            <text x="605" y="82" textAnchor="middle" fontSize="10" fill="#15803D" fontFamily="system-ui">Break ended</text>

            {/* Vertical arrow from IN_BREAK to AUTO CUE-IN */}
            <line x1="375" y1="93" x2="375" y2="150" stroke="#94A3B8" strokeWidth="1.5" markerEnd="url(#ah3)" />
            <text x="375" y="128" textAnchor="middle" fontSize="10" fill="#64748B" fontFamily="system-ui">duration expires</text>

            {/* AUTO CUE-IN state below center */}
            <rect x="310" y="150" width="130" height="46" rx="6" fill="#FFFBEB" stroke="#F59E0B" strokeWidth="1.5" />
            <text x="375" y="170" textAnchor="middle" fontSize="12" fontWeight="500" fill="#92400E" fontFamily="system-ui">AUTO CUE-IN</text>
            <text x="375" y="185" textAnchor="middle" fontSize="10" fill="#B45309" fontFamily="system-ui">Return to content</text>
          </svg>
          <p className="text-center text-xs text-slate-500 mt-3">Stateful mode state machine: tracks ad break lifecycle from cue-out through cue-in</p>
        </div>{/* How to Enable */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">How to Enable</h2>
          <p className="text-slate-700 mb-4">
            Stateful mode is configured per-channel. Toggle it on in the channel configuration panel
            or set <code className="px-2 py-1 bg-slate-100 rounded text-sm">statefulMode: true</code> in the API request body.
          </p>
          <CodeBlock code={`{
  "channelId": "my-channel",
  "name": "Production Channel",
  "statefulMode": true,
  "defaultAction": "noop",
  "rules": [...]
}`} language="json" />
        </section>

        {/* UI Preview - Stateful Mode Toggle */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Dashboard View</h2>
          <div className="my-8 rounded-lg border border-slate-300 overflow-hidden shadow-md">
            <div className="bg-slate-700 px-4 py-2 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <span className="text-xs text-slate-300 ml-2">POIS Dashboard: Stateful Mode</span>
            </div>
            <div className="p-6 bg-slate-50">
              {/* Toggle Section */}
              <div className="max-w-xl mb-6">
                <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <ToggleRight className="w-5 h-5 text-indigo-600" />
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Stateful Mode</div>
                      <div className="text-xs text-slate-500">Track ad break state across signals</div>
                    </div>
                  </div>
                  <div className="w-11 h-6 bg-indigo-600 rounded-full relative">
                    <div className="absolute right-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow" />
                  </div>
                </div>
              </div>

              {/* Break Status Timeline */}
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-900 mb-4">Break Status Timeline</h4>
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-3 bottom-3 w-0.5 bg-slate-200" />

                  {/* Event 1 - Cue Out */}
                  <div className="flex items-start gap-4 mb-4 relative">
                    <div className="w-8 h-8 rounded-full bg-red-100 border-2 border-red-400 flex items-center justify-center z-10">
                      <span className="text-xs font-bold text-red-600">↓</span>
                    </div>
                    <div className="flex-1 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-red-800">Cue-Out (Break Start)</span>
                        <span className="text-xs text-slate-500">10:30:00.000</span>
                      </div>
                      <div className="text-xs text-red-600 mt-1 font-mono">splice_insert | event_id: 1001 | duration: 180s</div>
                    </div>
                  </div>

                  {/* Event 2 - In Break (suppressed) */}
                  <div className="flex items-start gap-4 mb-4 relative">
                    <div className="w-8 h-8 rounded-full bg-yellow-100 border-2 border-yellow-400 flex items-center justify-center z-10">
                      <span className="text-xs font-bold text-yellow-600">⊘</span>
                    </div>
                    <div className="flex-1 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-yellow-800">Signal Suppressed</span>
                        <span className="text-xs text-slate-500">10:31:15.000</span>
                      </div>
                      <div className="text-xs text-yellow-600 mt-1 font-mono">In active break. Signal deleted (stateful mode)</div>
                    </div>
                  </div>

                  {/* Event 3 - Cue In */}
                  <div className="flex items-start gap-4 relative">
                    <div className="w-8 h-8 rounded-full bg-green-100 border-2 border-green-400 flex items-center justify-center z-10">
                      <span className="text-xs font-bold text-green-600">↑</span>
                    </div>
                    <div className="flex-1 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-green-800">Cue-In (Break End)</span>
                        <span className="text-xs text-slate-500">10:33:00.000</span>
                      </div>
                      <div className="text-xs text-green-600 mt-1 font-mono">splice_insert | event_id: 1001 | out_of_network: false</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="text-center text-sm text-slate-500 mt-2 italic">Stateful mode toggle and break status timeline</p>
        </section>

        {/* Break Detection Logic */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Break Detection Logic</h2>
          <p className="text-slate-700 mb-4">
            The system determines break boundaries using the <code className="px-2 py-1 bg-slate-100 rounded text-sm">splice_insert</code> command
            with the <code className="px-2 py-1 bg-slate-100 rounded text-sm">out_of_network_indicator</code> field:
          </p>
          <Table
            headers={['Signal', 'out_of_network_indicator', 'Interpretation']}
            rows={[
              [
                <code className="text-xs">splice_insert</code>,
                <code className="text-xs bg-red-50 text-red-700 px-1.5 py-0.5 rounded">true</code>,
                'Break Start (Cue-Out): enter ad break'
              ],
              [
                <code className="text-xs">splice_insert</code>,
                <code className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded">false</code>,
                'Break End (Cue-In): return to content'
              ],
            ]}
          />
          <Callout type="warning" title="Break End Detection">
            A break is considered ended when either an explicit cue-in signal arrives (splice_insert
            with out_of_network_indicator = false) OR when the break duration expires without
            receiving an explicit cue-in.
          </Callout>
        </section>

        {/* Auto Cue-In */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Auto Cue-In (Duration Expiry)</h2>
          <p className="text-slate-700 mb-4">
            When a break starts, the system calculates a <strong>break expiry time</strong> based on
            the break duration specified in the SCTE-35 signal. If no explicit cue-in arrives before
            the expiry time, the system automatically transitions out of the break state.
          </p>
          <p className="text-slate-700 mb-4">
            Duration is extracted from:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-slate-700 mb-4">
            <li>The <code className="px-2 py-1 bg-slate-100 rounded text-sm">break_duration</code> field in a splice_insert command (90kHz ticks)</li>
            <li>The <code className="px-2 py-1 bg-slate-100 rounded text-sm">segmentation_duration</code> field in a segmentation descriptor (90kHz ticks)</li>
          </ol>
          <CodeBlock code={`# Break expiry calculation (from signal_processor.py)
# Duration from splice_insert.break_duration (90kHz ticks → seconds)
duration_seconds = signal.splice_command.break_duration.duration // 90000

# Or from segmentation_descriptor.segmentation_duration
duration_seconds = descriptor.segmentation_duration // 90000

# Expiry time = now + duration (in milliseconds)
break_expiry_time = int(time.time() * 1000) + (duration_seconds * 1000)`} language="python" />
        </section>

        {/* State Persistence */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">State Persistence</h2>
          <p className="text-slate-700 mb-4">
            Channel state is persisted in DynamoDB using a single-table design. Each channel has
            a state record that tracks whether it is currently in an ad break.
          </p>
          <div className="flex items-start gap-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 mb-4">
            <Database className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
            <div>
              <h4 className="font-semibold text-slate-900 mb-1">DynamoDB State Record</h4>
              <p className="text-sm text-slate-700">
                Stored with <code className="text-xs bg-white/60 px-1 py-0.5 rounded">PK: CHANNEL#{'<channelId>'}</code> and <code className="text-xs bg-white/60 px-1 py-0.5 rounded">SK: STATE</code>
              </p>
            </div>
          </div>
          <CodeBlock code={`// ChannelState schema
{
  "channelId": "my-channel",        // Channel identifier
  "inBreak": true,                   // Whether currently in an ad break
  "breakStartTime": "2024-01-15T10:30:00Z",  // When the break started
  "breakEventId": 1001,              // splice_insert event_id
  "breakExpiryTime": 1705318380000,  // Unix ms when break auto-expires
  "lastProcessedTime": "2024-01-15T10:31:15Z" // Last signal processed
}`} language="json" />
          <Table
            headers={['Field', 'Type', 'Description']}
            rows={[
              ['channelId', 'string', 'Channel identifier'],
              ['inBreak', 'boolean', 'Whether the channel is currently in an ad break'],
              ['breakStartTime', 'string (ISO)', 'Timestamp when the current break started'],
              ['breakEventId', 'integer', 'The event_id from the splice_insert that started the break'],
              ['breakExpiryTime', 'integer (ms)', 'Unix timestamp in milliseconds when the break auto-expires'],
              ['lastProcessedTime', 'string (ISO)', 'Last time a signal was processed for this channel'],
            ]}
          />
        </section>

        {/* Processing Flow */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Processing Flow</h2>
          <p className="text-slate-700 mb-4">
            When stateful mode is enabled, the signal processing follows this logic:
          </p>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">1</div>
              <div>
                <div className="text-sm font-medium text-slate-900">Check Break State</div>
                <div className="text-xs text-slate-600">Load current channel state from DynamoDB</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">2</div>
              <div>
                <div className="text-sm font-medium text-slate-900">If In Break &amp; Not Break-End Signal</div>
                <div className="text-xs text-slate-600">Delete the signal (suppress during active break) unless break has expired</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">3</div>
              <div>
                <div className="text-sm font-medium text-slate-900">Process Rules</div>
                <div className="text-xs text-slate-600">Evaluate rules and apply action (delete, noop, replace)</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">4</div>
              <div>
                <div className="text-sm font-medium text-slate-900">Update State</div>
                <div className="text-xs text-slate-600">Persist new break state to DynamoDB (enter break, exit break, or no change)</div>
              </div>
            </div>
          </div>
        </section>

        {/* Behavior During Active Break */}
        <section className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100">
          <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            Behavior During Active Break
          </h3>
          <p className="text-sm text-slate-700 mb-3">
            While the channel is in an active break (inBreak = true and current time &lt; breakExpiryTime),
            all incoming signals are automatically deleted, <strong>except</strong> break-end signals
            (splice_insert with out_of_network_indicator = false). This prevents redundant signals
            from reaching the encoder during an ad break.
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">Signals deleted during break</span>
            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Break-end signals pass through</span>
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">Auto-expires by duration</span>
          </div>
        </section>
      </div>
    </div>
  );
};
