/**
 * PairUpToday Referral & Free Coupon Service
 * 
 * Features:
 * 1. Referral Status & Milestone Tracking (5-User Milestone System)
 * 2. Strict Anti-Fraud First-User Coupon Redemption (`FIRST3FREE`)
 * 3. 1-Click WhatsApp Share Link Generator
 * 4. Referral Code Validation & Application
 */

import { apiFetch } from '../utils/api';

export const PENDING_REFERRAL_STORAGE_KEY = 'pairup_pending_referral_code';

/**
 * Generates a unique user-specific referral code using the first 4 uppercase
 * letters of their name + 4 alphanumeric characters derived from their user ID.
 */
export const generateDynamicReferralCode = (name?: string, userId?: string): string => {
  const cleanLetters = (name || '').replace(/[^a-zA-Z]/g, '').toUpperCase();
  const prefix = (cleanLetters.slice(0, 4) || 'PAIR').padEnd(4, 'X');
  const cleanId = (userId || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const suffix = cleanId.length >= 4
    ? cleanId.slice(0, 4)
    : Math.floor(1000 + Math.random() * 9000).toString();
  return `${prefix}${suffix}`;
};

/**
 * Reads `?ref=` from the current URL and stores it in localStorage for auto-apply on signup.
 */
export const captureReferralFromUrl = (): string | null => {
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref')?.trim().toUpperCase();
    if (ref && ref.length >= 4) {
      localStorage.setItem(PENDING_REFERRAL_STORAGE_KEY, ref);
      return ref;
    }
    return localStorage.getItem(PENDING_REFERRAL_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const getPendingReferralCode = (): string => {
  try {
    return localStorage.getItem(PENDING_REFERRAL_STORAGE_KEY) || '';
  } catch {
    return '';
  }
};

export const clearPendingReferralCode = (): void => {
  try {
    localStorage.removeItem(PENDING_REFERRAL_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
};

export interface ReferredUserItem {
  id: string;
  refereeName: string;
  role: 'client' | 'companion';
  status: 'pending' | 'verified_active';
  createdAt: string;
  verifiedAt?: string | null;
}

export interface ReferralStatusResponse {
  success: boolean;
  referralCode: string;
  successfulReferralsCount: number;
  totalInvitedCount: number;
  pendingCount: number;
  verifiedCount: number;
  currentMilestoneProgress: number; // 0 to 5
  nextMilestoneTarget: number;       // 5, 10, 15...
  has10PercentBookingDiscount: boolean;
  isCompanionActive: boolean;
  isBoosted: boolean;
  boostExpiry?: string | null;
  hasVerifiedReferrerBadge: boolean;
  referralsList: ReferredUserItem[];
  hasUsedFreeTrial: boolean;
  isTrialPhoneUsed: boolean;
}

/**
 * Retrieves the comprehensive referral and milestone dashboard data for the active user.
 */
export const getReferralStatus = async (userId: string): Promise<ReferralStatusResponse> => {
  try {
    const res = await apiFetch(`/api/referrals/my-status?userId=${encodeURIComponent(userId)}`);
    if (res.ok) {
      const data = await res.json();
      const verified = Number(data.verifiedCount || data.successfulReferralsCount || 0);
      const milestoneProgress = verified % 5;
      const nextTarget = Math.floor(verified / 5 + 1) * 5;

      return {
        success: true,
        referralCode: data.referralCode || generateDynamicReferralCode(undefined, userId),
        successfulReferralsCount: verified,
        totalInvitedCount: Number(data.totalInvitedCount || 0),
        pendingCount: Number(data.pendingCount || 0),
        verifiedCount: verified,
        currentMilestoneProgress: milestoneProgress,
        nextMilestoneTarget: nextTarget,
        has10PercentBookingDiscount: Boolean(data.has10PercentBookingDiscount),
        isCompanionActive: Boolean(data.isCompanionActive),
        isBoosted: Boolean(data.isBoosted),
        boostExpiry: data.boostExpiry || null,
        hasVerifiedReferrerBadge: Boolean(data.hasVerifiedReferrerBadge),
        referralsList: Array.isArray(data.referralsList) ? data.referralsList : [],
        hasUsedFreeTrial: Boolean(data.hasUsedFreeTrial),
        isTrialPhoneUsed: Boolean(data.isTrialPhoneUsed)
      };
    }
  } catch (err) {
    console.warn('Error fetching referral status:', err);
  }

  // Graceful fallback defaults
  return {
    success: false,
    referralCode: generateDynamicReferralCode(undefined, userId),
    successfulReferralsCount: 0,
    totalInvitedCount: 0,
    pendingCount: 0,
    verifiedCount: 0,
    currentMilestoneProgress: 0,
    nextMilestoneTarget: 5,
    has10PercentBookingDiscount: false,
    isCompanionActive: false,
    isBoosted: false,
    hasVerifiedReferrerBadge: false,
    referralsList: [],
    hasUsedFreeTrial: false,
    isTrialPhoneUsed: false
  };
};

/**
 * Applies a referral code for a newly registered or existing referee.
 */
export const applyReferralCode = async (
  referralCode: string
): Promise<{ success: boolean; message?: string; error?: string }> => {
  const code = referralCode.trim().toUpperCase();
  if (!code) {
    return { success: false, error: 'Please enter a referral code.' };
  }

  try {
    const res = await apiFetch('/api/referrals/apply-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referralCode: code })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return { success: true, message: data.message || 'Referral code linked successfully!' };
    }
    return { success: false, error: data.error || 'Invalid or expired referral code.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error applying referral code.' };
  }
};

export interface RedeemCouponResult {
  success: boolean;
  message?: string;
  error?: string;
  membershipType?: string;
  membershipExpiry?: string;
}

/**
 * Redeems the first-user 3-month free coupon (`FIRST3FREE`) with strict permanent phone anti-fraud lockout.
 */
export const redeemFirstUserCoupon = async (
  couponCode: string,
  userPhone: string,
  userId: string
): Promise<RedeemCouponResult> => {
  const code = couponCode.trim().toUpperCase();
  if (code !== 'FIRST3FREE') {
    return {
      success: false,
      error: 'Invalid coupon code. Use FIRST3FREE to activate your 3-Month Free Trial.'
    };
  }

  try {
    const res = await apiFetch('/api/membership/redeem-coupon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        couponCode: code,
        phone: userPhone,
        userId
      })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return {
        success: true,
        message: data.message || 'Congratulations! 3 Months Free Companion Membership activated successfully.',
        membershipType: data.membership_type || 'free_trial',
        membershipExpiry: data.membership_expiry || new Date(Date.now() + 90 * 86400000).toISOString()
      };
    }

    return {
      success: false,
      error: data.error || 'This phone number or account has already redeemed the first-user free trial.'
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network error verifying coupon code.'
    };
  }
};

/**
 * Constructs a rich WhatsApp share URL with pre-filled promotional copy and deep link.
 */
export const generateWhatsAppShareUrl = (
  referralCode: string,
  userName?: string
): string => {
  const name = userName ? userName.split(' ')[0] : 'Your Friend';
  const appUrl = `https://pairuptoday.com?ref=${encodeURIComponent(referralCode)}`;

  const message = 
`Hey! 👋 ${name} invited you to join PairUpToday — India's verified in-person social companion and local hosting platform.

✨ Book genuine local companions for cafe chats, movie outings, city guides, and social events.
💼 Or become a Verified Companion Host and earn ₹499–₹1,500/hr!

👉 Use my Referral Code *${referralCode}* when you sign up:
${appUrl}

Join today and experience verified, safe in-person companionship! 🚀`;

  return `https://wa.me/?text=${encodeURIComponent(message)}`;
};
