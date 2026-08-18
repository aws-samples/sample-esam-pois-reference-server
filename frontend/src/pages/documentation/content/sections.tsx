// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Home, BookOpen, Code, Layers, Settings, Activity, AlertCircle } from 'lucide-react';

export const sections = [
  {
    id: 'home',
    title: 'Home',
    icon: <Home className="w-4 h-4" />
  },
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: <BookOpen className="w-4 h-4" />,
    items: [
      { id: 'quick-start', title: 'Quick Start' },
      { id: 'how-to-create-channel', title: 'How to Create a Channel' },
      { id: 'configuration', title: 'Configuration' }
    ]
  },
  {
    id: 'api',
    title: 'API Reference',
    icon: <Code className="w-4 h-4" />,
    items: [
      { id: 'api-overview', title: 'Overview' },
      { id: 'api-esam', title: 'ESAM Endpoint' },
      { id: 'api-channels', title: 'Channels' },
      { id: 'api-logs', title: 'Logs' }
    ]
  },
  {
    id: 'features',
    title: 'Features',
    icon: <Layers className="w-4 h-4" />,
    items: [
      { id: 'descriptor-priority', title: 'Descriptor Priority' },
      { id: 'stateful-mode', title: 'Stateful Mode' },
      { id: 'external-actions', title: 'External Actions' },
      { id: 'virtual-input-switching', title: 'Virtual Input Switching' },
      { id: 'esam-logs', title: 'ESAM Logs' },
      { id: 'correlation-tracking', title: 'Correlation & Tracking' }
    ]
  },
  {
    id: 'config',
    title: 'Configuration',
    icon: <Settings className="w-4 h-4" />,
    items: [
      { id: 'environment', title: 'Environment Variables' },
      { id: 'authentication', title: 'Authentication' },
      { id: 'dynamodb', title: 'DynamoDB' },
      { id: 'cloudwatch', title: 'CloudWatch' }
    ]
  },
  {
    id: 'monitoring',
    title: 'Monitoring',
    icon: <Activity className="w-4 h-4" />,
    items: [
      { id: 'metrics', title: 'Metrics' },
      { id: 'logs', title: 'Logs' },
      { id: 'alarms', title: 'Alarms' }
    ]
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    icon: <AlertCircle className="w-4 h-4" />
  }
];
