"use client";

import { Toaster, toast } from "react-hot-toast";

export function CustomToaster() {
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        className: '',
        style: {
          background: '#1a1a1a',
          color: '#fff',
          border: '1px solid #333',
          borderRadius: '12px',
          padding: '12px 16px',
          fontSize: '14px',
        },
        success: {
          iconTheme: {
            primary: '#10b981',
            secondary: '#1a1a1a',
          },
        },
        error: {
          iconTheme: {
            primary: '#ef4444',
            secondary: '#1a1a1a',
          },
        },
      }}
    />
  );
}

export { toast };
