import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Safe Mobile Chrome Guard: Ensure ServiceWorkerRegistration.showNotification is preferred
if (typeof window !== 'undefined' && 'Notification' in window) {
  try {
    const desc = Object.getOwnPropertyDescriptor(window, 'Notification');
    if (!desc || desc.configurable !== false) {
      const NativeNotification = window.Notification;
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

      try {
        Object.defineProperty(window, 'Notification', {
          value: SafeNotification,
          writable: true,
          configurable: true
        });
      } catch {}
    }
  } catch {}
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
