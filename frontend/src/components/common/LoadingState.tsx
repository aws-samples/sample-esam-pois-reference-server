// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Spinner from './Spinner';

/**
 * Props for the LoadingState component.
 */
interface LoadingStateProps {
  /** Optional message displayed below the spinner */
  message?: string;
  /** Size variant controlling layout and spinner dimensions */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Loading indicator with configurable size for full-page, section, or inline contexts.
 *
 * - `sm` — inline spinner, no min-height (for cards/sections)
 * - `md` — medium spinner with vertical padding
 * - `lg` — full-page layout with viewport-relative min-height (default)
 */
export default function LoadingState({ message = 'Loading...', size = 'lg' }: LoadingStateProps) {
  const sizeStyles = {
    sm: 'flex flex-col items-center justify-center space-y-2',
    md: 'flex flex-col items-center justify-center py-12 space-y-3',
    lg: 'flex flex-col items-center justify-center min-h-[calc(100vh-12rem)] space-y-4',
  };

  const spinnerSizes = {
    sm: 'sm' as const,
    md: 'md' as const,
    lg: 'lg' as const,
  };

  return (
    <div className={sizeStyles[size]}>
      <Spinner size={spinnerSizes[size]} />
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}
