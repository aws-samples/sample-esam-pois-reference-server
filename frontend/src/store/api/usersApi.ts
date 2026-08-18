// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { apiSlice } from './apiSlice';

export interface CognitoUser {
  username: string;
  email: string;
  name: string;
  enabled: boolean;
  status: 'CONFIRMED' | 'FORCE_CHANGE_PASSWORD' | 'RESET_REQUIRED';
  groups: string[];
  createdAt: string;
}

export interface CreateUserRequest {
  email: string;
  name: string;
  /** When true, Cognito generates the password and emails an invitation. */
  sendInvitation?: boolean;
  /** Required when sendInvitation is false. */
  temporaryPassword?: string;
  group: 'admin' | 'user';
}

export interface ChangeGroupRequest {
  group: 'admin' | 'user';
}

export interface ResetPasswordRequest {
  temporaryPassword: string;
}

export const usersApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getUsers: builder.query<CognitoUser[], void>({
      query: () => '/users',
      providesTags: ['User'],
    }),
    createUser: builder.mutation<void, CreateUserRequest>({
      query: (body) => ({
        url: '/users',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['User'],
    }),
    disableUser: builder.mutation<void, string>({
      query: (username) => ({
        url: `/users/${username}/disable`,
        method: 'POST',
      }),
      invalidatesTags: ['User'],
    }),
    enableUser: builder.mutation<void, string>({
      query: (username) => ({
        url: `/users/${username}/enable`,
        method: 'POST',
      }),
      invalidatesTags: ['User'],
    }),
    resetPassword: builder.mutation<void, { username: string; temporaryPassword: string }>({
      query: ({ username, temporaryPassword }) => ({
        url: `/users/${username}/reset-password`,
        method: 'POST',
        body: { temporaryPassword },
      }),
      invalidatesTags: ['User'],
    }),
    changeUserGroup: builder.mutation<void, { username: string; group: 'admin' | 'user' }>({
      query: ({ username, group }) => ({
        url: `/users/${username}/group`,
        method: 'PUT',
        body: { group },
      }),
      invalidatesTags: ['User'],
    }),
    deleteUser: builder.mutation<void, string>({
      query: (username) => ({
        url: `/users/${username}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['User'],
    }),
  }),
});

export const {
  useGetUsersQuery,
  useCreateUserMutation,
  useDisableUserMutation,
  useEnableUserMutation,
  useResetPasswordMutation,
  useChangeUserGroupMutation,
  useDeleteUserMutation,
} = usersApi;
