// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

/**
 * Props for the EmptyState component.
 */
interface EmptyStateProps {
  /** Custom icon element displayed above the title */
  icon?: ReactNode;
  /** Primary heading text */
  title: string;
  /** Optional description text below the title */
  description?: string;
  /** Optional action element (e.g. a button) below the description */
  action?: ReactNode;
  /** Display variant — "card" wraps in a Card-style container, "inline" renders without wrapper */
  variant?: 'card' | 'inline';
}

/**
 * Placeholder view for empty data states. Supports a "card" variant (default)
 * with a Card-style wrapper, and an "inline" variant for use inside existing
 * containers like DataTable.
 */
export default function EmptyState({ 
  icon, 
  title, 
  description, 
  action,
  variant = 'card',
}: EmptyStateProps) {
  const content = (
    <>
      <div className="flex justify-center mb-4">
        {icon || <Inbox className="h-12 w-12 text-gray-400" />}
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 mb-6">{description}</p>
      )}
      {action && <div>{action}</div>}
    </>
  );

  if (variant === 'inline') {
    return (
      <div className="p-12 text-center">
        {content}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
      {content}
    </div>
  );
}
