// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';
import { buildPythonLayer } from '../utils/python-layer';
import { buildPythonHandlerAsset } from '../utils/python-handler';

export interface ApiStackProps extends cdk.StackProps {
  table: dynamodb.Table;
  preferencesTable?: dynamodb.Table;
  userPool?: cognito.IUserPool;
  userPoolClientId?: string;
  logRetentionDays?: number;
  /**
   * Enables API Gateway data trace logging, which writes full request and
   * response payloads (including ESAM XML) to CloudWatch. Useful while
   * developing, but it increases log volume and cost. Defaults to true so the
   * sample stays easy to debug; the `prod` environment profile disables it.
   */
  enableDetailedLogging?: boolean;
  /** Enables AWS X-Ray tracing on the API stage and Lambda functions. */
  enableXRayTracing?: boolean;
  apiThrottleRateLimit?: number;
  apiThrottleBurstLimit?: number;
  /**
   * AWS Elemental MediaLive channel ARNs that the signal processor may update
   * with the MediaLive external-action plugin.
   *
   * The grant is opt-in because the plugin is optional: without it, the
   * processor has no MediaLive permissions at all. Pass channel ARNs at deploy
   * time, for example:
   *
   *   npx cdk deploy --all -c mediaLiveChannelArns=arn:aws:medialive:us-east-1:111122223333:channel:1234567
   *
   * Actions can also target another account by configuring explicit
   * credentials on the action itself, in which case no grant is needed here.
   */
  mediaLiveChannelArns?: string[];
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly apiUrl: string;
  public readonly lambdaFunctions: lambda.Function[];

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    this.lambdaFunctions = [];

    // Log retention from config (default 7 days)
    const logRetention = this._toLogRetention(props.logRetentionDays || 7);

    // Environment-driven observability and throttling settings. Defaults match
    // the `dev` profile in lib/config/environment.ts.
    const detailedLogging = props.enableDetailedLogging ?? true;
    const xRayTracing = props.enableXRayTracing ?? true;
    const throttleRateLimit = props.apiThrottleRateLimit ?? 100;
    const throttleBurstLimit = props.apiThrottleBurstLimit ?? 200;
    const lambdaTracing = xRayTracing
      ? lambda.Tracing.ACTIVE
      : lambda.Tracing.DISABLED;

    // Backend code root used for handler bundling.
    const backendDir = path.join(__dirname, '../../../backend');

    // =========================================================================
    // API Gateway - Create first to get API ID
    // =========================================================================

    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: `${id}-api`,
      description: 'POIS Reference Server API',
      deployOptions: {
        stageName: 'v1',
        tracingEnabled: xRayTracing,
        loggingLevel: detailedLogging
          ? apigateway.MethodLoggingLevel.INFO
          : apigateway.MethodLoggingLevel.ERROR,
        dataTraceEnabled: detailedLogging,
        metricsEnabled: true,
        throttlingBurstLimit: throttleBurstLimit,
        throttlingRateLimit: throttleRateLimit,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Correlation-ID',
        ],
        exposeHeaders: ['X-Correlation-ID'],
      },
    });

    this.apiUrl = this.api.url;

    // Gateway Responses — add CORS headers to 401/403 responses from the
    // Cognito authorizer (which rejects before Lambda runs, so Lambda CORS
    // headers are never set).
    this.api.addGatewayResponse('Unauthorized', {
      type: apigateway.ResponseType.UNAUTHORIZED,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization'",
      },
    });
    this.api.addGatewayResponse('AccessDenied', {
      type: apigateway.ResponseType.ACCESS_DENIED,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization'",
      },
    });

    // =========================================================================
    // Cognito Authorizer
    // =========================================================================

    let cognitoAuthorizer: apigateway.CognitoUserPoolsAuthorizer | undefined;
    if (props.userPool) {
      cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
        cognitoUserPools: [props.userPool],
        authorizerName: `${id}-cognito-authorizer`,
        identitySource: 'method.request.header.Authorization',
      });
    }

    const authMethodOptions: apigateway.MethodOptions = cognitoAuthorizer
      ? {
          authorizer: cognitoAuthorizer,
          authorizationType: apigateway.AuthorizationType.COGNITO,
        }
      : {};

    // =========================================================================
    // Lambda Layers
    //
    // Layers are built reproducibly inside the official AWS SAM Python build
    // image (Linux x86_64) via CDK Docker bundling, so contributors get the
    // correct native binaries regardless of their host OS/arch. The only
    // requirement is a running Docker daemon during `cdk deploy`.
    //
    // Each layer's pip dependencies live in `backend/layers/<name>/requirements.txt`.
    // =========================================================================

    const scte35Layer = buildPythonLayer(
      this,
      'Scte35Layer',
      path.join(__dirname, '../../../backend/layers/scte35'),
      {
        layerVersionName: `${id}-scte35`,
        description: 'SCTE-35 processing library (threefive)',
      }
    );

    const validationLayer = buildPythonLayer(
      this,
      'ValidationLayer',
      path.join(__dirname, '../../../backend/layers/validation'),
      {
        layerVersionName: `${id}-validation-v2`,
        description: 'Data validation library (pydantic + pydantic-core)',
        // pydantic-core ships a native C-extension (Rust .so), so the local
        // bundler must cross-compile to manylinux x86_64.
        hasNativeDeps: true,
      }
    );

    // =========================================================================
    // Lambda Functions
    // =========================================================================

    const signalProcessor = new lambda.Function(this, 'SignalProcessor', {
      functionName: `${id}-signal-processor`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handlers.esam_handler.handler',
      code: buildPythonHandlerAsset(backendDir, ['xmltodict']),
      layers: [scte35Layer, validationLayer],
      environment: {
        CHANNELS_TABLE_NAME: props.table.tableName,
        LOG_LEVEL: 'INFO',
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      description: 'ESAM signal processor',
      tracing: lambdaTracing,
      logRetention: logRetention,
    });

    props.table.grantReadWriteData(signalProcessor);

    // SSM read-only access for ESAM auth credential validation
    signalProcessor.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [`arn:aws:ssm:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:parameter/pois/channels/*`],
    }));

    // Optional MediaLive external actions. Scoped to the channel ARNs supplied
    // at deploy time; the plugin is unusable with the execution role until this
    // grant exists.
    const mediaLiveChannelArns = props.mediaLiveChannelArns?.filter((arn) => arn.length > 0) ?? [];
    if (mediaLiveChannelArns.length > 0) {
      signalProcessor.addToRolePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'medialive:BatchUpdateSchedule',
            'medialive:DescribeSchedule',
          ],
          resources: mediaLiveChannelArns,
        })
      );
    }

    this.lambdaFunctions.push(signalProcessor);

    const channelManager = new lambda.Function(this, 'ChannelManager', {
      functionName: `${id}-channel-manager`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handlers.channel_handler.handler',
      code: buildPythonHandlerAsset(backendDir),
      layers: [validationLayer],
      environment: {
        CHANNELS_TABLE_NAME: props.table.tableName,
        LOG_LEVEL: 'INFO',
        API_ID: this.api.restApiId,
        REGION: cdk.Stack.of(this).region,
        STAGE: 'v1',
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      description: 'Channel configuration management',
      tracing: lambdaTracing,
      logRetention: logRetention,
    });

    props.table.grantReadWriteData(channelManager);

    // SSM full access for credential lifecycle (create, read, delete)
    channelManager.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter', 'ssm:PutParameter', 'ssm:DeleteParameter'],
      resources: [`arn:aws:ssm:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:parameter/pois/channels/*`],
    }));

    this.lambdaFunctions.push(channelManager);

    // Log Source Registry - defines all log groups to query
    const logGroupsConfig = [
      {
        logGroupName: `/aws/lambda/${id}-signal-processor`,
        sourceLabel: 'esam',
        displayName: 'ESAM Signals',
      },
      {
        logGroupName: `/aws/lambda/${id}-channel-manager`,
        sourceLabel: 'channels',
        displayName: 'Channels',
      },
      {
        logGroupName: `/aws/lambda/${id}-user-management`,
        sourceLabel: 'users',
        displayName: 'Users',
      },
      {
        logGroupName: `/aws/lambda/${id}-preferences`,
        sourceLabel: 'settings',
        displayName: 'Settings',
      },
    ];

    const logsQuery = new lambda.Function(this, 'LogsQuery', {
      functionName: `${id}-logs-query`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handlers.logs_handler.handler',
      code: buildPythonHandlerAsset(backendDir),
      layers: [validationLayer],
      environment: {
        ESAM_LOG_GROUP: `/aws/lambda/${id}-signal-processor`,
        LOG_GROUPS_CONFIG: JSON.stringify(logGroupsConfig),
        LOG_LEVEL: 'INFO',
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      description: 'CloudWatch logs query service',
      tracing: lambdaTracing,
      logRetention: logRetention,
    });

    logsQuery.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:FilterLogEvents',
          'logs:DescribeLogStreams',
          'logs:GetLogEvents',
          'logs:StartQuery',
          'logs:GetQueryResults',
        ],
        resources: logGroupsConfig.map(
          (c) => `arn:aws:logs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:log-group:${c.logGroupName}:*`,
        ),
      })
    );

    this.lambdaFunctions.push(logsQuery);

    const externalActionsManager = new lambda.Function(this, 'ExternalActionsManager', {
      functionName: `${id}-external-actions-manager`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handlers.external_actions_handler.lambda_handler',
      code: buildPythonHandlerAsset(backendDir),
      layers: [validationLayer],
      environment: {
        CHANNELS_TABLE_NAME: props.table.tableName,
        LOG_LEVEL: 'INFO',
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      description: 'External actions management API',
      tracing: lambdaTracing,
      logRetention: logRetention,
    });

    props.table.grantReadWriteData(externalActionsManager);
    this.lambdaFunctions.push(externalActionsManager);

    // =========================================================================
    // API Routes
    // =========================================================================

    const esam = this.api.root.addResource('esam');
    esam.addMethod('POST', new apigateway.LambdaIntegration(signalProcessor));

    const channels = this.api.root.addResource('channels');
    channels.addMethod('GET', new apigateway.LambdaIntegration(channelManager), authMethodOptions);
    channels.addMethod('POST', new apigateway.LambdaIntegration(channelManager), authMethodOptions);

    const channel = channels.addResource('{id}');
    channel.addMethod('GET', new apigateway.LambdaIntegration(channelManager), authMethodOptions);
    channel.addMethod('PUT', new apigateway.LambdaIntegration(channelManager), authMethodOptions);
    channel.addMethod('DELETE', new apigateway.LambdaIntegration(channelManager), authMethodOptions);

    const logs = this.api.root.addResource('logs');
    logs.addMethod('GET', new apigateway.LambdaIntegration(logsQuery), authMethodOptions);

    const logSources = logs.addResource('sources');
    logSources.addMethod('GET', new apigateway.LambdaIntegration(logsQuery), authMethodOptions);

    // Auth management routes
    const authResource = channel.addResource('auth');
    const regenerate = authResource.addResource('regenerate');
    regenerate.addMethod('POST', new apigateway.LambdaIntegration(channelManager), authMethodOptions);
    const passwordResource = authResource.addResource('password');
    passwordResource.addMethod('GET', new apigateway.LambdaIntegration(channelManager), authMethodOptions);

    const channelLogs = channel.addResource('logs');
    channelLogs.addMethod('GET', new apigateway.LambdaIntegration(logsQuery), authMethodOptions);

    // External Actions routes
    const rules = channel.addResource('rules');
    const rule = rules.addResource('{ruleId}');
    const actions = rule.addResource('actions');
    actions.addMethod('GET', new apigateway.LambdaIntegration(externalActionsManager), authMethodOptions);
    actions.addMethod('POST', new apigateway.LambdaIntegration(externalActionsManager), authMethodOptions);

    const action = actions.addResource('{actionId}');
    action.addMethod('PUT', new apigateway.LambdaIntegration(externalActionsManager), authMethodOptions);
    action.addMethod('DELETE', new apigateway.LambdaIntegration(externalActionsManager), authMethodOptions);

    const validateAction = action.addResource('validate');
    validateAction.addMethod('POST', new apigateway.LambdaIntegration(externalActionsManager), authMethodOptions);

    // Action templates
    const actionsRoot = this.api.root.addResource('actions');
    const templates = actionsRoot.addResource('templates');
    templates.addMethod('GET', new apigateway.LambdaIntegration(externalActionsManager), authMethodOptions);

    // Action audit logs
    const actionLogs = channel.addResource('actions').addResource('logs');
    actionLogs.addMethod('GET', new apigateway.LambdaIntegration(externalActionsManager), authMethodOptions);
    
    const actionLogEntry = actionLogs.addResource('{entryId}');
    actionLogEntry.addMethod('GET', new apigateway.LambdaIntegration(externalActionsManager), authMethodOptions);

    // =========================================================================
    // Preferences Lambda
    // =========================================================================

    const preferencesHandler = new lambda.Function(this, 'PreferencesHandler', {
      functionName: `${id}-preferences`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handlers.preferences_handler.handler',
      code: buildPythonHandlerAsset(backendDir),
      layers: [validationLayer],
      environment: {
        PREFERENCES_TABLE_NAME: props.preferencesTable?.tableName || `${id}-preferences`,
        // Used to build the default apiUrl/esamEndpoint shown in the
        // Settings > ESAM tab before any custom values are saved.
        API_ID: this.api.restApiId,
        API_STAGE: 'v1',
        ESAM_LOG_GROUP: `/aws/lambda/${id}-signal-processor`,
        LOG_LEVEL: 'INFO',
      },
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      description: 'User preferences and system defaults',
      tracing: lambdaTracing,
      logRetention: logRetention,
    });

    if (props.preferencesTable) {
      props.preferencesTable.grantReadWriteData(preferencesHandler);
    }

    // Allow preferences handler to update CloudWatch log retention
    preferencesHandler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['logs:PutRetentionPolicy', 'logs:DescribeLogGroups'],
        resources: [`arn:aws:logs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:log-group:*`],
      })
    );

    this.lambdaFunctions.push(preferencesHandler);

    // Preferences API routes
    const preferences = this.api.root.addResource('preferences');
    const defaults = preferences.addResource('defaults');
    defaults.addMethod('GET', new apigateway.LambdaIntegration(preferencesHandler), authMethodOptions);
    defaults.addMethod('PUT', new apigateway.LambdaIntegration(preferencesHandler), authMethodOptions);

    // =========================================================================
    // Auth Config Lambda
    // =========================================================================

    const authConfigHandler = new lambda.Function(this, 'AuthConfigHandler', {
      functionName: `${id}-auth-config`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handlers.auth_config_handler.handler',
      code: buildPythonHandlerAsset(backendDir),
      environment: {
        USER_POOL_ID: props.userPool?.userPoolId || '',
        USER_POOL_CLIENT_ID: props.userPoolClientId || '',
        REGION: cdk.Stack.of(this).region,
        LOG_LEVEL: 'INFO',
      },
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      description: 'Auth configuration endpoint',
      tracing: lambdaTracing,
      logRetention: logRetention,
    });

    this.lambdaFunctions.push(authConfigHandler);

    // Auth config route (unauthenticated)
    const auth = this.api.root.addResource('auth');
    const config = auth.addResource('config');
    config.addMethod('GET', new apigateway.LambdaIntegration(authConfigHandler));

    // =========================================================================
    // User Management Lambda
    // =========================================================================

    const userManagementHandler = new lambda.Function(this, 'UserManagementHandler', {
      functionName: `${id}-user-management`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handlers.user_management_handler.handler',
      code: buildPythonHandlerAsset(backendDir),
      environment: {
        USER_POOL_ID: props.userPool?.userPoolId || '',
        LOG_LEVEL: 'INFO',
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      description: 'User management API (admin-only)',
      tracing: lambdaTracing,
      logRetention: logRetention,
    });

    // Grant Cognito admin permissions
    userManagementHandler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminDeleteUser',
          'cognito-idp:AdminDisableUser',
          'cognito-idp:AdminEnableUser',
          'cognito-idp:AdminSetUserPassword',
          'cognito-idp:AdminAddUserToGroup',
          'cognito-idp:AdminRemoveUserFromGroup',
          'cognito-idp:AdminListGroupsForUser',
          'cognito-idp:ListUsers',
          'cognito-idp:ListUsersInGroup',
        ],
        resources: [props.userPool?.userPoolArn || '*'],
      })
    );

    this.lambdaFunctions.push(userManagementHandler);

    // User management API routes
    const users = this.api.root.addResource('users');
    users.addMethod('GET', new apigateway.LambdaIntegration(userManagementHandler), authMethodOptions);
    users.addMethod('POST', new apigateway.LambdaIntegration(userManagementHandler), authMethodOptions);

    const user = users.addResource('{username}');
    user.addMethod('DELETE', new apigateway.LambdaIntegration(userManagementHandler), authMethodOptions);

    const disableUser = user.addResource('disable');
    disableUser.addMethod('POST', new apigateway.LambdaIntegration(userManagementHandler), authMethodOptions);

    const enableUser = user.addResource('enable');
    enableUser.addMethod('POST', new apigateway.LambdaIntegration(userManagementHandler), authMethodOptions);

    const resetPassword = user.addResource('reset-password');
    resetPassword.addMethod('POST', new apigateway.LambdaIntegration(userManagementHandler), authMethodOptions);

    const userGroup = user.addResource('group');
    userGroup.addMethod('PUT', new apigateway.LambdaIntegration(userManagementHandler), authMethodOptions);

    // =========================================================================
    // Outputs
    // =========================================================================

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.apiUrl,
      description: 'API Gateway base URL',
      exportName: `${id}-api-url`,
    });

    new cdk.CfnOutput(this, 'EsamEndpoint', {
      value: `${this.apiUrl}esam`,
      description: 'ESAM endpoint for video encoder integration',
      exportName: `${id}-esam-endpoint`,
    });

    cdk.Tags.of(this).add('Component', 'API');
    cdk.Tags.of(this).add('Service', 'POIS');
  }

  /** Convert days number to CDK RetentionDays enum */
  private _toLogRetention(days: number): logs.RetentionDays {
    const map: Record<number, logs.RetentionDays> = {
      1: logs.RetentionDays.ONE_DAY,
      3: logs.RetentionDays.THREE_DAYS,
      5: logs.RetentionDays.FIVE_DAYS,
      7: logs.RetentionDays.ONE_WEEK,
      14: logs.RetentionDays.TWO_WEEKS,
      30: logs.RetentionDays.ONE_MONTH,
      60: logs.RetentionDays.TWO_MONTHS,
      90: logs.RetentionDays.THREE_MONTHS,
      180: logs.RetentionDays.SIX_MONTHS,
      365: logs.RetentionDays.ONE_YEAR,
    };
    return map[days] || logs.RetentionDays.ONE_WEEK;
  }
}
