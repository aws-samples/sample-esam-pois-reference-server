// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useState, useEffect } from 'react';
import { useGetChannelsQuery, useCreateChannelMutation, useUpdateChannelMutation } from '../../store/api/channelsApi';
import { useGetSystemDefaultsQuery, useUpdateSystemDefaultsMutation } from '../../store/api/preferencesApi';
import { useGetLogSourcesQuery } from '../../store/api/logsApi';
import { Download, Upload, Copy, Check, Save, AlertTriangle, Plus, X } from 'lucide-react';
import InfoTooltip from '../common/InfoTooltip';
import Button from '../common/Button';
import Input from '../common/Input';
import Select from '../common/Select';
import LoadingState from '../common/LoadingState';
import PageHeader from '../common/PageHeader';
import Tabs from '../common/Tabs';

export default function SystemSettings() {
  // Persist active tab in URL hash
  const getInitialTab = () => {
    const hash = window.location.hash.replace('#', '');
    return ['defaults', 'esam', 'logs', 'backup'].includes(hash) ? hash : 'defaults';
  };
  
  const [activeTab, setActiveTab] = useState(getInitialTab);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    window.location.hash = tabId;
  };

  // Listen for hash changes (back/forward)
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (['defaults', 'esam', 'logs', 'backup'].includes(hash)) {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const tabs = [
    { id: 'defaults', label: 'Defaults' },
    { id: 'esam', label: 'ESAM' },
    { id: 'logs', label: 'Logs' },
    { id: 'backup', label: 'Backup & Export' },
  ];

  return (
    <div>
      <PageHeader title="System Settings" />

      <div className="bg-white rounded-lg shadow">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />

        <div className="p-6">
          {activeTab === 'defaults' && <DefaultsTab />}
          {activeTab === 'esam' && <EsamTab />}
          {activeTab === 'logs' && <LogsTab />}
          {activeTab === 'backup' && <BackupTab />}
        </div>
      </div>
    </div>
  );
}

function DefaultsTab() {
  const { data: defaults, isLoading } = useGetSystemDefaultsQuery();
  const [updateDefaults, { isLoading: isSaving }] = useUpdateSystemDefaultsMutation();
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    defaultAction: 'noop',
    defaultMode: 'stateless',
    descriptorPriority: '',
    actionsEnabled: true,
    actionsDryRun: false,
    defaultActionTimeoutMs: 5000,
    defaultActionMaxRetries: 3,
  });

  useEffect(() => {
    if (defaults) {
      setForm({
        defaultAction: defaults.defaultAction || 'noop',
        defaultMode: defaults.defaultMode || 'stateless',
        descriptorPriority: defaults.descriptorPriority || '',
        actionsEnabled: defaults.actionsEnabled ?? true,
        actionsDryRun: defaults.actionsDryRun ?? false,
        defaultActionTimeoutMs: defaults.defaultActionTimeoutMs ?? 5000,
        defaultActionMaxRetries: defaults.defaultActionMaxRetries ?? 3,
      });
    }
  }, [defaults]);

  const handleSave = async () => {
    try {
      await updateDefaults(form).unwrap();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save defaults:', err);
    }
  };

  if (isLoading) {
    return <LoadingState size="md" message="Loading defaults..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header with Save */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Default Channel Configuration</h3>
          <p className="text-sm text-gray-500">These defaults are applied when creating new channels.</p>
        </div>
        <Button onClick={handleSave} isLoading={isSaving} variant="primary">
          {!isSaving && (saved ? <Check className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />)}
          {saved ? 'Saved' : 'Save Changes'}
        </Button>
      </div>

      {/* Section 1: Signal Processing */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b">Signal Processing</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Action <InfoTooltip text="Action applied when no processing rule matches an incoming SCTE-35 signal. NOOP passes through unchanged, DELETE removes from stream." /></label>
            <Select
              value={form.defaultAction}
              onChange={(e) => setForm({ ...form, defaultAction: e.target.value })}
              options={[
                { value: 'noop', label: 'NOOP (Pass Through)' },
                { value: 'delete', label: 'DELETE' },
              ]}
              helperText="Action when no rule matches a signal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Mode <InfoTooltip text="Stateless: each signal processed independently. Stateful: tracks CUE-OUT/CUE-IN state and suppresses duplicate signals during active ad breaks." /></label>
            <Select
              value={form.defaultMode}
              onChange={(e) => setForm({ ...form, defaultMode: e.target.value })}
              options={[
                { value: 'stateless', label: 'Stateless' },
                { value: 'stateful', label: 'Stateful' },
              ]}
              helperText="Stateful mode tracks ad break state"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Descriptor Priority <InfoTooltip text="When a signal has multiple segmentation descriptors, this defines which type ID takes priority for rule matching. First match wins. Example: 52,34,48" /></label>
            <Input
              type="text"
              value={form.descriptorPriority}
              onChange={(e) => setForm({ ...form, descriptorPriority: e.target.value })}
              placeholder="52,34,48"
              helperText="Comma-separated segmentation type IDs for rule matching priority"
            />
          </div>
        </div>
      </div>

      {/* Section 2: External Actions */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b">External Actions</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">External Actions <InfoTooltip text="When enabled, matched rules can trigger external API calls like MediaLive schedule actions or webhooks. When disabled, rules still match but no external calls are made." /></label>
            <Select
              value={form.actionsEnabled ? 'true' : 'false'}
              onChange={(e) => setForm({ ...form, actionsEnabled: e.target.value === 'true' })}
              options={[
                { value: 'true', label: 'Enabled' },
                { value: 'false', label: 'Disabled' },
              ]}
              helperText="Enable MediaLive actions and webhooks by default"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dry Run <InfoTooltip text="When enabled, external actions are simulated but NOT executed. Useful for testing rules without affecting live channels. Actions are logged as [DRY RUN]." /></label>
            <Select
              value={form.actionsDryRun ? 'true' : 'false'}
              onChange={(e) => setForm({ ...form, actionsDryRun: e.target.value === 'true' })}
              options={[
                { value: 'false', label: 'Disabled' },
                { value: 'true', label: 'Enabled' },
              ]}
              helperText="Simulate actions without executing them"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Action Timeout (ms) <InfoTooltip text="Maximum time to wait for an external action API response before timing out. Default 5000ms (5 seconds)." /></label>
            <Input
              type="number"
              min={1000}
              max={30000}
              value={form.defaultActionTimeoutMs}
              onChange={(e) => setForm({ ...form, defaultActionTimeoutMs: parseInt(e.target.value) })}
              helperText="Max wait time for API response"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Retries <InfoTooltip text="Number of retry attempts when an external action fails. Uses exponential backoff between retries. Default 3." /></label>
            <Input
              type="number"
              min={0}
              max={10}
              value={form.defaultActionMaxRetries}
              onChange={(e) => setForm({ ...form, defaultActionMaxRetries: parseInt(e.target.value) })}
              helperText="Retry attempts with exponential backoff"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function EsamTab() {
  const [copied, setCopied] = useState<string | null>(null);
  const { data: defaults, isLoading } = useGetSystemDefaultsQuery();
  const [updateDefaults] = useUpdateSystemDefaultsMutation();
  
  // Values come from the backend (which knows its own deployment)
  const apiUrl = defaults?.apiUrl || '';
  const esamEndpoint = defaults?.esamEndpoint || (apiUrl ? `${apiUrl}/esam` : '');
  const region = defaults?.awsRegion || '';

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({ esamEndpoint: '', apiUrl: '', awsRegion: '', logRetentionDays: 7, logPollingIntervalMs: 5000, esamLogGroup: '' });

  useEffect(() => {
    setForm({
      esamEndpoint, apiUrl, awsRegion: region,
      logRetentionDays: defaults?.logRetentionDays || 7,
      logPollingIntervalMs: defaults?.logPollingIntervalMs || 5000,
      esamLogGroup: defaults?.esamLogGroup || '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only resync the form when defaults change
  }, [defaults]);

  const handleSave = async () => {
    await updateDefaults(form).unwrap();
    setEditing(false);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  if (isLoading) {
    return <LoadingState size="md" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">ESAM Configuration</h3>
            <p className="text-sm text-gray-500">
              Endpoints for encoder integration. These values are saved in the system defaults.
            </p>
          </div>
          {!editing ? (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSave}>
                <Save className="h-3.5 w-3.5 mr-1" />
                Save
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">ESAM Endpoint (POST) <InfoTooltip text="The URL your encoder sends SCTE-35 signals to. Configure this in your encoder's ESAM/SCC settings as the POIS Server URL." /></label>
              {!editing && (
                <button
                  onClick={() => copyToClipboard(esamEndpoint, 'esam')}
                  className="text-gray-400 hover:text-primary-600 transition-colors"
                >
                  {copied === 'esam' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </button>
              )}
            </div>
            {editing ? (
              <Input
                type="text"
                value={form.esamEndpoint}
                onChange={(e) => setForm({ ...form, esamEndpoint: e.target.value })}
                className="font-mono"
              />
            ) : (
              <code className="text-sm text-primary-700 bg-primary-50 px-3 py-2 rounded block font-mono break-all">
                {esamEndpoint}
              </code>
            )}
            <p className="text-xs text-gray-500 mt-2">
              Configure this URL as the POIS endpoint in your encoder's ESAM settings.
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">API Base URL <InfoTooltip text="Base URL for all POIS API endpoints (channels, logs, preferences). Used by the frontend to communicate with the backend." /></label>
              {!editing && (
                <button
                  onClick={() => copyToClipboard(apiUrl, 'api')}
                  className="text-gray-400 hover:text-primary-600 transition-colors"
                >
                  {copied === 'api' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </button>
              )}
            </div>
            {editing ? (
              <Input
                type="text"
                value={form.apiUrl}
                onChange={(e) => setForm({ ...form, apiUrl: e.target.value })}
                className="font-mono"
              />
            ) : (
              <code className="text-sm text-gray-700 bg-gray-100 px-3 py-2 rounded block font-mono break-all">
                {apiUrl}
              </code>
            )}
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <label className="text-sm font-medium text-gray-700 block mb-1">AWS Region <InfoTooltip text="AWS region where the POIS infrastructure is deployed. All API calls and CloudWatch logs are in this region." /></label>
            {editing ? (
              <Select
                value={form.awsRegion}
                onChange={(e) => setForm({ ...form, awsRegion: e.target.value })}
                options={[
                  { value: 'us-east-1', label: 'US East (N. Virginia)' },
                  { value: 'us-west-2', label: 'US West (Oregon)' },
                  { value: 'eu-west-1', label: 'EU (Ireland)' },
                  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
                  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
                ]}
              />
            ) : (
              <code className="text-sm text-gray-700 bg-gray-100 px-3 py-2 rounded block font-mono">
                {region}
              </code>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

function LogsTab() {
  const { data: defaults, isLoading } = useGetSystemDefaultsQuery();
  const [updateDefaults, { isLoading: isSaving }] = useUpdateSystemDefaultsMutation();
  const [saved, setSaved] = useState(false);
  const { data: logSources = [] } = useGetLogSourcesQuery();

  // All available log event types grouped by category
  const logTypeGroups = [
    {
      label: 'Signal Flow',
      description: 'Core ESAM signal processing events',
      types: [
        { id: 'SignalProcessingEvent (SPE)', label: 'Signal Received (SPE)', description: 'Incoming ESAM request from encoder' },
        { id: 'Signal processed', label: 'Signal Processed', description: 'Processing summary with timing' },
        { id: 'SignalProcessingNotification (SPN)', label: 'Signal Response (SPN)', description: 'Outgoing ESAM response to encoder' },
      ],
    },
    {
      label: 'Signal Actions',
      description: 'What happened to each signal',
      types: [
        { id: 'Signal passed through', label: 'NOOP (Pass Through)', description: 'Signal forwarded unchanged to the encoder' },
        { id: 'Signal deleted', label: 'Deleted', description: 'Signal removed from stream' },
        { id: 'Signal modified', label: 'Modified', description: 'Signal binary data was altered (REPLACE)' },
      ],
    },
    {
      label: 'Rule Engine',
      description: 'Rule matching and evaluation',
      types: [
        { id: 'Rule evaluation complete', label: 'Rule Evaluation', description: 'Rule evaluation result with matched rule' },
        { id: 'Rule matched', label: 'Rule Matched', description: 'Specific rule that matched the signal' },
      ],
    },
    {
      label: 'External Actions',
      description: 'MediaLive, webhooks, and other integrations',
      types: [
        { id: 'External actions triggered', label: 'Actions Triggered', description: 'External actions started' },
        { id: 'External actions completed', label: 'Actions Completed', description: 'External actions finished with results' },
        { id: 'External actions failed', label: 'Actions Failed', description: 'External actions encountered errors' },
      ],
    },
    {
      label: 'System',
      description: 'Internal system events',
      types: [
        { id: 'Channel loaded', label: 'Channel Loaded', description: 'Channel config loaded from database' },
      ],
    },
  ];

  const defaultVisibleTypes = [
    'SignalProcessingEvent (SPE)', 'Signal processed', 'SignalProcessingNotification (SPN)',
    'External actions triggered', 'External actions completed', 'External actions failed',
  ];

  const [form, setForm] = useState({
    logRetentionDays: 7,
    logPollingIntervalMs: 5000,
    esamLogGroup: '',
    visibleLogTypes: defaultVisibleTypes as string[],
    visibleLogSources: [] as string[],
  });

  useEffect(() => {
    if (defaults) {
      setForm({
        logRetentionDays: defaults.logRetentionDays || 7,
        logPollingIntervalMs: defaults.logPollingIntervalMs || 5000,
        esamLogGroup: defaults.esamLogGroup || '',
        visibleLogTypes: defaults.visibleLogTypes || defaultVisibleTypes,
        visibleLogSources: defaults.visibleLogSources || logSources.map(s => s.sourceLabel),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only resync when defaults/logSources change
  }, [defaults, logSources]);

  const handleSave = async () => {
    try {
      await updateDefaults(form).unwrap();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save log settings:', err);
    }
  };

  if (isLoading) {
    return <LoadingState size="md" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Log Configuration</h3>
            <p className="text-sm text-gray-500">Configure how logs are stored, rotated, and displayed in the UI.</p>
          </div>
          <Button onClick={handleSave} isLoading={isSaving} variant="primary">
            {!isSaving && (saved ? <Check className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />)}
            {saved ? 'Saved' : 'Save Changes'}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Log Retention Period <InfoTooltip text="CloudWatch automatically deletes logs older than this period. The policy takes effect immediately, but physical deletion of expired logs may take up to 72 hours." /></label>
            <Select
              value={String(form.logRetentionDays)}
              onChange={(e) => setForm({ ...form, logRetentionDays: parseInt(e.target.value) })}
              options={[
                { value: '1', label: '1 day' },
                { value: '3', label: '3 days' },
                { value: '7', label: '7 days (default)' },
                { value: '14', label: '14 days' },
                { value: '30', label: '30 days' },
                { value: '60', label: '60 days' },
                { value: '90', label: '90 days' },
                { value: '180', label: '6 months' },
                { value: '365', label: '1 year' },
              ]}
              helperText="CloudWatch automatically deletes logs older than this period. Changes take effect immediately, but deletion of expired logs may take up to 72 hours."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Real-Time Polling Interval <InfoTooltip text="How often the UI fetches new log events from CloudWatch. Lower values = more real-time but more API calls. Default 5 seconds." /></label>
            <Select
              value={String(form.logPollingIntervalMs)}
              onChange={(e) => setForm({ ...form, logPollingIntervalMs: parseInt(e.target.value) })}
              options={[
                { value: '1000', label: '1 second (high load)' },
                { value: '2000', label: '2 seconds' },
                { value: '3000', label: '3 seconds' },
                { value: '5000', label: '5 seconds (default)' },
                { value: '10000', label: '10 seconds' },
                { value: '30000', label: '30 seconds' },
                { value: '60000', label: '1 minute' },
              ]}
              helperText="How often the UI fetches new logs from CloudWatch. Lower = more real-time but more API calls."
            />
          </div>

          {/* Log Group - Read Only */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">ESAM Signal Log Group <InfoTooltip text="CloudWatch Log Group where the ESAM signal processor Lambda writes logs. Set automatically by CDK deployment - cannot be changed via UI." /></label>
            <code className="block w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg font-mono text-sm text-gray-700">
              {form.esamLogGroup || '/aws/lambda/pois-reference-server-dev-api-signal-processor'}
            </code>
            <p className="text-xs text-gray-500 mt-1">
              Automatically set by CDK deployment. This is where the ESAM signal processor writes logs.
            </p>
          </div>
        </div>
      </div>

      {/* Visible Event Types */}
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3 pb-2 border-b">
          <div>
            <h4 className="text-sm font-semibold text-gray-800">Visible Event Types <InfoTooltip text="Choose which log event types appear in the Monitoring page. Unchecked types are still logged to CloudWatch but hidden from the UI." /></h4>
            <p className="text-xs text-gray-500 mt-0.5">Select which events to show in the Live Feed</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => {
                const allTypes = logTypeGroups.flatMap(g => g.types.map(t => t.id));
                setForm({ ...form, visibleLogTypes: allTypes });
              }}
              className="text-xs text-primary-600 hover:text-primary-700 px-1 py-0"
            >
              Select All
            </Button>
            <span className="text-gray-300">|</span>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setForm({ ...form, visibleLogTypes: [] })}
              className="text-xs text-gray-500 hover:text-gray-700 px-1 py-0"
            >
              Clear
            </Button>
          </div>
        </div>
        <div className="space-y-4">
          {logTypeGroups.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-medium text-gray-600 mb-2">{group.label} <span className="font-normal text-gray-400">— {group.description}</span></p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {group.types.map((type) => (
                  <label key={type.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.visibleLogTypes.includes(type.id)}
                      onChange={(e) => {
                        const types = e.target.checked
                          ? [...form.visibleLogTypes, type.id]
                          : form.visibleLogTypes.filter(t => t !== type.id);
                        setForm({ ...form, visibleLogTypes: types });
                      }}
                      className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div>
                      <span className="text-sm text-gray-800">{type.label}</span>
                      <p className="text-xs text-gray-400">{type.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Visible Log Sources */}
      {logSources.length > 0 && (
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3 pb-2 border-b">
            <div>
              <h4 className="text-sm font-semibold text-gray-800">Visible Log Sources <InfoTooltip text="Choose which log sources appear in the Monitoring page. Unchecked sources are still logged to CloudWatch but hidden from the UI." /></h4>
              <p className="text-xs text-gray-500 mt-0.5">Select which log sources to show in the Live Feed</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setForm({ ...form, visibleLogSources: logSources.map(s => s.sourceLabel) })}
                className="text-xs text-primary-600 hover:text-primary-700 px-1 py-0"
              >
                Select All
              </Button>
              <span className="text-gray-300">|</span>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setForm({ ...form, visibleLogSources: [] })}
                className="text-xs text-gray-500 hover:text-gray-700 px-1 py-0"
              >
                Clear
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            {logSources.map((source) => (
              <label key={source.sourceLabel} className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.visibleLogSources.includes(source.sourceLabel)}
                  onChange={(e) => {
                    const sources = e.target.checked
                      ? [...form.visibleLogSources, source.sourceLabel]
                      : form.visibleLogSources.filter(s => s !== source.sourceLabel);
                    setForm({ ...form, visibleLogSources: sources });
                  }}
                  className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <span className="text-sm text-gray-800">{source.displayName}</span>
                  <p className="text-xs text-gray-400">{source.logGroupName}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* How it works */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">How Logging Works</h3>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-200 text-blue-800 rounded-full flex items-center justify-center text-xs font-bold">1</span>
            <div>
              <p className="text-sm font-medium text-blue-900">Signal arrives</p>
              <p className="text-xs text-blue-700">Encoder sends SCTE-35 signal via ESAM to the Lambda function</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-200 text-blue-800 rounded-full flex items-center justify-center text-xs font-bold">2</span>
            <div>
              <p className="text-sm font-medium text-blue-900">Lambda processes & logs</p>
              <p className="text-xs text-blue-700">Signal is processed, rules evaluated, and structured logs written to CloudWatch</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-200 text-blue-800 rounded-full flex items-center justify-center text-xs font-bold">3</span>
            <div>
              <p className="text-sm font-medium text-blue-900">UI polls for updates</p>
              <p className="text-xs text-blue-700">The Real-Time Logs tab polls CloudWatch every {form.logPollingIntervalMs / 1000}s for new entries</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-200 text-blue-800 rounded-full flex items-center justify-center text-xs font-bold">4</span>
            <div>
              <p className="text-sm font-medium text-blue-900">Auto-cleanup</p>
              <p className="text-xs text-blue-700">CloudWatch automatically deletes logs older than {form.logRetentionDays} days</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BackupTab() {
  const { data: channels, isLoading, refetch } = useGetChannelsQuery();
  const [createChannel] = useCreateChannelMutation();
  const [updateChannel] = useUpdateChannelMutation();
  
  // Import state
  const [importData, setImportData] = useState<any>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importActions, setImportActions] = useState<Record<string, 'skip' | 'create' | 'overwrite'>>({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; skipped: number; errors: string[] } | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  if (isLoading) {
    return <LoadingState size="md" message="Loading system info..." />;
  }

  const exportChannels = () => {
    if (!channels || channels.length === 0) {
      setBackupError('No channels to export');
      return;
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '2.0.0',
      channelCount: channels.length,
      channels: channels,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pois-channels-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!data.channels || !Array.isArray(data.channels)) {
          setBackupError('Invalid backup file format');
          return;
        }
        setImportData(data);
        setImportResult(null);
        
        // Build preview: compare with existing channels
        const existingIds = new Set((channels || []).map((ch: any) => ch.channelId));
        const existingNames = new Map((channels || []).map((ch: any) => [ch.name, ch.channelId]));
        
        const preview = data.channels.map((ch: any) => {
          const existsById = existingIds.has(ch.channelId);
          const existsByName = existingNames.has(ch.name);
          const conflict = existsById || existsByName;
          const existingId = existsById ? ch.channelId : existingNames.get(ch.name);
          
          return {
            channelId: ch.channelId,
            name: ch.name,
            rulesCount: ch.rules?.length || 0,
            actionsCount: ch.rules?.reduce((s: number, r: any) => s + (r.externalActions?.length || 0), 0) || 0,
            conflict,
            existingId,
            channel: ch,
          };
        });
        
        setImportPreview(preview);
        
        // Default actions: skip conflicts, create new
        const actions: Record<string, 'skip' | 'create' | 'overwrite'> = {};
        preview.forEach((p: any) => {
          actions[p.channelId] = p.conflict ? 'skip' : 'create';
        });
        setImportActions(actions);
      } catch {
        setBackupError('Failed to parse backup file');
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleImport = async () => {
    setImporting(true);
    const result = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };
    
    for (const item of importPreview) {
      const action = importActions[item.channelId];
      
      if (action === 'skip') {
        result.skipped++;
        continue;
      }
      
      try {
        if (action === 'create') {
          // Generate new ID to avoid conflicts
          const newChannel = {
            ...item.channel,
            channelId: item.conflict ? String(Date.now()) + Math.random().toString(36).slice(2, 6) : item.channelId,
          };
          await createChannel(newChannel).unwrap();
          result.created++;
        } else if (action === 'overwrite') {
          const targetId = item.existingId || item.channelId;
          await updateChannel({ id: targetId, channel: item.channel }).unwrap();
          result.updated++;
        }
      } catch (err: any) {
        result.errors.push(`${item.name}: ${err?.data?.error || err?.message || 'Unknown error'}`);
      }
    }
    
    setImportResult(result);
    setImporting(false);
    refetch();
  };

  const cancelImport = () => {
    setImportData(null);
    setImportPreview([]);
    setImportActions({});
    setImportResult(null);
  };

  const setAllActions = (action: 'skip' | 'create' | 'overwrite') => {
    const newActions: Record<string, 'skip' | 'create' | 'overwrite'> = {};
    importPreview.forEach((p) => {
      newActions[p.channelId] = action;
    });
    setImportActions(newActions);
  };

  return (
    <div className="space-y-6">
      {backupError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
          <p className="text-sm text-red-700">{backupError}</p>
          <button onClick={() => setBackupError(null)} className="text-red-400 hover:text-red-600 text-xs">Dismiss</button>
        </div>
      )}
      {/* Export */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Export Channels</h3>
        <p className="text-sm text-gray-500 mb-4">
          Download all channel configurations as a JSON file for backup or migration.
        </p>
        <Button onClick={exportChannels} variant="primary">
          <Download className="h-4 w-4 mr-2" />
          Export All Channels ({channels?.length || 0})
        </Button>
      </div>

      <div className="border-t pt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Import Channels</h3>
        <p className="text-sm text-gray-500 mb-4">
          Restore channel configurations from a previously exported backup file.
        </p>

        {/* File selector (only show when no preview) */}
        {!importData && (
          <label className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-colors w-fit">
            <Upload className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-700">Choose backup file</span>
            <input type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
          </label>
        )}

        {/* Import Preview */}
        {importData && !importResult && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                Backup from <strong>{new Date(importData.exportedAt).toLocaleString()}</strong> — {importData.channels.length} channel(s)
              </p>
            </div>

            {/* Bulk actions */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Set all to:</span>
              <button onClick={() => setAllActions('create')} className="px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-xs font-medium">Create</button>
              <button onClick={() => setAllActions('overwrite')} className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 text-xs font-medium">Overwrite</button>
              <button onClick={() => setAllActions('skip')} className="px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-xs font-medium">Skip</button>
            </div>

            {/* Channel list */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Channel</th>
                    <th className="text-center px-4 py-2 font-medium text-gray-700">Rules</th>
                    <th className="text-center px-4 py-2 font-medium text-gray-700">Actions</th>
                    <th className="text-center px-4 py-2 font-medium text-gray-700">Status</th>
                    <th className="text-center px-4 py-2 font-medium text-gray-700">Import Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {importPreview.map((item) => (
                    <tr key={item.channelId} className={importActions[item.channelId] === 'skip' ? 'opacity-50' : ''}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{item.name}</div>
                        <div className="text-xs text-gray-500 font-mono">{item.channelId}</div>
                      </td>
                      <td className="text-center px-4 py-3">{item.rulesCount}</td>
                      <td className="text-center px-4 py-3">{item.actionsCount}</td>
                      <td className="text-center px-4 py-3">
                        {item.conflict ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                            <AlertTriangle className="h-3 w-3" />
                            Exists
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                            <Plus className="h-3 w-3" />
                            New
                          </span>
                        )}
                      </td>
                      <td className="text-center px-4 py-3">
                        <select
                          value={importActions[item.channelId]}
                          onChange={(e) => setImportActions({ ...importActions, [item.channelId]: e.target.value as any })}
                          className={`px-2 py-1 border rounded text-xs font-medium ${
                            importActions[item.channelId] === 'overwrite' ? 'border-yellow-300 bg-yellow-50 text-yellow-800' :
                            importActions[item.channelId] === 'create' ? 'border-green-300 bg-green-50 text-green-800' :
                            'border-gray-300 bg-gray-50 text-gray-600'
                          }`}
                        >
                          <option value="skip">⏭ Skip</option>
                          <option value="create">{item.conflict ? '➕ Create Copy' : '➕ Create'}</option>
                          {item.conflict && <option value="overwrite">⚠️ Overwrite</option>}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Warning for overwrites */}
            {Object.values(importActions).some(a => a === 'overwrite') && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">Warning: Overwrite will replace existing channels</p>
                  <p className="text-xs text-red-600 mt-1">
                    This will replace all rules, external actions, and settings of the existing channel(s). This cannot be undone.
                  </p>
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
              <div className="flex gap-4 text-sm">
                <span className="text-green-700">
                  {Object.values(importActions).filter(a => a === 'create').length} create
                </span>
                <span className="text-yellow-700">
                  {Object.values(importActions).filter(a => a === 'overwrite').length} overwrite
                </span>
                <span className="text-gray-500">
                  {Object.values(importActions).filter(a => a === 'skip').length} skip
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={cancelImport}>
                  <X className="h-3.5 w-3.5 mr-1" />
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleImport}
                  disabled={importing || Object.values(importActions).every(a => a === 'skip')}
                  isLoading={importing}
                >
                  {!importing && <Upload className="h-3.5 w-3.5 mr-1" />}
                  {importing ? 'Importing...' : 'Import'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Import Result */}
        {importResult && (
          <div className="space-y-3">
            <div className={`rounded-lg p-4 ${importResult.errors.length > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
              <p className={`text-sm font-medium ${importResult.errors.length > 0 ? 'text-yellow-800' : 'text-green-800'}`}>
                Import completed
              </p>
              <div className="flex gap-4 mt-2 text-sm">
                {importResult.created > 0 && <span className="text-green-700">✅ {importResult.created} created</span>}
                {importResult.updated > 0 && <span className="text-yellow-700">✏️ {importResult.updated} updated</span>}
                {importResult.skipped > 0 && <span className="text-gray-500">⏭ {importResult.skipped} skipped</span>}
              </div>
              {importResult.errors.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-red-700 mb-1">Errors:</p>
                  {importResult.errors.map((err, i) => (
                    <p key={i} className="text-xs text-red-600">{err}</p>
                  ))}
                </div>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={cancelImport}>
              Import another file
            </Button>
          </div>
        )}
      </div>

      {/* System Info */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">System Info</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Total Channels</p>
            <p className="text-2xl font-bold text-gray-900">{channels?.length || 0}</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Total Rules</p>
            <p className="text-2xl font-bold text-gray-900">
              {channels?.reduce((sum: number, ch: any) => sum + (ch.rules?.length || 0), 0) || 0}
            </p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">External Actions</p>
            <p className="text-2xl font-bold text-gray-900">
              {channels?.reduce((sum: number, ch: any) =>
                sum + (ch.rules?.reduce((rSum: number, r: any) => rSum + (r.externalActions?.length || 0), 0) || 0), 0) || 0}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
