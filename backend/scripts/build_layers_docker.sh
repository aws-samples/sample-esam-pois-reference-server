#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0


# Build Lambda layers using Docker for correct architecture
# This ensures compatibility with Lambda runtime

set -e

echo "========================================="
echo "Building Lambda Layers with Docker"
echo "========================================="

mkdir -p dist/layers
mkdir -p build/layers

# Layer 1: threefive (version 2.3.x that works) + crcmod
echo "Building threefive layer..."
rm -rf build/layers/threefive
mkdir -p build/layers/threefive

docker run --rm \
  -v "$(pwd)/build/layers/threefive:/var/task" \
  -w /var/task \
  public.ecr.aws/lambda/python:3.12 \
  pip install "threefive>=2.3.0,<2.4.0" "crcmod>=1.7" -t python

cd build/layers/threefive
zip -r -q ../../../dist/layers/layer-threefive.zip python
cd ../../..
echo "✓ threefive layer: $(du -h dist/layers/layer-threefive.zip | cut -f1)"

# Layer 2: pydantic
echo "Building pydantic layer..."
rm -rf build/layers/pydantic
mkdir -p build/layers/pydantic

docker run --rm \
  -v "$(pwd)/build/layers/pydantic:/var/task" \
  -w /var/task \
  public.ecr.aws/lambda/python:3.12 \
  pip install pydantic==2.12.5 pydantic-core==2.41.5 -t python

cd build/layers/pydantic
zip -r -q ../../../dist/layers/layer-pydantic.zip python
cd ../../..
echo "✓ pydantic layer: $(du -h dist/layers/layer-pydantic.zip | cut -f1)"

echo ""
echo "✅ All layers built successfully!"
echo ""
