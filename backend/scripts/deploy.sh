#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0


# Deploy script for POIS Python backend
# Usage: ./scripts/deploy.sh [dev|prod]

set -e

ENVIRONMENT=${1:-dev}
AWS_PROFILE="dev"
AWS_REGION="us-east-1"

echo "========================================="
echo "POIS Python Backend Deployment"
echo "========================================="
echo "Environment: $ENVIRONMENT"
echo "AWS Profile: $AWS_PROFILE"
echo "AWS Region: $AWS_REGION"
echo ""

# Get AWS Account ID
echo "Getting AWS Account ID..."
ACCOUNT_ID=$(aws sts get-caller-identity --profile $AWS_PROFILE --query Account --output text)
echo "Account ID: $ACCOUNT_ID"
echo ""

# Configuration
STACK_NAME="pois-${ENVIRONMENT}"
TABLE_NAME="${STACK_NAME}-data"
LOG_GROUP="/aws/lambda/${STACK_NAME}-python-esam-handler"

echo "Configuration:"
echo "  Stack Name: $STACK_NAME"
echo "  Table Name: $TABLE_NAME"
echo "  Log Group: $LOG_GROUP"
echo ""

# Step 1: Package everything
echo "========================================="
echo "Step 1: Packaging Lambda functions and layers"
echo "========================================="
chmod +x scripts/package_lambda.sh
./scripts/package_lambda.sh all

if [ $? -ne 0 ]; then
    echo "❌ Packaging failed!"
    exit 1
fi

echo ""

# Step 2: Upload Lambda layers
echo "========================================="
echo "Step 2: Uploading Lambda layers"
echo "========================================="

echo "Uploading threefive layer..."
THREEFIVE_LAYER_ARN=$(aws lambda publish-layer-version \
  --profile $AWS_PROFILE \
  --region $AWS_REGION \
  --layer-name ${STACK_NAME}-python-threefive \
  --description "SCTE-35 processing library (threefive)" \
  --zip-file fileb://dist/layers/layer-threefive.zip \
  --compatible-runtimes python3.12 \
  --query 'LayerVersionArn' \
  --output text)

echo "✓ threefive layer: $THREEFIVE_LAYER_ARN"

echo "Uploading boto3 layer..."
BOTO3_LAYER_ARN=$(aws lambda publish-layer-version \
  --profile $AWS_PROFILE \
  --region $AWS_REGION \
  --layer-name ${STACK_NAME}-python-boto3 \
  --description "AWS SDK (boto3)" \
  --zip-file fileb://dist/layers/layer-boto3.zip \
  --compatible-runtimes python3.12 \
  --query 'LayerVersionArn' \
  --output text)

echo "✓ boto3 layer: $BOTO3_LAYER_ARN"

echo "Uploading pydantic layer..."
PYDANTIC_LAYER_ARN=$(aws lambda publish-layer-version \
  --profile $AWS_PROFILE \
  --region $AWS_REGION \
  --layer-name ${STACK_NAME}-python-pydantic \
  --description "Data validation (pydantic)" \
  --zip-file fileb://dist/layers/layer-pydantic.zip \
  --compatible-runtimes python3.12 \
  --query 'LayerVersionArn' \
  --output text)

echo "✓ pydantic layer: $PYDANTIC_LAYER_ARN"
echo ""

# Step 3: Get or create IAM role
echo "========================================="
echo "Step 3: Setting up IAM role"
echo "========================================="

ROLE_NAME="${STACK_NAME}-python-lambda-role"

# Check if role exists
if aws iam get-role --profile $AWS_PROFILE --role-name $ROLE_NAME &> /dev/null; then
    echo "✓ IAM role already exists: $ROLE_NAME"
    ROLE_ARN=$(aws iam get-role --profile $AWS_PROFILE --role-name $ROLE_NAME --query 'Role.Arn' --output text)
else
    echo "Creating IAM role: $ROLE_NAME"
    
    # Create trust policy
    cat > /tmp/trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

    # Create role
    ROLE_ARN=$(aws iam create-role \
      --profile $AWS_PROFILE \
      --role-name $ROLE_NAME \
      --assume-role-policy-document file:///tmp/trust-policy.json \
      --query 'Role.Arn' \
      --output text)
    
    echo "✓ Created IAM role: $ROLE_ARN"
    
    # Attach policies
    echo "Attaching policies..."
    
    aws iam attach-role-policy \
      --profile $AWS_PROFILE \
      --role-name $ROLE_NAME \
      --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
    
    # Create inline policy for DynamoDB and CloudWatch
    cat > /tmp/lambda-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Scan",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:${AWS_REGION}:${ACCOUNT_ID}:table/${TABLE_NAME}"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:DescribeLogStreams",
        "logs:GetLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
EOF

    aws iam put-role-policy \
      --profile $AWS_PROFILE \
      --role-name $ROLE_NAME \
      --policy-name ${ROLE_NAME}-policy \
      --policy-document file:///tmp/lambda-policy.json
    
    echo "✓ Policies attached"
    
    # Wait for role to be available
    echo "Waiting for IAM role to propagate..."
    sleep 10
fi

echo "Role ARN: $ROLE_ARN"
echo ""

# Step 4: Deploy Lambda functions
echo "========================================="
echo "Step 4: Deploying Lambda functions"
echo "========================================="

# Function 1: ESAM Handler
ESAM_FUNCTION_NAME="${STACK_NAME}-python-esam-handler"
echo "Deploying ESAM handler: $ESAM_FUNCTION_NAME"

if aws lambda get-function --profile $AWS_PROFILE --region $AWS_REGION --function-name $ESAM_FUNCTION_NAME &> /dev/null; then
    echo "  Updating existing function..."
    aws lambda update-function-code \
      --profile $AWS_PROFILE \
      --region $AWS_REGION \
      --function-name $ESAM_FUNCTION_NAME \
      --zip-file fileb://dist/handlers/esam_handler.zip \
      --no-cli-pager > /dev/null
    
    aws lambda update-function-configuration \
      --profile $AWS_PROFILE \
      --region $AWS_REGION \
      --function-name $ESAM_FUNCTION_NAME \
      --layers "$THREEFIVE_LAYER_ARN" "$BOTO3_LAYER_ARN" "$PYDANTIC_LAYER_ARN" \
      --environment Variables="{CHANNELS_TABLE_NAME=${TABLE_NAME},LOG_LEVEL=INFO}" \
      --no-cli-pager > /dev/null
    
    echo "  ✓ Updated"
else
    echo "  Creating new function..."
    aws lambda create-function \
      --profile $AWS_PROFILE \
      --region $AWS_REGION \
      --function-name $ESAM_FUNCTION_NAME \
      --runtime python3.12 \
      --role $ROLE_ARN \
      --handler handlers.esam_handler.handler \
      --zip-file fileb://dist/handlers/esam_handler.zip \
      --layers "$THREEFIVE_LAYER_ARN" "$BOTO3_LAYER_ARN" "$PYDANTIC_LAYER_ARN" \
      --environment Variables="{CHANNELS_TABLE_NAME=${TABLE_NAME},LOG_LEVEL=INFO}" \
      --timeout 30 \
      --memory-size 512 \
      --no-cli-pager > /dev/null
    
    echo "  ✓ Created"
fi

# Function 2: Channel Handler
CHANNEL_FUNCTION_NAME="${STACK_NAME}-python-channel-handler"
echo "Deploying Channel handler: $CHANNEL_FUNCTION_NAME"

if aws lambda get-function --profile $AWS_PROFILE --region $AWS_REGION --function-name $CHANNEL_FUNCTION_NAME &> /dev/null; then
    echo "  Updating existing function..."
    aws lambda update-function-code \
      --profile $AWS_PROFILE \
      --region $AWS_REGION \
      --function-name $CHANNEL_FUNCTION_NAME \
      --zip-file fileb://dist/handlers/channel_handler.zip \
      --no-cli-pager > /dev/null
    
    aws lambda update-function-configuration \
      --profile $AWS_PROFILE \
      --region $AWS_REGION \
      --function-name $CHANNEL_FUNCTION_NAME \
      --layers "$BOTO3_LAYER_ARN" "$PYDANTIC_LAYER_ARN" \
      --environment Variables="{CHANNELS_TABLE_NAME=${TABLE_NAME},LOG_LEVEL=INFO}" \
      --no-cli-pager > /dev/null
    
    echo "  ✓ Updated"
else
    echo "  Creating new function..."
    aws lambda create-function \
      --profile $AWS_PROFILE \
      --region $AWS_REGION \
      --function-name $CHANNEL_FUNCTION_NAME \
      --runtime python3.12 \
      --role $ROLE_ARN \
      --handler handlers.channel_handler.handler \
      --zip-file fileb://dist/handlers/channel_handler.zip \
      --layers "$BOTO3_LAYER_ARN" "$PYDANTIC_LAYER_ARN" \
      --environment Variables="{CHANNELS_TABLE_NAME=${TABLE_NAME},LOG_LEVEL=INFO}" \
      --timeout 30 \
      --memory-size 256 \
      --no-cli-pager > /dev/null
    
    echo "  ✓ Created"
fi

# Function 3: Logs Handler
LOGS_FUNCTION_NAME="${STACK_NAME}-python-logs-handler"
echo "Deploying Logs handler: $LOGS_FUNCTION_NAME"

if aws lambda get-function --profile $AWS_PROFILE --region $AWS_REGION --function-name $LOGS_FUNCTION_NAME &> /dev/null; then
    echo "  Updating existing function..."
    aws lambda update-function-code \
      --profile $AWS_PROFILE \
      --region $AWS_REGION \
      --function-name $LOGS_FUNCTION_NAME \
      --zip-file fileb://dist/handlers/logs_handler.zip \
      --no-cli-pager > /dev/null
    
    aws lambda update-function-configuration \
      --profile $AWS_PROFILE \
      --region $AWS_REGION \
      --function-name $LOGS_FUNCTION_NAME \
      --layers "$BOTO3_LAYER_ARN" "$PYDANTIC_LAYER_ARN" \
      --environment Variables="{ESAM_LOG_GROUP=${LOG_GROUP},LOG_LEVEL=INFO}" \
      --no-cli-pager > /dev/null
    
    echo "  ✓ Updated"
else
    echo "  Creating new function..."
    aws lambda create-function \
      --profile $AWS_PROFILE \
      --region $AWS_REGION \
      --function-name $LOGS_FUNCTION_NAME \
      --runtime python3.12 \
      --role $ROLE_ARN \
      --handler handlers.logs_handler.handler \
      --zip-file fileb://dist/handlers/logs_handler.zip \
      --layers "$BOTO3_LAYER_ARN" "$PYDANTIC_LAYER_ARN" \
      --environment Variables="{ESAM_LOG_GROUP=${LOG_GROUP},LOG_LEVEL=INFO}" \
      --timeout 30 \
      --memory-size 256 \
      --no-cli-pager > /dev/null
    
    echo "  ✓ Created"
fi

echo ""

# Step 5: Summary
echo "========================================="
echo "Deployment Complete! 🚀"
echo "========================================="
echo ""
echo "Lambda Functions:"
echo "  • $ESAM_FUNCTION_NAME"
echo "  • $CHANNEL_FUNCTION_NAME"
echo "  • $LOGS_FUNCTION_NAME"
echo ""
echo "Lambda Layers:"
echo "  • threefive: $THREEFIVE_LAYER_ARN"
echo "  • boto3: $BOTO3_LAYER_ARN"
echo "  • pydantic: $PYDANTIC_LAYER_ARN"
echo ""
echo "Configuration:"
echo "  • DynamoDB Table: $TABLE_NAME"
echo "  • Log Group: $LOG_GROUP"
echo "  • IAM Role: $ROLE_ARN"
echo ""
echo "Packages in dist/:"
echo "  • dist/layer-threefive.zip"
echo "  • dist/layer-boto3.zip"
echo "  • dist/layer-pydantic.zip"
echo "  • dist/esam_handler.zip"
echo "  • dist/channel_handler.zip"
echo "  • dist/logs_handler.zip"
echo ""
echo "Next steps:"
echo "  1. Test the functions with AWS Console or CLI"
echo "  2. Update API Gateway to point to Python functions"
echo "  3. Monitor CloudWatch Logs for any issues"
echo ""
echo "To test ESAM handler:"
echo "  aws lambda invoke --profile $AWS_PROFILE --function-name $ESAM_FUNCTION_NAME \\"
echo "    --payload '{\"httpMethod\":\"POST\",\"body\":\"{\\\"channelId\\\":\\\"test\\\",\\\"scte35Binary\\\":\\\"test\\\"}\"}' \\"
echo "    response.json"
echo ""
