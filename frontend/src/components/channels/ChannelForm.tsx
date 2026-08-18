// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGetChannelQuery, useCreateChannelMutation, useUpdateChannelMutation } from '../../store/api/channelsApi';
import { useGetSystemDefaultsQuery } from '../../store/api/preferencesApi';
import { Channel, Rule } from '../../types/channel';
import { Plus, Save, X, Trash2, AlertTriangle, Lock, Copy, Check } from 'lucide-react';
import PageHeader from '../common/PageHeader';
import Button from '../common/Button';
import Input from '../common/Input';
import Textarea from '../common/Textarea';
import Select from '../common/Select';
import FormSection from '../common/FormSection';
import Card from '../common/Card';
import LoadingState from '../common/LoadingState';
import InfoTooltip from '../common/InfoTooltip';
import ErrorAlert from '../common/ErrorAlert';
import EmptyState from '../common/EmptyState';
import IconButton from '../common/IconButton';
import Toggle from '../common/Toggle';
import ExternalActionsPanel from './ExternalActionsPanel';

export default function ChannelForm() {
  const { channelId } = useParams();
  const navigate = useNavigate();
  const isEdit = !!channelId;

  const { data: existingChannel, isLoading } = useGetChannelQuery(channelId || '', { skip: !channelId });
  const { data: systemDefaults } = useGetSystemDefaultsQuery(undefined, { skip: isEdit });
  const [createChannel, { isLoading: isCreating }] = useCreateChannelMutation();
  const [updateChannel, { isLoading: isUpdating }] = useUpdateChannelMutation();
  const [error, setError] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState<Partial<Channel>>({
    channelId: String(Date.now()),
    name: '',
    description: '',
    enabled: true,
    defaultAction: 'noop',
    statefulMode: false,
    descriptorPriority: '',
    actionsEnabled: true,
    actionsDryRun: false,
    rules: [],
  });

  // Apply system defaults for new channels
  useEffect(() => {
    if (!isEdit && systemDefaults) {
      setFormData(prev => ({
        ...prev,
        defaultAction: (systemDefaults.defaultAction || prev.defaultAction) as 'noop' | 'delete',
        statefulMode: systemDefaults.defaultMode === 'stateful',
        descriptorPriority: systemDefaults.descriptorPriority || prev.descriptorPriority,
        actionsEnabled: systemDefaults.actionsEnabled ?? prev.actionsEnabled,
        actionsDryRun: systemDefaults.actionsDryRun ?? prev.actionsDryRun,
      }));
    }
  }, [isEdit, systemDefaults]);

  useEffect(() => {
    if (existingChannel) {
      const normalizedChannel = {
        ...existingChannel,
        rules: existingChannel.rules?.map(rule => ({
          ...rule,
          modifications: rule.modifications || [],
          externalActions: rule.externalActions || [],
        })) || [],
      };
      
      setFormData(normalizedChannel);
    }
  }, [existingChannel]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    try {
      // Update rule names based on current position before saving
      // Also filter out conditions with empty values to prevent phantom conditions
      const updatedFormData = {
        ...formData,
        rules: formData.rules?.map((rule, index) => ({
          ...rule,
          name: `Rule ${index + 1}`,
          priority: index + 1,
          conditions: rule.conditions.filter(
            (c) => c.value !== '' && c.value !== null && c.value !== undefined
          ),
        })),
      };


      if (isEdit && channelId) {
        const result = await updateChannel({ id: channelId, channel: updatedFormData as Channel }).unwrap();
        if (result?.generatedPassword) {
          setGeneratedPassword(result.generatedPassword);
          return; // Stay on page to show password
        }
        navigate('/channels');
      } else {
        const result = await createChannel(updatedFormData as Channel).unwrap();
        if (result?.generatedPassword) {
          setGeneratedPassword(result.generatedPassword);
          return; // Stay on page to show password
        }
        navigate(`/channels/${updatedFormData.channelId}`);
      }
    } catch (err) {
      setError((err as Error).message || 'An error occurred');
    }
  };

  const addRule = () => {
    const ruleIndex = (formData.rules?.length || 0) + 1;
    const newRule: Rule = {
      ruleId: `rule-${Date.now()}`,
      name: `Rule ${ruleIndex}`,
      priority: ruleIndex,
      enabled: true,
      conditions: [{
        field: 'segmentationTypeId',
        operator: 'eq',
        value: '',
      }],
      action: 'noop',
      modifications: [],
      externalActions: [],
    };
    setFormData({ ...formData, rules: [...(formData.rules || []), newRule] });
  };

  const updateRule = (index: number, updatedRule: Rule) => {
    const newRules = [...(formData.rules || [])];
    newRules[index] = updatedRule;
    setFormData({ ...formData, rules: newRules });
  };

  const removeRule = (index: number) => {
    const newRules = formData.rules?.filter((_, i) => i !== index) || [];
    setFormData({ ...formData, rules: newRules });
  };

  const addModification = (ruleIndex: number) => {
    const rule = formData.rules![ruleIndex];
    const newModification = {
      target: 'segmentation_type_id',
      operation: 'set',
      value: '',
    };
    updateRule(ruleIndex, {
      ...rule,
      modifications: [...rule.modifications, newModification],
    });
  };

  const updateModification = (ruleIndex: number, modIndex: number, field: string, value: any) => {
    const rule = formData.rules![ruleIndex];
    const newModifications = [...rule.modifications];
    newModifications[modIndex] = { ...newModifications[modIndex], [field]: value };
    updateRule(ruleIndex, { ...rule, modifications: newModifications });
  };

  const removeModification = (ruleIndex: number, modIndex: number) => {
    const rule = formData.rules![ruleIndex];
    const newModifications = rule.modifications.filter((_, i) => i !== modIndex);
    updateRule(ruleIndex, { ...rule, modifications: newModifications });
  };

  if (isLoading) {
    return <LoadingState message="Loading channel..." />;
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit Channel' : 'Create Channel'}
        subtitle="Configure SCTE-35 signal processing rules"
        action={
          <div className="flex gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/channels')}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isCreating || isUpdating}
              onClick={(e: any) => {
                e.preventDefault();
                const form = document.querySelector('form');
                if (form) {
                  form.requestSubmit();
                }
              }}
            >
              <Save className="h-4 w-4 mr-2" />
              {isEdit ? 'Update Channel' : 'Create Channel'}
            </Button>
          </div>
        }
      />

      {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

      {/* Generated password alert after save */}
      {generatedPassword && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-green-800">Encoder credentials generated</p>
              <p className="text-xs text-green-700 mt-1">You can also view the password later in the channel details page.</p>
            </div>
            <button
              onClick={() => {
                setGeneratedPassword(null);
                if (isEdit) {
                  navigate('/channels');
                } else {
                  navigate(`/channels/${formData.channelId}`);
                }
              }}
              className="text-green-400 hover:text-green-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="text"
              value={generatedPassword}
              readOnly
              className="flex-1 px-3 py-1.5 bg-white border border-green-300 rounded-lg font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(generatedPassword);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-green-700 bg-white border border-green-300 rounded-lg hover:bg-green-50"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Settings */}
        <Card className="ring-1 ring-gray-200/60">
          <FormSection
            title="Basic Information"
            description="Configure the channel identification and basic settings"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Channel ID"
                value={formData.channelId}
                disabled
                helperText="Auto-generated internal identifier"
              />

              <Input
                label="Channel Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="my-channel"
                helperText="Use this in your encoder's Acquisition Point Identifier"
              />

              <div className="md:col-span-2">
                <Textarea
                  label="Description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  rows={2}
                />
              </div>
            </div>
          </FormSection>
        </Card>

        {/* Processing Settings */}
        <Card className="ring-1 ring-gray-200/60">
          <FormSection
            title="Processing Settings"
            description="Configure how signals are processed"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">Default Action</label>
                  <InfoTooltip text="Action applied when no rule matches a signal. NOOP passes the signal through unchanged. DELETE removes the signal from the stream." />
                </div>
                <Select
                  value={formData.defaultAction}
                  onChange={(e) => setFormData({ ...formData, defaultAction: e.target.value as any })}
                  options={[
                    { value: 'noop', label: 'NOOP (Pass Through)' },
                    { value: 'delete', label: 'DELETE' },
                  ]}
                  required
                />
              </div>

              <div>
                <div className="flex items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">Mode</label>
                  <InfoTooltip text="Stateless processes each signal independently. Stateful tracks ad break state (CUE-OUT/CUE-IN) and suppresses duplicate signals during an active break." />
                </div>
                <Select
                  value={formData.statefulMode ? 'stateful' : 'stateless'}
                  onChange={(e) => setFormData({ ...formData, statefulMode: e.target.value === 'stateful' })}
                  options={[
                    { value: 'stateless', label: 'Stateless' },
                    { value: 'stateful', label: 'Stateful' },
                  ]}
                />
              </div>

              <div className="md:col-span-2">
                <div className="flex items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">Descriptor Priority</label>
                  <InfoTooltip text="When a signal has multiple segmentation descriptors, this defines which type ID takes priority for rule matching. First match wins." />
                </div>
                <Input
                  value={formData.descriptorPriority}
                  onChange={(e) => setFormData({ ...formData, descriptorPriority: e.target.value })}
                  placeholder="52,34,48"
                  helperText="Comma-separated segmentation type IDs"
                />
              </div>
            </div>
          </FormSection>
        </Card>

        {/* Channel Controls */}
        <Card className="ring-1 ring-gray-200/60">
          <FormSection
            title="Channel Controls"
            description="Enable or disable channel features"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3 p-4 bg-white rounded-xl ring-1 ring-gray-200/60 shadow-sm hover:shadow-md transition-all">
                <Toggle
                  label=""
                  checked={formData.enabled ?? true}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                />
                <div className="flex-1">
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-900">Channel Enabled</span>
                    <InfoTooltip text="When disabled, the ESAM handler returns NOOP for all signals on this channel without processing any rules." />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Enable this channel for signal processing</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-white rounded-xl ring-1 ring-gray-200/60 shadow-sm hover:shadow-md transition-all">
                <Toggle
                  label=""
                  checked={formData.actionsEnabled ?? true}
                  onChange={(e) => setFormData({ ...formData, actionsEnabled: e.target.checked })}
                />
                <div className="flex-1">
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-900">External Actions</span>
                    <InfoTooltip text="When enabled, matched rules can trigger external API calls (MediaLive schedule actions, webhooks). When disabled, rules still match but no external calls are made." />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Execute MediaLive actions and webhooks</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-white rounded-xl ring-1 ring-gray-200/60 shadow-sm hover:shadow-md transition-all">
                <Toggle
                  label=""
                  checked={formData.authConfig?.authEnabled ?? false}
                  onChange={(e) => setFormData({
                    ...formData,
                    authConfig: { ...formData.authConfig, authEnabled: e.target.checked },
                  })}
                />
                <div className="flex-1">
                  <div className="flex items-center">
                    <Lock className="h-4 w-4 text-gray-500 mr-1.5" />
                    <span className="text-sm font-medium text-gray-900">Encoder Authentication</span>
                    <InfoTooltip text="When enabled, encoders must send Basic Auth credentials (username:password) with ESAM requests. Credentials are generated automatically." />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Require Basic Auth for ESAM requests</p>
                </div>
              </div>
            </div>

            {/* Dry Run - same card style, conditional */}
            {formData.actionsEnabled && (
              <div className="mt-4 flex items-start gap-3 p-4 bg-yellow-50 rounded-xl ring-1 ring-yellow-200 shadow-sm hover:shadow-md transition-all">
                <Toggle
                  label=""
                  checked={formData.actionsDryRun ?? false}
                  onChange={(e) => setFormData({ ...formData, actionsDryRun: e.target.checked })}
                />
                <div className="flex-1">
                  <div className="flex items-center">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mr-1.5" />
                    <span className="text-sm font-medium text-yellow-900">Dry Run Mode</span>
                    <InfoTooltip text="When enabled, external actions are simulated but NOT actually executed. Useful for testing rules and configurations without affecting live channels. Actions are logged as [DRY RUN]." />
                  </div>
                  <p className="text-xs text-yellow-700 mt-0.5">Simulate actions without executing them (for testing)</p>
                </div>
              </div>
            )}

            {/* Auth enabling notice */}
            {formData.authConfig?.authEnabled && !existingChannel?.authConfig?.authEnabled && (
              <div className="mt-4 p-3 bg-blue-50 rounded-xl ring-1 ring-blue-200">
                <p className="text-sm text-blue-800">
                  <Lock className="h-4 w-4 inline mr-1.5 -mt-0.5" />
                  Credentials will be generated when you save
                </p>
              </div>
            )}

            {/* Auth disabling warning */}
            {!formData.authConfig?.authEnabled && existingChannel?.authConfig?.authEnabled && (
              <div className="mt-4 p-3 bg-yellow-50 rounded-xl ring-1 ring-yellow-200">
                <p className="text-sm text-yellow-800">
                  <AlertTriangle className="h-4 w-4 inline mr-1.5 -mt-0.5" />
                  Disabling authentication will delete stored credentials and allow unauthenticated encoder access
                </p>
              </div>
            )}
          </FormSection>
        </Card>

        {/* Rules - Inline Dynamic Form */}
        <Card className="ring-1 ring-gray-200/60">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Processing Rules</h3>
              <p className="mt-1 text-sm text-gray-500">Define conditions and actions for signal processing</p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={addRule}>
              <Plus className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          </div>

          <div className="space-y-4">
            {formData.rules?.map((rule, ruleIndex) => {
              const actionColor = rule.action === 'delete' ? 'red' : rule.action === 'replace' ? 'yellow' : 'green';
              const gradientColors: Record<string, { gradient: string; numBg: string; numText: string }> = {
                red: { gradient: 'bg-gradient-to-r from-red-50 to-white', numBg: 'bg-red-100', numText: 'text-red-700' },
                yellow: { gradient: 'bg-gradient-to-r from-yellow-50 to-white', numBg: 'bg-yellow-100', numText: 'text-yellow-700' },
                green: { gradient: 'bg-gradient-to-r from-green-50 to-white', numBg: 'bg-green-100', numText: 'text-green-700' },
              };
              const rc = gradientColors[actionColor];

              return (
              <div key={rule.ruleId} className="rounded-xl ring-1 ring-gray-200/60 overflow-hidden shadow-sm hover:shadow-md transition-all">
                {/* Rule Header with gradient */}
                <div className={`px-5 py-3 flex items-center justify-between ${rc.gradient} border-b border-gray-100`}>
                  <div className="flex items-center gap-3">
                    <span className={`flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold ${rc.numBg} ${rc.numText}`}>
                      {ruleIndex + 1}
                    </span>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">{`Rule ${ruleIndex + 1}`}</h4>
                      <p className="text-xs text-gray-500">Priority {rule.priority}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      rule.action === 'delete' ? 'bg-red-50 text-red-700' :
                      rule.action === 'replace' ? 'bg-yellow-50 text-yellow-700' :
                      'bg-green-50 text-green-700'
                    }`}>
                      {(rule.action || 'noop').toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Rule Body */}
                <div className="p-5 bg-white space-y-4">
                  <div className="flex-1 space-y-4">
                    {/* Rule Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <div className="flex items-center mb-1">
                          <label className="block text-sm font-medium text-gray-700">Rule Name</label>
                          <InfoTooltip text="Auto-generated name based on rule position. Rules are evaluated in priority order." />
                        </div>
                        <Input
                          value={`Rule ${ruleIndex + 1}`}
                          disabled
                        />
                      </div>

                      <div>
                        <div className="flex items-center mb-1">
                          <label className="block text-sm font-medium text-gray-700">Action</label>
                          <InfoTooltip text="NOOP: pass signal through unchanged. DELETE: remove signal from stream. REPLACE: modify signal fields before passing through." />
                        </div>
                        <Select
                          value={rule.action}
                          onChange={(e) => updateRule(ruleIndex, { ...rule, action: e.target.value })}
                          options={[
                            { value: 'noop', label: 'NOOP' },
                            { value: 'delete', label: 'DELETE' },
                            { value: 'replace', label: 'REPLACE' },
                          ]}
                        />
                      </div>

                      <div>
                        <div className="flex items-center mb-1">
                          <label className="block text-sm font-medium text-gray-700">Priority</label>
                          <InfoTooltip text="Lower number = higher priority. When multiple rules match, the one with lowest priority number wins." />
                        </div>
                        <Input
                          type="number"
                          value={rule.priority}
                          onChange={(e) => updateRule(ruleIndex, { ...rule, priority: parseInt(e.target.value) })}
                          required
                        />
                      </div>
                    </div>

                    {/* Conditions */}
                    <div className="bg-blue-50 rounded-xl p-4 ring-1 ring-blue-200">
                      <div className="flex items-center mb-3">
                        <h4 className="text-sm font-semibold text-blue-900">1. Match Conditions</h4>
                        <InfoTooltip text="Define which SCTE-35 signals this rule should match. All conditions must be true (AND logic) for the rule to trigger." />
                      </div>
                      <p className="text-xs text-blue-700 mb-3">Define when this rule should trigger</p>
                      {rule.conditions.map((condition, condIndex) => (
                        <div key={condIndex} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-3 mb-3 items-end">
                          <div>
                            <div className="flex items-center mb-1">
                              <label className="block text-sm font-medium text-gray-700">Field</label>
                              <InfoTooltip text="SCTE-35 signal field to match against. Common: segmentationTypeId (52=Provider Ad Start, 53=Provider Ad End), commandType (5=Splice Insert, 6=Time Signal)." />
                            </div>
                            <Select
                              value={condition.field}
                              onChange={(e) => {
                                const newField = e.target.value;
                                const newConditions = [...rule.conditions];
                                // Reset value and operator when field changes
                                const defaultValue = newField === 'outOfNetwork' ? 'true' 
                                  : newField === 'commandType' ? '5' 
                                  : newField === 'segmentationTypeId' ? '52' 
                                  : '';
                                const defaultOp = (newField === 'outOfNetwork') ? 'eq' : condition.operator;
                                newConditions[condIndex] = { ...condition, field: newField, value: defaultValue, operator: defaultOp };
                                updateRule(ruleIndex, { ...rule, conditions: newConditions });
                              }}
                              options={[
                                { value: 'commandType', label: 'Command Type' },
                                { value: 'segmentationTypeId', label: 'Segmentation Type ID' },
                                { value: 'duration', label: 'Duration' },
                                { value: 'ptsAdjustment', label: 'PTS Adjustment' },
                                { value: 'tier', label: 'Tier' },
                                { value: 'upidType', label: 'UPID Type' },
                                { value: 'upidValue', label: 'UPID Value' },
                                { value: 'eventId', label: 'Event ID' },
                                { value: 'descriptorCount', label: 'Descriptor Count' },
                                { value: 'outOfNetwork', label: 'Out of Network' },
                                { value: 'zoneIdentity', label: 'Zone Identity' },
                              ]}
                            />
                          </div>

                          <div>
                            <div className="flex items-center mb-1">
                              <label className="block text-sm font-medium text-gray-700">Operator</label>
                              <InfoTooltip text="Comparison operator. Range: e.g. 10-30. In List: comma-separated values e.g. 52,54,56." />
                            </div>
                            <Select
                              value={condition.operator}
                              onChange={(e) => {
                                const newConditions = [...rule.conditions];
                                newConditions[condIndex] = { ...condition, operator: e.target.value };
                                updateRule(ruleIndex, { ...rule, conditions: newConditions });
                              }}
                              options={
                                condition.field === 'outOfNetwork'
                                  ? [
                                      { value: 'eq', label: 'Equals (=)' },
                                      { value: 'ne', label: 'Not Equals (≠)' },
                                    ]
                                  : [
                                      { value: 'eq', label: 'Equals (=)' },
                                      { value: 'ne', label: 'Not Equals (≠)' },
                                      { value: 'gt', label: 'Greater Than (>)' },
                                      { value: 'lt', label: 'Less Than (<)' },
                                      { value: 'gte', label: 'Greater or Equal (≥)' },
                                      { value: 'lte', label: 'Less or Equal (≤)' },
                                      { value: 'range', label: 'Range' },
                                      { value: 'in', label: 'In List' },
                                      { value: 'not_in', label: 'Not In List' },
                                    ]
                              }
                            />
                          </div>

                          <div>
                            <div className="flex items-center mb-1">
                              <label className="block text-sm font-medium text-gray-700">Value</label>
                              <InfoTooltip text="Value to compare against. For Range use 'min-max' (e.g. 10-30). For In List use comma-separated values (e.g. 52,54,56)." />
                            </div>
                            {/* Dynamic value input based on field + operator */}
                            {condition.field === 'outOfNetwork' ? (
                              <Select
                                value={(() => {
                                  const v = String(condition.value).toLowerCase();
                                  return (v === 'true' || v === '1' || v === 'yes') ? 'true' : 'false';
                                })()}
                                onChange={(e) => {
                                  const newConditions = [...rule.conditions];
                                  newConditions[condIndex] = { ...condition, value: e.target.value };
                                  updateRule(ruleIndex, { ...rule, conditions: newConditions });
                                }}
                                options={[
                                  { value: 'true', label: 'True (CUE-OUT)' },
                                  { value: 'false', label: 'False (CUE-IN / Return)' },
                                ]}
                              />
                            ) : condition.field === 'commandType' && (condition.operator === 'eq' || condition.operator === 'ne') ? (
                              <Select
                                value={String(condition.value)}
                                onChange={(e) => {
                                  const newConditions = [...rule.conditions];
                                  newConditions[condIndex] = { ...condition, value: e.target.value };
                                  updateRule(ruleIndex, { ...rule, conditions: newConditions });
                                }}
                                options={[
                                  { value: '4', label: '4 - Splice Schedule' },
                                  { value: '5', label: '5 - Splice Insert' },
                                  { value: '6', label: '6 - Time Signal' },
                                  { value: '255', label: '255 - Private Command' },
                                ]}
                              />
                            ) : condition.field === 'segmentationTypeId' && (condition.operator === 'eq' || condition.operator === 'ne') ? (
                              <Select
                                value={String(condition.value)}
                                onChange={(e) => {
                                  const newConditions = [...rule.conditions];
                                  newConditions[condIndex] = { ...condition, value: e.target.value };
                                  updateRule(ruleIndex, { ...rule, conditions: newConditions });
                                }}
                                options={[
                                  { value: '0', label: '0x00 - Not Indicated' },
                                  { value: '1', label: '0x01 - Content Identification' },
                                  { value: '16', label: '0x10 - Program Start' },
                                  { value: '17', label: '0x11 - Program End' },
                                  { value: '18', label: '0x12 - Program Early Termination' },
                                  { value: '19', label: '0x13 - Program Breakaway' },
                                  { value: '20', label: '0x14 - Program Resumption' },
                                  { value: '21', label: '0x15 - Program Run-over Planned' },
                                  { value: '22', label: '0x16 - Program Run-over Unplanned' },
                                  { value: '32', label: '0x20 - Chapter Start' },
                                  { value: '33', label: '0x21 - Chapter End' },
                                  { value: '34', label: '0x22 - Break Start' },
                                  { value: '35', label: '0x23 - Break End' },
                                  { value: '48', label: '0x30 - Provider Ad Start' },
                                  { value: '49', label: '0x31 - Provider Ad End' },
                                  { value: '50', label: '0x32 - Distributor Ad Start' },
                                  { value: '51', label: '0x33 - Distributor Ad End' },
                                  { value: '52', label: '0x34 - Provider PO Start' },
                                  { value: '53', label: '0x35 - Provider PO End' },
                                  { value: '54', label: '0x36 - Distributor PO Start' },
                                  { value: '55', label: '0x37 - Distributor PO End' },
                                  { value: '64', label: '0x40 - Unscheduled Event Start' },
                                  { value: '65', label: '0x41 - Unscheduled Event End' },
                                  { value: '80', label: '0x50 - Network Start' },
                                  { value: '81', label: '0x51 - Network End' },
                                ]}
                              />
                            ) : (
                            <Input
                              value={condition.value}
                              onChange={(e) => {
                                const newConditions = [...rule.conditions];
                                newConditions[condIndex] = { ...condition, value: e.target.value };
                                updateRule(ruleIndex, { ...rule, conditions: newConditions });
                              }}
                              placeholder={
                                condition.operator === 'range'
                                  ? 'e.g., 10-30'
                                  : condition.operator === 'in' || condition.operator === 'not_in'
                                  ? 'e.g., 52,54,56'
                                  : 'Value'
                              }
                              required
                            />
                            )}
                          </div>
                          {/* Remove condition button */}
                          {rule.conditions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newConditions = rule.conditions.filter((_, i) => i !== condIndex);
                                updateRule(ruleIndex, { ...rule, conditions: newConditions });
                              }}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors mb-1"
                              title="Remove condition"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      {/* Add Condition button */}
                      <button
                        type="button"
                        onClick={() => {
                          const newConditions = [...rule.conditions, { field: 'segmentationTypeId', operator: 'eq', value: '' }];
                          updateRule(ruleIndex, { ...rule, conditions: newConditions });
                        }}
                        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium mt-1"
                      >
                        + Add Condition
                      </button>
                    </div>

                    {/* Modifications */}
                    {rule.action === 'replace' && (
                      <div className="bg-yellow-50 rounded-xl p-4 ring-1 ring-yellow-200">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="flex items-center">
                              <h4 className="text-sm font-semibold text-yellow-900">2. Signal Modifications</h4>
                              <InfoTooltip text="Modify SCTE-35 signal fields before passing through. Only applies when action is REPLACE." />
                            </div>
                            <p className="text-xs text-yellow-700 mt-1">Modify SCTE-35 signal fields (only for REPLACE action)</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => addModification(ruleIndex)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add
                          </Button>
                        </div>
                        
                        {rule.modifications.map((mod, modIndex) => (
                          <div key={modIndex} className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                            <Select
                              label="Target"
                              value={mod.target}
                              onChange={(e) => updateModification(ruleIndex, modIndex, 'target', e.target.value)}
                              options={[
                                { value: 'segmentation_type_id', label: 'Type ID' },
                                { value: 'duration', label: 'Duration' },
                                { value: 'segmentation_upid', label: 'UPID' },
                              ]}
                            />

                            <Select
                              label="Operation"
                              value={mod.operation}
                              onChange={(e) => updateModification(ruleIndex, modIndex, 'operation', e.target.value)}
                              options={[
                                { value: 'set', label: 'Set' },
                                { value: 'append', label: 'Append' },
                                { value: 'remove', label: 'Remove' },
                              ]}
                            />

                            <div className="flex gap-2">
                              <Input
                                label="Value"
                                value={mod.value || ''}
                                onChange={(e) => updateModification(ruleIndex, modIndex, 'value', e.target.value)}
                                placeholder="New value"
                              />
                              <div className="flex items-end">
                                <IconButton
                                  variant="danger"
                                  size="sm"
                                  onClick={() => removeModification(ruleIndex, modIndex)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </IconButton>
                              </div>
                            </div>
                          </div>
                        ))}

                        {rule.modifications.length === 0 && (
                          <p className="text-xs text-gray-500 text-center py-2">
                            No modifications defined
                          </p>
                        )}
                      </div>
                    )}

                    {/* External Actions Section - INLINE */}
                    <div className="bg-purple-50 rounded-xl p-4 ring-1 ring-purple-200">
                      <div className="mb-3">
                        <div className="flex items-center">
                          <h4 className="text-sm font-semibold text-purple-900">3. External Actions</h4>
                          <InfoTooltip text="Trigger external API calls when this rule matches. Supports MediaLive schedule actions (logo insertion, input switch, etc.) and webhooks." />
                        </div>
                        <p className="text-xs text-purple-700 mt-1">Trigger external API calls (MediaLive, Webhooks) when this rule matches</p>
                      </div>
                      <ExternalActionsPanel
                        actions={rule.externalActions || []}
                        onChange={(actions) => updateRule(ruleIndex, { ...rule, externalActions: actions })}
                      />
                    </div>

                    {/* Alternate Content Section */}
                    <div className="bg-teal-50 rounded-xl p-4 ring-1 ring-teal-200">
                      <div className="mb-3">
                        <div className="flex items-center">
                          <h4 className="text-sm font-semibold text-teal-900">4. Alternate Content</h4>
                          <InfoTooltip text="Configure AlternateContent in the SPN response to instruct the encoder to switch to an alternate input source when this rule matches." />
                        </div>
                        <p className="text-xs text-teal-700 mt-1">Instruct the encoder to switch inputs when this rule matches</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                          label="Input Identity"
                          value={rule.altContentIdentity || ''}
                          onChange={(e) => updateRule(ruleIndex, { ...rule, altContentIdentity: e.target.value || undefined })}
                          placeholder="e.g., backup-feed-1"
                        />
                        <Input
                          label="Zone Identity"
                          value={rule.altContentZoneIdentity || ''}
                          onChange={(e) => updateRule(ruleIndex, { ...rule, altContentZoneIdentity: e.target.value || undefined })}
                          placeholder="e.g., Main_Sat"
                        />
                      </div>
                    </div>

                    {/* Rule Settings */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <Toggle
                        label="Rule Enabled"
                        checked={rule.enabled}
                        onChange={(e) => updateRule(ruleIndex, { ...rule, enabled: e.target.checked })}
                      />
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => removeRule(ruleIndex)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove Rule
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              );
            })}

            {(!formData.rules || formData.rules.length === 0) && (
              <EmptyState
                variant="inline"
                title="No rules defined yet"
                description="Add rules to define how signals are processed"
                action={
                  <Button type="button" variant="secondary" size="sm" onClick={addRule}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Rule
                  </Button>
                }
              />
            )}
          </div>
        </Card>
      </form>
    </div>
  );
}
