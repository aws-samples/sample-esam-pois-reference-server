// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface FrontendStackProps extends cdk.StackProps {
  apiUrl: string;
  userPool?: cognito.IUserPool;
  /** SSM parameter name where this stack publishes the dashboard URL. */
  frontendUrlParamName?: string;
}

export class FrontendStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    // Build frontend automatically during synth
    const frontendDir = path.join(__dirname, '../../../frontend');
    console.log('Building frontend...');
    execSync('npm run build', { cwd: frontendDir, stdio: 'inherit' });

    // S3 bucket for static website hosting.
    // No explicit bucketName: S3 names are GLOBALLY unique, so a fixed name
    // would make every second deployment of this sample fail with
    // "bucket already exists". CloudFormation generates a unique name.
    // DESTROY + autoDeleteObjects keeps the sample's cleanup promise:
    // `cdk destroy` removes everything, including this bucket's contents.
    this.bucket = new s3.Bucket(this, 'FrontendBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // CloudFront distribution with OAC (Origin Access Control).
    // OAC names are account-global (CloudFront is a global service) while
    // stack names repeat across regions, so the name must include the region
    // or a second deployment of this sample in the same account collides.
    const originAccessControl = new cloudfront.S3OriginAccessControl(
      this,
      'FrontendOAC',
      {
        originAccessControlName: `${id}-${cdk.Stack.of(this).region}-oac`,
      }
    );

    // ==========================================================================
    // CloudFront Functions
    //
    // Function names are account-global (CloudFront is a global service), so
    // they include the region to avoid collisions across multi-region deploys.
    // ==========================================================================

    // SPA routing: serve index.html for client-side routes (URIs without a
    // file extension). This replaces distribution-wide 403/404 error-page
    // mappings, which would also rewrite API error responses to index.html.
    const spaRoutingFn = new cloudfront.Function(this, 'SpaRoutingFn', {
      functionName: `${id}-${cdk.Stack.of(this).region}-spa-routing`,
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  if (!request.uri.includes('.')) {
    request.uri = '/index.html';
  }
  return request;
}
`),
    });

    // API proxy: the SPA calls the API at the same origin under /api/*, so no
    // build-time configuration (.env) is needed. This function strips the
    // /api prefix; the originPath below prepends the API Gateway stage.
    const apiRewriteFn = new cloudfront.Function(this, 'ApiRewriteFn', {
      functionName: `${id}-${cdk.Stack.of(this).region}-api-rewrite`,
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  request.uri = request.uri.substring(4); // strip leading '/api'
  if (request.uri === '') {
    request.uri = '/';
  }
  return request;
}
`),
    });

    // Parse the API Gateway domain and stage out of the deploy-time URL token
    // (https://{apiId}.execute-api.{region}.amazonaws.com/{stage}/).
    const apiDomain = cdk.Fn.select(2, cdk.Fn.split('/', props.apiUrl));
    const apiStage = cdk.Fn.select(3, cdk.Fn.split('/', props.apiUrl));

    this.distribution = new cloudfront.Distribution(this, 'FrontendDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket, {
          originAccessControl,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [
          {
            function: spaRoutingFn,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(apiDomain, {
            originPath: `/${apiStage}`,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          // No caching for API responses; forward everything except Host
          // (API Gateway routes on its own hostname).
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          functionAssociations: [
            {
              function: apiRewriteFn,
              eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            },
          ],
        },
      },
      defaultRootObject: 'index.html',
    });

    // Deploy frontend build to S3 + invalidate CloudFront cache
    new s3deploy.BucketDeployment(this, 'DeployFrontend', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../../frontend/dist'))],
      destinationBucket: this.bucket,
      distribution: this.distribution,
      distributionPaths: ['/*'],
    });

    // Publish the dashboard URL where the user pool's CustomMessage trigger
    // reads it at send time, so invitation emails carry a working link.
    let frontendUrlParam: ssm.StringParameter | undefined;
    if (props.frontendUrlParamName) {
      frontendUrlParam = new ssm.StringParameter(this, 'FrontendUrlParam', {
        parameterName: props.frontendUrlParamName,
        stringValue: `https://${this.distribution.distributionDomainName}`,
        description: 'POIS dashboard URL, embedded in Cognito invitation emails',
      });
    }

    // =========================================================================
    // Initial Admin User
    //
    // Self sign-up is disabled, so the first user is provisioned at deploy
    // time: npx cdk deploy --all -c adminEmail=you@example.com
    //
    // The user is created HERE (not in the auth stack) so the CloudFront URL
    // already exists in SSM when Cognito's CustomMessage trigger renders the
    // invitation - the email then carries an "Open the dashboard" button.
    // Cognito emails a temporary password; the login page handles the
    // required password change. No password is generated, stored, or logged
    // by the stacks.
    // =========================================================================
    const adminEmail: string | undefined = this.node.tryGetContext('adminEmail');
    if (adminEmail && props.userPool) {
      const adminUser = new cognito.CfnUserPoolUser(this, 'AdminUser', {
        userPoolId: props.userPool.userPoolId,
        username: adminEmail,
        desiredDeliveryMediums: ['EMAIL'],
        userAttributes: [
          { name: 'email', value: adminEmail },
          { name: 'email_verified', value: 'true' },
          { name: 'name', value: 'Administrator' },
        ],
      });
      adminUser.node.addDependency(this.distribution);
      if (frontendUrlParam) {
        // The URL must be in SSM before Cognito sends the invitation
        adminUser.node.addDependency(frontendUrlParam);
      }

      const adminMembership = new cognito.CfnUserPoolUserToGroupAttachment(
        this,
        'AdminUserGroupMembership',
        {
          userPoolId: props.userPool.userPoolId,
          groupName: 'admin',
          username: adminEmail,
        }
      );
      adminMembership.addDependency(adminUser);
    } else if (!adminEmail) {
      cdk.Annotations.of(this).addWarningV2(
        'pois:missing-admin-email',
        'No admin user will be created (self sign-up is disabled). ' +
          'Deploy with "-c adminEmail=you@example.com" to receive an invitation email, ' +
          'or create a user later with: aws cognito-idp admin-create-user'
      );
    }

    // Outputs
    new cdk.CfnOutput(this, 'BucketName', {
      value: this.bucket.bucketName,
      description: 'Frontend S3 bucket name',
      exportName: `${id}-bucket-name`,
    });

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront distribution domain name',
      exportName: `${id}-distribution-domain`,
    });

    new cdk.CfnOutput(this, 'FrontendUrl', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'Frontend URL',
      exportName: `${id}-frontend-url`,
    });
  }
}
