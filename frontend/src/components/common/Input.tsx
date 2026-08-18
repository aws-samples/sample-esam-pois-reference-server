// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { InputHTMLAttributes, forwardRef, useState } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', required, onInvalid, ...props }, ref) => {
    const [touched, setTouched] = useState(false);
    const showRequired = required && touched && !props.value && props.value !== 0;

    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            {label}
            {required && <span className="text-red-400 ml-0.5"></span>}
          </label>
        )}
        <input
          ref={ref}
          required={required}
          className={`
            w-full px-3 py-2
            border rounded-md
            text-sm text-slate-900
            placeholder:text-slate-400
            focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500
            disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed
            transition-colors
            ${error || showRequired ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' : 'border-slate-300'}
            ${className}
          `}
          onBlur={(e) => {
            setTouched(true);
            props.onBlur?.(e);
          }}
          onInvalid={(e) => {
            e.preventDefault();
            setTouched(true);
            onInvalid?.(e);
          }}
          {...props}
        />
        {(error || showRequired) && (
          <p className="mt-1 text-xs text-red-500">
            {error || 'This field is required'}
          </p>
        )}
        {helperText && !error && !showRequired && (
          <p className="mt-1 text-xs text-slate-500">{helperText}</p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

export default Input;
