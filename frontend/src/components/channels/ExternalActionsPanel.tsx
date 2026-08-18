// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useState } from 'react';
import { ExternalAction } from '../../types/channel';
import { useGetSystemDefaultsQuery } from '../../store/api/preferencesApi';
import Select from '../common/Select';
import Input from '../common/Input';
import Textarea from '../common/Textarea';
import Toggle from '../common/Toggle';
import { Trash2, ChevronUp, ChevronDown } from 'lucide-react';

interface ExternalActionsPanelProps {
  actions: ExternalAction[];
  onChange: (actions: ExternalAction[]) => void;
}

export default function ExternalActionsPanel({ actions, onChange }: ExternalActionsPanelProps) {
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const { data: systemDefaults } = useGetSystemDefaultsQuery();

  const addAction = (type: 'medialive_schedule_action' | 'webhook') => {
    const timeoutMs = systemDefaults?.defaultActionTimeoutMs ?? 5000;
    const maxRetries = systemDefaults?.defaultActionMaxRetries ?? 3;
    
    const newAction: ExternalAction = {
      actionId: `action-${Date.now()}`,
      actionType: type,
      enabled: true,
      order: actions.length,
      triggerMode: 'on_match',
      timeoutMs,
      blocking: false,
      target: {},
      actionConfig: type === 'medialive_schedule_action' 
        ? {
            channel_id: '',
            region: 'us-east-1',
            schedule_action_type: 'static_image_activate',
            action_settings: {},
          }
        : {
            url: '',
            method: 'POST',
            headers: {},
            auth_type: 'none',
            verify_ssl: true,
          },
      retryConfig: {
        maxRetries,
        baseDelaySeconds: 1,
      },
    };
    
    onChange([...actions, newAction]);
    setEditingActionId(newAction.actionId);
    setExpandedActionId(newAction.actionId);
  };

  const updateAction = (actionId: string, updates: Partial<ExternalAction>) => {
    onChange(
      actions.map((action) =>
        action.actionId === actionId ? { ...action, ...updates } : action
      )
    );
  };

  const deleteAction = (actionId: string) => {
    onChange(actions.filter((action) => action.actionId !== actionId));
    if (editingActionId === actionId) setEditingActionId(null);
    if (expandedActionId === actionId) setExpandedActionId(null);
  };

  const moveAction = (actionId: string, direction: 'up' | 'down') => {
    const index = actions.findIndex((a) => a.actionId === actionId);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === actions.length - 1) return;

    const newActions = [...actions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newActions[index], newActions[targetIndex]] = [newActions[targetIndex], newActions[index]];
    
    newActions.forEach((action, idx) => {
      action.order = idx;
    });

    onChange(newActions);
  };

  const getActionTypeLabel = (type: string): string => {
    switch (type) {
      case 'medialive_schedule_action': return 'MediaLive';
      case 'webhook': return 'Webhook';
      default: return type;
    }
  };

  return (
    <div className="space-y-3">
      {/* Action List */}
      {actions.map((action, index) => (
        <div key={action.actionId} className="border border-gray-200 rounded-lg p-3 bg-white">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-medium text-gray-500">#{index + 1}</span>
              <span className="text-sm font-medium text-gray-900">
                {getActionTypeLabel(action.actionType)}
              </span>
              {!action.enabled && (
                <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                  Disabled
                </span>
              )}
              {action.blocking && (
                <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-800 rounded">
                  Blocking
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => moveAction(action.actionId, 'up')}
                disabled={index === 0}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => moveAction(action.actionId, 'down')}
                disabled={index === actions.length - 1}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <Toggle
                ariaLabel={`Enable action ${action.actionId}`}
                checked={action.enabled}
                onChange={(e) => updateAction(action.actionId, { enabled: e.target.checked })}
              />
              <button
                type="button"
                onClick={() => {
                  const isEditing = editingActionId === action.actionId;
                  setEditingActionId(isEditing ? null : action.actionId);
                  setExpandedActionId(isEditing ? null : action.actionId);
                }}
                className="px-2 py-1 text-xs text-primary-600 hover:text-primary-800"
              >
                {editingActionId === action.actionId ? 'Done' : 'Edit'}
              </button>
              <button
                type="button"
                onClick={() => deleteAction(action.actionId)}
                className="p-1 text-red-400 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Inline Form */}
          {editingActionId === action.actionId && (
            <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
              {/* MediaLive Form */}
              {action.actionType === 'medialive_schedule_action' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      label="Schedule Action Type"
                      value={action.actionConfig.schedule_action_type}
                      onChange={(e) =>
                        updateAction(action.actionId, {
                          actionConfig: { ...action.actionConfig, schedule_action_type: e.target.value },
                        })
                      }
                      options={[
                        { value: 'static_image_activate', label: 'Static Image Activate' },
                        { value: 'static_image_deactivate', label: 'Static Image Deactivate' },
                        { value: 'motion_graphics_activate', label: 'Motion Graphics Activate' },
                        { value: 'motion_graphics_deactivate', label: 'Motion Graphics Deactivate' },
                        { value: 'input_switch', label: 'Input Switch' },
                        { value: 'input_prepare', label: 'Input Prepare' },
                        { value: 'scte35_splice_insert', label: 'SCTE-35 Splice Insert' },
                        { value: 'scte35_time_signal', label: 'SCTE-35 Time Signal' },
                        { value: 'scte35_return_to_network', label: 'SCTE-35 Return to Network' },
                        { value: 'hls_id3_segment_tagging', label: 'HLS ID3 Segment Tagging' },
                        { value: 'hls_timed_metadata', label: 'HLS Timed Metadata' },
                        { value: 'pause_state', label: 'Pause State' },
                      ]}
                    />
                    <Select
                      label="Trigger Mode"
                      value={action.triggerMode}
                      onChange={(e) =>
                        updateAction(action.actionId, { triggerMode: e.target.value as any })
                      }
                      options={[
                        { value: 'on_match', label: 'On Match' },
                        { value: 'on_no_match', label: 'On No Match' },
                        { value: 'always', label: 'Always' },
                      ]}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <Input
                      label="MediaLive Channel ID"
                      value={action.actionConfig.channel_id || ''}
                      onChange={(e) =>
                        updateAction(action.actionId, {
                          actionConfig: { ...action.actionConfig, channel_id: e.target.value },
                        })
                      }
                      placeholder="1234567"
                    />
                    <Select
                      label="Region"
                      value={action.actionConfig.region || 'us-east-1'}
                      onChange={(e) =>
                        updateAction(action.actionId, {
                          actionConfig: { ...action.actionConfig, region: e.target.value },
                        })
                      }
                      options={[
                        { value: 'us-east-1', label: 'US East (N. Virginia)' },
                        { value: 'us-west-2', label: 'US West (Oregon)' },
                        { value: 'eu-west-1', label: 'EU (Ireland)' },
                      ]}
                    />
                    <Select
                      label="Scheduling Mode"
                      value={action.actionConfig.scheduling_mode || 'immediate'}
                      onChange={(e) =>
                        updateAction(action.actionId, {
                          actionConfig: { ...action.actionConfig, scheduling_mode: e.target.value },
                        })
                      }
                      options={[
                        { value: 'immediate', label: 'Immediate' },
                        { value: 'fixed', label: 'Fixed Time' },
                        { value: 'follow', label: 'Follow Action' },
                      ]}
                    />
                  </div>

                  {action.actionConfig.scheduling_mode === 'fixed' && (
                    <Input
                      label="Start Time (UTC)"
                      value={action.actionConfig.start_time || ''}
                      onChange={(e) =>
                        updateAction(action.actionId, {
                          actionConfig: { ...action.actionConfig, start_time: e.target.value },
                        })
                      }
                      placeholder="20240101T120000"
                      helperText="Format: YYYYMMDDTHHmmss"
                    />
                  )}

                  {action.actionConfig.scheduling_mode === 'immediate' && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-3">
                      <Toggle
                        label="Use Signal Acquisition Time"
                        description="Schedule action at the exact time the signal was acquired (requires sufficient preroll)"
                        checked={action.actionConfig.use_acquisition_time !== false}
                        onChange={(e) =>
                          updateAction(action.actionId, {
                            actionConfig: { ...action.actionConfig, use_acquisition_time: e.target.checked },
                          })
                        }
                      />
                    </div>
                  )}

                  {action.actionConfig.scheduling_mode === 'follow' && (
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Reference Action Name"
                        value={action.actionConfig.reference_action_name || ''}
                        onChange={(e) =>
                          updateAction(action.actionId, {
                            actionConfig: { ...action.actionConfig, reference_action_name: e.target.value },
                          })
                        }
                        placeholder="previous-action-name"
                      />
                      <Select
                        label="Follow Point"
                        value={action.actionConfig.follow_point || 'END'}
                        onChange={(e) =>
                          updateAction(action.actionId, {
                            actionConfig: { ...action.actionConfig, follow_point: e.target.value },
                          })
                        }
                        options={[
                          { value: 'END', label: 'End' },
                          { value: 'START', label: 'Start' },
                        ]}
                      />
                    </div>
                  )}

                  {action.actionConfig.schedule_action_type === 'static_image_activate' && (
                    <>
                      <Input
                        label="Image URI (S3)"
                        value={action.actionConfig.action_settings?.image_uri || ''}
                        onChange={(e) =>
                          updateAction(action.actionId, {
                            actionConfig: {
                              ...action.actionConfig,
                              action_settings: {
                                ...action.actionConfig.action_settings,
                                image_uri: e.target.value,
                              },
                            },
                          })
                        }
                        placeholder="s3://bucket/path/to/image.png"
                      />
                      
                      <div className="grid grid-cols-3 gap-3">
                        <Input
                          label="Layer (0-7)"
                          type="number"
                          value={action.actionConfig.action_settings?.layer ?? 0}
                          onChange={(e) =>
                            updateAction(action.actionId, {
                              actionConfig: {
                                ...action.actionConfig,
                                action_settings: {
                                  ...action.actionConfig.action_settings,
                                  layer: parseInt(e.target.value),
                                },
                              },
                            })
                          }
                        />
                        <Input
                          label="Opacity (0-100)"
                          type="number"
                          value={action.actionConfig.action_settings?.opacity ?? 100}
                          onChange={(e) =>
                            updateAction(action.actionId, {
                              actionConfig: {
                                ...action.actionConfig,
                                action_settings: {
                                  ...action.actionConfig.action_settings,
                                  opacity: parseInt(e.target.value),
                                },
                              },
                            })
                          }
                        />
                        <Input
                          label="Duration (ms)"
                          type="number"
                          value={action.actionConfig.action_settings?.duration || ''}
                          onChange={(e) =>
                            updateAction(action.actionId, {
                              actionConfig: {
                                ...action.actionConfig,
                                action_settings: {
                                  ...action.actionConfig.action_settings,
                                  duration: e.target.value ? parseInt(e.target.value) : undefined,
                                },
                              },
                            })
                          }
                          placeholder="0 = unlimited"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Width (px)"
                          type="number"
                          value={action.actionConfig.action_settings?.width || ''}
                          onChange={(e) =>
                            updateAction(action.actionId, {
                              actionConfig: {
                                ...action.actionConfig,
                                action_settings: {
                                  ...action.actionConfig.action_settings,
                                  width: e.target.value ? parseInt(e.target.value) : undefined,
                                },
                              },
                            })
                          }
                          placeholder="Native width"
                        />
                        <Input
                          label="Height (px)"
                          type="number"
                          value={action.actionConfig.action_settings?.height || ''}
                          onChange={(e) =>
                            updateAction(action.actionId, {
                              actionConfig: {
                                ...action.actionConfig,
                                action_settings: {
                                  ...action.actionConfig.action_settings,
                                  height: e.target.value ? parseInt(e.target.value) : undefined,
                                },
                              },
                            })
                          }
                          placeholder="Native height"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Position X (px)"
                          type="number"
                          value={action.actionConfig.action_settings?.imageX ?? 0}
                          onChange={(e) =>
                            updateAction(action.actionId, {
                              actionConfig: {
                                ...action.actionConfig,
                                action_settings: {
                                  ...action.actionConfig.action_settings,
                                  imageX: parseInt(e.target.value),
                                },
                              },
                            })
                          }
                        />
                        <Input
                          label="Position Y (px)"
                          type="number"
                          value={action.actionConfig.action_settings?.imageY ?? 0}
                          onChange={(e) =>
                            updateAction(action.actionId, {
                              actionConfig: {
                                ...action.actionConfig,
                                action_settings: {
                                  ...action.actionConfig.action_settings,
                                  imageY: parseInt(e.target.value),
                                },
                              },
                            })
                          }
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Fade In (ms)"
                          type="number"
                          value={action.actionConfig.action_settings?.fadeIn ?? 0}
                          onChange={(e) =>
                            updateAction(action.actionId, {
                              actionConfig: {
                                ...action.actionConfig,
                                action_settings: {
                                  ...action.actionConfig.action_settings,
                                  fadeIn: parseInt(e.target.value),
                                },
                              },
                            })
                          }
                        />
                        <Input
                          label="Fade Out (ms)"
                          type="number"
                          value={action.actionConfig.action_settings?.fadeOut ?? 0}
                          onChange={(e) =>
                            updateAction(action.actionId, {
                              actionConfig: {
                                ...action.actionConfig,
                                action_settings: {
                                  ...action.actionConfig.action_settings,
                                  fadeOut: parseInt(e.target.value),
                                },
                              },
                            })
                          }
                        />
                      </div>
                    </>
                  )}

                  {action.actionConfig.schedule_action_type === 'input_switch' && (
                    <Input
                      label="Input Attachment Name"
                      value={action.actionConfig.action_settings?.input_attachment_name || ''}
                      onChange={(e) =>
                        updateAction(action.actionId, {
                          actionConfig: {
                            ...action.actionConfig,
                            action_settings: {
                              ...action.actionConfig.action_settings,
                              input_attachment_name: e.target.value,
                            },
                          },
                        })
                      }
                      placeholder="input-1"
                    />
                  )}

                  {action.actionConfig.schedule_action_type === 'motion_graphics_activate' && (
                    <>
                      <Input
                        label="Graphics URI (S3/HTTP)"
                        value={action.actionConfig.action_settings?.graphics_uri || ''}
                        onChange={(e) =>
                          updateAction(action.actionId, {
                            actionConfig: {
                              ...action.actionConfig,
                              action_settings: {
                                ...action.actionConfig.action_settings,
                                graphics_uri: e.target.value,
                              },
                            },
                          })
                        }
                        placeholder="s3://bucket/graphics.html"
                      />
                      <div className="grid grid-cols-3 gap-3">
                        <Input
                          label="Duration (ms)"
                          type="number"
                          value={action.actionConfig.action_settings?.duration_ms || ''}
                          onChange={(e) =>
                            updateAction(action.actionId, {
                              actionConfig: {
                                ...action.actionConfig,
                                action_settings: {
                                  ...action.actionConfig.action_settings,
                                  duration_ms: e.target.value ? parseInt(e.target.value) : undefined,
                                },
                              },
                            })
                          }
                          placeholder="0 = indefinite"
                        />
                        <Input
                          label="Username"
                          value={action.actionConfig.action_settings?.username || ''}
                          onChange={(e) =>
                            updateAction(action.actionId, {
                              actionConfig: {
                                ...action.actionConfig,
                                action_settings: {
                                  ...action.actionConfig.action_settings,
                                  username: e.target.value,
                                },
                              },
                            })
                          }
                          placeholder="ssm://<param>"
                        />
                        <Input
                          label="Password Param"
                          value={action.actionConfig.action_settings?.passwordParam || ''}
                          onChange={(e) =>
                            updateAction(action.actionId, {
                              actionConfig: {
                                ...action.actionConfig,
                                action_settings: {
                                  ...action.actionConfig.action_settings,
                                  passwordParam: e.target.value,
                                },
                              },
                            })
                          }
                          placeholder="EC2 param"
                        />
                      </div>
                    </>
                  )}

                  <div className="flex gap-3">
                    <div className="flex-1">
                      <Input
                        label="Timeout (ms)"
                        type="number"
                        value={action.timeoutMs}
                        onChange={(e) =>
                          updateAction(action.actionId, { timeoutMs: parseInt(e.target.value) })
                        }
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        label="Max Retries"
                        type="number"
                        value={action.retryConfig.maxRetries}
                        onChange={(e) =>
                          updateAction(action.actionId, {
                            retryConfig: { ...action.retryConfig, maxRetries: parseInt(e.target.value) },
                          })
                        }
                      />
                    </div>
                    <div className="flex-shrink-0">
                      <label className="block text-sm font-medium text-gray-700 mb-1">&nbsp;</label>
                      <label className="flex items-center gap-2 cursor-pointer px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors">
                        <span className="text-sm font-medium text-gray-700">Blocking</span>
                        <input
                          type="checkbox"
                          checked={action.blocking}
                          onChange={(e) => updateAction(action.actionId, { blocking: e.target.checked })}
                          className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        />
                      </label>
                    </div>
                  </div>
                </>
              )}

              {/* Webhook Form */}
              {action.actionType === 'webhook' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="URL"
                      value={action.actionConfig.url || ''}
                      onChange={(e) =>
                        updateAction(action.actionId, {
                          actionConfig: { ...action.actionConfig, url: e.target.value },
                        })
                      }
                      placeholder="https://api.example.com/webhook"
                    />
                    <Select
                      label="Method"
                      value={action.actionConfig.method || 'POST'}
                      onChange={(e) =>
                        updateAction(action.actionId, {
                          actionConfig: { ...action.actionConfig, method: e.target.value },
                        })
                      }
                      options={[
                        { value: 'GET', label: 'GET' },
                        { value: 'POST', label: 'POST' },
                        { value: 'PUT', label: 'PUT' },
                        { value: 'DELETE', label: 'DELETE' },
                      ]}
                    />
                  </div>

                  <Select
                    label="Trigger Mode"
                    value={action.triggerMode}
                    onChange={(e) =>
                      updateAction(action.actionId, { triggerMode: e.target.value as any })
                    }
                    options={[
                      { value: 'on_match', label: 'On Match' },
                      { value: 'on_no_match', label: 'On No Match' },
                      { value: 'always', label: 'Always' },
                    ]}
                  />

                  <Textarea
                    label="Request Body Template"
                    value={action.actionConfig.body_template || ''}
                    onChange={(e) =>
                      updateAction(action.actionId, {
                        actionConfig: { ...action.actionConfig, body_template: e.target.value },
                      })
                    }
                    placeholder='{"channel_id": "{{channel_id}}", "signal": {{signal}}}'
                    rows={4}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Timeout (ms)"
                      type="number"
                      value={action.timeoutMs}
                      onChange={(e) =>
                        updateAction(action.actionId, { timeoutMs: parseInt(e.target.value) })
                      }
                    />
                    <Input
                      label="Max Retries"
                      type="number"
                      value={action.retryConfig.maxRetries}
                      onChange={(e) =>
                        updateAction(action.actionId, {
                          retryConfig: { ...action.retryConfig, maxRetries: parseInt(e.target.value) },
                        })
                      }
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Add Action Buttons */}
      {actions.length === 0 && (
        <p className="text-xs text-gray-500 text-center py-2">
          No external actions defined
        </p>
      )}
      
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => addAction('medialive_schedule_action')}
          className="group relative p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all text-left"
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 group-hover:text-primary-700">
                MediaLive Action
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Control AWS MediaLive channels
              </div>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => addAction('webhook')}
          className="group relative p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all text-left"
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 group-hover:text-primary-700">
                Webhook Action
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Call any HTTP API endpoint
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
