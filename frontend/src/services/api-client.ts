// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Channel } from '../types/channel';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

class ApiClient {
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Channels
  async getChannels(): Promise<Channel[]> {
    return this.request<Channel[]>('/channels');
  }

  async getChannel(channelId: string): Promise<Channel> {
    return this.request<Channel>(`/channels/${channelId}`);
  }

  async createChannel(channel: Channel): Promise<void> {
    await this.request('/channels', {
      method: 'POST',
      body: JSON.stringify(channel),
    });
  }

  async updateChannel(channelId: string, channel: Channel): Promise<void> {
    await this.request(`/channels/${channelId}`, {
      method: 'PUT',
      body: JSON.stringify(channel),
    });
  }

  async deleteChannel(channelId: string): Promise<void> {
    await this.request(`/channels/${channelId}`, {
      method: 'DELETE',
    });
  }

  // System info
  async getSystemInfo(): Promise<{ esamEndpoint: string; apiUrl: string }> {
    return this.request('/info');
  }
}

export const apiClient = new ApiClient();
