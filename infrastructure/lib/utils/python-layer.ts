// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as lambda from 'aws-cdk-lib/aws-lambda';
import { ILocalBundling, BundlingOptions } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

/**
 * Build a Python Lambda layer from a `requirements.txt` directory.
 *
 * The CDK runs the install during `cdk deploy` so contributors don't need to
 * pre-package anything — `git clone && cdk deploy` is enough. Two strategies
 * are tried, in order:
 *
 *  1. **Docker** (preferred). `pip install` runs inside the official AWS SAM
 *     Python build image, so compiled C-extension wheels (e.g. pydantic-core)
 *     are always resolved for the Lambda runtime (Linux x86_64), regardless
 *     of the host OS or CPU.
 *
 *  2. **Local fallback** (when Docker is unavailable). `pip install` runs on
 *     the host. For layers with native deps we additionally pass
 *     `--platform manylinux2014_x86_64 --only-binary=:all:` so the binary
 *     wheel matches the Lambda runtime; this requires every dep in the
 *     requirements.txt to ship a manylinux wheel on PyPI. Pure-Python
 *     layers don't need that flag and would in fact be broken by it
 *     (sdist-only deps like `crcmod` can't satisfy `--only-binary`).
 *
 * The local fallback eliminates the "I don't have Docker" friction without
 * sacrificing portability.
 *
 * @param props.hasNativeDeps  Set to true if the layer's requirements include
 *                             any package that ships compiled C-extensions
 *                             (e.g. pydantic-core). Drives whether the local
 *                             fallback enforces the manylinux platform tag.
 */
export function buildPythonLayer(
  scope: Construct,
  id: string,
  requirementsDir: string,
  props: {
    layerVersionName?: string;
    description?: string;
    hasNativeDeps?: boolean;
  } = {}
): lambda.LayerVersion {
  const reqPath = path.join(requirementsDir, 'requirements.txt');
  if (!fs.existsSync(reqPath)) {
    throw new Error(
      `buildPythonLayer: requirements.txt not found at ${reqPath}. ` +
        `Create it under ${requirementsDir}/.`
    );
  }

  const bundling: BundlingOptions = {
    // Docker image used when bundling runs in a container.
    image: lambda.Runtime.PYTHON_3_12.bundlingImage,
    command: [
      'bash',
      '-c',
      [
        // Install into /asset-output/python so the layer has the standard
        // Lambda layout (/opt/python is on PYTHONPATH at runtime).
        'pip install -r requirements.txt -t /asset-output/python --no-cache-dir',
        // Strip pyc / cache directories to keep the zip small.
        'find /asset-output -type d -name __pycache__ -prune -exec rm -rf {} +',
        'find /asset-output -type f -name "*.pyc" -delete',
      ].join(' && '),
    ],
    local: createLocalPipBundler(requirementsDir, props.hasNativeDeps ?? false),
  };

  return new lambda.LayerVersion(scope, id, {
    layerVersionName: props.layerVersionName,
    description: props.description,
    compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
    code: lambda.Code.fromAsset(requirementsDir, { bundling }),
  });
}

/**
 * Local bundler that mimics the Docker step using the host's `pip`. Returns
 * `false` from `tryBundle` when the host can't honour the request (no pip,
 * pip too old to support `--platform`, etc.) — CDK then falls back to Docker.
 *
 * @param hasNativeDeps  When true, force the manylinux x86_64 wheel set so
 *                       compiled C-extensions (pydantic-core etc.) match
 *                       the Lambda runtime even when bundling on macOS/ARM.
 *                       When false, install with the host's defaults — this
 *                       is the right call for pure-Python layers and is
 *                       required when the layer includes any sdist-only deps
 *                       that would be rejected by `--only-binary=:all:`.
 */
function createLocalPipBundler(
  requirementsDir: string,
  hasNativeDeps: boolean
): ILocalBundling {
  return {
    tryBundle(outputDir: string): boolean {
      // Only attempt the local path when pip3 is available. CDK will fall
      // back to Docker bundling when this returns false.
      try {
        execSync('python3 -m pip --version', { stdio: 'ignore' });
      } catch {
        return false;
      }

      const pythonOut = path.join(outputDir, 'python');
      fs.mkdirSync(pythonOut, { recursive: true });

      const baseFlags = [
        'python3 -m pip install',
        `-r ${quoteShell(path.join(requirementsDir, 'requirements.txt'))}`,
        `-t ${quoteShell(pythonOut)}`,
        '--no-cache-dir',
        '--upgrade',
        '--quiet',
      ];

      // For native-extension layers we MUST cross-compile to manylinux x86_64
      // so the .so matches the Lambda runtime. For pure-Python layers we use
      // host defaults so sdist-only deps (e.g. crcmod) install correctly.
      const platformFlags = hasNativeDeps
        ? [
            '--platform manylinux2014_x86_64',
            '--python-version 3.12',
            '--only-binary=:all:',
            '--implementation cp',
          ]
        : [];

      const cmd = [...baseFlags, ...platformFlags].join(' ');

      try {
        execSync(cmd, { stdio: 'inherit' });
      } catch {
        return false;
      }

      // Strip caches to mirror the Docker path.
      try {
        execSync(
          `find ${quoteShell(outputDir)} -type d -name __pycache__ -prune -exec rm -rf {} +`,
          { stdio: 'ignore' }
        );
        execSync(
          `find ${quoteShell(outputDir)} -type f -name '*.pyc' -delete`,
          { stdio: 'ignore' }
        );
      } catch {
        // Cleanup failures are non-fatal.
      }

      return true;
    },
  };
}

function quoteShell(p: string): string {
  // Wrap in single quotes and escape any single quotes in the path.
  return `'${p.replace(/'/g, `'\\''`)}'`;
}
