// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useState } from 'react';
import { ExternalAction } from '../../types/channel';
import InfoTooltip from '../common/InfoTooltip';

interface MediaLiveActionFormProps {
  action?: ExternalAction;
  onSave: (action: ExternalAction) => void;
  onCancel: () => void;
}

// All 17 MediaLive schedule action types - matches AWS console
const SCHEDULE_ACTION_TYPES = [
  { value: 'static_image_activate', label: 'Static Image Activate', group: 'Image Overlay' },
  { value: 'static_image_deactivate', label: 'Static Image Deactivate', group: 'Image Overlay' },
  { value: 'static_image_output_activate', label: 'Static Image Output Activate', group: 'Image Overlay' },
  { value: 'static_image_output_deactivate', label: 'Static Image Output Deactivate', group: 'Image Overlay' },
  { value: 'motion_graphics_activate', label: 'Motion Graphics Activate', group: 'Motion Graphics' },
  { value: 'motion_graphics_deactivate', label: 'Motion Graphics Deactivate', group: 'Motion Graphics' },
  { value: 'input_switch', label: 'Input Switch', group: 'Input' },
  { value: 'input_prepare', label: 'Input Prepare', group: 'Input' },
  { value: 'scte35_splice_insert', label: 'SCTE-35 Splice Insert', group: 'SCTE-35' },
  { value: 'scte35_return_to_network', label: 'SCTE-35 Return to Network', group: 'SCTE-35' },
  { value: 'scte35_time_signal', label: 'SCTE-35 Time Signal', group: 'SCTE-35' },
  { value: 'scte35_input', label: 'SCTE-35 Input', group: 'SCTE-35' },
  { value: 'hls_id3_segment_tagging', label: 'HLS ID3 Segment Tagging', group: 'Metadata' },
  { value: 'hls_timed_metadata', label: 'HLS Timed Metadata', group: 'Metadata' },
  { value: 'id3_segment_tagging', label: 'ID3 Segment Tagging', group: 'Metadata' },
  { value: 'timed_metadata', label: 'Timed Metadata', group: 'Metadata' },
  { value: 'pause_state', label: 'Pause State', group: 'Channel Control' },
];

const REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'eu-west-1', label: 'EU (Ireland)' },
  { value: 'eu-central-1', label: 'EU (Frankfurt)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
  { value: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
  { value: 'sa-east-1', label: 'South America (São Paulo)' },
];

// Reusable field component
function Field({ label, tooltip, required, children }: {
  label: string; tooltip?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center mb-1">
        <label className="block text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-500"></span>}
        </label>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      {children}
    </div>
  );
}

const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm";

export default function MediaLiveActionForm({ action, onSave, onCancel }: MediaLiveActionFormProps) {
  const [formData, setFormData] = useState<Partial<ExternalAction>>(
    action || {
      actionId: `action-${Date.now()}`,
      actionType: 'medialive_schedule_action',
      enabled: true, order: 0, triggerMode: 'on_match',
      timeoutMs: 5000, blocking: false, target: {},
      actionConfig: { channel_id: '', region: 'us-east-1', schedule_action_type: 'static_image_activate', scheduling_mode: 'immediate', action_settings: {} },
      retryConfig: { maxRetries: 3, baseDelaySeconds: 1 },
    }
  );

  const [showCleanup, setShowCleanup] = useState(!!action?.cleanupConfig);
  const scheduleActionType = formData.actionConfig?.schedule_action_type || '';
  const settings = formData.actionConfig?.action_settings || {};

  const updateConfig = (key: string, value: any) => setFormData({ ...formData, actionConfig: { ...formData.actionConfig, [key]: value } });
  const updateSettings = (key: string, value: any) => setFormData({
    ...formData, actionConfig: { ...formData.actionConfig, action_settings: { ...settings, [key]: value } },
  });

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave(formData as ExternalAction); };

  // Group action types for optgroup
  const groups = SCHEDULE_ACTION_TYPES.reduce((acc, t) => {
    if (!acc[t.group]) acc[t.group] = [];
    acc[t.group].push(t);
    return acc;
  }, {} as Record<string, typeof SCHEDULE_ACTION_TYPES>);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* === Section 1: Action Type & Trigger === */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-gray-900 border-b pb-2">Action Type</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Schedule Action Type" required tooltip="The type of MediaLive schedule action to execute when the rule matches.">
            <select value={scheduleActionType} onChange={(e) => { updateConfig('schedule_action_type', e.target.value); updateConfig('action_settings', {}); }} className={inputClass} required>
              <option value="">Select action type...</option>
              {Object.entries(groups).map(([group, types]) => (
                <optgroup key={group} label={group}>
                  {types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label="Trigger Mode" tooltip="When to execute: On Match (rule matches), On No Match (no rule matches), Always (every signal).">
            <select value={formData.triggerMode} onChange={(e) => setFormData({ ...formData, triggerMode: e.target.value as any })} className={inputClass}>
              <option value="on_match">On Match</option>
              <option value="on_no_match">On No Match</option>
              <option value="always">Always</option>
            </select>
          </Field>
        </div>
      </div>

      {/* === Section 2: MediaLive Channel === */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-gray-900 border-b pb-2">MediaLive Channel</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Channel ID" required tooltip="The MediaLive channel ID (numeric). Find it in the MediaLive console.">
            <input type="text" value={formData.actionConfig?.channel_id || ''} onChange={(e) => updateConfig('channel_id', e.target.value)} className={inputClass} placeholder="e.g., 1234567" required />
          </Field>
          <Field label="Region" tooltip="AWS region where the MediaLive channel is running.">
            <select value={formData.actionConfig?.region || 'us-east-1'} onChange={(e) => updateConfig('region', e.target.value)} className={inputClass}>
              {REGIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>
          <Field label="Scheduling Mode" tooltip="Immediate: execute now. Fixed: at a specific UTC time. Follow: after another action completes.">
            <select value={formData.actionConfig?.scheduling_mode || 'immediate'} onChange={(e) => updateConfig('scheduling_mode', e.target.value)} className={inputClass}>
              <option value="immediate">Immediate</option>
              <option value="fixed">Fixed Time</option>
              <option value="follow">Follow</option>
            </select>
          </Field>
        </div>
      </div>

      {/* === Section 3: Action-Specific Settings === */}
      {scheduleActionType && (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-900 border-b pb-2">Action Settings</h4>

          {/* --- Static Image Activate --- */}
          {scheduleActionType === 'static_image_activate' && (
            <div className="space-y-4">
              <Field label="Image URI" required tooltip="S3 or HTTPS URL to a 32-bit BMP, PNG, or TGA file. Must not be larger than the input video.">
                <input type="text" value={settings.image_uri || ''} onChange={(e) => updateSettings('image_uri', e.target.value)} className={inputClass} placeholder="s3://bucket/image.png" required />
              </Field>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Layer (0-7)" tooltip="Z-order layer. Higher layers overlay lower layers.">
                  <input type="number" min="0" max="7" value={settings.layer ?? 0} onChange={(e) => updateSettings('layer', parseInt(e.target.value))} className={inputClass} />
                </Field>
                <Field label="Opacity (0-100)" tooltip="0 = transparent, 100 = fully opaque.">
                  <input type="number" min="0" max="100" value={settings.opacity ?? 100} onChange={(e) => updateSettings('opacity', parseInt(e.target.value))} className={inputClass} />
                </Field>
                <Field label="Duration (ms)" tooltip="How long the image stays. 0 = unlimited (until deactivated).">
                  <input type="number" min="0" value={settings.duration || ''} onChange={(e) => updateSettings('duration', e.target.value ? parseInt(e.target.value) : undefined)} className={inputClass} placeholder="0 = unlimited" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Position X (px)" tooltip="Left edge position relative to video frame.">
                  <input type="number" min="0" value={settings.imageX ?? 0} onChange={(e) => updateSettings('imageX', parseInt(e.target.value))} className={inputClass} />
                </Field>
                <Field label="Position Y (px)" tooltip="Top edge position relative to video frame.">
                  <input type="number" min="0" value={settings.imageY ?? 0} onChange={(e) => updateSettings('imageY', parseInt(e.target.value))} className={inputClass} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Width (px)" tooltip="Scale image to this width. Leave empty for native width.">
                  <input type="number" min="1" value={settings.width || ''} onChange={(e) => updateSettings('width', e.target.value ? parseInt(e.target.value) : undefined)} className={inputClass} placeholder="Native" />
                </Field>
                <Field label="Height (px)" tooltip="Scale image to this height. Leave empty for native height.">
                  <input type="number" min="1" value={settings.height || ''} onChange={(e) => updateSettings('height', e.target.value ? parseInt(e.target.value) : undefined)} className={inputClass} placeholder="Native" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Fade In (ms)" tooltip="Time for the image to fade in. 0 = no fade.">
                  <input type="number" min="0" value={settings.fadeIn ?? 0} onChange={(e) => updateSettings('fadeIn', parseInt(e.target.value))} className={inputClass} />
                </Field>
                <Field label="Fade Out (ms)" tooltip="Time for the image to fade out after duration ends. 0 = no fade.">
                  <input type="number" min="0" value={settings.fadeOut ?? 0} onChange={(e) => updateSettings('fadeOut', parseInt(e.target.value))} className={inputClass} />
                </Field>
              </div>
            </div>
          )}

          {/* --- Static Image Deactivate --- */}
          {scheduleActionType === 'static_image_deactivate' && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Layer (0-7)" tooltip="Which layer to deactivate.">
                <input type="number" min="0" max="7" value={settings.layer ?? 0} onChange={(e) => updateSettings('layer', parseInt(e.target.value))} className={inputClass} />
              </Field>
              <Field label="Fade Out (ms)" tooltip="Time for the image to fade out. 0 = instant removal.">
                <input type="number" min="0" value={settings.fadeOut ?? 0} onChange={(e) => updateSettings('fadeOut', parseInt(e.target.value))} className={inputClass} />
              </Field>
            </div>
          )}

          {/* --- Static Image Output Activate --- */}
          {scheduleActionType === 'static_image_output_activate' && (
            <div className="space-y-4">
              <Field label="Output Names" required tooltip="Comma-separated list of output names to apply the overlay to.">
                <input type="text" value={(settings.output_names || []).join(', ')} onChange={(e) => updateSettings('output_names', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))} className={inputClass} placeholder="output-1, output-2" required />
              </Field>
              <Field label="Image URI" required tooltip="S3 or HTTPS URL to a 32-bit BMP, PNG, or TGA file.">
                <input type="text" value={settings.image_uri || ''} onChange={(e) => updateSettings('image_uri', e.target.value)} className={inputClass} placeholder="s3://bucket/image.png" required />
              </Field>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Layer (0-7)"><input type="number" min="0" max="7" value={settings.layer ?? 0} onChange={(e) => updateSettings('layer', parseInt(e.target.value))} className={inputClass} /></Field>
                <Field label="Opacity (0-100)"><input type="number" min="0" max="100" value={settings.opacity ?? 100} onChange={(e) => updateSettings('opacity', parseInt(e.target.value))} className={inputClass} /></Field>
                <Field label="Duration (ms)"><input type="number" min="0" value={settings.duration || ''} onChange={(e) => updateSettings('duration', e.target.value ? parseInt(e.target.value) : undefined)} className={inputClass} placeholder="0 = unlimited" /></Field>
              </div>
            </div>
          )}

          {/* --- Static Image Output Deactivate --- */}
          {scheduleActionType === 'static_image_output_deactivate' && (
            <div className="space-y-4">
              <Field label="Output Names" required tooltip="Comma-separated list of output names to remove the overlay from.">
                <input type="text" value={(settings.output_names || []).join(', ')} onChange={(e) => updateSettings('output_names', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))} className={inputClass} placeholder="output-1, output-2" required />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Layer (0-7)"><input type="number" min="0" max="7" value={settings.layer ?? 0} onChange={(e) => updateSettings('layer', parseInt(e.target.value))} className={inputClass} /></Field>
                <Field label="Fade Out (ms)"><input type="number" min="0" value={settings.fadeOut ?? 0} onChange={(e) => updateSettings('fadeOut', parseInt(e.target.value))} className={inputClass} /></Field>
              </div>
            </div>
          )}

          {/* --- Motion Graphics Activate --- */}
          {scheduleActionType === 'motion_graphics_activate' && (
            <div className="space-y-4">
              <Field label="HTML5 URL" tooltip="URI of HTML5 content to render into the video stream.">
                <input type="text" value={settings.graphics_uri || ''} onChange={(e) => updateSettings('graphics_uri', e.target.value)} className={inputClass} placeholder="s3://bucket/graphics.html or https://..." />
              </Field>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Duration (ms)" tooltip="0 = render until deactivated. Max 86400000 (24h).">
                  <input type="number" min="0" max="86400000" value={settings.duration_ms || ''} onChange={(e) => updateSettings('duration_ms', e.target.value ? parseInt(e.target.value) : undefined)} className={inputClass} placeholder="0 = unlimited" />
                </Field>
                <Field label="Username" tooltip="AWS Parameter Store reference for authentication.">
                  <input type="text" value={settings.username || ''} onChange={(e) => updateSettings('username', e.target.value)} className={inputClass} placeholder="ssm://<param>" />
                </Field>
                <Field label="Password Param" tooltip="EC2 Parameter Store key for password.">
                  <input type="text" value={settings.password_param || ''} onChange={(e) => updateSettings('password_param', e.target.value)} className={inputClass} placeholder="EC2 param key" />
                </Field>
              </div>
            </div>
          )}

          {/* --- Motion Graphics Deactivate --- */}
          {scheduleActionType === 'motion_graphics_deactivate' && (
            <p className="text-sm text-gray-500 italic">No additional settings required. This will deactivate the active motion graphics overlay.</p>
          )}

          {/* --- Input Switch --- */}
          {scheduleActionType === 'input_switch' && (
            <div className="space-y-4">
              <Field label="Input Attachment Name" required tooltip="The name of the input attachment to switch to (as configured in the MediaLive channel).">
                <input type="text" value={settings.input_attachment_name || ''} onChange={(e) => updateSettings('input_attachment_name', e.target.value)} className={inputClass} placeholder="e.g., input-1" required />
              </Field>
            </div>
          )}

          {/* --- Input Prepare --- */}
          {scheduleActionType === 'input_prepare' && (
            <Field label="Input Attachment Name" tooltip="Leave empty to stop the most recent prepare action.">
              <input type="text" value={settings.input_attachment_name || ''} onChange={(e) => updateSettings('input_attachment_name', e.target.value)} className={inputClass} placeholder="Leave empty to stop prepare" />
            </Field>
          )}

          {/* --- SCTE-35 Splice Insert --- */}
          {scheduleActionType === 'scte35_splice_insert' && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Splice Event ID" required tooltip="Unique identifier for this splice event (0-4294967295).">
                <input type="number" min="0" max="4294967295" value={settings.splice_event_id ?? ''} onChange={(e) => updateSettings('splice_event_id', parseInt(e.target.value))} className={inputClass} required />
              </Field>
              <Field label="Duration (90kHz ticks)" tooltip="Duration in 90kHz ticks. Leave empty for no duration.">
                <input type="number" min="0" value={settings.duration || ''} onChange={(e) => updateSettings('duration', e.target.value ? parseInt(e.target.value) : undefined)} className={inputClass} placeholder="Optional" />
              </Field>
            </div>
          )}

          {/* --- SCTE-35 Return to Network --- */}
          {scheduleActionType === 'scte35_return_to_network' && (
            <Field label="Splice Event ID" required tooltip="Must match the splice_event_id of the corresponding splice insert.">
              <input type="number" min="0" max="4294967295" value={settings.splice_event_id ?? ''} onChange={(e) => updateSettings('splice_event_id', parseInt(e.target.value))} className={inputClass} required />
            </Field>
          )}

          {/* --- SCTE-35 Time Signal --- */}
          {scheduleActionType === 'scte35_time_signal' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Configure SCTE-35 descriptors in JSON format. Each descriptor needs SegmentationEventId and SegmentationCancelIndicator at minimum.</p>
              <Field label="Descriptors (JSON)" required tooltip="Array of SCTE-35 descriptors in AWS PascalCase format.">
                <textarea value={JSON.stringify(settings.descriptors || [], null, 2)} onChange={(e) => { try { updateSettings('descriptors', JSON.parse(e.target.value)); } catch { /* ignore invalid JSON while the user is typing */ } }} className={`${inputClass} font-mono`} rows={8} placeholder='[{"Scte35DescriptorSettings":{"SegmentationDescriptorScte35DescriptorSettings":{"SegmentationEventId":1,"SegmentationCancelIndicator":"SEGMENTATION_EVENT_NOT_CANCELED"}}}]' required />
              </Field>
            </div>
          )}

          {/* --- SCTE-35 Input --- */}
          {scheduleActionType === 'scte35_input' && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Input Attachment Name" required tooltip="The SCTE-35 input attachment to use.">
                <input type="text" value={settings.input_attachment_name || ''} onChange={(e) => updateSettings('input_attachment_name', e.target.value)} className={inputClass} required />
              </Field>
              <Field label="Mode" tooltip="FIXED: use this input. FOLLOW_ACTIVE: follow the active input.">
                <select value={settings.mode || 'FIXED'} onChange={(e) => updateSettings('mode', e.target.value)} className={inputClass}>
                  <option value="FIXED">Fixed</option>
                  <option value="FOLLOW_ACTIVE">Follow Active</option>
                </select>
              </Field>
            </div>
          )}

          {/* --- HLS ID3 Segment Tagging --- */}
          {scheduleActionType === 'hls_id3_segment_tagging' && (
            <Field label="ID3 Tag" tooltip="Tag to insert into each HLS segment. Supports keyword identifiers.">
              <input type="text" value={settings.tag || ''} onChange={(e) => updateSettings('tag', e.target.value)} className={inputClass} placeholder="ID3 tag content" />
            </Field>
          )}

          {/* --- HLS Timed Metadata --- */}
          {scheduleActionType === 'hls_timed_metadata' && (
            <Field label="ID3 Data (Base64)" required tooltip="Base64-encoded ID3 data per ID3 v2.4.0 specification.">
              <textarea value={settings.id3 || ''} onChange={(e) => updateSettings('id3', e.target.value)} className={`${inputClass} font-mono`} rows={3} placeholder="Base64 encoded ID3 data" required />
            </Field>
          )}

          {/* --- ID3 Segment Tagging --- */}
          {scheduleActionType === 'id3_segment_tagging' && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tag" tooltip="Tag content for segment tagging.">
                <input type="text" value={settings.tag || ''} onChange={(e) => updateSettings('tag', e.target.value)} className={inputClass} />
              </Field>
              <Field label="ID3" tooltip="ID3 tag content.">
                <input type="text" value={settings.id3 || ''} onChange={(e) => updateSettings('id3', e.target.value)} className={inputClass} />
              </Field>
            </div>
          )}

          {/* --- Timed Metadata --- */}
          {scheduleActionType === 'timed_metadata' && (
            <Field label="ID3 Metadata" required tooltip="Metadata content to insert.">
              <textarea value={settings.id3 || ''} onChange={(e) => updateSettings('id3', e.target.value)} className={`${inputClass} font-mono`} rows={3} required />
            </Field>
          )}

          {/* --- Pause State --- */}
          {scheduleActionType === 'pause_state' && (
            <div className="space-y-3">
              <Field label="Pipelines to Pause" required tooltip="Select at least one pipeline to pause encoding on.">
                <div className="space-y-2">
                  {['PIPELINE_0', 'PIPELINE_1'].map((pid) => (
                    <label key={pid} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={(settings.pipelines || []).includes(pid)}
                        onChange={(e) => {
                          const current = settings.pipelines || [];
                          const next = e.target.checked ? [...current, pid] : current.filter((p: string) => p !== pid);
                          updateSettings('pipelines', next);
                        }}
                        className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
                      <span className="text-sm text-gray-700">{pid.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </Field>
            </div>
          )}
        </div>
      )}

      {/* === Section 4: Cleanup === */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-900 border-b pb-2 flex-1">Cleanup Configuration</h4>
          <label className="flex items-center gap-2 cursor-pointer ml-4">
            <input type="checkbox" checked={showCleanup} onChange={(e) => { setShowCleanup(e.target.checked); if (!e.target.checked) setFormData({ ...formData, cleanupConfig: undefined }); else setFormData({ ...formData, cleanupConfig: { trigger_type_id: 53 } }); }} className="h-4 w-4 text-primary-600 border-gray-300 rounded" />
            <span className="text-sm text-gray-700">Enable auto-cleanup</span>
          </label>
        </div>
        {showCleanup && (
          <div className="grid grid-cols-2 gap-4 bg-blue-50 rounded-lg p-4">
            <Field label="Cleanup Trigger Type ID" tooltip="Segmentation Type ID that triggers cleanup (e.g., 53 = Provider Ad End).">
              <input type="number" value={formData.cleanupConfig?.trigger_type_id || ''} onChange={(e) => setFormData({ ...formData, cleanupConfig: { ...formData.cleanupConfig, trigger_type_id: parseInt(e.target.value) } })} className={inputClass} placeholder="53" />
            </Field>
            <Field label="Timeout (seconds)" tooltip="Force cleanup after this many seconds if no trigger signal received.">
              <input type="number" value={formData.cleanupConfig?.timeout_seconds || ''} onChange={(e) => setFormData({ ...formData, cleanupConfig: { ...formData.cleanupConfig, timeout_seconds: parseInt(e.target.value) } })} className={inputClass} placeholder="Optional" />
            </Field>
          </div>
        )}
      </div>

      {/* === Section 5: Advanced === */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-gray-900 border-b pb-2">Advanced Settings</h4>
        <div className="flex gap-4">
          <div className="flex-1">
            <Field label="Timeout (ms)" tooltip="Maximum time to wait for the MediaLive API response.">
              <input type="number" min="1000" value={formData.timeoutMs} onChange={(e) => setFormData({ ...formData, timeoutMs: parseInt(e.target.value) })} className={inputClass} />
            </Field>
          </div>
          <div className="flex-1">
            <Field label="Max Retries" tooltip="Number of retry attempts on failure (with exponential backoff).">
              <input type="number" min="0" max="10" value={formData.retryConfig?.maxRetries} onChange={(e) => setFormData({ ...formData, retryConfig: { ...formData.retryConfig!, maxRetries: parseInt(e.target.value) } })} className={inputClass} />
            </Field>
          </div>
          <div className="w-48 flex-shrink-0">
            <Field label="Blocking" tooltip="When enabled, subsequent actions wait for this one to complete. If it fails, remaining actions are skipped.">
              <select value={formData.blocking ? 'true' : 'false'} onChange={(e) => setFormData({ ...formData, blocking: e.target.value === 'true' })} className={inputClass}>
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </Field>
          </div>
        </div>
      </div>

      {/* === Submit === */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
        <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">{action ? 'Update Action' : 'Add Action'}</button>
      </div>
    </form>
  );
}
