// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store';
import { initializeAuth } from './config/amplify';
import Dashboard from './components/layout/Dashboard';
import ChannelsPage from './pages/channels/ChannelsPage';
import ChannelForm from './components/channels/ChannelForm';
import ChannelDetails from './components/channels/ChannelDetails';
import MonitoringPage from './pages/monitoring/MonitoringPage';
import LoginPage from './pages/auth/LoginPage';
import ProfilePage from './pages/ProfilePage';
import NotFound from './pages/NotFound';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AdminRoute from './components/auth/AdminRoute';
import { DocumentationPage } from './pages/documentation/DocumentationPage';
import UsersPage from './pages/users/UsersPage';

function App() {
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    initializeAuth()
      .then(() => setAuthReady(true))
      .catch(() => setAuthError(true));
  }, []);

  if (authError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-red-100 rounded-full mb-4">
            <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Server Unavailable</h2>
          <p className="text-sm text-gray-500 mb-4">Unable to load authentication configuration.</p>
          <button className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700" onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  if (!authReady) return null;

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>}>
              <Route index element={<Navigate to="/channels" replace />} />
              <Route path="channels" element={<ChannelsPage />} />
              <Route path="channels/new" element={<ChannelForm />} />
              <Route path="channels/:channelId" element={<ChannelDetails />} />
              <Route path="channels/:channelId/edit" element={<ChannelForm />} />
              <Route path="monitoring" element={<MonitoringPage />} />
              <Route path="users" element={<AdminRoute><UsersPage /></AdminRoute>} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="documentation" element={<DocumentationPage />} />
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </PersistGate>
    </Provider>
  );
}

export default App;
