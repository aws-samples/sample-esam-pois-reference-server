// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';

export interface EnvironmentConfig {
  envName: string;
  awsEnv: cdk.Environment;
  logRetentionDays: number;
  enableDetailedLogging: boolean;
  enableXRayTracing: boolean;
  apiThrottleRateLimit: number;
  apiThrottleBurstLimit: number;
}

const environments: Record<string, EnvironmentConfig> = {
  dev: {
    envName: 'dev',
    awsEnv: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
    },
    logRetentionDays: 7,
    enableDetailedLogging: true,
    enableXRayTracing: true,
    apiThrottleRateLimit: 100,
    apiThrottleBurstLimit: 200,
  },
  staging: {
    envName: 'staging',
    awsEnv: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
    },
    logRetentionDays: 14,
    enableDetailedLogging: true,
    enableXRayTracing: true,
    apiThrottleRateLimit: 500,
    apiThrottleBurstLimit: 1000,
  },
  prod: {
    envName: 'prod',
    awsEnv: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
    },
    logRetentionDays: 30,
    enableDetailedLogging: false,
    enableXRayTracing: true,
    apiThrottleRateLimit: 1000,
    apiThrottleBurstLimit: 2000,
  },
};

export function getEnvironmentConfig(envName: string): EnvironmentConfig {
  const config = environments[envName];
  if (!config) {
    throw new Error(
      `Unknown environment: ${envName}. Valid environments: ${Object.keys(environments).join(', ')}`
    );
  }
  return config;
}
