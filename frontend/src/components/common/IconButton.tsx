// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { ButtonHTMLAttributes, forwardRef } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  children: React.ReactNode;
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = 'ghost', size = 'md', children, className = '', ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variants = {
      primary: 'text-primary-600 hover:text-primary-700 hover:bg-primary-50 focus:ring-primary-500',
      secondary: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50 focus:ring-blue-500',
      danger: 'text-red-600 hover:text-red-700 hover:bg-red-50 focus:ring-red-500',
      ghost: 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:ring-gray-500',
    };
    
    const sizes = {
      sm: 'p-1',
      md: 'p-1.5',
    };
    
    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';

export default IconButton;
