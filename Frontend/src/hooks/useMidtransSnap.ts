import { useCallback, useEffect, useState } from 'react';

export type SnapCallbacks = {
  onSuccess?: (result: any) => void;
  onPending?: (result: any) => void;
  onError?: (error: any) => void;
  onClose?: () => void;
};

export type SnapPaymentData = {
  token: string;
  callbacks?: SnapCallbacks;
};

declare global {
  interface Window {
    snap?: {
      pay: (token: string, callbacks?: SnapCallbacks) => void;
    };
  }
}

export function useMidtransSnap() {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Prevent duplicate script loading
    if (window.snap) {
      setIsReady(true);
      setIsLoading(false);
      return;
    }

    const snapUrl = import.meta.env.VITE_MIDTRANS_SNAP_URL;
    const clientKey = import.meta.env.VITE_MIDTRANS_CLIENT_KEY;

    if (!snapUrl || !clientKey) {
      setError('Midtrans client key or snap URL not configured');
      setIsLoading(false);
      return;
    }

    const script = document.createElement('script');
    script.id = 'midtrans-snap-script';
    script.src = snapUrl;
    script.setAttribute('data-client-key', clientKey);
    script.async = true;

    script.onload = () => {
      setIsReady(true);
      setIsLoading(false);
    };

    script.onerror = () => {
      setError('Failed to load Midtrans Snap');
      setIsLoading(false);
    };

    document.head.appendChild(script);

    return () => {
      // Don't remove script on cleanup
    };
  }, []);

  const pay = useCallback(
    (token: string, callbacks: SnapCallbacks = {}) => {
      if (!window.snap) {
        callbacks.onError?.('Midtrans Snap not loaded');
        return;
      }

      window.snap.pay(token, {
        onSuccess: (result) => {
          callbacks.onSuccess?.(result);
        },
        onPending: (result) => {
          callbacks.onPending?.(result);
        },
        onError: (err) => {
          callbacks.onError?.(err);
        },
        onClose: () => {
          callbacks.onClose?.();
        },
      });
    },
    []
  );

  return {
    pay,
    isReady,
    isLoading,
    error,
  };
}