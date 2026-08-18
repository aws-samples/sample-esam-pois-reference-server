// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React from 'react';

interface ToggleProps {
  /** Visible label. When omitted, provide ariaLabel for screen readers. */
  label?: string;
  /** Accessible name used when no visible label is rendered. */
  ariaLabel?: string;
  description?: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}

export default function Toggle({ label, ariaLabel, description, checked, onChange, disabled = false }: ToggleProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label ?? ariaLabel}
        disabled={disabled}
        onClick={() => {
          const syntheticEvent = {
            target: { checked: !checked },
            currentTarget: { checked: !checked }
          } as React.ChangeEvent<HTMLInputElement>;
          onChange(syntheticEvent);
        }}
        className={`
          relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors
          focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${checked ? 'bg-indigo-600' : 'bg-gray-300'}
        `}
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
            ${checked ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
      {(label || description) && (
        <div className="flex-1 min-w-0">
          {label && (
            <label className="block text-sm font-medium text-gray-900">
              {label}
            </label>
          )}
          {description && (
            <p className="text-sm text-gray-500 mt-0.5">{description}</p>
          )}
        </div>
      )}
    </div>
  );
}
