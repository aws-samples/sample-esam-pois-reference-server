#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0


# Script para rebuild layers e handlers e fazer deploy
set -e

echo "========================================="
echo "Rebuild and Deploy POIS Backend"
echo "========================================="

cd "$(dirname "$0")/.."

# 1. Rebuild Lambda layers com versões corretas do pydantic
echo ""
echo "Step 1: Rebuilding Lambda layers..."
rm -rf build/layers dist/layers
mkdir -p build/layers dist/layers

# Layer 1: threefive
echo "Building threefive layer..."
rm -rf build/layers/threefive
mkdir -p build/layers/threefive/python
pip install "threefive>=2.3.0,<2.4.0" "crcmod>=1.7" -t build/layers/threefive/python --quiet
cd build/layers/threefive
zip -r -q ../../../dist/layers/layer-threefive.zip python -x "*.pyc" -x "__pycache__/*" -x "*.DS_Store"
cd ../../..
echo "✓ threefive layer: $(du -h dist/layers/layer-threefive.zip | cut -f1)"

# Layer 2: pydantic com versões específicas
echo "Building pydantic layer..."
rm -rf build/layers/pydantic
mkdir -p build/layers/pydantic/python
pip install pydantic==2.12.5 pydantic-core==2.41.5 -t build/layers/pydantic/python --quiet
cd build/layers/pydantic
zip -r -q ../../../dist/layers/layer-pydantic.zip python -x "*.pyc" -x "__pycache__/*" -x "*.DS_Store"
cd ../../..
echo "✓ pydantic layer: $(du -h dist/layers/layer-pydantic.zip | cut -f1)"

# 2. Package handlers
echo ""
echo "Step 2: Packaging Lambda handlers..."
./scripts/package_lambda.sh esam_handler
./scripts/package_lambda.sh channel_handler
./scripts/package_lambda.sh logs_handler

echo ""
echo "✅ All packages built successfully!"
echo ""
echo "Now deploying with CDK..."
cd ../infrastructure
npm run cdk -- deploy --all --profile dev --require-approval never

echo ""
echo "✅ Deploy completed!"
