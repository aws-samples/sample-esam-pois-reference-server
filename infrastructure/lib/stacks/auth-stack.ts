// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly preferencesTable: dynamodb.Table;
  /** SSM parameter (written by the frontend stack) holding the dashboard URL. */
  public readonly frontendUrlParamName: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // SSM parameter where the frontend stack publishes the dashboard URL
    // (per environment). Read at send time by the CustomMessage trigger.
    const frontendUrlParamName = `/pois/${this.node.tryGetContext('env') || 'dev'}/frontend-url`;

    // =========================================================================
    // Cognito User Pool
    // =========================================================================
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${id}-users`,
      selfSignUpEnabled: false,
      signInAliases: { email: true, username: false },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      // Sample cleanup promise: `cdk destroy` removes everything.
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { sms: false, otp: true },
    });

    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'admin',
      description: 'Administrators - full access',
      precedence: 1,
    });

    new cognito.CfnUserPoolGroup(this, 'UserGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'user',
      description: 'Standard users',
      precedence: 2,
    });

    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: `${id}-web-client`,
      authFlows: { userPassword: true, userSrp: true, adminUserPassword: true },
      generateSecret: false,
      preventUserExistenceErrors: true,
      refreshTokenValidity: cdk.Duration.days(30),
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
    });

    // =========================================================================
    // Preferences Table
    // =========================================================================
    this.preferencesTable = new dynamodb.Table(this, 'PreferencesTable', {
      tableName: `${id}-preferences`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      // Sample cleanup promise: `cdk destroy` removes everything. A RETAINed
      // table would also break redeploys, since the table name is fixed.
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // =========================================================================
    // Invitation Email (CustomMessage trigger)
    //
    // The invitation body is rendered at send time by this trigger, so it can
    // include the dashboard URL. The URL is read from an SSM parameter that
    // the frontend stack writes after creating the CloudFront distribution
    // (a static userInvitation template cannot do this: it is fixed at pool
    // creation, before the distribution exists; and CloudFormation does not
    // reliably forward UserPoolUser ClientMetadata to this trigger).
    // =========================================================================
    const customMessageFn = new lambda.Function(this, 'CustomMessageFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(10),
      environment: {
        FRONTEND_URL_PARAM: frontendUrlParamName,
      },
      description: 'Renders the POIS invitation email (CustomMessage trigger)',
      code: lambda.Code.fromInline(`
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const ssm = new SSMClient({});
let cachedUrl = ''; // only non-empty values are cached

async function getFrontendUrl() {
  if (cachedUrl) return cachedUrl;
  try {
    const resp = await ssm.send(new GetParameterCommand({ Name: process.env.FRONTEND_URL_PARAM }));
    cachedUrl = (resp.Parameter && resp.Parameter.Value) || '';
  } catch {
    // parameter not written yet (frontend stack not deployed) - fall back
  }
  return cachedUrl;
}

exports.handler = async (event) => {
  if (event.triggerSource !== 'CustomMessage_AdminCreateUser') {
    return event; // default messages for every other flow
  }

  const frontendUrl = await getFrontendUrl();
  const username = event.request.usernameParameter;
  const password = event.request.codeParameter;

  const urlBlock = frontendUrl
    ? '<p style="text-align: center; margin: 24px 0;">' +
      '<a href="' + frontendUrl + '" style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 12px 28px; border-radius: 8px;">Open the dashboard</a></p>'
    : '<p style="font-size: 15px; line-height: 1.6;">The dashboard URL is shown in the CloudFormation outputs of your deployment (<code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 13px;">FrontendUrl</code>).</p>';

  event.response.emailSubject = 'Your POIS Reference Server account';
  event.response.emailMessage = [
    '<div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">',
    '  <div style="background: #4f46e5; border-radius: 8px 8px 0 0; padding: 24px 32px;">',
    '    <h1 style="color: #ffffff; font-size: 20px; margin: 0;">POIS Reference Server</h1>',
    '  </div>',
    '  <div style="border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 32px;">',
    '    <p style="font-size: 15px; line-height: 1.6;">Hello,</p>',
    '    <p style="font-size: 15px; line-height: 1.6;">An account has been created for you on the POIS Reference Server dashboard. Use the credentials below to sign in:</p>',
    '    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">',
    '      <tr>',
    '        <td style="padding: 12px 16px; background: #f9fafb; border: 1px solid #e5e7eb; font-size: 13px; color: #6b7280; width: 40%;">Username</td>',
    '        <td style="padding: 12px 16px; background: #f9fafb; border: 1px solid #e5e7eb; font-size: 14px; font-family: monospace;">' + username + '</td>',
    '      </tr>',
    '      <tr>',
    '        <td style="padding: 12px 16px; background: #f9fafb; border: 1px solid #e5e7eb; font-size: 13px; color: #6b7280;">Temporary password</td>',
    '        <td style="padding: 12px 16px; background: #f9fafb; border: 1px solid #e5e7eb; font-size: 14px; font-family: monospace;">' + password + '</td>',
    '      </tr>',
    '    </table>',
    urlBlock,
    '    <p style="font-size: 15px; line-height: 1.6;">You will be asked to choose a permanent password on first sign-in.</p>',
    '    <p style="font-size: 13px; color: #6b7280; line-height: 1.6; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px;">This temporary password expires in 7 days. If it expires, ask an administrator to recreate the account.</p>',
    '  </div>',
    '</div>',
  ].join('\\n');

  return event;
};
      `),
    });

    this.userPool.addTrigger(
      cognito.UserPoolOperation.CUSTOM_MESSAGE,
      customMessageFn
    );

    customMessageFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameter'],
        resources: [
          cdk.Stack.of(this).formatArn({
            service: 'ssm',
            resource: 'parameter',
            resourceName: frontendUrlParamName.replace(/^\//, ''),
          }),
        ],
      })
    );

    this.frontendUrlParamName = frontendUrlParamName;

    // =========================================================================
    // Outputs
    // =========================================================================
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      exportName: `${id}-user-pool-id`,
    });
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      exportName: `${id}-user-pool-client-id`,
    });
    new cdk.CfnOutput(this, 'PreferencesTableName', {
      value: this.preferencesTable.tableName,
      exportName: `${id}-preferences-table`,
    });
  }

}
