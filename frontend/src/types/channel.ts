// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

export interface AuthConfig {
  authEnabled: boolean;
  username?: string;
  ssmParameterPath?: string;
}

export interface Channel {
  channelId: string;
  name: string;
  description?: string;
  enabled: boolean;
  defaultAction: 'delete' | 'noop' | 'replace';
  statefulMode: boolean;
  descriptorPriority?: string;
  autoAddDescriptors?: boolean;
  rules: Rule[];
  createdAt: string;
  updatedAt: string;
  // External actions settings
  actionsEnabled?: boolean;
  actionsDryRun?: boolean;
  // Authentication
  authConfig?: AuthConfig;
  // ESAM endpoint (populated by backend)
  esamEndpoint?: string;
}

export interface Rule {
  ruleId: string;
  name: string;
  priority: number;
  enabled: boolean;
  conditions: Condition[];
  action: string; // 'delete', 'noop', or 'replace'
  modifications: Modification[]; // Separate field at rule level
  description?: string;
  // External actions
  externalActions?: ExternalAction[];
  // Alternate content
  altContentIdentity?: string;
  altContentZoneIdentity?: string;
}

export interface Condition {
  field: string;
  operator: string;
  value: string | number | string[];
}

export interface Modification {
  target: string;
  operation: string;
  value?: any;
}

// External Actions Types
export interface ExternalAction {
  actionId: string;
  actionType: 'medialive_schedule_action' | 'webhook';
  target: {
    credentialId?: string;
    username?: string;
    password?: string;
    token?: string;
    [key: string]: any;
  };
  triggerMode: 'on_match' | 'on_no_match' | 'always';
  actionConfig: Record<string, any>;
  cleanupConfig?: {
    triggerTypeId?: number;
    triggerUpid?: string;
    timeoutSeconds?: number;
    [key: string]: any;
  };
  retryConfig: {
    maxRetries: number;
    baseDelaySeconds: number;
  };
  timeoutMs: number;
  enabled: boolean;
  conditions?: any[];
  order: number;
  blocking: boolean;
}

export interface MediaLiveActionConfig {
  channelId: string;
  region: string;
  scheduleActionType: 
    | 'static_image_activate'
    | 'static_image_deactivate'
    | 'motion_graphics_activate'
    | 'motion_graphics_deactivate'
    | 'input_switch'
    | 'scte35_splice_insert'
    | 'scte35_time_signal'
    | 'pause_state';
  actionSettings: Record<string, any>;
}

export interface WebhookActionConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  bodyTemplate?: string;
  authType?: 'none' | 'basic' | 'bearer';
  verifySsl?: boolean;
}
