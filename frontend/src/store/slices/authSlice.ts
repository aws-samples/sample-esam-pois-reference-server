// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { 
  signIn, 
  signOut, 
  getCurrentUser,
  fetchUserAttributes,
  fetchAuthSession,
  confirmSignIn,
} from 'aws-amplify/auth';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  groups: string[];
  emailVerified: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  accessToken: string | null;
  idToken: string | null;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  accessToken: null,
  idToken: null,
};

export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      try {
        await signOut();
      } catch (e) {
        // Ignore
      }

      const result = await signIn({ username: email, password });
      
      if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        // Return a special payload so the UI can show the change password form
        return rejectWithValue('NEW_PASSWORD_REQUIRED');
      }

      if (!result.isSignedIn) {
        throw new Error('Sign in failed');
      }

      const user = await getCurrentUser();
      const attributes = await fetchUserAttributes();
      const session = await fetchAuthSession();

      const accessToken = session.tokens?.accessToken?.toString() || null;
      const idToken = session.tokens?.idToken?.toString() || null;
      const groups = (session.tokens?.accessToken?.payload['cognito:groups'] as string[]) || [];

      return {
        user: {
          id: user.userId,
          email: attributes.email || '',
          name: attributes.name || '',
          role: groups.includes('admin') ? 'admin' as const : 'user' as const,
          groups,
          emailVerified: attributes.email_verified === 'true',
        },
        accessToken,
        idToken,
      };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Login failed');
    }
  }
);

export const completeNewPassword = createAsyncThunk(
  'auth/completeNewPassword',
  async ({ newPassword }: { newPassword: string }, { rejectWithValue }) => {
    try {
      const result = await confirmSignIn({ challengeResponse: newPassword });

      if (!result.isSignedIn) {
        throw new Error('Password change failed');
      }

      const user = await getCurrentUser();
      const attributes = await fetchUserAttributes();
      const session = await fetchAuthSession();

      const accessToken = session.tokens?.accessToken?.toString() || null;
      const idToken = session.tokens?.idToken?.toString() || null;
      const groups = (session.tokens?.accessToken?.payload['cognito:groups'] as string[]) || [];

      return {
        user: {
          id: user.userId,
          email: attributes.email || '',
          name: attributes.name || '',
          role: groups.includes('admin') ? 'admin' as const : 'user' as const,
          groups,
          emailVerified: attributes.email_verified === 'true',
        },
        accessToken,
        idToken,
      };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Password change failed');
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await signOut();
      return null;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Logout failed');
    }
  }
);

export const checkAuth = createAsyncThunk(
  'auth/checkAuth',
  async (_, { rejectWithValue }) => {
    try {
      const user = await getCurrentUser();
      const attributes = await fetchUserAttributes();
      const session = await fetchAuthSession();

      if (!session.tokens) {
        return rejectWithValue('No valid session');
      }

      const accessToken = session.tokens.accessToken?.toString() || null;
      const idToken = session.tokens.idToken?.toString() || null;
      const groups = (session.tokens.accessToken?.payload['cognito:groups'] as string[]) || [];

      return {
        user: {
          id: user.userId,
          email: attributes.email || '',
          name: attributes.name || '',
          role: groups.includes('admin') ? 'admin' as const : 'user' as const,
          groups,
          emailVerified: attributes.email_verified === 'true',
        },
        accessToken,
        idToken,
      };
    } catch (error: any) {
      return rejectWithValue('Not authenticated');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setCredentials: (state, action: PayloadAction<{ user: User; accessToken: string; idToken: string }>) => {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.idToken = action.payload.idToken;
      state.isAuthenticated = true;
      state.isLoading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.idToken = action.payload.idToken;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        // Don't clear auth state for NEW_PASSWORD_REQUIRED (it's not a real error)
        if (action.payload !== 'NEW_PASSWORD_REQUIRED') {
          state.isAuthenticated = false;
          state.user = null;
        }
        state.error = action.payload as string;
      })
      .addCase(completeNewPassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(completeNewPassword.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.idToken = action.payload.idToken;
        state.error = null;
      })
      .addCase(completeNewPassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(logout.fulfilled, (state) => {
        state.isAuthenticated = false;
        state.user = null;
        state.accessToken = null;
        state.idToken = null;
        state.error = null;
      })
      .addCase(checkAuth.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.idToken = action.payload.idToken;
        state.error = null;
      })
      .addCase(checkAuth.rejected, (state) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.accessToken = null;
        state.idToken = null;
      });
  },
});

export const { clearError, setCredentials } = authSlice.actions;
export default authSlice.reducer;
