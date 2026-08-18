// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React from 'react';
import { Callout, Table } from '../components/DocComponents';
import { ScrollText, Filter, Search } from 'lucide-react';

export const ESAMLogs: React.FC = () => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="p-8 border-b border-slate-200">
        <h1 className="text-3xl font-bold text-slate-900 mb-3 flex items-center gap-3">
          <ScrollText className="w-8 h-8 text-indigo-600" />
          ESAM Logs
        </h1>
        <p className="text-lg text-slate-600">
          Real-time viewer for ESAM signal processing events in the dashboard
        </p>
      </div>

      <div className="p-8 space-y-8">
        {/* Overview */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Overview</h2>
          <p className="text-slate-700 leading-relaxed mb-4">
            The ESAM Logs viewer provides a real-time log of all ESAM signal processing events
            directly in the POIS dashboard. It shows every signal received, the rule evaluation
            result, the action taken, and the full request/response payloads, making it easy
            to debug signal conditioning behavior.
          </p>
          <Callout type="info" title="Data Source">
            Logs are queried from CloudWatch Logs using structured queries. The viewer supports
            multiple log sources including the ESAM handler, external actions, and channel state changes.
          </Callout>
        </section>

        {/* UI Preview - Live SCTE-35 Feed */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Dashboard View</h2>
          <div className="my-8 rounded-lg border border-slate-300 overflow-hidden shadow-md">
            <div className="bg-slate-700 px-4 py-2 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <span className="text-xs text-slate-300 ml-2">POIS Dashboard: /monitoring</span>
            </div>
            <div className="p-6 bg-slate-50">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Live SCTE-35 Feed</h3>
                  <p className="text-sm text-slate-500">Real-time signal processing monitor</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-2 text-sm text-green-600">
                    <div className="w-2 h-2 rounded-full bg-green-500" /> Live (5s)
                  </span>
                  <button className="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg bg-white">
                    &#9208; Pause
                  </button>
                  <button className="p-1.5 text-slate-400 border border-slate-200 rounded-lg bg-white">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-5 gap-3 mb-6">
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">Total Events</p>
                  <p className="text-2xl font-bold text-slate-900">247</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">Deleted</p>
                  <p className="text-2xl font-bold text-red-600">38</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">Pass-Through</p>
                  <p className="text-2xl font-bold text-green-600">156</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">Modified</p>
                  <p className="text-2xl font-bold text-yellow-600">49</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">Errors</p>
                  <p className="text-2xl font-bold text-orange-600">4</p>
                </div>
              </div>

              {/* Filter Card */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Filter className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    <div className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-400">
                      Search by correlation ID, channel, rule, error...
                    </div>
                    <button className="px-3 py-2 text-sm text-slate-500 border border-slate-200 rounded-lg bg-white flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
                      Clear
                    </button>
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Time Range</label>
                      <select className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-700">
                        <option>Last 24 hours</option>
                        <option>Last 15 minutes</option>
                        <option>Last 1 hour</option>
                        <option>Last 6 hours</option>
                        <option>Last 7 days</option>
                        <option>Last 30 days</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Source</label>
                      <select className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-700">
                        <option>All Sources</option>
                        <option>esam</option>
                        <option>audit</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Channel</label>
                      <select className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-700">
                        <option>All Channels</option>
                        <option>sports-live-east</option>
                        <option>news-national</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Event Type</label>
                      <select className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-700">
                        <option>All Events</option>
                        <option>SPE Received</option>
                        <option>Processed</option>
                        <option>SPN Response</option>
                        <option>NOOP</option>
                        <option>Deleted</option>
                        <option>Modified</option>
                        <option>Rule Evaluated</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Level</label>
                      <select className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-700">
                        <option>All Levels</option>
                        <option>ERROR</option>
                        <option>WARNING</option>
                        <option>INFO</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* View Toggle */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-500">247 events</p>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-100 text-indigo-700">
                    Flat View
                  </button>
                  <button className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-500 hover:bg-slate-100">
                    Group by Request
                  </button>
                </div>
              </div>

              {/* Events Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="w-8 py-3" />
                      <th className="py-3 text-left uppercase text-xs font-semibold text-slate-500 px-2">#</th>
                      <th className="px-3 py-3 text-left uppercase text-xs font-semibold text-slate-500">Time</th>
                      <th className="px-3 py-3 text-left uppercase text-xs font-semibold text-slate-500">Event</th>
                      <th className="px-3 py-3 text-left uppercase text-xs font-semibold text-slate-500">Channel</th>
                      <th className="px-3 py-3 text-left uppercase text-xs font-semibold text-slate-500">Correlation</th>
                      <th className="px-3 py-3 text-left uppercase text-xs font-semibold text-slate-500">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Row 1 - Signal processed (delete) */}
                    <tr className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer">
                      <td className="pl-3 py-2.5 text-center">
                        <svg className="w-3.5 h-3.5 text-slate-400 inline" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
                      </td>
                      <td className="py-2.5 text-xs font-mono text-slate-400 px-2">1</td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs text-slate-900">10:32:15 AM</span>
                        <span className="block text-[10px] text-slate-400">6/10/2026</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700">Processed</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-700">sports-live-east</td>
                      <td className="px-3 py-2.5">
                        <span className="text-[10px] font-mono text-slate-400">a3f8c2d1</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-50 text-red-700 ring-1 ring-red-200">DELETE</span>
                          <span className="font-mono text-slate-500">12.4ms</span>
                        </div>
                      </td>
                    </tr>
                    {/* Row 2 - SPE Received */}
                    <tr className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer">
                      <td className="pl-3 py-2.5 text-center">
                        <svg className="w-3.5 h-3.5 text-slate-400 inline" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
                      </td>
                      <td className="py-2.5 text-xs font-mono text-slate-400 px-2">2</td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs text-slate-900">10:32:14 AM</span>
                        <span className="block text-[10px] text-slate-400">6/10/2026</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700">SPE Received</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-700">sports-live-east</td>
                      <td className="px-3 py-2.5">
                        <span className="text-[10px] font-mono text-slate-400">a3f8c2d1</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs text-slate-400">Incoming ESAM request</span>
                      </td>
                    </tr>
                    {/* Row 3 - Signal processed (noop) */}
                    <tr className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer">
                      <td className="pl-3 py-2.5 text-center">
                        <svg className="w-3.5 h-3.5 text-slate-400 inline" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
                      </td>
                      <td className="py-2.5 text-xs font-mono text-slate-400 px-2">3</td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs text-slate-900">10:31:58 AM</span>
                        <span className="block text-[10px] text-slate-400">6/10/2026</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700">Processed</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-700">news-national</td>
                      <td className="px-3 py-2.5">
                        <span className="text-[10px] font-mono text-slate-400">7bc4e910</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-50 text-green-700 ring-1 ring-green-200">NOOP</span>
                          <span className="font-mono text-slate-500">8.7ms</span>
                        </div>
                      </td>
                    </tr>
                    {/* Row 4 - SPN Response (replace) */}
                    <tr className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer">
                      <td className="pl-3 py-2.5 text-center">
                        <svg className="w-3.5 h-3.5 text-slate-400 inline" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
                      </td>
                      <td className="py-2.5 text-xs font-mono text-slate-400 px-2">4</td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs text-slate-900">10:31:42 AM</span>
                        <span className="block text-[10px] text-slate-400">6/10/2026</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700">SPN Response</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-700">sports-live-east</td>
                      <td className="px-3 py-2.5">
                        <span className="text-[10px] font-mono text-slate-400">e5a21f88</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200">REPLACE</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <p className="text-center text-sm text-slate-500 mt-2 italic">Live SCTE-35 Feed with stats cards, filters, and event table</p>
        </section>

        {/* Features */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Features</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <Filter className="w-4 h-4 text-indigo-600" />
                Filtering
              </h4>
              <ul className="space-y-1 text-sm text-slate-700">
                <li>&#8226; Filter by channel name</li>
                <li>&#8226; Filter by action (delete, noop, replace)</li>
                <li>&#8226; Filter by time range</li>
                <li>&#8226; Filter by log source</li>
                <li>&#8226; Free-text search across all fields</li>
              </ul>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <Search className="w-4 h-4 text-indigo-600" />
                Log Detail View
              </h4>
              <ul className="space-y-1 text-sm text-slate-700">
                <li>&#8226; Original signal binary (Base64)</li>
                <li>&#8226; Parsed SCTE-35 fields</li>
                <li>&#8226; Rule that matched</li>
                <li>&#8226; Action taken and modifications applied</li>
                <li>&#8226; Response XML (SPN)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Correlation Tracking */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Correlation IDs</h2>
          <p className="text-slate-700 mb-4">
            Every signal processing request generates a unique <strong>correlation ID</strong> that links
            all log entries for that request. Click on any log entry to see the full processing chain.
            from signal receipt through rule evaluation, modifications, external actions, and response generation.
          </p>
          <Callout type="info" title="Correlation Header">
            The correlation ID is returned in the <code>X-Correlation-ID</code> response header on every API call.
            Use it to trace a specific signal through the system.
          </Callout>
        </section>

        {/* Log Entry Details */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Log Entry Contents</h2>
          <Table
            headers={['Section', 'Contents']}
            rows={[
              ['Signal Info', 'Base64 binary, command type, PTS adjustment, descriptor count'],
              ['Parsed Fields', 'Segmentation type ID, duration, event ID, UPID, out_of_network indicator'],
              ['Rule Evaluation', 'Matched rule ID, conditions evaluated, action determined'],
              ['Modifications', 'Fields modified, old values, new values'],
              ['External Actions', 'Actions triggered, execution status, response time'],
              ['Response', 'SPN XML, status code, status note, processing time'],
            ]}
          />
        </section>

        {/* Tips */}
        <section className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100">
          <h3 className="text-lg font-semibold text-slate-900 mb-3">Tips</h3>
          <ul className="space-y-2 text-sm text-slate-700">
            <li>&#8226; Use the <strong>source</strong> filter to focus on ESAM signals vs. external action results</li>
            <li>&#8226; Click the correlation ID to see all related log entries grouped together</li>
            <li>&#8226; The time range filter defaults to the last 24 hours. Expand it when investigating past issues</li>
            <li>&#8226; Logs appear within 1-5 seconds of signal processing due to CloudWatch ingestion latency</li>
            <li>&#8226; Use the search field to find signals by UPID value or specific error messages</li>
          </ul>
        </section>
      </div>
    </div>
  );
};
