// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useState } from 'react';
import { Rule } from '../../types/channel';
import AlertModal from '../common/AlertModal';
import ConfirmModal from '../common/ConfirmModal';
import ExternalActionsPanel from './ExternalActionsPanel';

interface RuleBuilderProps {
  rules: Rule[];
  onChange: (rules: Rule[]) => void;
}

export default function RuleBuilder({ rules, onChange }: RuleBuilderProps) {
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: () => {},
  });

  // Normalize rules to ensure they match the expected structure
  const normalizedRules = rules.map(rule => {
    // Check if rule has old structure with action.type
    if (rule.action && typeof rule.action === 'object' && 'type' in rule.action) {
      const oldAction = rule.action as any;
      return {
        ...rule,
        action: oldAction.type,
        modifications: oldAction.modifications || rule.modifications || [],
      };
    }
    // Already in new structure
    return {
      ...rule,
      modifications: rule.modifications || [],
    };
  });

  const addRule = () => {
    const newRule: Rule = {
      ruleId: `rule-${Date.now()}`,
      name: 'New Rule',
      priority: normalizedRules.length,
      enabled: true,
      conditions: [],
      action: 'noop',
      modifications: [],
      externalActions: [],
    };
    setEditingRule(newRule);
  };

  const saveRule = () => {
    if (!editingRule) return;

    // Validate rule before saving
    const validation = validateRuleClient(editingRule);
    
    if (!validation.valid) {
      // Show errors
      setAlertModal({
        isOpen: true,
        title: 'Cannot save rule',
        message: validation.errors.map(e => `• ${e.message}`).join('\n'),
        type: 'error',
      });
      return;
    }

    if (validation.warnings.length > 0) {
      // Show warnings but allow save
      setConfirmModal({
        isOpen: true,
        title: 'Warning',
        message: validation.warnings.map(w => `• ${w.message}`).join('\n'),
        type: 'warning',
        onConfirm: () => {
          setConfirmModal({ ...confirmModal, isOpen: false });
          performSave();
        },
      });
      return;
    }

    performSave();
  };

  const performSave = () => {
    if (!editingRule) return;
    
    const existingIndex = normalizedRules.findIndex((r) => r.ruleId === editingRule.ruleId);
    if (existingIndex >= 0) {
      const updated = [...normalizedRules];
      updated[existingIndex] = editingRule;
      onChange(updated);
    } else {
      onChange([...normalizedRules, editingRule]);
    }
    setEditingRule(null);
  };

  // Client-side validation
  const validateRuleClient = (rule: Rule): { valid: boolean; errors: Array<{message: string}>; warnings: Array<{message: string}> } => {
    const errors: Array<{message: string}> = [];
    const warnings: Array<{message: string}> = [];

    // Validate rule name
    if (!rule.name || rule.name.trim().length === 0) {
      errors.push({ message: 'Rule name is required' });
    }

    // Validate conditions
    if (rule.conditions.length === 0) {
      errors.push({ message: 'At least one condition is required' });
    }

    rule.conditions.forEach((condition, index) => {
      if (!condition.value || condition.value === '') {
        errors.push({ message: `Condition ${index + 1}: Value is required` });
      }

      // Validate numeric fields
      if (['commandType', 'segmentationTypeId', 'upidType', 'duration'].includes(condition.field)) {
        // For 'in' and 'not_in' operators, validate comma-separated list
        if (condition.operator === 'in' || condition.operator === 'not_in') {
          const values = String(condition.value).split(',').map(v => v.trim());
          values.forEach((val, valIdx) => {
            const num = Number(val);
            if (isNaN(num)) {
              errors.push({ message: `Condition ${index + 1}: Value ${valIdx + 1} ("${val}") must be a number` });
            }
            if (['commandType', 'segmentationTypeId', 'upidType'].includes(condition.field) && (num < 0 || num > 255)) {
              errors.push({ message: `Condition ${index + 1}: Value ${valIdx + 1} must be between 0 and 255` });
            }
          });
        } else {
          // Single value validation
          const num = Number(condition.value);
          if (isNaN(num)) {
            errors.push({ message: `Condition ${index + 1}: Value must be a number` });
          }
          if (['commandType', 'segmentationTypeId', 'upidType'].includes(condition.field) && (num < 0 || num > 255)) {
            errors.push({ message: `Condition ${index + 1}: Value must be between 0 and 255` });
          }
          if (condition.field === 'duration' && num < 0) {
            errors.push({ message: `Condition ${index + 1}: Duration must be positive` });
          }
        }
      }

      // Validate range format
      if (condition.operator === 'range' && typeof condition.value === 'string' && !condition.value.includes('-')) {
        errors.push({ message: `Condition ${index + 1}: Range format must be "min-max" (e.g., "10-30")` });
      }
    });

    // Validate REPLACE action
    if (rule.action === 'replace') {
      if (!rule.modifications || rule.modifications.length === 0) {
        warnings.push({ message: 'REPLACE action without modifications will act as NOOP' });
      } else {
        rule.modifications.forEach((mod, index) => {
          if (mod.operation === 'set' && (mod.value === undefined || mod.value === null || mod.value === '')) {
            errors.push({ message: `Modification ${index + 1}: Value is required for Set operation` });
          }

          // Validate numeric fields
          if (['ptsAdjustment', 'breakDuration', 'segmentationDuration', 'segmentationTypeId', 'upidType', 'deviceRestrictions'].includes(mod.target)) {
            const num = Number(mod.value);
            if (isNaN(num)) {
              errors.push({ message: `Modification ${index + 1}: Value must be a number` });
            }
            if (mod.target === 'ptsAdjustment' && (num < 0 || num > 8589934591)) {
              errors.push({ message: `Modification ${index + 1}: PTS adjustment must be between 0 and 8589934591` });
            }
            if (['breakDuration', 'segmentationDuration'].includes(mod.target) && num < 0) {
              errors.push({ message: `Modification ${index + 1}: Duration must be positive` });
            }
            if (['breakDuration', 'segmentationDuration'].includes(mod.target) && num > 49000) {
              errors.push({ message: `Modification ${index + 1}: Duration exceeds maximum (49000 seconds)` });
            }
            if (['segmentationTypeId', 'upidType'].includes(mod.target) && (num < 0 || num > 255)) {
              errors.push({ message: `Modification ${index + 1}: Value must be between 0 and 255` });
            }
            if (mod.target === 'deviceRestrictions' && (num < 0 || num > 3)) {
              errors.push({ message: `Modification ${index + 1}: Device restrictions must be between 0 and 3` });
            }
          }
        });

        // Check for duplicate targets
        const targets = rule.modifications.map(m => m.target);
        const duplicates = targets.filter((t, i) => targets.indexOf(t) !== i);
        if (duplicates.length > 0) {
          warnings.push({ message: `Duplicate modification targets: ${[...new Set(duplicates)].join(', ')}. Only the last one will be applied.` });
        }

        // Check for conflicting durations
        const hasBreakDuration = rule.modifications.some(m => m.target === 'breakDuration');
        const hasSegmentationDuration = rule.modifications.some(m => m.target === 'segmentationDuration');
        if (hasBreakDuration && hasSegmentationDuration) {
          warnings.push({ message: 'Modifying both break_duration and segmentation_duration may cause inconsistencies' });
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  };

  const deleteRule = (ruleId: string) => {
    onChange(normalizedRules.filter((r) => r.ruleId !== ruleId));
  };

  const addCondition = () => {
    if (!editingRule) return;
    setEditingRule({
      ...editingRule,
      conditions: [
        ...editingRule.conditions,
        { field: 'commandType', operator: 'eq', value: '' },
      ],
    });
  };

  return (
    <div className="space-y-4">
      {/* Rules List */}
      {normalizedRules.map((rule, index) => (
        <div key={rule.ruleId} className="border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                <h4 className="font-medium text-gray-900">{rule.name}</h4>
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    rule.action === 'delete'
                      ? 'bg-red-100 text-red-800'
                      : rule.action === 'replace'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-green-100 text-green-800'
                  }`}
                >
                  {rule.action.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-gray-600">
                {rule.conditions.length} condition(s) • Priority: {rule.priority}
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setEditingRule(JSON.parse(JSON.stringify(rule)))}
                className="text-primary-600 hover:text-primary-800 text-sm"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => deleteRule(rule.ruleId)}
                className="text-red-600 hover:text-red-800 text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Add Rule Button */}
      {!editingRule && (
        <button
          type="button"
          onClick={addRule}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-primary-500 hover:text-primary-600 transition"
        >
          + Add Rule
        </button>
      )}

      {/* Rule Editor Modal */}
      {editingRule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {normalizedRules.find((r) => r.ruleId === editingRule.ruleId) ? 'Edit Rule' : 'New Rule'}
              </h3>

              <div className="space-y-4">
                {/* Rule Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name</label>
                  <input
                    type="text"
                    value={editingRule.name}
                    onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <input
                    type="number"
                    value={editingRule.priority}
                    onChange={(e) =>
                      setEditingRule({ ...editingRule, priority: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">Lower number = higher priority</p>
                </div>

                {/* Action Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                  <select
                    value={editingRule.action}
                    onChange={(e) => {
                      const actionType = e.target.value as 'delete' | 'noop' | 'replace';
                      setEditingRule({
                        ...editingRule,
                        action: actionType,
                        modifications: actionType === 'replace' ? editingRule.modifications : [],
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="delete">DELETE</option>
                    <option value="noop">NOOP</option>
                    <option value="replace">REPLACE</option>
                  </select>
                </div>

                {/* Modifications (only for REPLACE action) */}
                {editingRule.action === 'replace' && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Modifications
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRule({
                            ...editingRule,
                            modifications: [
                              ...editingRule.modifications,
                              { target: 'ptsAdjustment', operation: 'set', value: '' },
                            ],
                          });
                        }}
                        className="text-sm text-primary-600 hover:text-primary-800"
                      >
                        + Add Modification
                      </button>
                    </div>

                    {editingRule.modifications.length === 0 && (
                      <p className="text-sm text-gray-500 italic mb-2">
                        No modifications. Add at least one modification to modify the SCTE-35 signal.
                      </p>
                    )}

                    {editingRule.modifications.map((mod, idx) => (
                      <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-2">
                        <div className="flex items-start space-x-2">
                          <div className="flex-1 space-y-2">
                            {/* Target Field */}
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Field
                              </label>
                              <select
                                value={mod.target}
                                onChange={(e) => {
                                  const updated = [...editingRule.modifications];
                                  updated[idx].target = e.target.value;
                                  setEditingRule({
                                    ...editingRule,
                                    modifications: updated,
                                  });
                                }}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                              >
                                <optgroup label="Info Section">
                                  <option value="ptsAdjustment">PTS Adjustment</option>
                                </optgroup>
                                <optgroup label="Splice Insert Command">
                                  <option value="breakDuration">Break Duration</option>
                                  <option value="availNum">Avail Number</option>
                                  <option value="availExpected">Avails Expected</option>
                                </optgroup>
                                <optgroup label="Segmentation Descriptor">
                                  <option value="segmentationDuration">Segmentation Duration</option>
                                  <option value="segmentationTypeId">Segmentation Type ID</option>
                                  <option value="upidType">UPID Type</option>
                                  <option value="upidValue">UPID Value</option>
                                  <option value="webDeliveryAllowed">Web Delivery Allowed</option>
                                  <option value="noRegionalBlackout">No Regional Blackout</option>
                                  <option value="archiveAllowed">Archive Allowed</option>
                                  <option value="deviceRestrictions">Device Restrictions</option>
                                </optgroup>
                              </select>
                            </div>

                            {/* Operation */}
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Operation
                              </label>
                              <select
                                value={mod.operation}
                                onChange={(e) => {
                                  const updated = [...editingRule.modifications];
                                  updated[idx].operation = e.target.value;
                                  setEditingRule({
                                    ...editingRule,
                                    modifications: updated,
                                  });
                                }}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                              >
                                <option value="set">Set (Replace)</option>
                                <option value="add">Add (Increment)</option>
                                <option value="remove">Remove (Decrement)</option>
                              </select>
                            </div>

                            {/* Value */}
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Value
                                {['breakDuration', 'segmentationDuration'].includes(mod.target) && (
                                  <span className="text-gray-500 font-normal ml-1">(seconds)</span>
                                )}
                              </label>
                              <input
                                type={
                                  ['webDeliveryAllowed', 'noRegionalBlackout', 'archiveAllowed'].includes(mod.target)
                                    ? 'checkbox'
                                    : 'text'
                                }
                                checked={
                                  ['webDeliveryAllowed', 'noRegionalBlackout', 'archiveAllowed'].includes(mod.target)
                                    ? mod.value === true || mod.value === 'true'
                                    : undefined
                                }
                                value={
                                  ['webDeliveryAllowed', 'noRegionalBlackout', 'archiveAllowed'].includes(mod.target)
                                    ? undefined
                                    : mod.value
                                }
                                onChange={(e) => {
                                  const updated = [...editingRule.modifications];
                                  if (['webDeliveryAllowed', 'noRegionalBlackout', 'archiveAllowed'].includes(mod.target)) {
                                    updated[idx].value = e.target.checked;
                                  } else {
                                    updated[idx].value = e.target.value;
                                  }
                                  setEditingRule({
                                    ...editingRule,
                                    modifications: updated,
                                  });
                                }}
                                className={
                                  ['webDeliveryAllowed', 'noRegionalBlackout', 'archiveAllowed'].includes(mod.target)
                                    ? 'h-4 w-4 text-primary-600 border-gray-300 rounded'
                                    : 'w-full px-2 py-1.5 border border-gray-300 rounded text-sm'
                                }
                                placeholder={
                                  ['breakDuration', 'segmentationDuration'].includes(mod.target)
                                    ? 'e.g., 60'
                                    : mod.target === 'segmentationTypeId'
                                    ? 'e.g., 52 (Provider Ad Start)'
                                    : 'Value'
                                }
                              />
                            </div>
                          </div>

                          {/* Remove Button */}
                          <button
                            type="button"
                            onClick={() => {
                              const updated = editingRule.modifications.filter((_, i) => i !== idx);
                              setEditingRule({
                                ...editingRule,
                                modifications: updated,
                              });
                            }}
                            className="text-red-600 hover:text-red-800 px-2 mt-5"
                            title="Remove modification"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Conditions */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">Conditions</label>
                    <button
                      type="button"
                      onClick={addCondition}
                      className="text-sm text-primary-600 hover:text-primary-800"
                    >
                      + Add Condition
                    </button>
                  </div>

                  {editingRule.conditions.map((condition, idx) => (
                    <div key={idx} className="flex space-x-2 mb-2">
                      <select
                        value={condition.field}
                        onChange={(e) => {
                          const updated = [...editingRule.conditions];
                          updated[idx].field = e.target.value;
                          setEditingRule({ ...editingRule, conditions: updated });
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="commandType">Command Type</option>
                        <option value="segmentationTypeId">Segmentation Type ID</option>
                        <option value="upidType">UPID Type</option>
                        <option value="eventId">Event ID</option>
                        <option value="duration">Duration</option>
                      </select>

                      <select
                        value={condition.operator}
                        onChange={(e) => {
                          const updated = [...editingRule.conditions];
                          updated[idx].operator = e.target.value;
                          setEditingRule({ ...editingRule, conditions: updated });
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="eq">=</option>
                        <option value="ne">!=</option>
                        <option value="gt">&gt;</option>
                        <option value="lt">&lt;</option>
                        <option value="range">Range</option>
                        <option value="in">In List</option>
                        <option value="not_in">Not In List</option>
                      </select>

                      <input
                        type="text"
                        value={condition.value}
                        onChange={(e) => {
                          const updated = [...editingRule.conditions];
                          updated[idx].value = e.target.value;
                          setEditingRule({ ...editingRule, conditions: updated });
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder={
                          condition.operator === 'range'
                            ? 'e.g., 10-30'
                            : condition.operator === 'in' || condition.operator === 'not_in'
                            ? 'e.g., 52,54,56'
                            : 'Value'
                        }
                      />

                      <button
                        type="button"
                        onClick={() => {
                          const updated = editingRule.conditions.filter((_, i) => i !== idx);
                          setEditingRule({ ...editingRule, conditions: updated });
                        }}
                        className="text-red-600 hover:text-red-800 px-2"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                {/* External Actions Section */}
                <div className="pt-4 border-t border-gray-300 mt-6">
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 rounded-lg p-4 mb-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">⚡</span>
                      <div>
                        <p className="text-base font-semibold text-blue-900">
                          External Actions
                        </p>
                        <p className="text-xs text-blue-700 mt-0.5">
                          Trigger external API calls (MediaLive, Webhooks) when this rule matches
                        </p>
                      </div>
                    </div>
                  </div>
                  <ExternalActionsPanel
                    actions={editingRule.externalActions || []}
                    onChange={(actions) => {
                      console.log('External actions changed:', actions);
                      setEditingRule({ ...editingRule, externalActions: actions });
                    }}
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setEditingRule(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveRule}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Save Rule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText="Continue"
        cancelText="Cancel"
      />
    </div>
  );
}
