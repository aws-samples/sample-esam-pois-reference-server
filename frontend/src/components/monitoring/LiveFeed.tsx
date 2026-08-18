// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useState } from 'react';
import { useGetLogsQuery, useGetLogSourcesQuery, LogEvent } from '../../store/api/logsApi';
import { useGetChannelsQuery } from '../../store/api/channelsApi';
import { useGetSystemDefaultsQuery } from '../../store/api/preferencesApi';
import { Activity, Filter, X, Settings, CheckCircle, ChevronRight, ChevronDown, Copy, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '../common/PageHeader';
import Button from '../common/Button';
import Badge from '../common/Badge';
import Select from '../common/Select';
import Card from '../common/Card';
import LoadingState from '../common/LoadingState';
import EmptyState from '../common/EmptyState';
import Pagination from '../common/Pagination';

const EVENT_META: Record<string, { label: string; variant: 'success'|'danger'|'warning'|'info'|'default' }> = {
  'SignalProcessingEvent (SPE)':       { label: 'SPE Received',      variant: 'info' },
  'Signal processed':                   { label: 'Processed',         variant: 'default' },
  'SignalProcessingNotification (SPN)': { label: 'SPN Response',      variant: 'info' },
  'Signal passed through':             { label: 'NOOP',              variant: 'success' },
  'Signal deleted':                     { label: 'Deleted',           variant: 'danger' },
  'Signal modified':                    { label: 'Modified',          variant: 'warning' },
  'Rule evaluation complete':           { label: 'Rule Evaluated',    variant: 'default' },
  'Rule matched':                       { label: 'Rule Matched',      variant: 'default' },
  'External actions triggered':         { label: 'Actions Triggered', variant: 'warning' },
  'External actions completed':         { label: 'Actions Completed', variant: 'success' },
  'External actions failed':            { label: 'Actions Failed',    variant: 'danger' },
  'Channel loaded':                     { label: 'Channel Loaded',    variant: 'default' },
  'Auth failed':                         { label: 'Auth Failed',       variant: 'danger' },
};

const AUDIT_EVENT_META: Record<string, { label: string; variant: 'success'|'danger'|'warning'|'info'|'default' }> = {
  'channel.create':       { label: 'Channel Created',  variant: 'info' },
  'channel.update':       { label: 'Channel Updated',  variant: 'info' },
  'channel.delete':       { label: 'Channel Deleted',  variant: 'info' },
  'user.create':          { label: 'User Created',     variant: 'warning' },
  'user.delete':          { label: 'User Deleted',     variant: 'warning' },
  'user.disable':         { label: 'User Disabled',    variant: 'warning' },
  'user.enable':          { label: 'User Enabled',     variant: 'warning' },
  'user.resetPassword':   { label: 'Password Reset',   variant: 'warning' },
  'user.changeGroup':     { label: 'Role Changed',     variant: 'warning' },
  'preferences.update':   { label: 'Settings Updated', variant: 'default' },
  'auth.credentials_generated':    { label: 'Credentials Generated',    variant: 'info' },
  'auth.credentials_regenerated':  { label: 'Credentials Regenerated',  variant: 'info' },
  'auth.disabled':                 { label: 'Auth Disabled',            variant: 'warning' },
};

const DEFAULT_VISIBLE = [
  'SignalProcessingEvent (SPE)', 'Signal processed', 'SignalProcessingNotification (SPN)',
  'External actions triggered', 'External actions completed', 'External actions failed',
];

function getMeta(msg: string) {
  if (msg.startsWith('Rule matched:')) return EVENT_META['Rule matched'];
  // Check audit events (dotted action pattern)
  if (msg.includes('.') && AUDIT_EVENT_META[msg]) return AUDIT_EVENT_META[msg];
  return EVENT_META[msg] || { label: msg, variant: 'default' as const };
}

export default function LiveFeed() {
  const [paused, setPaused] = useState(false);
  const [channelFilter, setChannelFilter] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [timeRange, setTimeRange] = useState('24h');
  const [searchText, setSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [groupByCorrelation, setGroupByCorrelation] = useState(false);
  const { data: channels = [] } = useGetChannelsQuery();
  const { data: systemDefaults } = useGetSystemDefaultsQuery();
  const { data: logSources = [] } = useGetLogSourcesQuery();

  const pollingInterval = systemDefaults?.logPollingIntervalMs ?? 5000;
  const retentionDays = systemDefaults?.logRetentionDays ?? 7;
  const visibleTypes = (systemDefaults?.visibleLogTypes?.length ? systemDefaults.visibleLogTypes : null) ?? DEFAULT_VISIBLE;
  const visibleSources = systemDefaults?.visibleLogSources?.length ? systemDefaults.visibleLogSources : undefined;

  const allRanges = [
    { value: '15m', label: 'Last 15 minutes', ms: 15*60*1000, maxDays: 1 },
    { value: '1h', label: 'Last 1 hour', ms: 3600000, maxDays: 1 },
    { value: '6h', label: 'Last 6 hours', ms: 6*3600000, maxDays: 1 },
    { value: '24h', label: 'Last 24 hours', ms: 86400000, maxDays: 1 },
    { value: '7d', label: 'Last 7 days', ms: 7*86400000, maxDays: 7 },
    { value: '30d', label: 'Last 30 days', ms: 30*86400000, maxDays: 30 },
  ];
  const timeRangeOptions = allRanges.filter(r => r.maxDays <= retentionDays);
  const getRangeMs = (r: string) => allRanges.find(x => x.value === r)?.ms || 86400000;
  const [queryStartTime, setQueryStartTime] = useState(() => String(Date.now() - getRangeMs('24h')));
  const handleTimeRangeChange = (r: string) => { setTimeRange(r); setCurrentPage(1); setQueryStartTime(String(Date.now() - getRangeMs(r))); };

  const { data: logsResponse, isLoading } = useGetLogsQuery(
    { limit: 3000, startTime: queryStartTime, search: searchText || undefined, source: sourceFilter || undefined },
    { skip: paused, pollingInterval }
  );
  const allEvents = logsResponse?.events || [];

  const isVisible = (msg: string) => {
    // Audit events are always visible
    if (msg.includes('.') && AUDIT_EVENT_META[msg]) return true;
    // If explicit config exists, use it
    if (systemDefaults?.visibleLogTypes?.length) {
      if (msg.startsWith('Rule matched:')) return visibleTypes.includes('Rule matched');
      return visibleTypes.includes(msg);
    }
    // Default: show only the most useful events (not intermediate noise)
    const defaultShow = [
      'SignalProcessingEvent (SPE)',
      'Signal processed',
      'SignalProcessingNotification (SPN)',
      'External actions triggered',
      'External actions completed',
      'External actions failed',
      'Auth failed',
    ];
    return defaultShow.includes(msg);
  };

  let filtered = allEvents.filter(e => isVisible(e.message));
  // Apply source visibility preference
  if (visibleSources) {
    filtered = filtered.filter(e => !e.source || visibleSources.includes(e.source));
  }
  if (channelFilter) filtered = filtered.filter(e => e.channelId === channelFilter || e.channelName === channelFilter);
  if (eventTypeFilter) filtered = filtered.filter(e => eventTypeFilter === 'Rule matched' ? e.message.startsWith('Rule matched:') : e.message === eventTypeFilter);
  if (levelFilter) filtered = filtered.filter(e => e.level === levelFilter);

  const events = filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const totalPages = Math.ceil(events.length / itemsPerPage);
  const paginated = events.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getChannelName = (ev: LogEvent): string => {
    if (ev.channelName) return ev.channelName;
    if (!ev.channelId) return '';
    return channels.find(c => c.channelId === ev.channelId || c.name === ev.channelId)?.name || ev.channelId;
  };

  // Stats cards: ESAM events only
  const esamEvents = events.filter(e => e.source === 'esam' || e.source === undefined || e.source === null);
  const processed = esamEvents.filter(e => e.message === 'Signal processed');
  const hasFilters = channelFilter || eventTypeFilter || levelFilter || sourceFilter || timeRange !== '24h' || searchText;
  const eventTypeOptions = visibleTypes.map(t => ({ value: t, label: getMeta(t).label }));

  return (
    <div>
      <PageHeader title="Live SCTE-35 Feed" subtitle="Real-time signal processing monitor"
        action={
          <div className="flex items-center gap-3">
            {!paused ? (
              <span className="flex items-center gap-2 text-sm text-green-600">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Live ({pollingInterval / 1000}s)
              </span>
            ) : <span className="text-sm text-gray-500">Paused</span>}
            <Button variant={paused ? 'accent' : 'ghost'} size="md" onClick={() => setPaused(!paused)}>
              {paused ? '▶ Resume' : '⏸ Pause'}
            </Button>
            <Link to="/profile#logs"><Button variant="ghost" size="md"><Settings className="h-4 w-4" /></Button></Link>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card padding="md"><p className="text-xs text-gray-500 mb-1">Total Events</p><p className="text-2xl font-bold text-gray-900">{esamEvents.length}</p></Card>
        <Card padding="md"><p className="text-xs text-gray-500 mb-1">Deleted</p><p className="text-2xl font-bold text-red-600">{processed.filter(e => e.action === 'delete').length}</p></Card>
        <Card padding="md"><p className="text-xs text-gray-500 mb-1">Pass-Through</p><p className="text-2xl font-bold text-green-600">{processed.filter(e => e.action === 'noop').length}</p></Card>
        <Card padding="md"><p className="text-xs text-gray-500 mb-1">Modified</p><p className="text-2xl font-bold text-yellow-600">{processed.filter(e => e.action === 'replace').length}</p></Card>
        <Card padding="md"><p className="text-xs text-gray-500 mb-1">Errors</p><p className="text-2xl font-bold text-orange-600">{esamEvents.filter(e => e.level === 'ERROR').length}</p></Card>
      </div>

      {/* Filters */}
      <Card padding="md" className="mb-6">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Filter className="h-5 w-5 text-gray-400" />
            <input type="text" value={searchText} onChange={e => { setSearchText(e.target.value); setCurrentPage(1); }}
              placeholder="Search by correlation ID, channel, rule, error..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" />
            {hasFilters && <Button variant="ghost" size="md" onClick={() => { setChannelFilter(''); setEventTypeFilter(''); setLevelFilter(''); setSourceFilter(''); setSearchText(''); setCurrentPage(1); handleTimeRangeChange('24h'); }}><X className="h-4 w-4 mr-1" /> Clear</Button>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Select label="Time Range" value={timeRange} onChange={e => handleTimeRangeChange(e.target.value)} options={timeRangeOptions.map(r => ({ value: r.value, label: r.label }))} />
            <Select label="Source" value={sourceFilter} onChange={e => { setSourceFilter(e.target.value); setCurrentPage(1); }} options={[{ value: '', label: 'All Sources' }, ...logSources.map(s => ({ value: s.sourceLabel, label: s.displayName }))]} />
            <Select label="Channel" value={channelFilter} onChange={e => { setChannelFilter(e.target.value); setCurrentPage(1); }} options={[{ value: '', label: 'All Channels' }, ...channels.map(ch => ({ value: ch.channelId, label: ch.name }))]} />
            <Select label="Event Type" value={eventTypeFilter} onChange={e => { setEventTypeFilter(e.target.value); setCurrentPage(1); }} options={[{ value: '', label: 'All Events' }, ...eventTypeOptions]} />
            <Select label="Level" value={levelFilter} onChange={e => { setLevelFilter(e.target.value); setCurrentPage(1); }} options={[{ value: '', label: 'All Levels' }, { value: 'ERROR', label: 'ERROR' }, { value: 'WARNING', label: 'WARNING' }, { value: 'INFO', label: 'INFO' }]} />
          </div>
        </div>
      </Card>

      {/* Events */}
      {/* View toggle */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{events.length} events</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setGroupByCorrelation(false); setCurrentPage(1); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${!groupByCorrelation ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            Flat View
          </button>
          <button
            onClick={() => { setGroupByCorrelation(true); setCurrentPage(1); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${groupByCorrelation ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            Group by Request
          </button>
        </div>
      </div>

      {isLoading && !allEvents.length ? (
        <LoadingState message="Loading events..." size="md" />
      ) : events.length === 0 ? (
        <EmptyState icon={<Activity className="h-12 w-12 text-gray-400" />} title="No events found"
          description={hasFilters ? 'Try adjusting your filters or time range' : 'Events will appear here when ESAM requests are processed'} />
      ) : (
        <>
          {!groupByCorrelation ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
            <table className="w-full" style={{tableLayout:'fixed', minWidth:'900px'}}>
              <colgroup>
                <col style={{width:'2%'}} />
                <col style={{width:'3%'}} />
                <col style={{width:'10%'}} />
                <col style={{width:'11%'}} />
                <col style={{width:'10%'}} />
                <col style={{width:'12%'}} />
                <col style={{width:'52%'}} />
              </colgroup>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="py-3" />
                  <th className="py-3 text-left uppercase text-xs font-semibold text-gray-500">#</th>
                  <th className="px-3 py-3 text-left uppercase text-xs font-semibold text-gray-500">Time</th>
                  <th className="px-3 py-3 text-left uppercase text-xs font-semibold text-gray-500">Event</th>
                  <th className="px-3 py-3 text-left uppercase text-xs font-semibold text-gray-500">Channel</th>
                  <th className="px-3 py-3 text-left uppercase text-xs font-semibold text-gray-500">Correlation</th>
                  <th className="px-3 py-3 text-left uppercase text-xs font-semibold text-gray-500">Details</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((ev, idx) => (
                  <EventRow key={`${ev.timestamp}-${idx}`} event={ev} index={(currentPage - 1) * itemsPerPage + idx + 1} getChannelName={getChannelName} />
                ))}
              </tbody>
            </table>
          </div>
          ) : (
          <GroupedView events={events} getChannelName={getChannelName} currentPage={currentPage} itemsPerPage={itemsPerPage} />
          )}
          {totalPages > 1 && (
            <div className="mt-6">
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage}
                itemsPerPage={itemsPerPage} totalItems={events.length}
                onItemsPerPageChange={s => { setItemsPerPage(s); setCurrentPage(1); }} itemsPerPageOptions={[10, 20, 50, 100]} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EventRow({ event, index, getChannelName }: { event: LogEvent; index: number; getChannelName: (e: LogEvent) => string }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const meta = getMeta(event.message);
  const channel = getChannelName(event);
  const isError = event.level === 'ERROR';
  const isWarning = event.level === 'WARNING';

  const handleCopy = () => {
    const clean = Object.fromEntries(Object.entries(event).filter(([, v]) => v != null));
    navigator.clipboard.writeText(JSON.stringify(clean, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <tr
        onClick={() => setExpanded(!expanded)}
        className={`border-b border-gray-100 last:border-0 text-sm cursor-pointer transition-colors ${isError ? 'bg-red-50/40' : isWarning ? 'bg-yellow-50/40' : 'hover:bg-gray-50'}`}
      >
        <td className="pl-3 py-2.5 text-center">
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5 text-gray-400 inline" />
            : <ChevronRight className="h-3.5 w-3.5 text-gray-400 inline" />}
        </td>
        <td className="py-2.5 text-xs font-mono text-gray-400">{index}</td>
        <td className="px-3 py-2.5 whitespace-nowrap overflow-hidden">
          <span className="text-xs text-gray-900">{new Date(event.timestamp).toLocaleTimeString()}</span>
          <span className="block text-[10px] text-gray-400">{new Date(event.timestamp).toLocaleDateString()}</span>
        </td>
        <td className="px-3 py-2.5 overflow-hidden">
          <div className="flex items-center gap-1.5">
            <Badge variant={meta.variant}>{meta.label}</Badge>
            {isError && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />}
            {isWarning && <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 flex-shrink-0" />}
          </div>
        </td>
        <td className="px-3 py-2.5 overflow-hidden truncate">
          {channel || <span className="text-gray-300">—</span>}
        </td>
        <td className="px-3 py-2.5">
          {event.correlationId ? (
            <span className="text-[10px] font-mono text-gray-400 whitespace-nowrap" title={event.correlationId}>{event.correlationId.split('-')[0]}</span>
          ) : <span className="text-gray-200">—</span>}
        </td>
        <td className="px-3 py-2.5 overflow-hidden">
          <EventDetails event={event} />
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50/70">
          <td colSpan={7} className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Event Detail</span>
              <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary-600 transition-colors">
                {copied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy JSON</>}
              </button>
            </div>
            <pre className="text-xs font-mono text-gray-700 bg-gray-900/5 rounded-lg p-3 overflow-x-auto max-h-80 whitespace-pre-wrap break-all">
              {JSON.stringify(Object.fromEntries(Object.entries(event).filter(([, v]) => v != null)), null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

function EventDetails({ event }: { event: LogEvent }) {
  const msg = event.message;

  // Audit events: show performedBy
  if (msg.includes('.') && AUDIT_EVENT_META[msg]) {
    return (
      <div className="flex items-center gap-2 text-xs">
        {event.performedBy && <span className="text-gray-600">by <span className="font-medium text-gray-800">{event.performedBy}</span></span>}
        {event.targetId && <span className="text-gray-400 truncate">{event.targetType}: {event.targetId}</span>}
      </div>
    );
  }

  // Auth failure events
  if (msg === 'Auth failed') {
    return (
      <div className="flex items-center gap-2 text-xs flex-wrap">
        {event.channelName && <span className="text-gray-600">Channel: <span className="font-medium text-gray-800">{event.channelName}</span></span>}
        {(event as any).sourceIp && <span className="text-gray-500">IP: <span className="font-mono">{(event as any).sourceIp}</span></span>}
        {(event as any).reason && <span className="text-red-600">{(event as any).reason}</span>}
        {(event as any).username && <span className="text-gray-500">user: <span className="font-mono">{(event as any).username}</span></span>}
      </div>
    );
  }

  // Signal processed: action badge + timing + details
  if (msg === 'Signal processed') {
    return (
      <div className="flex items-center gap-2 text-xs flex-wrap">
        {event.action && <Badge variant={event.action === 'delete' ? 'danger' : event.action === 'replace' ? 'warning' : 'success'}>{event.action.toUpperCase()}</Badge>}
        {event.processingTimeMs != null && <span className="font-mono text-gray-500">{Math.round(event.processingTimeMs * 100) / 100}ms</span>}
        {event.details && <span className="text-gray-400 truncate">{event.details}</span>}
      </div>
    );
  }

  // Rule evaluation
  if (msg === 'Rule evaluation complete') {
    return (
      <div className="flex items-center gap-2 text-xs">
        {event.matched
          ? <span className="flex items-center gap-1 text-green-600"><CheckCircle className="h-3 w-3" /> Matched</span>
          : <span className="text-gray-500">No match</span>}
        {event.action && <Badge variant={event.action === 'delete' ? 'danger' : event.action === 'replace' ? 'warning' : 'success'}>{event.action.toUpperCase()}</Badge>}
      </div>
    );
  }

  // Rule matched
  if (msg.startsWith('Rule matched:')) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-700">{msg.replace('Rule matched: ', '')}</span>
        {event.action && <Badge variant={event.action === 'delete' ? 'danger' : 'warning'}>{event.action.toUpperCase()}</Badge>}
      </div>
    );
  }

  // External actions triggered
  if (msg === 'External actions triggered') {
    return <div className="flex items-center gap-2 text-xs"><span className="text-gray-700">{event.actionsCount} action(s)</span>{event.dryRun && <Badge variant="warning">DRY RUN</Badge>}</div>;
  }

  // External actions completed
  if (msg === 'External actions completed') {
    return (
      <div className="flex items-center gap-2 text-xs">
        {event.actionsSucceeded != null && <span className="text-green-600">{event.actionsSucceeded} succeeded</span>}
        {(event.actionsFailed ?? 0) > 0 && <span className="text-red-600">{event.actionsFailed} failed</span>}
      </div>
    );
  }

  // External actions failed
  if (msg === 'External actions failed') return <span className="text-xs text-red-600 truncate block">{event.error || 'Error'}</span>;

  // SPN - show action from XML
  if (msg === 'SignalProcessingNotification (SPN)' && event.xml) {
    const m = event.xml.match(/action="([^"]+)"/);
    return m ? <Badge variant={m[1] === 'delete' ? 'danger' : m[1] === 'replace' ? 'warning' : 'success'}>{m[1].toUpperCase()}</Badge> : null;
  }

  // SPE
  if (msg === 'SignalProcessingEvent (SPE)') return <span className="text-xs text-gray-400">Incoming ESAM request</span>;

  // Channel loaded
  if (msg === 'Channel loaded') return <span className="text-xs text-gray-400">{event.channelName || ''}</span>;

  // Signal deleted / passed / modified
  if (msg === 'Signal deleted' || msg === 'Signal passed through' || msg === 'Signal modified') return null;

  // Error
  if (event.error) return <span className="text-xs text-red-600 truncate block">{event.error}</span>;

  return event.details ? <span className="text-xs text-gray-400 truncate block">{event.details}</span> : null;
}

function GroupedView({ events, getChannelName, currentPage, itemsPerPage }: {
  events: LogEvent[];
  getChannelName: (e: LogEvent) => string;
  currentPage: number;
  itemsPerPage: number;
}) {
  // Group events by correlationId
  const groups: Record<string, { events: LogEvent[]; timestamp: string; channel: string; action: string; hasExternalActions: boolean; processingTimeMs: number }> = {};

  for (const ev of events) {
    const cid = ev.correlationId;
    if (!cid) continue;
    // Skip audit events — they're not ESAM requests
    if (ev.message.includes('.') && AUDIT_EVENT_META[ev.message]) continue;
    if (!groups[cid]) {
      groups[cid] = { events: [], timestamp: ev.timestamp, channel: '', action: '', hasExternalActions: false, processingTimeMs: 0 };
    }
    groups[cid].events.push(ev);
    if (ev.message === 'Signal processed') {
      groups[cid].action = ev.action || 'noop';
      groups[cid].processingTimeMs = ev.processingTimeMs || 0;
    }
    if (ev.message === 'External actions triggered') {
      groups[cid].hasExternalActions = true;
    }
    if (!groups[cid].channel && ev.channelId) {
      groups[cid].channel = getChannelName(ev);
    }
    // Use earliest timestamp
    if (ev.timestamp < groups[cid].timestamp) {
      groups[cid].timestamp = ev.timestamp;
    }
  }

  const sorted = Object.entries(groups).sort(([, a], [, b]) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const paginated = sorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-3">
      {paginated.map(([cid, group]) => (
        <GroupedRow key={cid} correlationId={cid} group={group} />
      ))}
    </div>
  );
}

function GroupedRow({ correlationId, group }: {
  correlationId: string;
  group: { events: LogEvent[]; timestamp: string; channel: string; action: string; hasExternalActions: boolean; processingTimeMs: number };
}) {
  const [expanded, setExpanded] = useState(false);
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const dotColor = group.action === 'delete' ? 'bg-red-500' : group.action === 'replace' ? 'bg-yellow-500' : 'bg-green-500';
  const actionBg = group.action === 'delete' ? 'bg-red-50 text-red-700 ring-1 ring-red-200' : group.action === 'replace' ? 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200' : 'bg-green-50 text-green-700 ring-1 ring-green-200';

  const copyEvent = (ev: LogEvent, idx: number) => {
    const clean = Object.fromEntries(Object.entries(ev).filter(([, v]) => v != null));
    navigator.clipboard.writeText(JSON.stringify(clean, null, 2));
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const sortedEvents = group.events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all ring-1 ring-gray-200/60">
      <div className="flex items-center justify-between px-4 py-3.5 cursor-pointer select-none" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {expanded ? <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />}
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
          <span className="text-sm text-gray-700">{new Date(group.timestamp).toLocaleTimeString()}</span>
          <span className="text-xs text-gray-400">{new Date(group.timestamp).toLocaleDateString()}</span>
          <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${actionBg}`}>{(group.action || 'noop').toUpperCase()}</span>
          <span className="text-xs text-gray-500 truncate">{group.channel}</span>
          {group.hasExternalActions && <span className="px-2 py-0.5 text-xs bg-purple-50 text-purple-700 rounded-full ring-1 ring-purple-200 font-medium">Action</span>}
          {group.processingTimeMs > 0 && <span className="text-xs text-gray-400 font-mono">{Math.round(group.processingTimeMs * 10) / 10}ms</span>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          <span className="text-[10px] font-mono text-gray-400">{correlationId.split('-')[0]}</span>
          <span className="text-xs text-gray-400">{group.events.length} events</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100">
          {sortedEvents.map((ev, idx) => {
            const meta = getMeta(ev.message);
            const isEventExpanded = expandedEvent === idx;
            const summary = ev.message === 'Signal processed' && ev.details ? ev.details :
              ev.message === 'External actions completed' ? `${ev.actionsSucceeded} succeeded, ${ev.actionsFailed || 0} failed` :
              ev.message === 'External actions triggered' ? `${ev.actionsCount} action(s)${ev.dryRun ? ' [DRY RUN]' : ''}` :
              ev.message.startsWith('Rule matched:') ? ev.message.replace('Rule matched: ', '') :
              ev.message === 'Auth failed' ? `${(ev as any).reason || 'unauthorized'}` :
              '';

            return (
              <div key={idx} className={`border-b border-gray-50 last:border-0 ${isEventExpanded ? 'bg-gray-50/50' : ''}`}>
                <div
                  className="flex items-center gap-3 px-4 py-2 text-xs cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedEvent(isEventExpanded ? null : idx)}
                >
                  {isEventExpanded ? <ChevronDown className="h-3 w-3 text-gray-400 flex-shrink-0" /> : <ChevronRight className="h-3 w-3 text-gray-400 flex-shrink-0" />}
                  <span className="text-gray-400 font-mono w-20 flex-shrink-0">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                  <span className="text-gray-600 truncate flex-1">{summary}</span>
                  <button
                    className="text-gray-400 hover:text-primary-600 flex-shrink-0 p-1"
                    onClick={(e) => { e.stopPropagation(); copyEvent(ev, idx); }}
                    title="Copy JSON"
                  >
                    {copiedIdx === idx ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                {isEventExpanded && (
                  <div className="px-4 pb-3 pl-12">
                    <pre className="text-[11px] font-mono text-gray-700 bg-gray-900/5 rounded-lg p-3 overflow-x-auto max-h-60 whitespace-pre-wrap break-all">
                      {JSON.stringify(Object.fromEntries(Object.entries(ev).filter(([, v]) => v != null)), null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
