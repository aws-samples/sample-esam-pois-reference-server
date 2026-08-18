// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React, { createContext, useContext } from 'react';

interface NavigationContextType {
  navigateTo: (sectionId: string) => void;
}

const NavigationContext = createContext<NavigationContextType>({
  navigateTo: () => {},
});

export const NavigationProvider: React.FC<{
  onNavigate: (sectionId: string) => void;
  children: React.ReactNode;
}> = ({ onNavigate, children }) => {
  return (
    <NavigationContext.Provider value={{ navigateTo: onNavigate }}>
      {children}
    </NavigationContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with its provider by design
export const useDocNavigation = () => useContext(NavigationContext);
