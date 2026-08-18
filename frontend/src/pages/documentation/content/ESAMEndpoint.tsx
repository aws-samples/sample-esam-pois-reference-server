// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React from 'react';
import { CodeBlock, Callout, MethodBadge } from '../components/DocComponents';
import { useDeploymentInfo } from '../components/useDeploymentInfo';

export const ESAMEndpoint: React.FC = () => {
  const { esamEndpoint } = useDeploymentInfo();
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="p-8 border-b border-slate-200">
        <div className="flex items-center gap-3 mb-3">
          <MethodBadge method="POST" />
          <code className="text-2xl font-mono font-bold text-slate-900">/esam</code>
        </div>
        <p className="text-lg text-slate-600">
          Processes SCTE-35 signals according to SCTE-130 Part 9 standard
        </p>
      </div>

      <div className="p-8 space-y-8">
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Description</h2>
          <p className="text-slate-700 leading-relaxed">
            Receives a <strong>SignalProcessingEvent (SPE)</strong> in XML format and returns a{' '}
            <strong>SignalProcessingNotification (SPN)</strong> with the processed or modified signal.
          </p>
        </section>


        {/* Processing Pipeline Diagram */}
        <div className="my-6 p-6 bg-slate-50 rounded-xl border border-slate-200">
          <svg viewBox="0 0 800 220" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <marker id="ah2" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <path d="M0,0 L8,3 L0,6" fill="#94A3B8" />
              </marker>
            </defs>

            {/* Row 1: 5 pipeline stages, equally spaced */}
            {/* Node 1: ESAM XML Input */}
            <rect x="20" y="37" width="120" height="46" rx="6" fill="#1E293B" stroke="#334155" strokeWidth="1.5" />
            <text x="80" y="57" textAnchor="middle" fontSize="11" fontWeight="600" fill="#FFFFFF" fontFamily="system-ui">ESAM XML</text>
            <text x="80" y="72" textAnchor="middle" fontSize="10" fill="#94A3B8" fontFamily="system-ui">Input Signal</text>

            <line x1="140" y1="60" x2="170" y2="60" stroke="#94A3B8" strokeWidth="1.5" markerEnd="url(#ah2)" />

            {/* Node 2: XML Parser */}
            <rect x="170" y="37" width="120" height="46" rx="6" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.5" />
            <text x="230" y="57" textAnchor="middle" fontSize="11" fontWeight="500" fill="#334155" fontFamily="system-ui">XML Parser</text>
            <text x="230" y="72" textAnchor="middle" fontSize="10" fill="#64748B" fontFamily="system-ui">ESAM to struct</text>

            <line x1="290" y1="60" x2="320" y2="60" stroke="#94A3B8" strokeWidth="1.5" markerEnd="url(#ah2)" />

            {/* Node 3: SCTE-35 Decoder */}
            <rect x="320" y="37" width="120" height="46" rx="6" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.5" />
            <text x="380" y="57" textAnchor="middle" fontSize="11" fontWeight="500" fill="#334155" fontFamily="system-ui">SCTE-35 Decoder</text>
            <text x="380" y="72" textAnchor="middle" fontSize="10" fill="#64748B" fontFamily="system-ui">Binary to fields</text>

            <line x1="440" y1="60" x2="470" y2="60" stroke="#94A3B8" strokeWidth="1.5" markerEnd="url(#ah2)" />

            {/* Node 4: Rule Evaluator */}
            <rect x="470" y="37" width="120" height="46" rx="6" fill="#EEF2FF" stroke="#4F46E5" strokeWidth="1.5" />
            <text x="530" y="57" textAnchor="middle" fontSize="11" fontWeight="500" fill="#4338CA" fontFamily="system-ui">Rule Evaluator</text>
            <text x="530" y="72" textAnchor="middle" fontSize="10" fill="#6366F1" fontFamily="system-ui">Match conditions</text>

            <line x1="590" y1="60" x2="620" y2="60" stroke="#94A3B8" strokeWidth="1.5" markerEnd="url(#ah2)" />

            {/* Node 5: Response Builder */}
            <rect x="620" y="37" width="120" height="46" rx="6" fill="#F0FDF4" stroke="#22C55E" strokeWidth="1.5" />
            <text x="680" y="57" textAnchor="middle" fontSize="11" fontWeight="500" fill="#166534" fontFamily="system-ui">Response Builder</text>
            <text x="680" y="72" textAnchor="middle" fontSize="10" fill="#15803D" fontFamily="system-ui">SPN XML output</text>

            {/* Vertical arrow from Rule Evaluator to Signal Modifier */}
            <line x1="530" y1="83" x2="530" y2="135" stroke="#94A3B8" strokeWidth="1.5" markerEnd="url(#ah2)" />

            {/* Signal Modifier below Rule Evaluator */}
            <rect x="470" y="135" width="120" height="46" rx="6" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.5" />
            <text x="530" y="155" textAnchor="middle" fontSize="11" fontWeight="500" fill="#334155" fontFamily="system-ui">Signal Modifier</text>
            <text x="530" y="170" textAnchor="middle" fontSize="10" fill="#64748B" fontFamily="system-ui">Apply changes</text>
          </svg>
          <p className="text-center text-xs text-slate-500 mt-3">ESAM processing pipeline: from XML input through SCTE-35 decoding, rule evaluation, and response generation</p>
        </div><section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Request</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Headers</h3>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <code className="text-sm text-slate-700">Content-Type: application/xml</code>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Body</h3>
              <CodeBlock code={`<?xml version="1.0" encoding="UTF-8"?>
<SignalProcessingEvent xmlns="urn:scte:224:2018">
  <AcquisitionPointIdentity>channel-name</AcquisitionPointIdentity>
  <AcquisitionSignalID>signal-123</AcquisitionSignalID>
  <AcquisitionTime>2024-01-15T10:30:00Z</AcquisitionTime>
  <UTCPoint>
    <utcPoint>1705318200</utcPoint>
  </UTCPoint>
  <SCTE35PointDescriptor>
    <spliceInfoSection>/DA4AAAAAAAAAP/wBQb+AAAAAAAwAi4C...</spliceInfoSection>
  </SCTE35PointDescriptor>
  <StreamTimes>
    <StreamTime>
      <timeType>PTS</timeType>
      <timeValue>12345678</timeValue>
    </StreamTime>
  </StreamTimes>
</SignalProcessingEvent>`} language="xml" />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Response</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Success (200 OK)</h3>
              <CodeBlock code={`<?xml version="1.0" encoding="UTF-8"?>
<SignalProcessingNotification xmlns="urn:scte:224:2018">
  <StatusCode>0</StatusCode>
  <AcquisitionPointIdentity>channel-name</AcquisitionPointIdentity>
  <AcquisitionSignalID>signal-123</AcquisitionSignalID>
  <StatusNote>Signal processed successfully</StatusNote>
</SignalProcessingNotification>`} language="xml" />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Behavior</h2>
          <div className="space-y-4">
            <Callout type="warning" title="Channel Not Found">
              If the specified channel doesn't exist, the system returns a NOOP response with status note "Channel not registered with POIS".
            </Callout>
            <Callout type="info" title="Channel Disabled">
              If the channel is disabled (enabled: false), the system returns NOOP with status note "Channel is disabled".
            </Callout>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Examples</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">cURL</h3>
              <CodeBlock code={`curl -X POST ${esamEndpoint} \\
  -H "Content-Type: application/xml" \\
  -d @signal.xml`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Python</h3>
              <CodeBlock code={`import requests

xml_payload = """<?xml version="1.0" encoding="UTF-8"?>
<SignalProcessingEvent xmlns="urn:scte:224:2018">
  <AcquisitionPointIdentity>my-channel</AcquisitionPointIdentity>
  ...
</SignalProcessingEvent>"""

response = requests.post(
    '${esamEndpoint}',
    headers={'Content-Type': 'application/xml'},
    data=xml_payload
)

print(response.text)`} language="python" />
            </div>
          </div>
        </section>

        <section className="bg-slate-50 rounded-xl p-6 border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-3">Performance</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-slate-600 mb-1">Average Time</div>
              <div className="text-xl font-bold text-slate-900">&lt; 100ms</div>
            </div>
            <div>
              <div className="text-slate-600 mb-1">Timeout</div>
              <div className="text-xl font-bold text-slate-900">30s</div>
            </div>
            <div>
              <div className="text-slate-600 mb-1">Memory</div>
              <div className="text-xl font-bold text-slate-900">512 MB</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
