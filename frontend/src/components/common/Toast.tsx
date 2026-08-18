// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

/**
 * Props for the Toast notification component.
 */
interface ToastProps {
  /** The message to display in the toast */
  message: string;
  /** Visual variant — determines color scheme */
  variant: 'success' | 'error';
  /** Callback invoked when the toast is dismissed */
  onClose: () => void;
  /** Auto-dismiss duration in milliseconds (default 4000) */
  duration?: number;
}

/**
 * Fixed-position toast notification that auto-dismisses after a configurable duration.
 * Renders at top-right with a fade-out transition.
 */
export default function Toast({ message, variant, onClose, duration = 4000 }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  useEffect(() => {
    if (!visible) {
      const fadeTimer = setTimeout(onClose, 300);
      return () => clearTimeout(fadeTimer);
    }
  }, [visible, onClose]);

  const variants = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
  };

  const icons = {
    success: <CheckCircle className="h-5 w-5 text-green-500" />,
    error: <XCircle className="h-5 w-5 text-red-500" />,
  };

  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg transition-opacity duration-300 ${variants[variant]} ${visible ? 'opacity-100' : 'opacity-0'}`}
      role="alert"
    >
      {icons[variant]}
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={() => setVisible(false)}
        className="ml-2 p-0.5 rounded hover:bg-black/5 transition-colors"
        aria-label="Close notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
