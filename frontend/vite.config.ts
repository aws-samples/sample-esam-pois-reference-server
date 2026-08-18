// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Local development runs against a DEPLOYED API (the backend is Lambda-only,
// there is no local API server). Point the dev proxy at your deployment:
//
//   DEV_API_TARGET=https://<api-id>.execute-api.<region>.amazonaws.com/v1 npm run dev
//
// The ApiUrl CloudFormation output of the api stack has the exact value.
// The DEPLOYED frontend needs no configuration at all - CloudFront proxies
// /api/* to API Gateway.
const devApiTarget = process.env.DEV_API_TARGET;

/** Answers /api/* with a helpful error when DEV_API_TARGET is not set. */
function missingApiTargetGuard(): Plugin {
  return {
    name: 'pois-missing-dev-api-target',
    configureServer(server) {
      server.middlewares.use('/api', (_req, res) => {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            message:
              'DEV_API_TARGET is not set. Restart the dev server with: ' +
              'DEV_API_TARGET=https://<api-id>.execute-api.<region>.amazonaws.com/v1 npm run dev ' +
              '(see the ApiUrl output of your CDK deployment)',
          })
        );
      });
    },
  };
}

if (!devApiTarget) {
  console.warn(
    '\n[pois] DEV_API_TARGET is not set - API calls will fail.\n' +
      '[pois] Start the dev server with:\n' +
      '[pois]   DEV_API_TARGET=https://<api-id>.execute-api.<region>.amazonaws.com/v1 npm run dev\n' +
      '[pois] (value comes from the ApiUrl output of "npx cdk deploy")\n'
  );
}

export default defineConfig({
  plugins: [react(), ...(devApiTarget ? [] : [missingApiTargetGuard()])],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: devApiTarget
      ? {
          '/api': {
            target: devApiTarget,
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
          },
        }
      : undefined,
  },
});
