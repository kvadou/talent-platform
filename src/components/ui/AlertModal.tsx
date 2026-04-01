'use client';

import { Modal } from './Modal';

interface AlertModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  buttonLabel?: string;
}

export function AlertModal({
  open,
  onClose,
  title,
  message,
  buttonLabel = 'OK',
}: AlertModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-white bg-purple-700 rounded-lg hover:bg-purple-800 transition-colors"
        >
          {buttonLabel}
        </button>
      }
    >
      <p className="text-gray-600">{message}</p>
    </Modal>
  );
}
