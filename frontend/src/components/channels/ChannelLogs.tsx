// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useState } from 'react';
import { useGetChannelLogsQuery } from '../../store/api/logsApi';
import { useGetSystemDefaultsQuery } from '../../store/api/preferencesApi';
import ActionLogsViewer from './ActionLogsViewer';
import Scte35DecoderModal from './Scte35DecoderModal';
import { Eye, Activity, ChevronDown, ChevronRight } from 'lucide-react';
import Button from '../common/Button';
import Badge from '../common/Badge';
import LoadingState from '../common/LoadingState';

interface ChannelLogsProps {
  channelId: string;
}

export default function ChannelLogs({ channelId }: ChannelLogsProps) {
  const [activeTab, setActiveTab] = useState<'esam' | 'actions'>(() => {
    return (localStorage.getItem(`channel-${channelId}-logtab`) as 'esam' | 'actions') || 'esam';
  });
  const [paused, setPaused] = useState(false);
  const [decoderModal, setDecoderModal] = useState<{ isOpen: boolean; xml: string; type: 'SPE' | 'SPN' }>({
    isOpen: false, xml: '', type: 'SPE',
  });

  const { data: systemDefaults } = useGetSystemDefaultsQuery();
  const pollingInterval = systemDefaults?.logPollingIntervalMs ?? 5000;

  const { data: logsResponse, isLoading } = useGetChannelLogsQuery(
    { channelId, limit: 500 },
    { skip: paused || activeTab !== 'esam', pollingInterval }
  );
  const logs = logsResponse?.events || [];

  const speSpnLogs = logs.filter(log =>
    log.message === 'SignalProcessingEvent (SPE)' ||
    log.message === 'SignalProcessingNotification (SPN)'
  );

  const psnLogs = logs.filter(log =>
    log.message === 'ProcessStatusNotification (PSN)'
  );

  const groupedLogs = speSpnLogs.reduce((acc, log) => {
    const key = log.correlationId;
    if (!acc[key]) acc[key] = { spe: null, spn: null, timestamp: log.timestamp };
    if (log.message.includes('SPE')) {
      acc[key].spe = log;
    } else {
      let action = log.action;
      if (log.xml) {
        const m = log.xml.match(/action="([^"]+)"/);
        if (m) action = m[1];
      }
      acc[key].spn = { ...log, action };
    }
    return acc;
  }, {} as Record<string, any>);

  const pairs = Object.values(groupedLogs).sort((a: any, b: any) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Build unified timeline: SPE/SPN pairs + PSN entries
  const timelineEntries: any[] = [
    ...pairs.map((p: any) => ({ type: 'pair', data: p, timestamp: p.timestamp })),
    ...psnLogs.map((log) => ({ type: 'psn', data: log, timestamp: log.timestamp })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Stats
  const totalPairs = pairs.length;
  const deleted = pairs.filter((p: any) => p.spn?.action === 'delete').length;
  const noop = pairs.filter((p: any) => p.spn?.action === 'noop').length;
  const replaced = pairs.filter((p: any) => p.spn?.action === 'replace').length;

  return (
    <div>
      {/* Sub-tab Navigation */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          {(['esam', 'actions'] as const).map(tab => (
            <button
              key={tab}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
              onClick={() => { setActiveTab(tab); localStorage.setItem(`channel-${channelId}-logtab`, tab); }}
            >
              {tab === 'esam' ? 'ESAM Logs' : 'Action Logs'}
            </button>
          ))}
        </div>
        {activeTab === 'esam' && (
          <div className="flex items-center gap-3">
            {!paused && (
              <span className="flex items-center gap-2 text-xs text-green-600">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live
              </span>
            )}
            <Button variant={paused ? 'accent' : 'ghost'} size="sm" onClick={() => setPaused(!paused)}>
              {paused ? 'Resume' : 'Pause'}
            </Button>
          </div>
        )}
      </div>

      {activeTab === 'esam' ? (
        <div>
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Total</p>
              <p className="text-xl font-bold text-gray-900">{totalPairs}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Noop</p>
              <p className="text-xl font-bold text-green-600">{noop}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Deleted</p>
              <p className="text-xl font-bold text-red-600">{deleted}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Modified</p>
              <p className="text-xl font-bold text-yellow-600">{replaced}</p>
            </div>
          </div>

          {/* Log entries */}
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="text-center py-12">
                <LoadingState size="md" message="Loading logs..." />
              </div>
            ) : timelineEntries.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <Activity className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium text-sm">No ESAM events yet</p>
                <p className="text-xs text-gray-400 mt-1">Logs will appear when encoder sends SCTE-35 signals</p>
              </div>
            ) : (
              timelineEntries.map((entry: any, idx) =>
                entry.type === 'psn' ? (
                  <PsnLogCard key={`psn-${idx}`} log={entry.data} />
                ) : (
                  <EsamLogCard key={`pair-${idx}`} pair={entry.data} onDecode={(xml, type) => setDecoderModal({ isOpen: true, xml, type })} />
                )
              )
            )}
          </div>

          <Scte35DecoderModal isOpen={decoderModal.isOpen} onClose={() => setDecoderModal({ isOpen: false, xml: '', type: 'SPE' })} xml={decoderModal.xml} type={decoderModal.type} />
        </div>
      ) : (
        <ActionLogsViewer channelId={channelId} />
      )}
    </div>
  );
}

function EsamLogCard({ pair, onDecode }: { pair: any; onDecode: (xml: string, type: 'SPE' | 'SPN') => void }) {
  const [expanded, setExpanded] = useState(false);
  const action = pair.spn?.action || 'noop';
  const borderColor = action === 'delete' ? 'border-red-400' : action === 'replace' ? 'border-yellow-400' : 'border-green-400';

  return (
    <div className={`bg-white border border-gray-200 border-l-4 ${borderColor} rounded-xl overflow-hidden`}>
      {/* Collapsed header */}
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer select-none" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {expanded ? <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />}
          <span className="text-sm text-gray-700">{new Date(pair.timestamp).toLocaleTimeString()}</span>
          <span className="text-xs text-gray-400">{new Date(pair.timestamp).toLocaleDateString()}</span>
          <Badge variant={action === 'delete' ? 'danger' : action === 'replace' ? 'warning' : 'success'}>
            {action.toUpperCase()}
          </Badge>
          {pair.spn?.processingTimeMs > 0 && (
            <span className="text-xs text-gray-400 font-mono">{Math.round(pair.spn.processingTimeMs * 10) / 10}ms</span>
          )}
        </div>
        <span className="text-[10px] font-mono text-gray-400 flex-shrink-0 ml-3">
          {pair.spe?.correlationId?.split('-')[0] || ''}
        </span>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          {/* SPE */}
          {pair.spe && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Request (SPE)</span>
                <Button variant="secondary" size="sm" onClick={(e: React.MouseEvent) => { e.stopPropagation(); onDecode(pair.spe.xml, 'SPE'); }}>
                  <Eye className="h-3 w-3 mr-1" /> Decode
                </Button>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 border-l-4 border-blue-400">
                <pre className="text-xs font-mono whitespace-pre-wrap break-all leading-relaxed text-gray-700 max-h-48 overflow-y-auto">
                  {pair.spe.xml}
                </pre>
              </div>
            </div>
          )}

          {/* SPN */}
          {pair.spn && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: action === 'delete' ? '#991b1b' : action === 'replace' ? '#854d0e' : '#166534' }}>
                    Response (SPN)
                  </span>
                  <Badge variant={action === 'delete' ? 'danger' : action === 'replace' ? 'warning' : 'success'}>
                    {action.toUpperCase()}
                  </Badge>
                </div>
                <Button variant="secondary" size="sm" onClick={(e: React.MouseEvent) => { e.stopPropagation(); onDecode(pair.spn.xml, 'SPN'); }}>
                  <Eye className="h-3 w-3 mr-1" /> Decode
                </Button>
              </div>
              <div className={`bg-gray-50 border border-gray-200 rounded-lg p-3 border-l-4 ${
                action === 'delete' ? 'border-red-400' : action === 'replace' ? 'border-yellow-400' : 'border-green-400'
              }`}>
                <pre className="text-xs font-mono whitespace-pre-wrap break-all leading-relaxed text-gray-700 max-h-48 overflow-y-auto">
                  {pair.spn.xml}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PsnLogCard({ log }: { log: any }) {
  const [expanded, setExpanded] = useState(false);
  const isError = (log.classCode ?? 0) !== 0;
  const borderColor = isError ? 'border-red-400' : 'border-cyan-400';
  const ringColor = isError ? 'ring-red-200' : 'ring-cyan-200';

  return (
    <div className={`bg-white border border-gray-200 border-l-4 ${borderColor} rounded-xl overflow-hidden ring-1 ${ringColor}`}>
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer select-none" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {expanded ? <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />}
          <span className="text-sm text-gray-700">{new Date(log.timestamp).toLocaleTimeString()}</span>
          <span className="text-xs text-gray-400">{new Date(log.timestamp).toLocaleDateString()}</span>
          <Badge variant={isError ? 'danger' : 'default'}>PSN</Badge>
          {isError && (
            <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded">classCode: {log.classCode}</span>
          )}
        </div>
        <span className="text-[10px] font-mono text-gray-400 flex-shrink-0 ml-3">
          {log.acquisitionSignalID || ''}
        </span>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">Class Code</p>
              <p className={`text-sm font-mono font-semibold ${isError ? 'text-red-700' : 'text-gray-900'}`}>{log.classCode ?? 0}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">Detail Code</p>
              <p className="text-sm font-mono font-semibold text-gray-900">{log.detailCode ?? 0}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">Signal ID</p>
              <p className="text-sm font-mono text-gray-900 truncate">{log.acquisitionSignalID || '-'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">Timestamp</p>
              <p className="text-sm font-mono text-gray-900">{new Date(log.timestamp).toLocaleString()}</p>
            </div>
          </div>
          {log.note && (
            <div className="mt-3 bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">Note</p>
              <p className="text-sm text-gray-700">{log.note}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
