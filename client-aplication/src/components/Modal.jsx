import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

let openModalCount = 0;
let originalBodyOverflow = '';

export default function Modal({ title, onClose, children }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    if (openModalCount === 0)
      originalBodyOverflow = document.body.style.overflow;
    openModalCount++;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      openModalCount--;
      if (openModalCount === 0)
        document.body.style.overflow = originalBodyOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus();
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      className="modal-dialog"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        closeRef.current();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeRef.current();
      }}
    >
      {children}
    </dialog>,
    document.body,
  );
}
