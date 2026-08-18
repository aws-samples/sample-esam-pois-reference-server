// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React from 'react';
import { Home } from '../content/Home';
import { QuickStart } from '../content/QuickStart';
import { HowToCreateChannel } from '../content/HowToCreateChannel';
import { APIOverview } from '../content/APIOverview';
import { ESAMEndpoint } from '../content/ESAMEndpoint';
import { ChannelsAPI } from '../content/ChannelsAPI';
import { LogsAPI } from '../content/LogsAPI';
import { DescriptorPriority } from '../content/DescriptorPriority';
import { StatefulMode } from '../content/StatefulMode';
import { ExternalActions } from '../content/ExternalActions';
import { VirtualInputSwitching } from '../content/VirtualInputSwitching';
import { ESAMLogs } from '../content/ESAMLogs';
import { EnvironmentVariables, DynamoDBConfig, CloudWatchConfig } from '../content/Configuration';
import { Authentication } from '../content/Authentication';
import { Metrics, Alarms, LogsMonitoring } from '../content/Monitoring';
import { Troubleshooting } from '../content/Troubleshooting';
import { ChannelConfiguration } from '../content/ChannelConfiguration';
import CorrelationTracking from '../content/CorrelationTracking';

interface ContentRendererProps {
  section: string;
}

export const ContentRenderer: React.FC<ContentRendererProps> = ({ section }) => {
  const renderContent = () => {
    switch (section) {
      case 'home':
        return <Home />;
      // Getting Started
      case 'getting-started':
        return <QuickStart />;
      case 'quick-start':
        return <QuickStart />;
      case 'how-to-create-channel':
        return <HowToCreateChannel />;
      case 'configuration':
        return <ChannelConfiguration />;
      // API Reference
      case 'api':
        return <APIOverview />;
      case 'api-overview':
        return <APIOverview />;
      case 'api-esam':
        return <ESAMEndpoint />;
      case 'api-channels':
        return <ChannelsAPI />;
      case 'api-logs':
        return <LogsAPI />;
      // Features
      case 'features':
        return <DescriptorPriority />;
      case 'descriptor-priority':
        return <DescriptorPriority />;
      case 'stateful-mode':
        return <StatefulMode />;
      case 'external-actions':
        return <ExternalActions />;
      case 'virtual-input-switching':
        return <VirtualInputSwitching />;
      case 'esam-logs':
        return <ESAMLogs />;
      case 'correlation-tracking':
        return <CorrelationTracking />;
      // Configuration
      case 'config':
        return <EnvironmentVariables />;
      case 'environment':
        return <EnvironmentVariables />;
      case 'authentication':
        return <Authentication />;
      case 'dynamodb':
        return <DynamoDBConfig />;
      case 'cloudwatch':
        return <CloudWatchConfig />;
      // Monitoring
      case 'monitoring':
        return <Metrics />;
      case 'metrics':
        return <Metrics />;
      case 'alarms':
        return <Alarms />;
      case 'logs':
        return <LogsMonitoring />;
      // Troubleshooting
      case 'troubleshooting':
        return <Troubleshooting />;
      default:
        return (
          <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Coming Soon
            </h2>
            <p className="text-slate-600">
              This section is under development. Full content will be available soon.
            </p>
          </div>
        );
    }
  };

  return <div className="animate-fadeIn">{renderContent()}</div>;
};
