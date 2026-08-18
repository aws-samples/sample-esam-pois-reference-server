// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useAppSelector } from '../store';
import SystemSettings from '../components/settings/SystemSettings';
import { Link } from 'react-router-dom';
import { BookOpen, FileText, Code } from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAppSelector((state) => state.auth);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Profile</h2>

      {/* User Info Card */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-20 h-20 bg-primary-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">{user?.name}</h3>
            <p className="text-gray-600">{user?.email}</p>
            <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${
              user?.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
            }`}>
              {user?.role?.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="border-t pt-6">
          <h4 className="font-medium text-gray-900 mb-4">Account Information</h4>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">User ID</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono">{user?.id}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Email Verified</dt>
              <dd className="mt-1 text-sm">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  user?.emailVerified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {user?.emailVerified ? 'Verified' : 'Not Verified'}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Groups</dt>
              <dd className="mt-1 text-sm text-gray-900">{user?.groups.join(', ') || 'None'}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h4 className="font-medium text-gray-900 mb-4">Quick Actions</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/documentation"
            className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
          >
            <div className="flex-shrink-0">
              <BookOpen className="w-8 h-8 text-indigo-600 group-hover:text-indigo-700" />
            </div>
            <div className="ml-4">
              <h5 className="text-sm font-medium text-gray-900 group-hover:text-indigo-900">
                Full Documentation
              </h5>
              <p className="text-xs text-gray-500 mt-1">
                Guides, API reference, and tutorials
              </p>
            </div>
          </Link>

          <Link
            to="/documentation?section=api"
            className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
          >
            <div className="flex-shrink-0">
              <Code className="w-8 h-8 text-indigo-600 group-hover:text-indigo-700" />
            </div>
            <div className="ml-4">
              <h5 className="text-sm font-medium text-gray-900 group-hover:text-indigo-900">
                API Reference
              </h5>
              <p className="text-xs text-gray-500 mt-1">
                Documentation for all endpoints
              </p>
            </div>
          </Link>

          <Link
            to="/documentation?section=troubleshooting"
            className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
          >
            <div className="flex-shrink-0">
              <FileText className="w-8 h-8 text-indigo-600 group-hover:text-indigo-700" />
            </div>
            <div className="ml-4">
              <h5 className="text-sm font-medium text-gray-900 group-hover:text-indigo-900">
                Troubleshooting
              </h5>
              <p className="text-xs text-gray-500 mt-1">
                Common problem resolution
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* System Settings */}
      <SystemSettings />
    </div>
  );
}
