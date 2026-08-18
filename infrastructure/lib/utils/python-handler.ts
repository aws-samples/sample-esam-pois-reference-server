// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as lambda from 'aws-cdk-lib/aws-lambda';
import { ILocalBundling, BundlingOptions } from 'aws-cdk-lib';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

/**
 * Bundle a Python handler's source tree (handlers/, domain/, infrastructure/)
 * along with its handler-local dependencies into a Lambda asset.
 *
 * Layers cover the heavy shared deps (boto3, pydantic, threefive). This helper
 * is for the small per-handler extras (e.g. xmltodict for the ESAM handler).
 *
 * Like {@link buildPythonLayer}, this prefers Docker bundling and falls back
 * to a host-side `pip` install — so contributors get a working Lambda asset
 * regardless of OS/architecture and without a separate packaging step.
 *
 * @param backendDir   Absolute path to the Python project root (the directory
 *                     containing handlers/, domain/, infrastructure/).
 * @param requirements Optional list of pip requirement strings to install
 *                     alongside the source tree.
 */
export function buildPythonHandlerAsset(
  backendDir: string,
  requirements: string[] = []
): lambda.AssetCode {
  const reqLine = requirements.join(' ');
  const sourceDirs = ['handlers', 'domain', 'infrastructure'];

  const bundling: BundlingOptions = {
    image: lambda.Runtime.PYTHON_3_12.bundlingImage,
    command: [
      'bash',
      '-c',
      [
        // Copy source folders.
        ...sourceDirs.map((d) => `cp -R ${d} /asset-output/`),
        // Install handler-local deps directly into the asset, if any.
        reqLine
          ? `pip install ${reqLine} -t /asset-output --no-cache-dir`
          : 'true',
        // Strip caches.
        'find /asset-output -type d -name __pycache__ -prune -exec rm -rf {} +',
        'find /asset-output -type f -name "*.pyc" -delete',
      ].join(' && '),
    ],
    local: createLocalHandlerBundler(backendDir, sourceDirs, requirements),
  };

  return lambda.Code.fromAsset(backendDir, { bundling });
}

function createLocalHandlerBundler(
  backendDir: string,
  sourceDirs: string[],
  requirements: string[]
): ILocalBundling {
  return {
    tryBundle(outputDir: string): boolean {
      // Only attempt the local path when pip is available. CDK falls back to
      // Docker bundling when this returns false.
      try {
        execSync('python3 -m pip --version', { stdio: 'ignore' });
      } catch {
        return false;
      }

      try {
        // Copy source trees.
        for (const dir of sourceDirs) {
          const src = path.join(backendDir, dir);
          if (!fs.existsSync(src)) {
            continue;
          }
          // -R preserves directory structure; trailing dot semantics differ
          // across cp implementations, so be explicit.
          execSync(
            `cp -R ${quoteShell(src)} ${quoteShell(path.join(outputDir, dir))}`,
            { stdio: 'inherit' }
          );
        }

        // Handler-local dependencies. xmltodict and friends are pure Python,
        // so the platform flag is unnecessary; if a future handler-local dep
        // grows a native component, pin it via a layer instead.
        if (requirements.length > 0) {
          const cmd = [
            'python3 -m pip install',
            ...requirements.map(quoteShell),
            `-t ${quoteShell(outputDir)}`,
            '--no-cache-dir',
            '--upgrade',
            '--quiet',
          ].join(' ');
          execSync(cmd, { stdio: 'inherit' });
        }

        // Strip caches.
        execSync(
          `find ${quoteShell(outputDir)} -type d -name __pycache__ -prune -exec rm -rf {} +`,
          { stdio: 'ignore' }
        );
        execSync(
          `find ${quoteShell(outputDir)} -type f -name '*.pyc' -delete`,
          { stdio: 'ignore' }
        );
      } catch {
        return false;
      }

      return true;
    },
  };
}

function quoteShell(p: string): string {
  return `'${p.replace(/'/g, `'\\''`)}'`;
}
