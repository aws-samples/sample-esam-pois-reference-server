#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0


# Optimized deploy script - boto3 is included in Lambda runtime
# Usage: ./scripts/deploy_optimized.sh [dev|prod]

set -e

ENVIRONMENT=${1:-dev}
AWS_PROFILE="dev"
AWS_REGION="us-east-1"

echo "========================================="
echo "POIS Python Backend Deployment (Optimized)"
echo "========================================="
echo "Environment: $ENVIRONMENT"
echo "AWS Profile: $AWS_PROFILE"
echo "AWS Region: $AWS_REGION"
echo ""

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --profile $AWS_PROFILE --query Account --output text)
echo "Account ID: $ACCOUNT_ID"

# Configuration
STACK_NAME="pois-${ENVIRONMENT}"
TABLE_NAME="${STACK_NAME}-data"
LOG_GROUP="/aws/lambda/${STACK_NAME}-python-esam-handler"

echo "Configuration:"
echo "  Table: $TABLE_NAME"
echo "  Log Group: $LOG_GROUP"
echo ""

# Use existing threefive layer
# NOTE: Update the layer version if you publish a new threefive layer
THREEFIVE_LAYER_ARN="arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:layer:${STACK_NAME}-python-threefive:2"

# Upload pydantic layer
echo "Uploading pydantic layer..."
PYDANTIC_LAYER_ARN=$(aws lambda publish-layer-version \
  --profile $AWS_PROFILE \
  --region $AWS_REGION \
  --layer-name ${STACK_NAME}-python-pydantic \
  --description "Data validation (pydantic)" \
  --zip-file fileb://dist/layers/layer-pydantic.zip \
  --compatible-runtimes python3.12 \
  --query 'LayerVersionArn' \
  --output text 2>&1)

if [ $? -ne 0 ]; then
    echo "⚠️  Pydantic layer upload failed, trying to use existing..."
    PYDANTIC_LAYER_ARN=$(aws lambda list-layer-versions \
      --profile $AWS_PROFILE \
      --region $AWS_REGION \
      --layer-name ${STACK_NAME}-python-pydantic \
      --query 'LayerVersions[0].LayerVersionArn' \
      --output text)
fi

echo "✓ pydantic layer: $PYDANTIC_LAYER_ARN"
echo ""

# Get or create IAM role
ROLE_NAME="${STACK_NAME}-python-lambda-role"

if aws iam get-role --profile $AWS_PROFILE --role-name $ROLE_NAME &> /dev/null; then
    ROLE_ARN=$(aws iam get-role --profile $AWS_PROFILE --role-name $ROLE_NAME --query 'Role.Arn' --output text)
    echo "✓ Using existing IAM role: $ROLE_NAME"
else
    echo "Creating IAM role..."
    cat > /tmp/trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "lambda.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
EOF

    ROLE_ARN=$(aws iam create-role \
      --profile $AWS_PROFILE \
      --role-name $ROLE_NAME \
      --assume-role-policy-document file:///tmp/trust-policy.json \
      --query 'Role.Arn' \
      --output text)
    
    aws iam attach-role-policy \
      --profile $AWS_PROFILE \
      --role-name $ROLE_NAME \
      --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
    
    cat > /tmp/lambda-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["dynamodb:*"],
      "Resource": "arn:aws:dynamodb:${AWS_REGION}:${ACCOUNT_ID}:table/${TABLE_NAME}"
    },
    {
      "Effect": "Allow",
      "Action": ["logs:DescribeLogStreams", "logs:GetLogEvents"],
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
    
    echo "✓ Created IAM role, waiting 10s..."
    sleep 10
fi

echo ""

# Deploy functions
echo "========================================="
echo "Deploying Lambda Functions"
echo "========================================="

# ESAM Handler (needs threefive + pydantic, boto3 from runtime)
ESAM_FUNCTION_NAME="${STACK_NAME}-python-esam-handler"
echo "Deploying: $ESAM_FUNCTION_NAME"

if aws lambda get-function --profile $AWS_PROFILE --region $AWS_REGION --function-name $ESAM_FUNCTION_NAME &> /dev/null; then
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
      --layers "$THREEFIVE_LAYER_ARN" "$PYDANTIC_LAYER_ARN" \
      --no-cli-pager > /dev/null
    
    echo "  ✓ Updated"
else
    aws lambda create-function \
      --profile $AWS_PROFILE \
      --region $AWS_REGION \
      --function-name $ESAM_FUNCTION_NAME \
      --runtime python3.12 \
      --role $ROLE_ARN \
      --handler handlers.esam_handler.handler \
      --zip-file fileb://dist/handlers/esam_handler.zip \
      --layers "$THREEFIVE_LAYER_ARN" "$PYDANTIC_LAYER_ARN" \
      --environment Variables="{CHANNELS_TABLE_NAME=${TABLE_NAME},LOG_LEVEL=INFO}" \
      --timeout 30 \
      --memory-size 512 \
      --no-cli-pager > /dev/null
    
    echo "  ✓ Created"
fi

# Channel Handler (needs only pydantic, boto3 from runtime)
CHANNEL_FUNCTION_NAME="${STACK_NAME}-python-channel-handler"
echo "Deploying: $CHANNEL_FUNCTION_NAME"

if aws lambda get-function --profile $AWS_PROFILE --region $AWS_REGION --function-name $CHANNEL_FUNCTION_NAME &> /dev/null; then
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
      --layers "$PYDANTIC_LAYER_ARN" \
      --no-cli-pager > /dev/null
    
    echo "  ✓ Updated"
else
    aws lambda create-function \
      --profile $AWS_PROFILE \
      --region $AWS_REGION \
      --function-name $CHANNEL_FUNCTION_NAME \
      --runtime python3.12 \
      --role $ROLE_ARN \
      --handler handlers.channel_handler.handler \
      --zip-file fileb://dist/handlers/channel_handler.zip \
      --layers "$PYDANTIC_LAYER_ARN" \
      --environment Variables="{CHANNELS_TABLE_NAME=${TABLE_NAME},LOG_LEVEL=INFO}" \
      --timeout 30 \
      --memory-size 256 \
      --no-cli-pager > /dev/null
    
    echo "  ✓ Created"
fi

# Logs Handler (needs only pydantic, boto3 from runtime)
LOGS_FUNCTION_NAME="${STACK_NAME}-python-logs-handler"
echo "Deploying: $LOGS_FUNCTION_NAME"

if aws lambda get-function --profile $AWS_PROFILE --region $AWS_REGION --function-name $LOGS_FUNCTION_NAME &> /dev/null; then
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
      --layers "$PYDANTIC_LAYER_ARN" \
      --no-cli-pager > /dev/null
    
    echo "  ✓ Updated"
else
    aws lambda create-function \
      --profile $AWS_PROFILE \
      --region $AWS_REGION \
      --function-name $LOGS_FUNCTION_NAME \
      --runtime python3.12 \
      --role $ROLE_ARN \
      --handler handlers.logs_handler.handler \
      --zip-file fileb://dist/handlers/logs_handler.zip \
      --layers "$PYDANTIC_LAYER_ARN" \
      --environment Variables="{ESAM_LOG_GROUP=${LOG_GROUP},LOG_LEVEL=INFO}" \
      --timeout 30 \
      --memory-size 256 \
      --no-cli-pager > /dev/null
    
    echo "  ✓ Created"
fi

echo ""
echo "========================================="
echo "✅ Deployment Complete!"
echo "========================================="
echo ""
echo "Functions:"
echo "  • $ESAM_FUNCTION_NAME"
echo "  • $CHANNEL_FUNCTION_NAME"
echo "  • $LOGS_FUNCTION_NAME"
echo ""
echo "Layers:"
echo "  • threefive: $THREEFIVE_LAYER_ARN"
echo "  • pydantic: $PYDANTIC_LAYER_ARN"
echo "  • boto3: (included in Lambda runtime)"
echo ""
