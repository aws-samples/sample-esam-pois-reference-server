// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { ReactNode } from 'react';
import { AlertTriangle, Info, CheckCircle, Trash2 } from 'lucide-react';
import Modal from './Modal';

/**
 * Props for the ConfirmModal component.
 */
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | ReactNode;
  confirmText?: string;
  cancelText?: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  isLoading?: boolean;
  /** Inline error message displayed above the buttons */
  error?: string | null;
}

/**
 * Confirmation dialog built on top of the base Modal component.
 * Displays an icon, title, message, and confirm/cancel buttons
 * with type-specific color theming.
 */
export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'info',
  isLoading = false,
  error = null,
}: ConfirmModalProps) {
  const getIcon = () => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="h-8 w-8 text-yellow-600" strokeWidth={2.5} />;
      case 'error':
        return <Trash2 className="h-8 w-8 text-red-600" strokeWidth={2.5} />;
      case 'success':
        return <CheckCircle className="h-8 w-8 text-green-600" strokeWidth={2.5} />;
      default:
        return <Info className="h-8 w-8 text-blue-600" strokeWidth={2.5} />;
    }
  };

  const getIconBgColor = () => {
    switch (type) {
      case 'warning':
        return 'bg-yellow-50';
      case 'error':
        return 'bg-red-50';
      case 'success':
        return 'bg-green-50';
      default:
        return 'bg-blue-50';
    }
  };

  const getConfirmButtonColor = () => {
    switch (type) {
      case 'warning':
        return 'bg-yellow-600 hover:bg-yellow-700';
      case 'error':
        return 'bg-red-600 hover:bg-red-700';
      case 'success':
        return 'bg-green-600 hover:bg-green-700';
      default:
        return 'bg-primary-600 hover:bg-primary-700';
    }
  };

  const getCancelButtonColor = () => {
    switch (type) {
      case 'error':
        return 'border-2 border-red-600 text-red-600 hover:bg-red-50';
      default:
        return 'border border-gray-300 text-gray-700 hover:bg-gray-50';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="md">
      <div className="flex flex-col items-center px-8 py-10">
        {/* Icon */}
        <div className="mb-6">
          <div className={`${getIconBgColor()} rounded-full p-4 relative`}>
            <div className={`absolute inset-0 ${getIconBgColor()} rounded-full opacity-50`}></div>
            <div className="relative z-10">{getIcon()}</div>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-2xl font-bold text-gray-900 mb-4" style={{ letterSpacing: '-0.02em' }}>
          {title}
        </h3>

        {/* Message */}
        <div className="mb-8 text-center">
          <div className="text-gray-400 text-sm leading-relaxed">
            {typeof message === 'string' ? <p>{message}</p> : message}
          </div>
        </div>

        {/* Inline error */}
        {error && (
          <div className="w-full mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className={`px-8 py-2.5 rounded-full transition-all font-semibold text-sm min-w-[120px] disabled:opacity-50 disabled:cursor-not-allowed ${getCancelButtonColor()}`}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-8 py-2.5 text-white rounded-full transition-all font-semibold text-sm min-w-[120px] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${getConfirmButtonColor()}`}
          >
            {isLoading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
