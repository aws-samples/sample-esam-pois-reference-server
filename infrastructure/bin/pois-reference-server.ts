#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DatabaseStack } from '../lib/stacks/database-stack';
import { AuthStack } from '../lib/stacks/auth-stack';
import { ApiStack } from '../lib/stacks/api-stack';
import { FrontendStack } from '../lib/stacks/frontend-stack';
import { MonitoringStack } from '../lib/stacks/monitoring-stack';
import { getEnvironmentConfig } from '../lib/config/environment';

const app = new cdk.App();

// Get environment from context or default to 'dev'
const envName = app.node.tryGetContext('env') || 'dev';
const config = getEnvironmentConfig(envName);

// Optional: MediaLive channel ARNs the signal processor may update through the
// MediaLive external-action plugin. Comma-separated, for example:
//   -c mediaLiveChannelArns=arn:aws:medialive:us-east-1:111122223333:channel:1234567
const mediaLiveChannelArns = String(app.node.tryGetContext('mediaLiveChannelArns') || '')
  .split(',')
  .map((arn) => arn.trim())
  .filter((arn) => arn.length > 0);

// Stack naming convention: pois-reference-server-{env}-{component}
const stackPrefix = `pois-reference-server-${envName}`;

// Database Stack - DynamoDB tables
const databaseStack = new DatabaseStack(app, `${stackPrefix}-database`, {
  env: config.awsEnv,
  description: `POIS Reference Server ${envName} - Database`,
  tags: {
    Environment: envName,
    Project: 'POIS-Reference-Server',
    ManagedBy: 'CDK',
  },
});

// Auth Stack - Cognito + User Management
const authStack = new AuthStack(app, `${stackPrefix}-auth`, {
  env: config.awsEnv,
  description: `POIS Reference Server ${envName} - Authentication`,
  tags: {
    Environment: envName,
    Project: 'POIS-Reference-Server',
    ManagedBy: 'CDK',
  },
});

// API Stack - Lambda functions + API Gateway
const apiStack = new ApiStack(app, `${stackPrefix}-api`, {
  env: config.awsEnv,
  description: `POIS Reference Server ${envName} - API`,
  table: databaseStack.table,
  preferencesTable: authStack.preferencesTable,
  userPool: authStack.userPool,
  userPoolClientId: authStack.userPoolClient.userPoolClientId,
  logRetentionDays: config.logRetentionDays,
  enableDetailedLogging: config.enableDetailedLogging,
  enableXRayTracing: config.enableXRayTracing,
  apiThrottleRateLimit: config.apiThrottleRateLimit,
  apiThrottleBurstLimit: config.apiThrottleBurstLimit,
  mediaLiveChannelArns,
  tags: {
    Environment: envName,
    Project: 'POIS-Reference-Server',
    ManagedBy: 'CDK',
  },
});

apiStack.addDependency(authStack);

// Frontend Stack - S3 + CloudFront
new FrontendStack(app, `${stackPrefix}-frontend`, {
  env: config.awsEnv,
  description: `POIS Reference Server ${envName} - Frontend`,
  apiUrl: apiStack.apiUrl,
  userPool: authStack.userPool,
  frontendUrlParamName: authStack.frontendUrlParamName,
  tags: {
    Environment: envName,
    Project: 'POIS-Reference-Server',
    ManagedBy: 'CDK',
  },
});

// Monitoring Stack - CloudWatch dashboards + alarms
new MonitoringStack(app, `${stackPrefix}-monitoring`, {
  env: config.awsEnv,
  description: `POIS Reference Server ${envName} - Monitoring`,
  apiGateway: apiStack.api,
  lambdaFunctions: apiStack.lambdaFunctions,
  table: databaseStack.table,
  tags: {
    Environment: envName,
    Project: 'POIS-Reference-Server',
    ManagedBy: 'CDK',
  },
});

app.synth();
