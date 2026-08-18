#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

# Lambda packaging script for POIS Python backend.
#
# Why this script is careful about platform:
# ------------------------------------------
# Lambda runs Linux x86_64 (glibc). When a layer contains a Python package
# with a compiled C-extension (pydantic_core, for example), the binary
# shipped in the .zip MUST match that target. Otherwise the runtime fails
# at import time with errors like:
#     Runtime.ImportModuleError: No module named 'pydantic_core._pydantic_core'
#
# A `pip install` from a developer machine (macOS, Windows, Linux/arm64)
# silently picks the wheel for THAT host, which is usually wrong for Lambda.
# This script forces pip to download manylinux x86_64 wheels for the deps
# that have native code, and validates the result so a wrong build fails
# loudly here instead of at deploy time.
#
# Pure-Python deps (no compiled code) are installed normally because they
# don't have a "platform" — every platform uses the same .py files.
#
# Usage: ./scripts/package_lambda.sh [handler_name|all|layers]

set -euo pipefail

COMMAND=${1:-}

if [ -z "$COMMAND" ]; then
    cat <<EOF
Usage: $0 <handler_name|all|layers>

Available handlers:
  esam_handler, channel_handler, logs_handler,
  external_actions_handler, preferences_handler,
  auth_config_handler, user_management_handler

  all    - Package all handlers and layers
  layers - Package all Lambda layers
EOF
    exit 1
fi

# Lambda target. Bumping the runtime requires changing this AND the runtime
# in infrastructure/lib/stacks/api-stack.ts in lock-step.
LAMBDA_PYTHON_VERSION="3.12"

# ---------------------------------------------------------------------------
# pip helpers
# ---------------------------------------------------------------------------

# Install pure-Python dependencies into a target directory.
# Use this for packages that contain no compiled code (boto3, threefive,
# crcmod, xmltodict, etc.). Cross-platform safe.
pip_install_pure_python() {
    local target_dir="$1"
    shift
    pip install --no-cache-dir --upgrade --target "$target_dir" "$@" --quiet
}

# Install dependencies that ship native C-extensions, forcing the manylinux
# x86_64 wheel so the binary matches the Lambda runtime regardless of which
# OS/architecture the developer is using.
#
# This works because every native dep we rely on (pydantic-core today)
# publishes a manylinux wheel on PyPI. If a future dep doesn't, the install
# will fail loudly here rather than at runtime.
pip_install_lambda_native() {
    local target_dir="$1"
    shift
    pip install --no-cache-dir --upgrade --force-reinstall \
        --platform manylinux2014_x86_64 \
        --python-version "$LAMBDA_PYTHON_VERSION" \
        --only-binary=:all: \
        --implementation cp \
        --target "$target_dir" \
        "$@" --quiet
}

zip_layer() {
    local layer_name="$1"
    local layer_build_dir="$2"
    cd "$layer_build_dir"
    zip -r -q "../../../dist/layers/layer-${layer_name}.zip" python \
        -x "*.pyc" -x "__pycache__/*" -x "*.DS_Store"
    cd - >/dev/null
    echo "✓ Layer created: dist/layers/layer-${layer_name}.zip ($(du -h "dist/layers/layer-${layer_name}.zip" | cut -f1))"
}

# ---------------------------------------------------------------------------
# Handler packaging
# ---------------------------------------------------------------------------

package_handler() {
    local HANDLER_NAME=$1
    echo "========================================="
    echo "Packaging Lambda function: $HANDLER_NAME"
    echo "========================================="

    BUILD_DIR="build/handlers/$HANDLER_NAME"
    rm -rf "$BUILD_DIR"
    mkdir -p "$BUILD_DIR"

    echo "Copying source code..."
    cp -r handlers "$BUILD_DIR/"
    cp -r domain "$BUILD_DIR/"
    cp -r infrastructure "$BUILD_DIR/"

    if [ "$HANDLER_NAME" = "esam_handler" ]; then
        echo "Installing esam_handler dependencies (xmltodict)..."
        # xmltodict is pure Python.
        pip_install_pure_python "$BUILD_DIR" "xmltodict"
    fi

    mkdir -p dist/handlers
    echo "Creating deployment package..."
    cd "$BUILD_DIR"
    zip -r "../../../dist/handlers/${HANDLER_NAME}.zip" . \
        -x "*.pyc" -x "__pycache__/*" -x "*.git*" -x "*.DS_Store" >/dev/null
    cd ../../..

    echo "✓ Package created: dist/handlers/${HANDLER_NAME}.zip ($(du -h "dist/handlers/${HANDLER_NAME}.zip" | cut -f1))"
    echo ""
}

# ---------------------------------------------------------------------------
# Layer packaging
# ---------------------------------------------------------------------------

package_layers() {
    echo "========================================="
    echo "Packaging Lambda Layers"
    echo "========================================="

    mkdir -p dist/layers
    mkdir -p build/layers

    # Layer 1: threefive (SCTE-35) + crcmod. Both pure Python.
    echo "Building threefive layer (pure Python)..."
    rm -rf build/layers/threefive
    mkdir -p build/layers/threefive/python
    pip_install_pure_python "build/layers/threefive/python" \
        "threefive>=2.4.0" "crcmod>=1.7"
    zip_layer "threefive" "build/layers/threefive"

    # Layer 2: boto3. Pure Python.
    echo "Building boto3 layer (pure Python)..."
    rm -rf build/layers/boto3
    mkdir -p build/layers/boto3/python
    pip_install_pure_python "build/layers/boto3/python" "boto3>=1.28.0"
    zip_layer "boto3" "build/layers/boto3"

    # Layer 3: pydantic. Pulls in pydantic_core, which is a Rust-based
    # C-extension. Force the manylinux x86_64 wheel so the .so matches
    # Lambda's runtime regardless of host OS/arch.
    echo "Building pydantic layer (forcing manylinux x86_64 for pydantic_core)..."
    rm -rf build/layers/pydantic
    mkdir -p build/layers/pydantic/python
    pip_install_lambda_native "build/layers/pydantic/python" "pydantic>=2.0.0"
    zip_layer "pydantic" "build/layers/pydantic"

    # Validate that pydantic_core was built for Linux x86_64. Catching this
    # here avoids the much worse failure mode of Lambda crashing at cold
    # start with Runtime.ImportModuleError after deploy.
    local pydantic_so
    pydantic_so=$(find build/layers/pydantic/python/pydantic_core \
        -name '_pydantic_core*.so' 2>/dev/null | head -1)
    if [ -z "$pydantic_so" ]; then
        echo "ERROR: pydantic_core native extension is missing from the layer." >&2
        exit 1
    fi
    if ! file "$pydantic_so" | grep -q 'ELF .* x86-64'; then
        echo "ERROR: pydantic_core was built for the wrong platform:" >&2
        file "$pydantic_so" >&2
        echo "       Lambda requires Linux x86_64." >&2
        exit 1
    fi
    echo "  ✓ pydantic_core verified Linux x86_64."

    echo ""
    echo "All layers packaged successfully in dist/layers/"
    echo ""
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

case $COMMAND in
    layers)
        package_layers
        ;;
    all)
        package_layers
        package_handler "esam_handler"
        package_handler "channel_handler"
        package_handler "logs_handler"
        package_handler "external_actions_handler"
        package_handler "preferences_handler"
        package_handler "auth_config_handler"
        package_handler "user_management_handler"
        echo "========================================="
        echo "All packages created successfully!"
        echo "========================================="
        ;;
    esam_handler|channel_handler|logs_handler|external_actions_handler|preferences_handler|auth_config_handler|user_management_handler)
        package_handler "$COMMAND"
        ;;
    *)
        echo "Error: Unknown command '$COMMAND'" >&2
        exit 1
        ;;
esac

echo "Done!"
