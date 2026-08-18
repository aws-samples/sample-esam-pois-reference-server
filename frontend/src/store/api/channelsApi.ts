// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { apiSlice } from './apiSlice';
import { Channel } from '../../types/channel';

export const channelsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getChannels: builder.query<Channel[], void>({
      query: () => '/channels',
      providesTags: ['Channel'],
    }),
    getChannel: builder.query<Channel, string>({
      query: (id) => `/channels/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Channel', id }],
    }),
    createChannel: builder.mutation<{ generatedPassword?: string }, Channel>({
      query: (channel) => ({
        url: '/channels',
        method: 'POST',
        body: channel,
      }),
      invalidatesTags: ['Channel'],
    }),
    updateChannel: builder.mutation<{ generatedPassword?: string }, { id: string; channel: Channel }>({
      query: ({ id, channel }) => ({
        url: `/channels/${id}`,
        method: 'PUT',
        body: channel,
      }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Channel', id }, 'Channel'],
    }),
    deleteChannel: builder.mutation<void, string>({
      query: (id) => ({
        url: `/channels/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Channel'],
    }),
    regenerateAuth: builder.mutation<{ password: string }, string>({
      query: (channelId) => ({
        url: `/channels/${channelId}/auth/regenerate`,
        method: 'POST',
      }),
      invalidatesTags: ['Channel'],
    }),
    getAuthPassword: builder.query<{ password: string }, string>({
      query: (channelId) => `/channels/${channelId}/auth/password`,
    }),
  }),
});

export const {
  useGetChannelsQuery,
  useGetChannelQuery,
  useCreateChannelMutation,
  useUpdateChannelMutation,
  useDeleteChannelMutation,
  useRegenerateAuthMutation,
  useLazyGetAuthPasswordQuery,
} = channelsApi;
