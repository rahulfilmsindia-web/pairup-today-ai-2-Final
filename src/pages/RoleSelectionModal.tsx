import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { UserCheck, Sparkles, Shield, ArrowRight, AlertCircle } from 'lucide-react';

interface RoleSelectionModalProps {
  onSelectRoleDone: (role: 'CLIENT' | 'COMPANION') => void;
}

export const RoleSelectionModal: React.FC<RoleSelectionModalProps> = ({ onSelectRoleDone }) => {
  const { showRoleSelection, selectActiveRole, user, logout } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!showRoleSelection || !user) return null;

  const handleSelectRole = async (role: 'CLIENT' | 'COMPANION') => {
    setErrorMsg(null);
    setLoading(true);
    const result = await selectActiveRole(role);
    setLoading(false);

    if (result.success) {
      onSelectRoleDone(role);
    } else {
      setErrorMsg(result.error || 'Failed to verify workspace access on backend.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 text-slate-100">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full overflow-hidden ring-2 ring-amber-400/50 shadow-lg shadow-pink-500/20">
            <img
              src="/assets/aistudio/image_AIIEuv.png_bc62f6e1.png"
              alt="PairUpToday"
              className="w-full h-full object-cover"
            />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            {t.roleSelectionTitle}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-md mx-auto">
            Welcome back, <strong className="text-slate-200">{user.legalName || user.phone}</strong>. {t.roleSelectionSubtitle}.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* EXACT TWO BUTTONS REQUIRED:
            "Enter as Client Member"
            "Enter as Companion Host" */}
        <div className="space-y-4">
          
          {/* Button 1: Enter as Client Member */}
          <button
            type="button"
            disabled={loading}
            onClick={() => handleSelectRole('CLIENT')}
            className="w-full p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-900 border border-amber-400/30 hover:border-amber-400 text-left transition-all duration-300 hover:scale-[1.01] group flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-400 flex items-center justify-center shrink-0">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="text-base font-bold text-slate-100 group-hover:text-amber-300 transition-colors">
                  {t.enterAsClient}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Discover and book verified companions. 100% Free membership.
                </div>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-amber-400 transition-transform group-hover:translate-x-1" />
          </button>

          {/* Button 2: Enter as Companion Host */}
          <button
            type="button"
            disabled={loading}
            onClick={() => handleSelectRole('COMPANION')}
            className="w-full p-5 rounded-2xl bg-gradient-to-r from-pink-500/15 via-slate-900 to-slate-900 border border-pink-500/30 hover:border-pink-500 text-left transition-all duration-300 hover:scale-[1.01] group flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-pink-500/20 border border-pink-500/40 text-pink-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <div className="text-base font-bold text-slate-100 group-hover:text-pink-300 transition-colors">
                  {t.enterAsCompanion}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Manage services, receive client bookings, and earn 85% net shares.
                </div>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-pink-400 transition-transform group-hover:translate-x-1" />
          </button>

        </div>

        {/* Security verification notice */}
        <div className="mt-8 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>PairUp Verified Network Authorization</span>
          </div>
          <button
            onClick={logout}
            className="text-slate-400 hover:text-red-400 underline"
          >
            Log out
          </button>
        </div>

      </div>
    </div>
  );
};
