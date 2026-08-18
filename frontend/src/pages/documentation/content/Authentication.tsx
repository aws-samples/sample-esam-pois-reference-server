// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React from 'react';
import { CodeBlock, Callout, Table } from '../components/DocComponents';
import { Lock, Shield, Users, Key } from 'lucide-react';

export const Authentication: React.FC = () => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="p-8 border-b border-slate-200">
        <h1 className="text-3xl font-bold text-slate-900 mb-3 flex items-center gap-3">
          <Lock className="w-8 h-8 text-indigo-600" />
          Authentication
        </h1>
        <p className="text-lg text-slate-600">
          Amazon Cognito authentication with role-based access control
        </p>
      </div>

      <div className="p-8 space-y-8">
        {/* Overview */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Overview</h2>
          <p className="text-slate-700 leading-relaxed mb-4">
            The POIS Reference Server uses <strong>Amazon Cognito User Pools</strong> for authentication
            and authorization. Users are assigned to groups that determine their role and permissions
            within the system. The frontend uses AWS Amplify to handle the authentication flow,
            obtaining JWT tokens that are passed to the API Gateway.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 text-center">
              <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <h4 className="font-semibold text-slate-900 text-sm">Cognito User Pool</h4>
              <p className="text-xs text-slate-600 mt-1">User management & groups</p>
            </div>
            <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 text-center">
              <Key className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <h4 className="font-semibold text-slate-900 text-sm">JWT Tokens</h4>
              <p className="text-xs text-slate-600 mt-1">ID & Access tokens via Amplify</p>
            </div>
            <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200 text-center">
              <Shield className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <h4 className="font-semibold text-slate-900 text-sm">RBAC</h4>
              <p className="text-xs text-slate-600 mt-1">Role-based access control</p>
            </div>
          </div>
        </section>

        {/* Auth Flow Diagram */}
        <div className="my-6 p-6 bg-slate-50 rounded-xl border border-slate-200">
          <svg viewBox="0 0 800 100" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <marker id="ah5" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <path d="M0,0 L8,3 L0,6" fill="#94A3B8" />
              </marker>
            </defs>

            {/* 5 nodes, single row, equally spaced */}
            <rect x="20" y="27" width="120" height="46" rx="6" fill="#1E293B" stroke="#334155" strokeWidth="1.5" />
            <text x="80" y="47" textAnchor="middle" fontSize="11" fontWeight="600" fill="#FFFFFF" fontFamily="system-ui">User Login</text>
            <text x="80" y="62" textAnchor="middle" fontSize="10" fill="#94A3B8" fontFamily="system-ui">Email + Password</text>

            <line x1="140" y1="50" x2="175" y2="50" stroke="#94A3B8" strokeWidth="1.5" markerEnd="url(#ah5)" />

            <rect x="175" y="27" width="120" height="46" rx="6" fill="#FFFBEB" stroke="#F59E0B" strokeWidth="1.5" />
            <text x="235" y="47" textAnchor="middle" fontSize="11" fontWeight="500" fill="#92400E" fontFamily="system-ui">Cognito</text>
            <text x="235" y="62" textAnchor="middle" fontSize="10" fill="#B45309" fontFamily="system-ui">User Pool</text>

            <line x1="295" y1="50" x2="330" y2="50" stroke="#94A3B8" strokeWidth="1.5" markerEnd="url(#ah5)" />

            <rect x="330" y="27" width="120" height="46" rx="6" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.5" />
            <text x="390" y="47" textAnchor="middle" fontSize="11" fontWeight="500" fill="#334155" fontFamily="system-ui">JWT Token</text>
            <text x="390" y="62" textAnchor="middle" fontSize="10" fill="#64748B" fontFamily="system-ui">ID + Access</text>

            <line x1="450" y1="50" x2="485" y2="50" stroke="#94A3B8" strokeWidth="1.5" markerEnd="url(#ah5)" />

            <rect x="485" y="27" width="120" height="46" rx="6" fill="#FFFBEB" stroke="#F59E0B" strokeWidth="1.5" />
            <text x="545" y="47" textAnchor="middle" fontSize="11" fontWeight="500" fill="#92400E" fontFamily="system-ui">API Gateway</text>
            <text x="545" y="62" textAnchor="middle" fontSize="10" fill="#B45309" fontFamily="system-ui">Authorizer</text>

            <line x1="605" y1="50" x2="640" y2="50" stroke="#94A3B8" strokeWidth="1.5" markerEnd="url(#ah5)" />

            <rect x="640" y="27" width="120" height="46" rx="6" fill="#EEF2FF" stroke="#4F46E5" strokeWidth="1.5" />
            <text x="700" y="47" textAnchor="middle" fontSize="11" fontWeight="600" fill="#4338CA" fontFamily="system-ui">Lambda + RBAC</text>
            <text x="700" y="62" textAnchor="middle" fontSize="10" fill="#6366F1" fontFamily="system-ui">Role-based access</text>
          </svg>
          <p className="text-center text-xs text-slate-500 mt-3">Authentication flow: user credentials validated by Cognito, JWT token verified at API Gateway, roles enforced in Lambda</p>
        </div>{/* User Roles */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">User Roles</h2>
          <p className="text-slate-700 mb-4">
            Users are assigned to Cognito groups that map to roles. Each role has a specific set of permissions:
          </p>
          <Table
            headers={['Role', 'Cognito Group', 'Description']}
            rows={[
              [
                <span className="font-semibold text-red-700">Admin</span>,
                <code className="text-xs">admin</code>,
                'Full access: create, update, delete channels; configure external actions; manage users and settings'
              ],
              [
                <span className="font-semibold text-green-700">User</span>,
                <code className="text-xs">user</code>,
                'Read access: view channels, rules, external actions, logs, and metrics; cannot make changes'
              ],
            ]}
          />
        </section>

        {/* RBAC Permissions Matrix */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Permissions Matrix</h2>
          <Table
            headers={['Operation', 'Admin', 'User']}
            rows={[
              ['View channels, rules, and external actions', '✅', '✅'],
              ['View logs and metrics', '✅', '✅'],
              ['Create / update / delete channels', '✅', '❌'],
              ['Configure external actions (MediaLive, webhooks)', '✅', '❌'],
              ['Update system defaults (Settings)', '✅', '❌'],
              ['Manage users', '✅', '❌'],
              ['Regenerate / view channel ESAM passwords', '✅', '❌'],
            ]}
          />
        </section>

        {/* Creating First User */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">The First User</h2>
          <p className="text-slate-700 mb-4">
            The initial admin is provisioned at deploy time. Pass your email address as CDK
            context and Cognito sends an invitation email with a temporary password; the
            dashboard asks for a permanent password on first sign-in:
          </p>
          <CodeBlock code={`npx cdk deploy --all -c adminEmail=you@example.com`} />

          <Callout type="warning" title="No self sign-up">
            Self sign-up is disabled by design: nobody can register through the login page.
            Every account is created either at deploy time (adminEmail) or by an admin on the
            dashboard's Users page.
          </Callout>

          <h3 className="text-lg font-semibold text-slate-900 mb-2 mt-4">Fallback: create a user via CLI</h3>
          <p className="text-slate-700 mb-4">
            If you deployed without <code className="px-1 py-0.5 bg-slate-100 rounded text-sm">adminEmail</code>,
            create the first admin with the AWS CLI:
          </p>
          <CodeBlock code={`aws cognito-idp admin-create-user \\
  --user-pool-id <USER_POOL_ID> \\
  --username admin@example.com \\
  --user-attributes Name=email,Value=admin@example.com Name=email_verified,Value=true

aws cognito-idp admin-add-user-to-group \\
  --user-pool-id <USER_POOL_ID> \\
  --username admin@example.com \\
  --group-name admin`} />
        </section>

        {/* User lifecycle rules */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">User Management Rules</h2>
          <p className="text-slate-700 mb-4">
            All user management operations (create, disable, reset password, change group,
            delete) are restricted to members of the <strong>admin</strong> group. Two
            safeguards prevent lockouts:
          </p>
          <ul className="space-y-2 text-slate-700 mb-4 list-disc list-inside">
            <li>
              <strong>No self-service on your own account</strong> — you cannot disable, demote
              or delete yourself. Another admin must do it.
            </li>
            <li>
              <strong>The last admin is protected</strong> — the only enabled admin cannot be
              disabled, demoted or deleted. To remove an admin who left the team, first create
              or promote another admin, then remove the account.
            </li>
          </ul>
        </section>

        {/* API Authentication Flow */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">API Authentication Flow</h2>
          <p className="text-slate-700 mb-4">
            The frontend uses AWS Amplify to authenticate users and obtain JWT tokens. The tokens
            are automatically attached to API requests via the Authorization header.
          </p>
          <div className="space-y-3 mb-4">
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">1</div>
              <div>
                <div className="text-sm font-medium text-slate-900">User Signs In</div>
                <div className="text-xs text-slate-600">Amplify authenticates against Cognito User Pool (email + password)</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">2</div>
              <div>
                <div className="text-sm font-medium text-slate-900">Receive JWT Tokens</div>
                <div className="text-xs text-slate-600">Cognito returns ID token, access token, and refresh token</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">3</div>
              <div>
                <div className="text-sm font-medium text-slate-900">API Requests</div>
                <div className="text-xs text-slate-600">Token is passed as <code className="text-xs bg-white px-1 py-0.5 rounded">Authorization: Bearer &lt;id_token&gt;</code></div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">4</div>
              <div>
                <div className="text-sm font-medium text-slate-900">API Gateway Validates</div>
                <div className="text-xs text-slate-600">Cognito authorizer verifies token and extracts user groups</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">5</div>
              <div>
                <div className="text-sm font-medium text-slate-900">RBAC Check</div>
                <div className="text-xs text-slate-600">Lambda checks user's Cognito group against required role for the operation</div>
              </div>
            </div>
          </div>
          <CodeBlock code={`// Frontend - Amplify automatically attaches token
import { fetchAuthSession } from 'aws-amplify/auth';

const session = await fetchAuthSession();
const token = session.tokens?.idToken?.toString();

// API call with auth header
const response = await fetch('/v1/channels', {
  headers: {
    'Authorization': \`Bearer \${token}\`,
    'Content-Type': 'application/json'
  }
});`} language="typescript" />
        </section>

        {/* ESAM Endpoint Auth */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">ESAM Endpoint Authentication</h2>
          <p className="text-slate-700 mb-4">
            The ESAM endpoint supports optional <strong>HTTP Basic Authentication</strong> for encoder-to-POIS
            communication. This is separate from the Cognito-based dashboard auth. It is designed for
            machine-to-machine authentication between the encoder and the POIS server.
          </p>
          <CodeBlock code={`{
  "authConfig": {
    "authEnabled": true,
    "username": "esam-encoder",
    "ssmParameterPath": "/pois/channels/my-channel/esam-password"
  }
}`} language="json" />
          <Callout type="warning" title="Password Storage">
            Channel ESAM passwords are stored in AWS Systems Manager Parameter Store (SecureString).
            The password is auto-generated when auth is enabled and can be regenerated via the
            <code> POST /channels/:id/auth/regenerate</code> endpoint.
          </Callout>
        </section>

        {/* Token Structure */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">JWT Token Structure</h2>
          <p className="text-slate-700 mb-4">
            The ID token from Cognito contains the user's group membership in the <code className="px-2 py-1 bg-slate-100 rounded text-sm">cognito:groups</code> claim:
          </p>
          <CodeBlock code={`// Decoded JWT payload (ID Token)
{
  "sub": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "email": "admin@example.com",
  "email_verified": true,
  "cognito:groups": ["admin"],
  "iss": "https://cognito-idp.<region>.amazonaws.com/<USER_POOL_ID>",
  "aud": "<APP_CLIENT_ID>",
  "token_use": "id",
  "auth_time": 1705318200,
  "exp": 1705321800
}`} language="json" />
          <Table
            headers={['Claim', 'Description']}
            rows={[
              [<code className="text-xs">cognito:groups</code>, 'Array of Cognito groups the user belongs to (used for RBAC)'],
              [<code className="text-xs">email</code>, 'User email address'],
              [<code className="text-xs">sub</code>, 'Unique user identifier (UUID)'],
              [<code className="text-xs">exp</code>, 'Token expiration time (epoch seconds), typically 1 hour'],
            ]}
          />
        </section>

        {/* Troubleshooting */}
        <section className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100">
          <h3 className="text-lg font-semibold text-slate-900 mb-3">Common Issues</h3>
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-800">401 Unauthorized</h4>
              <p className="text-sm text-slate-700">Token expired or invalid. Amplify should auto-refresh. Check if the refresh token is still valid.</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-800">403 Forbidden</h4>
              <p className="text-sm text-slate-700">User authenticated but lacks the required role. Check Cognito group membership.</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-800">User not receiving confirmation email</h4>
              <p className="text-sm text-slate-700">Check SES sandbox limits. In sandbox mode, both sender and recipient must be verified.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
