// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Callout } from '../components/DocComponents';
import { GitBranch } from 'lucide-react';

export default function CorrelationTracking() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="p-8 border-b border-slate-200">
        <h1 className="text-3xl font-bold text-slate-900 mb-3 flex items-center gap-3">
          <GitBranch className="w-8 h-8 text-indigo-600" />
          Correlation &amp; Request Tracking
        </h1>
        <p className="text-lg text-slate-600">
          Trace every ESAM signal through its complete processing lifecycle using unique Correlation IDs
        </p>
      </div>

      <div className="p-8 space-y-8">
        {/* How It Works */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">How It Works</h2>
          <p className="text-slate-700 leading-relaxed mb-4">
            Every ESAM request processed by POIS is assigned a unique <strong>Correlation ID</strong> (UUID v4).
            This ID is generated at the start of each Lambda invocation and injected into every log entry
            produced during that request. This allows you to trace the complete lifecycle of a signal
            from reception to response.
          </p>
        </section>

        {/* Processing Flow */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Processing Flow</h2>
          <p className="text-slate-700 leading-relaxed mb-4">
            All processing happens within a <strong>single Lambda invocation</strong>. The encoder sends
            a POST request and waits for the response. Everything below runs synchronously inside that
            same invocation:
          </p>

          <div className="my-6 p-6 bg-slate-50 rounded-xl border border-slate-200">
            <svg viewBox="0 0 800 400" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
              <defs />

              {/* Step 1 */}
              <rect x="280" y="10" width="240" height="44" rx="6" fill="#EEF2FF" stroke="#4F46E5" strokeWidth="1.5" />
              <text x="300" y="37" fontSize="12" fontWeight="700" fill="#4338CA" fontFamily="system-ui">1</text>
              <text x="316" y="37" fontSize="11" fontWeight="500" fill="#4338CA" fontFamily="system-ui">Generate correlation_id = uuid4()</text>

              {/* Arrow 1-2 */}
              <line x1="400" y1="54" x2="400" y2="61" stroke="#94A3B8" strokeWidth="1.5" />
          <polygon points="395,61 405,61 400,68" fill="#94A3B8" />

              {/* Step 2 */}
              <rect x="280" y="74" width="240" height="44" rx="6" fill="#EEF2FF" stroke="#4F46E5" strokeWidth="1.5" />
              <text x="300" y="101" fontSize="12" fontWeight="700" fill="#4338CA" fontFamily="system-ui">2</text>
              <text x="316" y="101" fontSize="11" fontWeight="500" fill="#4338CA" fontFamily="system-ui">Parse ESAM XML (SPE)</text>

              {/* Arrow 2-3 */}
              <line x1="400" y1="118" x2="400" y2="125" stroke="#94A3B8" strokeWidth="1.5" />
          <polygon points="395,125 405,125 400,132" fill="#94A3B8" />

              {/* Step 3 */}
              <rect x="280" y="138" width="240" height="44" rx="6" fill="#EEF2FF" stroke="#4F46E5" strokeWidth="1.5" />
              <text x="300" y="165" fontSize="12" fontWeight="700" fill="#4338CA" fontFamily="system-ui">3</text>
              <text x="316" y="165" fontSize="11" fontWeight="500" fill="#4338CA" fontFamily="system-ui">Load channel config from DynamoDB</text>

              {/* Arrow 3-4 */}
              <line x1="400" y1="182" x2="400" y2="189" stroke="#94A3B8" strokeWidth="1.5" />
          <polygon points="395,189 405,189 400,196" fill="#94A3B8" />

              {/* Step 4 */}
              <rect x="280" y="202" width="240" height="44" rx="6" fill="#EEF2FF" stroke="#4F46E5" strokeWidth="1.5" />
              <text x="300" y="229" fontSize="12" fontWeight="700" fill="#4338CA" fontFamily="system-ui">4</text>
              <text x="316" y="229" fontSize="11" fontWeight="500" fill="#4338CA" fontFamily="system-ui">Evaluate rules against SCTE-35 signal</text>

              {/* Arrow 4-5 */}
              <line x1="400" y1="246" x2="400" y2="253" stroke="#94A3B8" strokeWidth="1.5" />
          <polygon points="395,253 405,253 400,260" fill="#94A3B8" />

              {/* Step 5 (amber for external actions) */}
              <rect x="280" y="266" width="240" height="44" rx="6" fill="#FFFBEB" stroke="#F59E0B" strokeWidth="1.5" />
              <text x="300" y="293" fontSize="12" fontWeight="700" fill="#92400E" fontFamily="system-ui">5</text>
              <text x="316" y="293" fontSize="11" fontWeight="500" fill="#92400E" fontFamily="system-ui">Execute external actions (if any)</text>

              {/* Arrow 5-6 */}
              <line x1="400" y1="310" x2="400" y2="317" stroke="#94A3B8" strokeWidth="1.5" />
          <polygon points="395,317 405,317 400,324" fill="#94A3B8" />

              {/* Step 6 */}
              <rect x="280" y="330" width="240" height="44" rx="6" fill="#EEF2FF" stroke="#4F46E5" strokeWidth="1.5" />
              <text x="300" y="357" fontSize="12" fontWeight="700" fill="#4338CA" fontFamily="system-ui">6</text>
              <text x="316" y="357" fontSize="11" fontWeight="500" fill="#4338CA" fontFamily="system-ui">Build ESAM response (SPN)</text>

              {/* Log messages on the right side */}
              <text x="534" y="37" fontSize="9" fill="#64748B" fontFamily="system-ui">log: "Request started"</text>
              <text x="534" y="101" fontSize="9" fill="#64748B" fontFamily="system-ui">log: "SignalProcessingEvent (SPE)"</text>
              <text x="534" y="165" fontSize="9" fill="#64748B" fontFamily="system-ui">log: "Channel loaded"</text>
              <text x="534" y="229" fontSize="9" fill="#64748B" fontFamily="system-ui">log: "Rule evaluation complete"</text>
              <text x="534" y="289" fontSize="9" fill="#64748B" fontFamily="system-ui">log: "External actions triggered"</text>
              <text x="534" y="301" fontSize="9" fill="#64748B" fontFamily="system-ui">log: "External actions completed"</text>
              <text x="534" y="353" fontSize="9" fill="#64748B" fontFamily="system-ui">log: "Signal processed"</text>
              <text x="534" y="365" fontSize="9" fill="#64748B" fontFamily="system-ui">log: "SignalProcessingNotification (SPN)"</text>
            </svg>
            <p className="text-center text-xs text-slate-500 mt-3">
              Vertical processing flow within a single Lambda invocation. All steps share the same Correlation ID.
            </p>
          </div>
        </section>

        {/* Key Points */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Key Points</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-5 bg-slate-50 rounded-xl border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Single Lambda Invocation</h3>
              <p className="text-sm text-slate-700">
                SPE parsing, rule evaluation, external actions (MediaLive API calls),
                and SPN response all happen in the same Lambda invocation. There is no cross-service communication.
              </p>
            </div>
            <div className="p-5 bg-slate-50 rounded-xl border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">UUID v4 Entropy</h3>
              <p className="text-sm text-slate-700">
                The correlation ID is generated using Python's <code className="px-1 py-0.5 bg-slate-200 rounded text-xs">uuid.uuid4()</code>,
                which provides 122 bits of entropy. Collision probability is negligible (~1 in 2<sup>61</sup>).
              </p>
            </div>
            <div className="p-5 bg-slate-50 rounded-xl border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">X-Correlation-ID Header</h3>
              <p className="text-sm text-slate-700">
                The correlation ID is returned in the <code className="px-1 py-0.5 bg-slate-200 rounded text-xs">X-Correlation-ID</code> response
                header, allowing the encoder to log it for end-to-end tracing.
              </p>
            </div>
            <div className="p-5 bg-slate-50 rounded-xl border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Synchronous External Actions</h3>
              <p className="text-sm text-slate-700">
                Even MediaLive schedule actions (input switch, graphic overlay, etc.) execute synchronously
                within the same invocation. The encoder waits for the full response, which includes
                the time spent calling the MediaLive API (~100-500ms).
              </p>
            </div>
          </div>
        </section>

        {/* Example: Grouped Log View */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Example: Grouped Log View</h2>
          <p className="text-slate-700 leading-relaxed mb-4">
            In the <strong>Monitoring</strong> page, you can switch to "Group by Request" view to see all events
            from the same correlation ID collapsed together. This makes it easy to trace the full lifecycle
            of each signal.
          </p>
          <Callout type="info" title="Tip">
            Hover over any correlation ID in the flat view to see the full UUID.
            Click "Group by Request" to see events organized by request instead of chronologically.
          </Callout>
        </section>

        {/* Typical Event Counts per Request */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Typical Event Counts per Request</h2>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Scenario</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Events</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Typical Duration</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="px-4 py-3 text-slate-700">Signal with no rule match</td>
                  <td className="px-4 py-3 font-medium text-slate-900">6 events</td>
                  <td className="px-4 py-3 text-slate-600">~10ms</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="px-4 py-3 text-slate-700">Signal with rule match (delete/noop)</td>
                  <td className="px-4 py-3 font-medium text-slate-900">7 events</td>
                  <td className="px-4 py-3 text-slate-600">~10-15ms</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-700">Signal with external action</td>
                  <td className="px-4 py-3 font-medium text-slate-900">8-9 events</td>
                  <td className="px-4 py-3 text-slate-600">~100-500ms</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
