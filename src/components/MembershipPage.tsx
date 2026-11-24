import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { 
  Sparkles, CheckCircle2, Crown, Clock, Gift, 
  ArrowRight, AlertCircle, Check, RefreshCw, Zap, Award
} from 'lucide-react';
import { 
  purchaseCompanionMembership, 
  MEMBERSHIP_TIERS,
  CompanionMembershipPlan,
  MEMBERSHIP_PRICE_INR
} from '../services/paymentService';
import { redeemFirstUserCoupon, getReferralStatus } from '../services/referralService';

interface MembershipPageProps {
  user: any;
  onMembershipUpdated?: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const MembershipPage: React.FC<MembershipPageProps> = ({
  user,
  onMembershipUpdated
}) => {
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponFeedback, setCouponFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [paymentLoadingPlan, setPaymentLoadingPlan] = useState<CompanionMembershipPlan | null>(null);
  const [paymentFeedback, setPaymentFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [referralData, setReferralData] = useState<{
    hasUsedFreeTrial: boolean;
    isTrialPhoneUsed: boolean;
    membershipExpiry?: string | null;
  }>({
    hasUsedFreeTrial: Boolean(user?.hasUsedFreeTrial || user?.has_used_free_trial),
    isTrialPhoneUsed: false
  });

  const isNative = Capacitor.isNativePlatform();

  // Load anti-fraud trial status
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

  const isFreeTrialUsed = referralData.hasUsedFreeTrial || referralData.isTrialPhoneUsed || Boolean(user?.hasUsedFreeTrial || user?.has_used_free_trial);
  const isCompanionActive = Boolean(user?.isCompanionActive || user?.is_companion_active);
  const planTier = (user?.planTier || user?.plan_tier || (isCompanionActive ? 'starter' : 'none')).toLowerCase();
  const membershipType = user?.membershipType || user?.membership_type || (isCompanionActive ? 'paid' : 'none');
  const membershipExpiry = user?.membershipExpiry || user?.membership_expiry || referralData.membershipExpiry;
  const isBoosted = Boolean(user?.isBoosted || user?.is_boosted);
  const hasVipBadge = Boolean(user?.hasVipBadge || user?.has_vip_badge);

  const expiryFormatted = membershipExpiry 
    ? new Date(membershipExpiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const daysRemaining = membershipExpiry 
    ? Math.max(0, Math.ceil((new Date(membershipExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  // 1. Plan Purchase Handler (STARTER, PROFESSIONAL, PREMIUM)
  const handlePurchasePlan = async (plan: CompanionMembershipPlan) => {
    setPaymentLoadingPlan(plan);
    setPaymentFeedback(null);
    setCouponFeedback(null);

    try {
      const result = await purchaseCompanionMembership(user, plan);
      if (result.success) {
        setPaymentFeedback({
          type: 'success',
          message: `🎉 ${plan} membership activated successfully! Your Companion profile is now active on PairUp Verified Network.`
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
      setPaymentLoadingPlan(null);
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
          message: result.message || '🎉 Congratulations! 3 Months (90 Days) Free Companion Membership activated successfully!'
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ─── ACTIVE MEMBERSHIP BANNER ─── */}
      {isCompanionActive && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 border border-purple-500/30 text-slate-100 shadow-lg space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-pink-500/20 text-pink-400">
                <Crown className="w-4 h-4" />
              </span>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-pink-400">
                  {membershipType === 'free_trial' || planTier === 'free_trial'
                    ? '🎁 3-Month Free Trial Active'
                    : `👑 ${planTier.toUpperCase()} Membership Active`}
                </span>
                <span className="text-xs text-slate-400 ml-2">
                  {daysRemaining > 0 ? `(${daysRemaining} days remaining)` : ''}
                </span>
              </div>
            </div>
            {expiryFormatted && (
              <span className="self-start sm:self-auto text-xs bg-white/10 px-3 py-1 rounded-full font-bold border border-white/10 text-slate-200">
                Expires {expiryFormatted}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-slate-300">
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <Check className="w-3.5 h-3.5" /> 85% Net Payout Active
            </span>
            {isBoosted && (
              <span className="flex items-center gap-1 text-amber-400 font-semibold">
                <Zap className="w-3.5 h-3.5" /> Priority Discovery Placement
              </span>
            )}
            {hasVipBadge && (
              <span className="flex items-center gap-1 text-purple-400 font-semibold">
                <Award className="w-3.5 h-3.5" /> VIP Verification Badge
              </span>
            )}
          </div>
        </div>
      )}

      {/* ─── FEEDBACK MESSAGES ─── */}
      {paymentFeedback && (
        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 shadow-md ${
          paymentFeedback.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
            : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
        }`}>
          <div className="flex items-center gap-2">
            {paymentFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{paymentFeedback.message}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setPaymentFeedback(null)} 
            className="text-slate-400 hover:text-white text-xs px-2 py-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* ─── HEADER ─── */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-300 text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5 text-pink-400" />
          <span>PairUp Verified Network</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
          Choose Your Membership Plan
        </h2>
        <p className="text-slate-400 text-xs max-w-md mx-auto leading-relaxed">
          A paid membership is mandatory before you can receive bookings. Select a plan below to activate your Companion profile on PairUp Verified Network.
        </p>
      </div>

      {/* ─── THREE-TIER MEMBERSHIP PRICING CARDS ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. STARTER (₹449 / 1 month) */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between hover:border-pink-500/50 transition-colors shadow-lg">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-extrabold text-slate-400 tracking-wider">Starter</span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                1 Month
              </span>
            </div>
            <div className="text-2xl font-extrabold text-amber-400 my-2">
              ₹{MEMBERSHIP_TIERS.STARTER.priceInr} <span className="text-xs font-normal text-slate-400">/ 1 month</span>
            </div>
            <ul className="text-[11px] text-slate-400 space-y-2 mt-4">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>30 days active hosting profile</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Listed on PairUp Verified Network</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>85% gross earning share</span>
              </li>
            </ul>
          </div>

          <button
            type="button"
            onClick={() => handlePurchasePlan('STARTER')}
            disabled={paymentLoadingPlan !== null}
            className="mt-6 w-full py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-black disabled:opacity-60 transition-all flex items-center justify-center gap-2 shadow-md shadow-pink-600/20 active:scale-95 cursor-pointer"
          >
            {paymentLoadingPlan === 'STARTER' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>{isNative ? 'Subscribe STARTER (₹449)' : 'Subscribe STARTER (₹449)'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>

        {/* 2. PROFESSIONAL (₹1,099 / 3 months - HIGHLIGHTED) */}
        <div className="p-5 rounded-2xl bg-slate-900 border-2 border-pink-500/60 flex flex-col justify-between shadow-xl shadow-pink-500/10 relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="px-3 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-400 to-rose-400 text-slate-950 uppercase tracking-wider shadow-sm">
              MOST POPULAR
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-extrabold text-pink-400 tracking-wider">Professional</span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/30">
                3 Months
              </span>
            </div>
            <div className="text-2xl font-extrabold text-amber-400 my-2">
              ₹{MEMBERSHIP_TIERS.PROFESSIONAL.priceInr.toLocaleString('en-IN')}{' '}
              <span className="text-xs font-normal text-slate-400">/ 3 months</span>
            </div>
            <ul className="text-[11px] text-slate-400 space-y-2 mt-4">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>90 days active hosting</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-pink-300 font-bold">Priority discovery placement</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>85% gross earning share</span>
              </li>
            </ul>
          </div>

          <button
            type="button"
            onClick={() => handlePurchasePlan('PROFESSIONAL')}
            disabled={paymentLoadingPlan !== null}
            className="mt-6 w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-rose-400 hover:from-amber-500 hover:to-rose-500 text-slate-950 text-xs font-black disabled:opacity-60 transition-all flex items-center justify-center gap-2 shadow-md shadow-amber-400/20 active:scale-95 cursor-pointer"
          >
            {paymentLoadingPlan === 'PROFESSIONAL' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>{isNative ? 'Subscribe PROFESSIONAL (₹1,099)' : 'Subscribe PROFESSIONAL (₹1,099)'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>

        {/* 3. PREMIUM (₹5,999 / 1 year) */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between hover:border-pink-500/50 transition-colors shadow-lg">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-extrabold text-slate-400 tracking-wider">Premium</span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                1 Year
              </span>
            </div>
            <div className="text-2xl font-extrabold text-amber-400 my-2">
              ₹{MEMBERSHIP_TIERS.PREMIUM.priceInr.toLocaleString('en-IN')}{' '}
              <span className="text-xs font-normal text-slate-400">/ 1 year</span>
            </div>
            <ul className="text-[11px] text-slate-400 space-y-2 mt-4">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>365 days unlimited hosting</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-amber-300 font-bold">VIP verification badge</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Zero renewal interruption</span>
              </li>
            </ul>
          </div>

          <button
            type="button"
            onClick={() => handlePurchasePlan('PREMIUM')}
            disabled={paymentLoadingPlan !== null}
            className="mt-6 w-full py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-black disabled:opacity-60 transition-all flex items-center justify-center gap-2 shadow-md shadow-pink-600/20 active:scale-95 cursor-pointer"
          >
            {paymentLoadingPlan === 'PREMIUM' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>{isNative ? 'Subscribe PREMIUM (₹5,999)' : 'Subscribe PREMIUM (₹5,999)'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* ─── FIRST-USER 3-MONTH FREE COUPON CARD (FIRST3FREE) ─── */}
      {!isFreeTrialUsed && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 border border-pink-500/30 shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0">
                <Gift className="w-5 h-5 text-pink-400" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-pink-400 flex items-center gap-1.5">
                  <span>First-Time Companion Offer</span>
                  <span className="px-2 py-0.5 rounded-full bg-pink-500/20 text-[10px] text-pink-300 font-bold">
                    Free 90 Days
                  </span>
                </h4>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  Have a promo code? Apply <code className="px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 font-mono font-bold">FIRST3FREE</code> to activate 3 Months (90 Days) Starter Membership for FREE!
                </p>
              </div>
            </div>
          </div>

          {couponFeedback && (
            <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
              couponFeedback.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
            }`}>
              {couponFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span>{couponFeedback.message}</span>
            </div>
          )}

          <form onSubmit={handleRedeemCoupon} className="flex flex-col sm:flex-row gap-2 pt-1">
            <div className="relative flex-1">
              <input
                type="text"
                value={couponCode}
                onChange={e => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Enter promo code (e.g. FIRST3FREE)"
                disabled={couponLoading}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-pink-500 text-slate-100 placeholder-slate-600 text-xs uppercase font-mono tracking-wider focus:outline-none transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={couponLoading || !couponCode.trim()}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-black text-xs shadow-md shadow-pink-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
            >
              {couponLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Validating...</span>
                </>
              ) : (
                <>
                  <span>Apply Code</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* ─── PLATFORM-AWARE COMPLIANCE FOOTER NOTE ─── */}
      <p className="text-center text-[11px] text-slate-500 pt-2">
        {isNative
          ? 'All payments are processed securely via Google Play. Your profile will be activated immediately after payment confirmation.'
          : 'All payments are processed securely via Razorpay. Your profile will be activated immediately after payment confirmation.'}
      </p>
    </div>
  );
};
