'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Название окна для скринридеров. */
  label: string;
  className?: string;
  children: ReactNode;
}

/**
 * Окно на основе нативного <dialog>: фокус остаётся внутри, Esc закрывает, фон под окном неактивен.
 * Содержимое создаётся только пока окно открыто, поэтому при повторном открытии состояние сбрасывается.
 */
export function Modal({ open, onClose, label, className = '', children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`modal ${className}`.trim()}
      aria-label={label}
      onClose={onClose}
      onClick={(e) => {
        // клик по затемнённому фону (сам <dialog>), а не по содержимому
        if (e.target === ref.current) onClose();
      }}
    >
      {open ? <div className="modal__body">{children}</div> : null}
    </dialog>
  );
}
