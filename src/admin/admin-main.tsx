import React from 'react';
import { createRoot } from 'react-dom/client';
import { AdminAuthProvider } from '../context/AdminAuthContext';
import { LanguageProvider } from '../context/LanguageContext';
import { AdminPortal } from './AdminPortal';
import '../index.css';

const adminContainer = document.getElementById('admin-root');

if (adminContainer) {
  const root = createRoot(adminContainer);
  root.render(
    <React.StrictMode>
      <LanguageProvider>
        <AdminAuthProvider>
          <div className="min-h-screen w-full bg-slate-950 text-slate-100 overflow-x-hidden">
            <AdminPortal />
          </div>
        </AdminAuthProvider>
      </LanguageProvider>
    </React.StrictMode>
  );
}
