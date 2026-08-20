// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

export interface ChannelCredentialPurgeProps {
  /**
   * Parameter Store prefix holding this environment's encoder passwords.
   *
   * Must be environment-scoped: every parameter below it is deleted when the
   * stack is destroyed.
   */
  readonly parameterPrefix: string;
  readonly logRetention: logs.RetentionDays;
}

/**
 * Deletes this environment's encoder credentials when the stack is destroyed.
 *
 * The channel API creates those SecureStrings at runtime, so CloudFormation
 * never owns them and `cdk destroy` cannot see them. Deleting a channel removes
 * its own parameter, but destroying the stacks while channels still exist would
 * otherwise leave secrets in the account and rely on the operator remembering to
 * remove them.
 *
 * The custom resource is inert on create and update: its only work happens on
 * delete.
 */
export class ChannelCredentialPurge extends Construct {
  constructor(scope: Construct, id: string, props: ChannelCredentialPurgeProps) {
    super(scope, id);

    const prefix = props.parameterPrefix.replace(/\/+$/, '');
    if (!prefix.startsWith('/')) {
      throw new Error(`parameterPrefix must be an absolute SSM path, got "${prefix}"`);
    }

    const stack = cdk.Stack.of(this);
    const parameterArn = stack.formatArn({
      service: 'ssm',
      resource: 'parameter',
      resourceName: `${prefix.replace(/^\//, '')}/*`,
    });

    const onEvent = new lambda.Function(this, 'OnEvent', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      description: "Deletes this environment's encoder credentials on stack deletion",
      logRetention: props.logRetention,
      environment: {
        PARAMETER_PREFIX: prefix,
      },
      code: lambda.Code.fromInline(`
import logging
import os

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

PHYSICAL_ID = "pois-channel-credential-purge"
# DeleteParameters accepts at most 10 names per call.
BATCH_SIZE = 10


def handler(event, context):
    """Delete the encoder credentials under PARAMETER_PREFIX on stack deletion."""
    request_type = event.get("RequestType")
    if request_type != "Delete":
        logger.info("No action required for %s", request_type)
        return {"PhysicalResourceId": PHYSICAL_ID}

    prefix = os.environ["PARAMETER_PREFIX"]
    ssm = boto3.client("ssm")

    names = []
    for page in ssm.get_paginator("get_parameters_by_path").paginate(
        Path=prefix, Recursive=True
    ):
        names.extend(parameter["Name"] for parameter in page["Parameters"])

    logger.info("Found %d parameter(s) under %s", len(names), prefix)

    deleted, failed = 0, []
    for start in range(0, len(names), BATCH_SIZE):
        batch = names[start : start + BATCH_SIZE]
        try:
            response = ssm.delete_parameters(Names=batch)
            deleted += len(response.get("DeletedParameters", []))
            failed.extend(response.get("InvalidParameters", []))
        except Exception as error:
            # Cleanup must never block the stack deletion, or the stack is left
            # in DELETE_FAILED, which is worse than a leftover parameter.
            logger.error("Failed to delete %s: %s", batch, error)
            failed.extend(batch)

    if failed:
        logger.error("Not deleted, remove manually: %s", failed)

    logger.info("Deleted %d parameter(s) under %s", deleted, prefix)
    return {
        "PhysicalResourceId": PHYSICAL_ID,
        "Data": {"Deleted": deleted, "Failed": len(failed)},
    }
`),
    });

    onEvent.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ssm:GetParametersByPath', 'ssm:DeleteParameters'],
        resources: [parameterArn],
      })
    );

    const provider = new cr.Provider(this, 'Provider', {
      onEventHandler: onEvent,
      logRetention: props.logRetention,
    });

    new cdk.CustomResource(this, 'Resource', {
      serviceToken: provider.serviceToken,
      resourceType: 'Custom::ChannelCredentialPurge',
      properties: {
        // Recreates the resource if the prefix changes, so a renamed prefix
        // does not leave the old one unmanaged.
        ParameterPrefix: prefix,
      },
    });
  }
}
