import React, { useState, useEffect } from 'react';
import { 
  Sparkles, CheckCircle2, ShieldCheck, Crown, Clock, Gift, 
  ArrowRight, AlertCircle, Copy, Check, Lock, Smartphone, RefreshCw 
} from 'lucide-react';
import { purchaseCompanionMembership, isNativePlatform, MEMBERSHIP_PRICE_INR } from '../services/paymentService';
import { redeemFirstUserCoupon, getReferralStatus } from '../services/referralService';

interface MembershipPageProps {
  user: any;
  onMembershipUpdated?: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const MembershipPage: React.FC<MembershipPageProps> = ({
  user,
  onMembershipUpdated,
  onNavigateTab
}) => {
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponFeedback, setCouponFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentFeedback, setPaymentFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [referralData, setReferralData] = useState<{
    hasUsedFreeTrial: boolean;
    isTrialPhoneUsed: boolean;
    membershipExpiry?: string | null;
  }>({
    hasUsedFreeTrial: Boolean(user?.hasUsedFreeTrial || user?.has_used_free_trial),
    isTrialPhoneUsed: false
  });

  const isNative = isNativePlatform();

  // Load latest anti-fraud trial status
  useEffect(() => {
    if (user?.id) {
      getReferralStatus(user.id).then(status => {
        setReferralData({
          hasUsedFreeTrial: status.hasUsedFreeTrial || Boolean(user?.hasUsedFreeTrial || user?.has_used_free_trial),
          isTrialPhoneUsed: status.isTrialPhoneUsed,
          membershipExpiry: user?.membershipExpiry || user?.membership_expiry
        });
      }).catch(() => {});
    }
  }, [user?.id]);

  const isFreeTrialUsed = referralData.hasUsedFreeTrial || referralData.isTrialPhoneUsed;
  const isCompanionActive = Boolean(user?.isCompanionActive || user?.is_companion_active);
  const membershipType = user?.membershipType || user?.membership_type || (isCompanionActive ? 'paid' : 'none');
  const membershipExpiry = user?.membershipExpiry || user?.membership_expiry || referralData.membershipExpiry;

  const expiryFormatted = membershipExpiry 
    ? new Date(membershipExpiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const daysRemaining = membershipExpiry 
    ? Math.max(0, Math.ceil((new Date(membershipExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  // 1. Paid Monthly Membership Trigger (₹449)
  const handlePurchaseMembership = async () => {
    setPaymentLoading(true);
    setPaymentFeedback(null);
    setCouponFeedback(null);

    try {
      const result = await purchaseCompanionMembership(user);
      if (result.success) {
        setPaymentFeedback({
          type: 'success',
          message: 'Membership activated successfully! Your Companion profile is now active on PairUp Verified Network.'
        });
        if (onMembershipUpdated) onMembershipUpdated();
      } else if (!result.cancelled) {
        setPaymentFeedback({
          type: 'error',
          message: result.error || 'Membership payment could not be completed.'
        });
      }
    } catch (err: any) {
      setPaymentFeedback({
        type: 'error',
        message: err.message || 'Payment failed. Please try again.'
      });
    } finally {
      setPaymentLoading(false);
    }
  };

  // 2. Free Trial Coupon Redemption (`FIRST3FREE`)
  const handleRedeemCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;

    setCouponLoading(true);
    setCouponFeedback(null);
    setPaymentFeedback(null);

    try {
      const result = await redeemFirstUserCoupon(
        couponCode.trim(),
        user?.phone || '',
        user?.id || ''
      );

      if (result.success) {
        setPaymentFeedback({
          type: 'success',
          message: result.message || '🎉 Congratulations! 3 Months Free Companion Membership activated successfully!'
        });
        setReferralData(prev => ({
          ...prev,
          hasUsedFreeTrial: true,
          isTrialPhoneUsed: true,
          membershipExpiry: result.membershipExpiry
        }));
        setCouponCode('');
        if (onMembershipUpdated) onMembershipUpdated();
      } else {
        setCouponFeedback({
          type: 'error',
          message: result.error || 'Coupon code invalid or trial already redeemed.'
        });
      }
    } catch (err: any) {
      setCouponFeedback({
        type: 'error',
        message: err.message || 'Failed to redeem coupon.'
      });
    } finally {
      setCouponLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Crown className="w-6 h-6 text-amber-500" />
            <span>Companion Membership</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Activate your hosting capability to accept real-world companion bookings across your city.
          </p>
        </div>

        {/* Live Status Badge */}
        {isCompanionActive ? (
          <span className="self-start sm:self-auto px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-700 text-xs font-black flex items-center gap-1.5 shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>
              {membershipType === 'free_trial' ? 'Free Trial Active' : 'Membership Active'}
              {daysRemaining > 0 ? ` (${daysRemaining}d left)` : ''}
            </span>
          </span>
        ) : (
          <span className="self-start sm:self-auto px-3.5 py-1.5 rounded-full bg-rose-50 border border-rose-300 text-rose-700 text-xs font-black flex items-center gap-1.5 shadow-xs">
            <Clock className="w-4 h-4 text-rose-600" />
            <span>Membership Inactive</span>
          </span>
        )}
      </div>

      {/* Active Membership Banner */}
      {isCompanionActive && expiryFormatted && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-900 to-indigo-900 text-white shadow-md space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-200">
              {membershipType === 'free_trial' ? '🎁 3-Month Promotional Free Trial' : '👑 Paid Monthly Membership'}
            </span>
            <span className="text-xs bg-white/20 px-2.5 py-0.5 rounded-full font-bold">
              Expires {expiryFormatted}
            </span>
          </div>
          <p className="text-xs text-purple-100 leading-relaxed">
            Your hosting badge is live. You earn <strong>85% Net Payout</strong> on every completed booking with zero platform commission deduction from your earnings.
          </p>
        </div>
      )}

      {/* Notifications / Feedback */}
      {paymentFeedback && (
        <div className={`p-4 rounded-2xl text-xs font-extrabold flex items-center gap-2 shadow-sm ${
          paymentFeedback.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
            : 'bg-rose-50 text-rose-800 border border-rose-300'
        }`}>
          {paymentFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
          <span>{paymentFeedback.message}</span>
        </div>
      )}

      {/* ─── 1. PROMINENT ₹449/MONTH PAID MEMBERSHIP CARD (TOP) ─── */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border-2 border-purple-200 shadow-md relative overflow-hidden space-y-5">
        <div className="absolute top-0 right-0 bg-gradient-to-l from-purple-600 to-pink-600 text-white text-[11px] font-black px-4 py-1 rounded-bl-2xl uppercase tracking-wider shadow-sm">
          Recommended
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-black uppercase text-purple-700 tracking-wider block">Starter Hosting Plan</span>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
              ₹{MEMBERSHIP_PRICE_INR} <span className="text-sm font-semibold text-slate-500">/ month</span>
            </h3>
            <p className="text-xs text-slate-600">
              Standard 30-day verified host access with instant booking activation.
            </p>
          </div>

          {/* Primary Action Button: Platform-Aware Trigger */}
          <button
            type="button"
            onClick={handlePurchaseMembership}
            disabled={paymentLoading}
            className="min-h-[52px] px-8 py-3.5 rounded-2xl bg-gradient-to-r from-purple-700 via-pink-600 to-rose-600 hover:from-purple-800 hover:to-pink-700 text-white font-black text-sm shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {paymentLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>{isNative ? 'Subscribe via Google Play' : `Pay ₹${MEMBERSHIP_PRICE_INR} / Month`}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold">Verified Host Blue Tick</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <Sparkles className="w-4 h-4 text-pink-600 shrink-0" />
            <span className="font-bold">85% Guaranteed Net Payout</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <Smartphone className="w-4 h-4 text-purple-600 shrink-0" />
            <span className="font-bold">Rapido-Style Live Navigation</span>
          </div>
        </div>

        {/* Google Play Policy Compliance: No external web payment links shown in native app */}
        {!isNative && (
          <p className="text-[11px] text-slate-400 italic">
            * Secured by Razorpay 256-bit SSL encryption. Auto-renews monthly; cancel anytime from your settings.
          </p>
        )}
      </div>

      {/* ─── 2. FIRST-USER 3-MONTH FREE TRIAL OFFER CARD (`FIRST3FREE`) ─── */}
      {/* ONLY rendered if user has not used free trial; hidden immediately once applied or if already used */}
      {!isFreeTrialUsed && (
        <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-amber-50/90 via-orange-50/50 to-pink-50/60 border-2 border-amber-300 shadow-sm space-y-4 animate-fade-in">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400 text-slate-950 font-black text-[11px] uppercase tracking-wider shadow-xs">
                <Gift className="w-3.5 h-3.5" />
                <span>First User Offer</span>
              </span>
              <h4 className="text-base sm:text-lg font-black text-slate-900 pt-1">
                Activate 3 Months (90 Days) Free Membership!
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
                Apply code <strong className="text-amber-900 font-black font-mono">FIRST3FREE</strong> for 3 Months Free Membership (First-time registration only).
              </p>
            </div>
          </div>

          {/* Coupon Input Form */}
          <form onSubmit={handleRedeemCoupon} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
            <div className="relative flex-1">
              <input
                type="text"
                value={couponCode}
                onChange={e => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Enter Code (FIRST3FREE)"
                className="w-full min-h-[48px] px-4 py-2.5 bg-white border-2 border-amber-300 rounded-xl text-xs sm:text-sm font-mono font-black text-slate-900 uppercase tracking-widest placeholder:text-slate-400 focus:outline-none focus:border-amber-500 shadow-inner"
              />
              <button
                type="button"
                onClick={() => setCouponCode('FIRST3FREE')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-amber-800 bg-amber-200/80 hover:bg-amber-300 px-2.5 py-1 rounded-lg transition cursor-pointer"
              >
                Insert Code
              </button>
            </div>

            <button
              type="submit"
              disabled={couponLoading || !couponCode.trim()}
              className="min-h-[48px] px-8 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-black text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {couponLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <span>Apply</span>
              )}
            </button>
          </form>

          {couponFeedback && (
            <div className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
              couponFeedback.type === 'success'
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                : 'bg-rose-100 text-rose-900 border border-rose-300'
            }`}>
              {couponFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-700" />}
              <span>{couponFeedback.message}</span>
            </div>
          )}

          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Strict Anti-Fraud: Valid once per verified phone number. After 90 days, standard ₹449/mo plan applies.</span>
          </div>
        </div>
      )}

      {/* ─── 3. REFERRAL REWARD SHORTCUT BANNER ─── */}
      <div className="p-5 rounded-2xl sm:rounded-3xl bg-purple-50 border border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <span className="text-xs font-black text-purple-950 block">Want Free Membership Every Month?</span>
          <p className="text-xs text-slate-600">
            Invite 5 verified friends to join PairUpToday. Every 5 verified referrals awards you <strong>+30 Days Free Membership</strong> and a <strong>15-Day Profile Boost</strong>!
          </p>
        </div>
        {onNavigateTab && (
          <button
            type="button"
            onClick={() => onNavigateTab('referrals')}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs shadow-md shadow-purple-700/20 transition-all shrink-0 cursor-pointer active:scale-95"
          >
            Refer & Earn →
          </button>
        )}
      </div>
    </div>
  );
};
