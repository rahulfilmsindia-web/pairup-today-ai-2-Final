import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ShieldCheck, Phone, Lock, KeyRound, X, AlertCircle, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';

export const AuthGatewayModal: React.FC = () => {
  const {
    showAuthModal,
    authModalTab,
    closeAuthModal,
    openAuthModal,
    requestOtp,
    registerWithOtp,
    loginWithPassword,
    checkPhoneRegistered,
    resetPassword,
    bookingContext
  } = useAuth();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<'login' | 'signin' | 'forgot'>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [forgotStep, setForgotStep] = useState<'phone_otp' | 'set_password' | 'success'>('phone_otp');
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [unregisteredError, setUnregisteredError] = useState(false);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  // Forgot Password state
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');

  useEffect(() => {
    setActiveTab(authModalTab);
    setErrorMsg(null);
    setSuccessMsg(null);
    setUnregisteredError(false);
    setForgotStep('phone_otp');
  }, [authModalTab, showAuthModal]);

  // 60s countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  if (!showAuthModal) return null;

  const handleSendOtp = async () => {
    setErrorMsg(null);
    setUnregisteredError(false);
    if (!phone || phone.length < 10) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number (+91).');
      return;
    }

    setLoading(true);
    const phoneCheck = await checkPhoneRegistered(phone);
    if (activeTab === 'signin' && phoneCheck.registered) {
      setLoading(false);
      setErrorMsg('Mobile number already registered. Switched to login.');
      setActiveTab('login');
      return;
    }

    const result = await requestOtp(phone, activeTab === 'signin' ? 'registration' : 'login');
    setLoading(false);

    if (result.success) {
      setOtpSent(true);
      setCountdown(60);
      if (result.devCode) {
        setDevOtpHint(result.devCode);
        setOtp(result.devCode);
      }
    } else {
      setErrorMsg(result.error || 'Failed to send OTP.');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setUnregisteredError(false);

    if (!phone || !password) {
      setErrorMsg('Please enter both mobile number and password.');
      return;
    }

    setLoading(true);
    const result = await loginWithPassword(phone, password);
    setLoading(false);

    if (!result.success) {
      if (result.isNotRegistered) {
        setUnregisteredError(true);
      } else {
        setErrorMsg(result.error || 'Invalid credentials. Please verify your phone and password.');
      }
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!otpSent) {
      await handleSendOtp();
      return;
    }

    if (!otp || otp.length !== 6) {
      setErrorMsg('Please enter the 6-digit OTP received on your mobile.');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    const result = await registerWithOtp(phone, otp, password);
    setLoading(false);

    if (!result.success) {
      setErrorMsg(result.error || 'Registration failed.');
    }
  };

  // --- FORGOT PASSWORD HANDLERS ---
  const handleForgotSendOtp = async () => {
    setErrorMsg(null);
    if (!forgotPhone || forgotPhone.length < 10) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number (+91).');
      return;
    }
    setLoading(true);
    const phoneCheck = await checkPhoneRegistered(forgotPhone);
    if (!phoneCheck.registered) {
      setLoading(false);
      setErrorMsg('This number is not registered yet. Please create a new account.');
      return;
    }
    const result = await requestOtp(forgotPhone, 'password-reset');
    setLoading(false);
    if (result.success) {
      setOtpSent(true);
      setCountdown(60);
      if (result.devCode) {
        setDevOtpHint(result.devCode);
        setForgotOtp(result.devCode);
      }
    } else {
      setErrorMsg(result.error || 'Failed to send OTP.');
    }
  };

  const handleForgotVerifyOtp = () => {
    setErrorMsg(null);
    if (!forgotOtp || forgotOtp.length !== 6) {
      setErrorMsg('Please enter the 6-digit OTP received on your mobile.');
      return;
    }
    setForgotStep('set_password');
  };

  const handleForgotSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!forgotNewPassword || forgotNewPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter.');
      return;
    }
    setLoading(true);
    const result = await resetPassword(forgotPhone, forgotOtp, forgotNewPassword);
    setLoading(false);
    if (result.success) {
      setForgotStep('success');
      setSuccessMsg(result.message || 'Password reset successfully!');
      // After 2 seconds, redirect to login with phone prefilled
      setTimeout(() => {
        setActiveTab('login');
        setPhone(forgotPhone);
        setForgotPhone('');
        setForgotOtp('');
        setForgotNewPassword('');
        setForgotConfirmPassword('');
        setOtpSent(false);
        setDevOtpHint(null);
        setForgotStep('phone_otp');
        setSuccessMsg(null);
      }, 2000);
    } else {
      setErrorMsg(result.error || 'Failed to reset password.');
      // If OTP was wrong, go back to OTP step
      if (result.error?.toLowerCase().includes('otp') || result.error?.toLowerCase().includes('incorrect')) {
        setForgotStep('phone_otp');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl shadow-pink-500/10 overflow-hidden text-slate-100">
        
        {/* Header with security banner */}
        <div className="p-6 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/image_AIIEuv.png_bc62f6e1.png"
              alt="PairUpToday"
              className="w-9 h-9 rounded-full object-cover ring-1 ring-amber-400"
            />
            <div>
              <h3 className="text-base font-bold text-slate-100">
                {t.authGatewayTitle}
              </h3>
              <p className="text-[11px] text-slate-400">
                {t.authGatewaySubtitle}
              </p>
            </div>
          </div>
          
          <button
            onClick={closeAuthModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Companion Booking Context Banner */}
        {bookingContext && (
          <div className="px-5 py-2.5 bg-gradient-to-r from-pink-950/70 via-slate-900 to-slate-900 border-b border-pink-500/20 flex items-center justify-between text-xs">
            <span className="text-slate-300">
              Booking: <strong className="text-pink-300">{bookingContext.companionName}</strong>
            </span>
            <span className="text-amber-400 font-bold">₹{bookingContext.hourlyRate}/hr</span>
          </div>
        )}

        {/* Tab Switcher: Login vs Sign In (hide when forgot tab active) */}
        {activeTab !== 'forgot' && (
        <div className="flex border-b border-slate-800 bg-slate-950/50">
          <button
            onClick={() => {
              setActiveTab('login');
              setErrorMsg(null);
              setUnregisteredError(false);
            }}
            className={`flex-1 py-3 text-xs sm:text-sm font-bold text-center transition-colors border-b-2 ${
              activeTab === 'login'
                ? 'border-amber-400 text-amber-400 bg-slate-900/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.tabLogin}
          </button>
          <button
            onClick={() => {
              setActiveTab('signin');
              setErrorMsg(null);
              setUnregisteredError(false);
            }}
            className={`flex-1 py-3 text-xs sm:text-sm font-bold text-center transition-colors border-b-2 ${
              activeTab === 'signin'
                ? 'border-pink-500 text-pink-400 bg-slate-900/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.tabSignIn} (New Account)
          </button>
        </div>
        )}

        {/* Forgot Password Tab Header */}
        {activeTab === 'forgot' && (
          <div className="px-6 py-3 bg-slate-950/50 border-b border-slate-800 flex items-center gap-2">
            <button
              onClick={() => {
                setActiveTab('login');
                setErrorMsg(null);
                setSuccessMsg(null);
                setOtpSent(false);
                setForgotStep('phone_otp');
                setForgotPhone('');
                setForgotOtp('');
                setForgotNewPassword('');
                setForgotConfirmPassword('');
                setDevOtpHint(null);
                setCountdown(0);
              }}
              className="text-slate-400 hover:text-amber-400 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-amber-400">Forgot Password</span>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6">
          
          {/* Unregistered User Message Banner */}
          {unregisteredError && (
            <div className="mb-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <span>Not registered yet? Please </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('signin');
                    setUnregisteredError(false);
                  }}
                  className="font-bold underline text-amber-200 hover:text-white cursor-pointer"
                >
                  Sign In
                </button>
                <span> to create your account.</span>
              </div>
            </div>
          )}

          {/* General Error Message */}
          {errorMsg && !unregisteredError && (
            <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Message */}
          {successMsg && (
            <div className="mb-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Dev OTP Hint */}
          {devOtpHint && (
            <div className="mb-4 p-2.5 rounded-lg bg-sky-950/60 border border-sky-500/30 text-[11px] text-sky-300 flex items-center justify-between">
              <span>Security Network Code: <strong className="font-mono text-sm">{devOtpHint}</strong></span>
              <span className="text-[10px] text-slate-400">PairUp Security Network</span>
            </div>
          )}

          {activeTab === 'forgot' ? (
            /* ===== FORGOT PASSWORD TAB ===== */
            <div className="space-y-4">
              {forgotStep === 'success' ? (
                <div className="text-center py-8 space-y-3">
                  <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
                  <p className="text-sm font-bold text-slate-100">Password Reset Successful!</p>
                  <p className="text-xs text-slate-400">Redirecting to login...</p>
                </div>
              ) : forgotStep === 'set_password' ? (
                <form onSubmit={handleForgotSetPassword} className="space-y-4">
                  <p className="text-xs text-slate-400">OTP verified! Set your new password below.</p>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      New Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        value={forgotNewPassword}
                        onChange={e => setForgotNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Re-enter New Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        value={forgotConfirmPassword}
                        onChange={e => setForgotConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-slate-950 text-sm font-bold shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.01] active:scale-98 disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save New Password'}
                  </button>
                </form>
              ) : (
                /* Step 1: Phone + OTP */
                <div className="space-y-4">
                  <p className="text-xs text-slate-400">Enter your registered mobile number. We'll send you an OTP to verify.</p>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Registered Mobile Number
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs font-semibold">
                          +91
                        </div>
                        <input
                          type="tel"
                          value={forgotPhone}
                          onChange={e => setForgotPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          placeholder="9876543210"
                          maxLength={10}
                          disabled={otpSent}
                          className="w-full pl-12 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 disabled:opacity-60"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleForgotSendOtp}
                        disabled={loading || countdown > 0 || forgotPhone.length < 10}
                        className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold border border-slate-700 disabled:opacity-50 whitespace-nowrap"
                      >
                        {countdown > 0 ? `${countdown}s` : otpSent ? 'Resend' : 'Send OTP'}
                      </button>
                    </div>
                  </div>

                  {otpSent && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Enter OTP
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <KeyRound className="w-4 h-4" />
                          </div>
                          <input
                            type="text"
                            value={forgotOtp}
                            onChange={e => setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="Enter 6-digit OTP"
                            maxLength={6}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono tracking-widest text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleForgotVerifyOtp}
                        disabled={loading || forgotOtp.length !== 6}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-slate-950 text-sm font-bold shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.01] active:scale-98 disabled:opacity-50"
                      >
                        Verify OTP & Continue
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : activeTab === 'login' ? (
            /* ===== LOGIN TAB ===== */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {t.phoneLabel}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs font-semibold">
                    +91
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9876543210"
                    maxLength={10}
                    className="w-full pl-12 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {t.passwordLabel}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter account password"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    required
                  />
                </div>
              </div>

              {/* Forgot Password Link */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('forgot');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setForgotStep('phone_otp');
                    setOtpSent(false);
                    setDevOtpHint(null);
                    setCountdown(0);
                  }}
                  className="text-xs text-amber-400 hover:text-amber-300 underline font-semibold"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-sky-500 hover:from-amber-600 hover:to-sky-600 text-slate-950 text-sm font-bold shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.01] active:scale-98 disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : t.loginButton}
              </button>
            </form>
          ) : (
            /* ===== SIGN IN (REGISTRATION) TAB ===== */
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {t.phoneLabel}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs font-semibold">
                      +91
                    </div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="9876543210"
                      maxLength={10}
                      className="w-full pl-12 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-pink-500"
                      required
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={loading || countdown > 0 || phone.length < 10}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-pink-400 text-xs font-semibold border border-slate-700 disabled:opacity-50 whitespace-nowrap"
                  >
                    {countdown > 0 ? `${countdown}s` : otpSent ? 'Resend' : 'Send OTP'}
                  </button>
                </div>
              </div>

              {otpSent && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    {t.otpLabel}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter 6-digit OTP"
                      maxLength={6}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono tracking-widest text-slate-100 placeholder-slate-500 focus:outline-none focus:border-pink-500"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Set Account Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Create at least 6 characters"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-pink-500"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white text-sm font-bold shadow-lg shadow-pink-500/20 transition-all hover:scale-[1.01] active:scale-98 disabled:opacity-50"
              >
                {loading ? 'Processing...' : otpSent ? 'Verify OTP & Create Account' : 'Request OTP to Continue'}
              </button>
            </form>
          )}

          {/* Customer Facing Security Branding */}
          <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.securityBranding}</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
