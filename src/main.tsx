import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Bulletproof Mobile Chrome Guard: Prevent "Failed to construct 'Notification': Illegal constructor"
if (typeof window !== 'undefined' && 'Notification' in window) {
  try {
    const NativeNotification = window.Notification;
    // Test if new Notification() is legal in this environment
    let isConstructorAllowed = true;
    try {
      new (NativeNotification as any)('__test_probe__', { silent: true });
    } catch (testErr: any) {
      if (testErr && testErr.message && testErr.message.includes('Illegal constructor')) {
        isConstructorAllowed = false;
      }
    }

    if (!isConstructorAllowed) {
      const SafeNotification = function (title: string, options?: NotificationOptions) {
        if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then((reg) => {
            if (reg && typeof reg.showNotification === 'function') {
              reg.showNotification(title, options).catch(() => {});
            }
          }).catch(() => {});
        }
        return {} as Notification;
      };
      SafeNotification.permission = NativeNotification.permission;
      SafeNotification.requestPermission = NativeNotification.requestPermission
        ? NativeNotification.requestPermission.bind(NativeNotification)
        : () => Promise.resolve('denied');

      Object.defineProperty(window, 'Notification', {
        value: SafeNotification,
        writable: true,
        configurable: true
      });
    }
  } catch (guardErr) {
    console.warn('Notification polyfill notice:', guardErr);
  }
}

// Register Service Worker for background overlay alerts & notifications
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
