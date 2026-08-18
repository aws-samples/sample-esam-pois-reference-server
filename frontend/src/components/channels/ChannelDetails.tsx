// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { useGetChannelQuery, useRegenerateAuthMutation, useLazyGetAuthPasswordQuery } from '../../store/api/channelsApi';
import { useAppSelector } from '../../store';
import { Info, List, Activity, Edit, ArrowLeft, Copy, Check, Lock, Eye, EyeOff, RefreshCw, X, ChevronDown, ChevronRight } from 'lucide-react';
import PageHeader from '../common/PageHeader';
import Button from '../common/Button';
import Card from '../common/Card';
import Badge from '../common/Badge';
import IconButton from '../common/IconButton';
import LoadingState from '../common/LoadingState';
import Tabs from '../common/Tabs';
import EmptyState from '../common/EmptyState';
import ChannelLogs from './ChannelLogs';

export default function ChannelDetails() {
  const { channelId } = useParams();
  const navigate = useNavigate();
  const { data: channel, isLoading } = useGetChannelQuery(channelId || '', { skip: !channelId });
  const { user } = useAppSelector((state) => state.auth);
  const isAdmin = user?.groups?.includes('admin');
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem(`channel-${channelId}-tab`) || 'overview';
  });
  const [copied, setCopied] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordValue, setPasswordValue] = useState<string | null>(null);
  const [regeneratedPassword, setRegeneratedPassword] = useState<string | null>(null);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [regenerateAuth, { isLoading: isRegenerating }] = useRegenerateAuthMutation();
  const [triggerGetPassword, { isFetching: isFetchingPassword }] = useLazyGetAuthPasswordQuery();

  // Debug log
  console.log('=== CHANNEL DETAILS ===');
  console.log('Channel ID:', channelId);
  console.log('Channel data:', channel);
  console.log('External Actions:', channel?.rules?.map(r => ({
    ruleId: r.ruleId,
    externalActions: r.externalActions
  })));

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    localStorage.setItem(`channel-${channelId}-tab`, tabId);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  if (isLoading) {
    return <LoadingState message="Loading channel..." />;
  }

  if (!channel) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">Channel not found</p>
        <Button variant="primary" onClick={() => navigate('/channels')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Channels
        </Button>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <Info className="h-4 w-4" /> },
    { id: 'rules', label: 'Rules', icon: <List className="h-4 w-4" />, badge: channel.rules.length },
    { id: 'logs', label: 'Real-Time Logs', icon: <Activity className="h-4 w-4" /> },
  ];

  return (
    <div>
      <PageHeader
        title={channel.name}
        subtitle={`Channel ID: ${channel.channelId}`}
        action={
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => navigate('/channels')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            {isAdmin && (
              <Link to={`/channels/${channel.channelId}/edit`}>
                <Button variant="primary">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Channel
                </Button>
              </Link>
            )}
          </div>
        }
      />

      <Card padding="none">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Status Cards Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Status</p>
                  <Badge variant={channel.enabled ? 'success' : 'default'}>
                    {channel.enabled ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Default Action</p>
                  <Badge variant={channel.defaultAction === 'delete' ? 'danger' : 'success'}>
                    {channel.defaultAction.toUpperCase()}
                  </Badge>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Mode</p>
                  <span className="text-sm font-semibold text-gray-900">{channel.statefulMode ? 'Stateful' : 'Stateless'}</span>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Rules</p>
                  <span className="text-sm font-semibold text-gray-900">{channel.rules.length}</span>
                </div>
              </div>

              {/* Feature Toggles Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`border rounded-xl p-4 flex items-center gap-3 ${channel.actionsEnabled ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${channel.actionsEnabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">External Actions</p>
                    <p className="text-xs text-gray-500">{channel.actionsEnabled ? 'Enabled' : 'Disabled'}{channel.actionsDryRun ? ' (Dry Run)' : ''}</p>
                  </div>
                </div>
                <div className={`border rounded-xl p-4 flex items-center gap-3 ${channel.authConfig?.authEnabled ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                  <Lock className={`h-4 w-4 flex-shrink-0 ${channel.authConfig?.authEnabled ? 'text-blue-600' : 'text-gray-400'}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Encoder Auth</p>
                    <p className="text-xs text-gray-500">{channel.authConfig?.authEnabled ? 'Basic Auth' : 'Disabled'}</p>
                  </div>
                </div>
                <div className="border border-gray-200 rounded-xl p-4 flex items-center gap-3 bg-gray-50">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-gray-300" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Descriptor Priority</p>
                    <p className="text-xs text-gray-500 font-mono">{channel.descriptorPriority || 'Default'}</p>
                  </div>
                </div>
              </div>

              {/* Encoder Configuration */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span>Encoder Configuration</span>
                  </h3>
                </div>
                <div className="p-6 space-y-4 bg-white">
                  {/* Acquisition Point */}
                  <div className="grid grid-cols-[140px_1fr_auto] items-center gap-3">
                    <span className="text-xs font-medium text-gray-500">Acquisition Point</span>
                    <input type="text" value={channel.name} readOnly className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm text-gray-800" />
                    <IconButton variant="secondary" size="sm" onClick={() => copyToClipboard(channel.name, 'name')} title="Copy">
                      {copied === 'name' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </IconButton>
                  </div>

                  {/* ESAM URL */}
                  {channel.esamEndpoint && (
                    <div className="grid grid-cols-[140px_1fr_auto] items-center gap-3">
                      <span className="text-xs font-medium text-gray-500">ESAM URL</span>
                      <input type="text" value={channel.esamEndpoint} readOnly className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm text-gray-800" />
                      <IconButton variant="secondary" size="sm" onClick={() => copyToClipboard(channel.esamEndpoint!, 'endpoint')} title="Copy">
                        {copied === 'endpoint' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </IconButton>
                    </div>
                  )}

                  {/* Auth Credentials */}
                  {channel.authConfig?.authEnabled && (
                    <>
                      <div className="border-t border-gray-100 pt-4">
                        <div className="grid grid-cols-[140px_1fr_auto] items-center gap-3">
                          <span className="text-xs font-medium text-gray-500">Username</span>
                          <input type="text" value={channel.authConfig.username || ''} readOnly className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm text-gray-800" />
                          <IconButton variant="secondary" size="sm" onClick={() => copyToClipboard(channel.authConfig!.username || '', 'username')} title="Copy">
                            {copied === 'username' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          </IconButton>
                        </div>
                      </div>
                      <div className="grid grid-cols-[140px_1fr_auto] items-center gap-3">
                        <span className="text-xs font-medium text-gray-500">Password</span>
                        <input type="text" value={showPassword && passwordValue ? passwordValue : '••••••••••••••••'} readOnly className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm text-gray-800 tracking-widest" />
                        <div className="flex gap-1">
                          <IconButton variant="secondary" size="sm" disabled={isFetchingPassword} onClick={async () => {
                            if (showPassword) { setShowPassword(false); setPasswordValue(null); }
                            else { try { const r = await triggerGetPassword(channel.channelId).unwrap(); setPasswordValue(r.password); setShowPassword(true); } catch { /* surfaced via RTK Query error state */ } }
                          }} title={showPassword ? 'Hide' : 'Show'}>
                            {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </IconButton>
                          <IconButton variant="secondary" size="sm" onClick={async () => {
                            if (passwordValue) { copyToClipboard(passwordValue, 'password'); }
                            else { try { const r = await triggerGetPassword(channel.channelId).unwrap(); copyToClipboard(r.password, 'password'); } catch { /* surfaced via RTK Query error state */ } }
                          }} title="Copy">
                            {copied === 'password' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          </IconButton>
                          <IconButton variant="secondary" size="sm" onClick={() => setShowRegenConfirm(true)} title="Regenerate">
                            <RefreshCw className="h-3.5 w-3.5" />
                          </IconButton>
                        </div>
                      </div>

                      {showRegenConfirm && (
                        <div className="ml-[140px] bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                          <p className="text-sm text-yellow-800 mb-2">Regenerating will invalidate the current password.</p>
                          <div className="flex gap-2">
                            <Button variant="danger" size="sm" isLoading={isRegenerating} onClick={async () => {
                              try { const r = await regenerateAuth(channel.channelId).unwrap(); setRegeneratedPassword(r.password); setShowRegenConfirm(false); setShowPassword(false); setPasswordValue(null); } catch { /* surfaced via RTK Query error state */ }
                            }}>Confirm</Button>
                            <Button variant="ghost" size="sm" onClick={() => setShowRegenConfirm(false)}>Cancel</Button>
                          </div>
                        </div>
                      )}

                      {regeneratedPassword && (
                        <div className="ml-[140px] bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-green-800">New password generated</p>
                            <button onClick={() => setRegeneratedPassword(null)} className="text-green-400 hover:text-green-600"><X className="h-4 w-4" /></button>
                          </div>
                          <div className="flex items-center gap-2">
                            <input type="text" value={regeneratedPassword} readOnly className="flex-1 px-3 py-1.5 bg-white border border-green-300 rounded-lg font-mono text-sm" />
                            <IconButton variant="secondary" size="sm" onClick={() => copyToClipboard(regeneratedPassword, 'regen-password')} title="Copy">
                              {copied === 'regen-password' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            </IconButton>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Description */}
              {channel.description && (
                <div className="border border-gray-200 rounded-xl p-5 bg-white">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Description</p>
                  <p className="text-sm text-gray-700">{channel.description}</p>
                </div>
              )}
            </div>
          )}

          {/* Rules Tab */}
          {activeTab === 'rules' && (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Total Rules</p>
                  <p className="text-2xl font-bold text-gray-900">{channel.rules.length}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Active</p>
                  <p className="text-2xl font-bold text-green-600">{channel.rules.filter(r => r.enabled).length}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">With Actions</p>
                  <p className="text-2xl font-bold text-purple-600">{channel.rules.filter(r => r.externalActions && r.externalActions.length > 0).length}</p>
                </div>
              </div>

              {channel.rules.length === 0 ? (
                <EmptyState
                  variant="inline"
                  icon={<List className="h-12 w-12 text-gray-400" />}
                  title="No rules configured"
                  description="Add rules to define how signals are processed on this channel"
                />
              ) : (
                channel.rules.map((rule, idx) => (
                  <RuleCard key={rule.ruleId} rule={rule} index={idx} />
                ))
              )}
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <div>
              <ChannelLogs channelId={channel.channelId} />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function RuleCard({ rule, index }: { rule: any; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const actionColor = rule.action === 'delete' ? 'red' : rule.action === 'replace' ? 'yellow' : 'green';
  const colors: Record<string, { gradient: string; border: string; numBg: string; numText: string }> = {
    red: { gradient: 'bg-gradient-to-r from-red-50 to-white', border: 'border-red-100', numBg: 'bg-red-100', numText: 'text-red-700' },
    yellow: { gradient: 'bg-gradient-to-r from-yellow-50 to-white', border: 'border-yellow-100', numBg: 'bg-yellow-100', numText: 'text-yellow-700' },
    green: { gradient: 'bg-gradient-to-r from-green-50 to-white', border: 'border-green-100', numBg: 'bg-green-100', numText: 'text-green-700' },
  };
  const c = colors[actionColor];

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden hover:border-primary-300 transition-colors">
      <div
        className={`px-5 py-3 flex items-center justify-between cursor-pointer select-none ${c.gradient} border-b ${c.border}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
          <span className={`flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold ${c.numBg} ${c.numText}`}>
            {index + 1}
          </span>
          <div>
            <h4 className="text-sm font-semibold text-gray-900">{rule.name}</h4>
            <p className="text-xs text-gray-500">Priority {rule.priority}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {rule.externalActions?.length > 0 && (
            <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded">{rule.externalActions.length} action(s)</span>
          )}
          <Badge variant={rule.action === 'delete' ? 'danger' : rule.action === 'replace' ? 'warning' : 'success'}>
            {rule.action?.toUpperCase() || 'NOOP'}
          </Badge>
          <Badge variant={rule.enabled ? 'success' : 'default'}>
            {rule.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
      </div>

      {expanded && (
        <div className="p-5">
          <div className={`grid gap-4 ${rule.modifications?.length > 0 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-3">Conditions</p>
              <div className="space-y-2">
                {rule.conditions.map((cond: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm bg-white px-3 py-2 rounded-lg border border-blue-100">
                    <span className="font-medium text-blue-900">{cond.field}</span>
                    <span className="text-blue-500">{cond.operator}</span>
                    <span className="font-mono text-blue-700">"{cond.value}"</span>
                  </div>
                ))}
              </div>
            </div>

            {rule.modifications?.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-xs font-semibold text-yellow-800 uppercase tracking-wider mb-3">Modifications</p>
                <div className="space-y-2">
                  {rule.modifications.map((mod: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm bg-white px-3 py-2 rounded-lg border border-yellow-100">
                      <span className="font-medium text-yellow-900">{mod.operation}</span>
                      <span className="text-yellow-600">{mod.target}</span>
                      <span className="font-mono text-yellow-700">= "{mod.value}"</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {rule.externalActions?.length > 0 && (
            <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-purple-800 uppercase tracking-wider mb-3">External Actions ({rule.externalActions.length})</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {rule.externalActions.map((action: any, i: number) => (
                  <div key={i} className="bg-white px-4 py-3 rounded-lg border border-purple-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-purple-900">
                        {action.actionType === 'medialive_schedule_action' ? 'MediaLive' : action.actionType === 'webhook' ? 'Webhook' : action.actionType}
                      </span>
                      <Badge variant={action.enabled ? 'success' : 'default'}>{action.enabled ? 'On' : 'Off'}</Badge>
                    </div>
                    <p className="text-xs text-purple-600">{action.actionConfig?.schedule_action_type?.replace(/_/g, ' ') || action.actionConfig?.method || ''}</p>
                    {action.actionConfig?.channel_id && <p className="text-xs text-gray-500 mt-1 font-mono">Channel: {action.actionConfig.channel_id}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {rule.altContentIdentity && (
            <div className="mt-4 bg-teal-50 border border-teal-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-teal-800 uppercase tracking-wider mb-3">Alternate Content</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-white px-4 py-3 rounded-lg border border-teal-100">
                  <p className="text-xs font-medium text-teal-600 mb-1">Input Identity</p>
                  <p className="text-sm font-mono text-teal-900">{rule.altContentIdentity}</p>
                </div>
                {rule.altContentZoneIdentity && (
                  <div className="bg-white px-4 py-3 rounded-lg border border-teal-100">
                    <p className="text-xs font-medium text-teal-600 mb-1">Zone Identity</p>
                    <p className="text-sm font-mono text-teal-900">{rule.altContentZoneIdentity}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
