// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React from 'react';
import { Zap, Shield, Code2, Layers, Radio, Lock } from 'lucide-react';
import { useDocNavigation } from '../components/NavigationContext';

export const Home: React.FC = () => {
  const { navigateTo } = useDocNavigation();

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl p-12 text-white shadow-xl">
        <h1 className="text-4xl font-bold mb-4">
          POIS Reference Server
        </h1>
        <p className="text-xl text-indigo-100 mb-8 max-w-2xl">
          A reference implementation of SCTE-130 POIS for SCTE-35 signal conditioning and ad insertion management, with full ESAM support.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigateTo('quick-start')}
            className="px-6 py-3 bg-white text-indigo-600 rounded-lg font-semibold hover:bg-indigo-50 transition-colors"
          >
            Get Started
          </button>
          <button
            onClick={() => navigateTo('api-overview')}
            className="px-6 py-3 bg-white/10 backdrop-blur-sm text-white rounded-lg font-semibold hover:bg-white/20 transition-colors border border-white/20"
          >
            View API
          </button>
        </div>
      </div>


      {/* Architecture Diagram */}
      <div className="p-6 bg-white rounded-xl border border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900 mb-5 text-center">System Architecture</h2>
        <svg viewBox="0 0 820 480" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <marker id="ah" markerWidth="7" markerHeight="5" refX="6" refY="2.5" orient="auto">
              <path d="M0,0 L7,2.5 L0,5" fill="#94A3B8" />
            </marker>
          </defs>

          {/* Row labels */}
          <text x="15" y="45" textAnchor="start" fontSize="8" fontWeight="600" fill="#CBD5E1" fontFamily="system-ui" transform="rotate(-90, 15, 45)">USERS</text>
          <text x="15" y="125" textAnchor="start" fontSize="8" fontWeight="600" fill="#CBD5E1" fontFamily="system-ui" transform="rotate(-90, 15, 125)">EDGE</text>
          <text x="15" y="210" textAnchor="start" fontSize="8" fontWeight="600" fill="#CBD5E1" fontFamily="system-ui" transform="rotate(-90, 15, 210)">COMPUTE</text>
          <text x="15" y="300" textAnchor="start" fontSize="8" fontWeight="600" fill="#CBD5E1" fontFamily="system-ui" transform="rotate(-90, 15, 300)">PROCESS</text>
          <text x="15" y="390" textAnchor="start" fontSize="8" fontWeight="600" fill="#CBD5E1" fontFamily="system-ui" transform="rotate(-90, 15, 390)">EXTERNAL</text>

          {/* Horizontal separator lines */}
          <line x1="35" y1="80" x2="800" y2="80" stroke="#F1F5F9" strokeWidth="1" />
          <line x1="35" y1="165" x2="800" y2="165" stroke="#F1F5F9" strokeWidth="1" />
          <line x1="35" y1="255" x2="800" y2="255" stroke="#F1F5F9" strokeWidth="1" />
          <line x1="35" y1="345" x2="800" y2="345" stroke="#F1F5F9" strokeWidth="1" />

          {/* ROW 1: Users */}
          <rect x="43" y="25" width="115" height="40" rx="6" fill="#1E293B" stroke="#334155" strokeWidth="1.5" />
          <text x="100" y="43" textAnchor="middle" fontSize="11" fontWeight="600" fill="#FFFFFF" fontFamily="system-ui">Operator</text>
          <text x="100" y="56" textAnchor="middle" fontSize="9" fill="#94A3B8" fontFamily="system-ui">Dashboard User</text>

          {/* Encoder - USERS row, aligned above API Gateway */}
          <rect x="353" y="25" width="115" height="40" rx="6" fill="#1E293B" stroke="#334155" strokeWidth="1.5" />
          <text x="410" y="43" textAnchor="middle" fontSize="11" fontWeight="600" fill="#FFFFFF" fontFamily="system-ui">Encoder</text>
          <text x="410" y="56" textAnchor="middle" fontSize="9" fill="#94A3B8" fontFamily="system-ui">SCTE-35 Source</text>
          {/* Encoder → API Gateway (straight vertical down) */}
          <line x1="410" y1="65" x2="410" y2="105" stroke="#94A3B8" strokeWidth="1.5" markerEnd="url(#ah)" />
          <text x="418" y="80" textAnchor="start" fontSize="8" fill="#64748B" fontFamily="system-ui">ESAM POST</text>

          
          
          

          {/* Vertical arrows: Users → Edge */}
          <line x1="100" y1="65" x2="100" y2="105" stroke="#94A3B8" strokeWidth="1.5" markerEnd="url(#ah)" />
          {/* Encoder arrow: goes down then left to API Gateway */}
          
          

          {/* ROW 2: Edge */}
          <rect x="43" y="105" width="115" height="40" rx="6" fill="#FFFBEB" stroke="#F59E0B" strokeWidth="1.5" />
          <text x="100" y="123" textAnchor="middle" fontSize="11" fontWeight="500" fill="#92400E" fontFamily="system-ui">CloudFront</text>
          <text x="100" y="136" textAnchor="middle" fontSize="9" fill="#B45309" fontFamily="system-ui">S3 + CDN</text>

          <rect x="193" y="105" width="115" height="40" rx="6" fill="#EEF2FF" stroke="#4F46E5" strokeWidth="1.5" />
          <text x="250" y="123" textAnchor="middle" fontSize="11" fontWeight="600" fill="#4338CA" fontFamily="system-ui">React App</text>
          <text x="250" y="136" textAnchor="middle" fontSize="9" fill="#6366F1" fontFamily="system-ui">SPA Dashboard</text>

          <rect x="353" y="105" width="115" height="40" rx="6" fill="#FFFBEB" stroke="#F59E0B" strokeWidth="1.5" />
          <text x="410" y="123" textAnchor="middle" fontSize="11" fontWeight="500" fill="#92400E" fontFamily="system-ui">API Gateway</text>
          <text x="410" y="136" textAnchor="middle" fontSize="9" fill="#B45309" fontFamily="system-ui">REST API</text>

          
          {/* API GW → Cognito */}
          <line x1="468" y1="125" x2="693" y2="125" stroke="#94A3B8" strokeWidth="1.5" markerEnd="url(#ah)" />
          <text x="580" y="118" textAnchor="middle" fontSize="8" fill="#94A3B8" fontFamily="system-ui">validates</text>
          <rect x="693" y="105" width="115" height="40" rx="6" fill="#FFFBEB" stroke="#F59E0B" strokeWidth="1.5" />
          <text x="750" y="123" textAnchor="middle" fontSize="11" fontWeight="500" fill="#92400E" fontFamily="system-ui">Cognito</text>
          <text x="750" y="136" textAnchor="middle" fontSize="9" fill="#B45309" fontFamily="system-ui">User Auth</text>

          {/* Horizontal arrows: Edge layer */}
          <line x1="157" y1="125" x2="193" y2="125" stroke="#94A3B8" strokeWidth="1.5" markerEnd="url(#ah)" />
          <line x1="307" y1="125" x2="353" y2="125" stroke="#94A3B8" strokeWidth="1.5" markerEnd="url(#ah)" />
          

          {/* Encoder arrow goes to API Gateway (vertical down then horizontal) */}
          {/* Already goes straight down to API GW col via row alignment */}

          {/* Vertical arrows: Edge → Compute */}
          <line x1="410" y1="145" x2="410" y2="190" stroke="#94A3B8" strokeWidth="1.5" markerEnd="url(#ah)" />
          {/* API GW to Channel Handler */}
          <path d="M370,145 V168 H250 V190" fill="none" stroke="#94A3B8" strokeWidth="1" markerEnd="url(#ah)" />
          {/* API GW to Logs Handler */}
          <path d="M450,145 V168 H570 V190" fill="none" stroke="#94A3B8" strokeWidth="1" markerEnd="url(#ah)" />

          {/* ROW 3: Compute */}
          <rect x="193" y="190" width="115" height="40" rx="6" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.5" />
          <text x="250" y="208" textAnchor="middle" fontSize="10" fontWeight="500" fill="#334155" fontFamily="system-ui">Channel Handler</text>
          <text x="250" y="221" textAnchor="middle" fontSize="9" fill="#64748B" fontFamily="system-ui">CRUD</text>

          <rect x="353" y="190" width="115" height="40" rx="6" fill="#EEF2FF" stroke="#4F46E5" strokeWidth="1.5" />
          <text x="410" y="208" textAnchor="middle" fontSize="10" fontWeight="600" fill="#4338CA" fontFamily="system-ui">ESAM Handler</text>
          <text x="410" y="221" textAnchor="middle" fontSize="9" fill="#6366F1" fontFamily="system-ui">Signal Processing</text>

          <rect x="513" y="190" width="115" height="40" rx="6" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.5" />
          <text x="570" y="208" textAnchor="middle" fontSize="10" fontWeight="500" fill="#334155" fontFamily="system-ui">Logs Handler</text>
          <text x="570" y="221" textAnchor="middle" fontSize="9" fill="#64748B" fontFamily="system-ui">CloudWatch</text>

          <rect x="693" y="190" width="115" height="40" rx="6" fill="#FFFBEB" stroke="#F59E0B" strokeWidth="1.5" />
          <text x="750" y="208" textAnchor="middle" fontSize="10" fontWeight="500" fill="#92400E" fontFamily="system-ui">DynamoDB</text>
          <text x="750" y="221" textAnchor="middle" fontSize="9" fill="#B45309" fontFamily="system-ui">Channels, State</text>


          {/* Handlers → DynamoDB */}
          <line x1="627" y1="210" x2="693" y2="210" stroke="#94A3B8" strokeWidth="1.5" markerEnd="url(#ah)" />
          <text x="660" y="203" textAnchor="middle" fontSize="8" fill="#94A3B8" fontFamily="system-ui">read/write</text>
          

          {/* ESAM Handler → Processing */}
          <line x1="410" y1="230" x2="410" y2="280" stroke="#94A3B8" strokeWidth="1.5" markerEnd="url(#ah)" />

          {/* ROW 4: Processing */}
          <rect x="193" y="280" width="115" height="40" rx="6" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.5" />
          <text x="250" y="298" textAnchor="middle" fontSize="10" fontWeight="500" fill="#334155" fontFamily="system-ui">Rule Engine</text>
          <text x="250" y="311" textAnchor="middle" fontSize="9" fill="#64748B" fontFamily="system-ui">Match Conditions</text>

          <rect x="353" y="280" width="115" height="40" rx="6" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.5" />
          <text x="410" y="298" textAnchor="middle" fontSize="10" fontWeight="500" fill="#334155" fontFamily="system-ui">Signal Modifier</text>
          <text x="410" y="311" textAnchor="middle" fontSize="9" fill="#64748B" fontFamily="system-ui">Apply Changes</text>

          <rect x="513" y="280" width="115" height="40" rx="6" fill="#F0FDF4" stroke="#22C55E" strokeWidth="1.5" />
          <text x="570" y="298" textAnchor="middle" fontSize="10" fontWeight="500" fill="#166534" fontFamily="system-ui">External Actions</text>
          <text x="570" y="311" textAnchor="middle" fontSize="9" fill="#15803D" fontFamily="system-ui">Side Effects</text>
          {/* External Actions → MediaLive */}
          <path d="M540,320 V350 H410 V370" fill="none" stroke="#94A3B8" strokeWidth="1.5" markerEnd="url(#ah)" />
          {/* External Actions → Webhook */}
          <path d="M600,320 V350 H720 V370" fill="none" stroke="#94A3B8" strokeWidth="1.5" markerEnd="url(#ah)" />

          {/* Horizontal arrows: Processing */}
          <line x1="307" y1="300" x2="353" y2="300" stroke="#94A3B8" strokeWidth="1.5" markerEnd="url(#ah)" />
          <line x1="467" y1="300" x2="513" y2="300" stroke="#94A3B8" strokeWidth="1.5" markerEnd="url(#ah)" />

          {/* External Actions → External systems */}
          
          

          {/* ROW 5: External */}
          <rect x="353" y="370" width="115" height="40" rx="6" fill="#1E293B" stroke="#334155" strokeWidth="1.5" />
          <text x="410" y="388" textAnchor="middle" fontSize="10" fontWeight="600" fill="#FFFFFF" fontFamily="system-ui">MediaLive</text>
          <text x="410" y="401" textAnchor="middle" fontSize="9" fill="#94A3B8" fontFamily="system-ui">Schedule Actions</text>

          <rect x="663" y="370" width="115" height="40" rx="6" fill="#1E293B" stroke="#334155" strokeWidth="1.5" />
          <text x="720" y="388" textAnchor="middle" fontSize="10" fontWeight="600" fill="#FFFFFF" fontFamily="system-ui">Webhook</text>
          <text x="720" y="401" textAnchor="middle" fontSize="9" fill="#94A3B8" fontFamily="system-ui">HTTP Endpoint</text>

          <path d="M250,320 V352 H100 V370" fill="none" stroke="#94A3B8" strokeWidth="1.5" markerEnd="url(#ah)" />
          <text x="175" y="347" textAnchor="middle" fontSize="8" fill="#64748B" fontFamily="system-ui">response</text>
          {/* ESAM Response back (dashed, along bottom then left) */}
          <rect x="43" y="370" width="115" height="40" rx="6" fill="#EEF2FF" stroke="#4F46E5" strokeWidth="1.5" />
          <text x="100" y="388" textAnchor="middle" fontSize="10" fontWeight="600" fill="#4338CA" fontFamily="system-ui">ESAM Response</text>
          <text x="100" y="401" textAnchor="middle" fontSize="9" fill="#6366F1" fontFamily="system-ui">SPN XML</text>

          {/* Arrow labels */}
          <text x="175" y="119" textAnchor="middle" fontSize="8" fill="#94A3B8" fontFamily="system-ui">serves</text>
          <text x="330" y="119" textAnchor="middle" fontSize="8" fill="#94A3B8" fontFamily="system-ui">REST</text>
          
          
        </svg>
        <p className="text-center text-xs text-slate-400 mt-4">Layered architecture: all connections are horizontal or vertical, no crossing lines</p>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          onClick={() => navigateTo('api-esam')}
          className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-lg transition-shadow cursor-pointer"
        >
          <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
            <Zap className="w-6 h-6 text-indigo-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            SCTE-35 Processing
          </h3>
          <p className="text-slate-600 text-sm">
            Decode, modify, and re-encode SCTE-35 signals with full support for segmentation descriptors and splice commands.
          </p>
        </div>

        <div
          onClick={() => navigateTo('api-channels')}
          className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-lg transition-shadow cursor-pointer"
        >
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
            <Layers className="w-6 h-6 text-purple-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Channel Management
          </h3>
          <p className="text-slate-600 text-sm">
            Full CRUD for channels with customizable transformation rules, descriptor priority, and real-time validation.
          </p>
        </div>

        <div
          onClick={() => navigateTo('stateful-mode')}
          className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-lg transition-shadow cursor-pointer"
        >
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Stateful Mode
          </h3>
          <p className="text-slate-600 text-sm">
            Intelligent ad break tracking with state persistence and automatic cue-in/cue-out detection across signals.
          </p>
        </div>

        <div
          onClick={() => navigateTo('external-actions')}
          className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-lg transition-shadow cursor-pointer"
        >
          <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center mb-4">
            <Radio className="w-6 h-6 text-pink-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            External Actions
          </h3>
          <p className="text-slate-600 text-sm">
            Trigger actions on external systems (MediaLive schedule actions, webhooks) when signals match rules.
          </p>
        </div>

        <div
          onClick={() => navigateTo('api-overview')}
          className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-lg transition-shadow cursor-pointer"
        >
          <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
            <Code2 className="w-6 h-6 text-orange-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            REST API
          </h3>
          <p className="text-slate-600 text-sm">
            Fully documented REST API with CORS support, rate limiting, and easy integration with external systems.
          </p>
        </div>

        <div
          onClick={() => navigateTo('authentication')}
          className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-lg transition-shadow cursor-pointer"
        >
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Authentication & RBAC
          </h3>
          <p className="text-slate-600 text-sm">
            Amazon Cognito authentication with role-based access control for multi-tenant environments.
          </p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="bg-white rounded-xl p-8 border border-slate-200">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Quick Links</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div
            onClick={() => navigateTo('quick-start')}
            className="p-4 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all group cursor-pointer"
          >
            <h4 className="font-semibold text-slate-900 group-hover:text-indigo-700 mb-1">Quick Start</h4>
            <p className="text-sm text-slate-600">Get up and running in minutes</p>
          </div>
          <div
            onClick={() => navigateTo('api-overview')}
            className="p-4 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all group cursor-pointer"
          >
            <h4 className="font-semibold text-slate-900 group-hover:text-indigo-700 mb-1">API Reference</h4>
            <p className="text-sm text-slate-600">Explore all available endpoints</p>
          </div>
          <div
            onClick={() => navigateTo('troubleshooting')}
            className="p-4 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all group cursor-pointer"
          >
            <h4 className="font-semibold text-slate-900 group-hover:text-indigo-700 mb-1">Troubleshooting</h4>
            <p className="text-sm text-slate-600">Solve common problems</p>
          </div>
        </div>
      </div>
    </div>
  );
};
