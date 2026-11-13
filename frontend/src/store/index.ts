// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  type Storage,
} from 'redux-persist';
import authReducer from './slices/authSlice';
import { apiSlice } from './api/apiSlice';

// Keep the browser adapter in application code instead of importing the
// CommonJS redux-persist storage module. Vite 8 can expose that deep import as
// a module namespace object, which has no getItem/setItem methods at runtime.
const browserStorage: Storage = {
  getItem: async (key: string) => window.localStorage.getItem(key),
  setItem: async (key: string, value: string) => {
    window.localStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    window.localStorage.removeItem(key);
  },
};

// Persist config for auth slice
const authPersistConfig = {
  key: 'pois-auth',
  storage: browserStorage,
  whitelist: ['user', 'idToken', 'accessToken', 'isAuthenticated'],
};

const persistedAuthReducer = persistReducer(authPersistConfig, authReducer);

export const store = configureStore({
  reducer: {
    auth: persistedAuthReducer,
    api: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(apiSlice.middleware),
  devTools: import.meta.env.DEV,
});

export const persistor = persistStore(store);

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
