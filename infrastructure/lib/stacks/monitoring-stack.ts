// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Construct } from 'constructs';

export interface MonitoringStackProps extends cdk.StackProps {
  apiGateway: apigateway.RestApi;
  lambdaFunctions: lambda.Function[];
  table: dynamodb.Table;
}

export class MonitoringStack extends cdk.Stack {
  public readonly dashboard: cloudwatch.Dashboard;
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    // SNS topic for alarms
    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName: `${id}-alarms`,
      displayName: 'POIS Monitoring Alarms',
    });

    // CloudWatch Dashboard
    // Dashboard names are account-global (the CloudWatch dashboard list is
    // shared across regions), so include the region to avoid collisions when
    // the sample is deployed to more than one region in the same account.
    this.dashboard = new cloudwatch.Dashboard(this, 'POISDashboard', {
      dashboardName: `${id}-${cdk.Stack.of(this).region}-dashboard`,
    });

    // API Gateway metrics
    const apiRequestsMetric = props.apiGateway.metricCount({
      period: cdk.Duration.minutes(5),
      statistic: 'Sum',
    });

    const api4xxMetric = props.apiGateway.metricClientError({
      period: cdk.Duration.minutes(5),
      statistic: 'Sum',
    });

    const api5xxMetric = props.apiGateway.metricServerError({
      period: cdk.Duration.minutes(5),
      statistic: 'Sum',
    });

    const apiLatencyMetric = props.apiGateway.metricLatency({
      period: cdk.Duration.minutes(5),
      statistic: 'Average',
    });

    // Add API widgets to dashboard
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Requests',
        left: [apiRequestsMetric],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Errors',
        left: [api4xxMetric, api5xxMetric],
        width: 12,
      })
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Latency (ms)',
        left: [apiLatencyMetric],
        width: 24,
      })
    );

    // Lambda metrics
    const lambdaWidgets: cloudwatch.IWidget[] = [];
    props.lambdaFunctions.forEach((fn) => {
      const errorMetric = fn.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      });

      const durationMetric = fn.metricDuration({
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      });

      lambdaWidgets.push(
        new cloudwatch.GraphWidget({
          title: `${fn.functionName} - Errors`,
          left: [errorMetric],
          width: 12,
        })
      );

      lambdaWidgets.push(
        new cloudwatch.GraphWidget({
          title: `${fn.functionName} - Duration`,
          left: [durationMetric],
          width: 12,
        })
      );

      // Alarm for Lambda errors
      const errorAlarm = new cloudwatch.Alarm(this, `${fn.node.id}ErrorAlarm`, {
        alarmName: `${fn.functionName}-errors`,
        metric: errorMetric,
        threshold: 5,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      errorAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));
    });

    this.dashboard.addWidgets(...lambdaWidgets);

    // DynamoDB metrics
    const readCapacityMetric = props.table.metricConsumedReadCapacityUnits({
      period: cdk.Duration.minutes(5),
      statistic: 'Sum',
    });

    const writeCapacityMetric = props.table.metricConsumedWriteCapacityUnits({
      period: cdk.Duration.minutes(5),
      statistic: 'Sum',
    });

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'DynamoDB Read Capacity',
        left: [readCapacityMetric],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'DynamoDB Write Capacity',
        left: [writeCapacityMetric],
        width: 12,
      })
    );

    // Alarm for API 5xx errors
    const api5xxAlarm = new cloudwatch.Alarm(this, 'Api5xxAlarm', {
      alarmName: `${id}-api-5xx-errors`,
      metric: api5xxMetric,
      threshold: 10,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    api5xxAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));

    // Outputs
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
    });

    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: this.alarmTopic.topicArn,
      description: 'SNS topic ARN for alarms',
      exportName: `${id}-alarm-topic-arn`,
    });
  }
}
