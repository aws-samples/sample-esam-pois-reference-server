// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

export default function Card({ children, className = '', padding = 'md', interactive = false }: CardProps) {
  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 ${paddings[padding]} ${
        interactive ? 'hover:border-slate-300 transition-colors cursor-pointer' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
