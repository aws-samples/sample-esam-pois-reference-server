// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { fetchAuthSession } from 'aws-amplify/auth';
import type { RootState } from '../index';
import { setCredentials, logout } from '../slices/authSlice';

const baseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  prepareHeaders: (headers, { getState }) => {
    // Cognito Authorizer validates the ID token (which contains cognito:groups)
    const token = (getState() as RootState).auth.idToken;
    if (token) {
      headers.set('Authorization', token);
    }
    return headers;
  },
});

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    try {
      const session = await fetchAuthSession({ forceRefresh: true });
      const newAccessToken = session.tokens?.accessToken?.toString();
      const newIdToken = session.tokens?.idToken?.toString();

      if (newAccessToken) {
        const state = api.getState() as RootState;
        const currentUser = state.auth.user;

        if (currentUser) {
          api.dispatch(
            setCredentials({
              user: currentUser,
              accessToken: newAccessToken,
              idToken: newIdToken || '',
            })
          );
        }

        result = await baseQuery(args, api, extraOptions);
      } else {
        api.dispatch(logout());
      }
    } catch {
      api.dispatch(logout());
    }
  }

  return result;
};

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Channel', 'User', 'Preferences'],
  endpoints: () => ({}),
});
