// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../../store';

interface AdminRouteProps {
  children: React.ReactNode;
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const { user } = useAppSelector((state) => state.auth);

  if (!user?.groups?.includes('admin')) {
    return <Navigate to="/channels" replace />;
  }

  return <>{children}</>;
}
