// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useState, useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ErrorAlertProps {
  message: string;
  onClose?: () => void;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

export default function ErrorAlert({ 
  message, 
  onClose, 
  autoClose = true, 
  autoCloseDelay = 5000 
}: ErrorAlertProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [timeLeft, setTimeLeft] = useState(autoCloseDelay / 1000);

  useEffect(() => {
    if (!autoClose) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleClose identity is intentionally not tracked
  }, [autoClose]);

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  if (!isVisible) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 animate-slideDown">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <AlertCircle className="h-5 w-5 text-red-600" />
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">Error</h3>
          <p className="mt-1 text-sm text-red-700">{message}</p>
          {autoClose && (
            <p className="mt-2 text-xs text-red-600">
              Auto-closing in {timeLeft}s
            </p>
          )}
        </div>
        <button
          onClick={handleClose}
          className="ml-3 flex-shrink-0 inline-flex text-red-400 hover:text-red-600 focus:outline-none"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
