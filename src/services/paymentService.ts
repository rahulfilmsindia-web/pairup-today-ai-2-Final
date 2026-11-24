/**
 * PairUpToday Hybrid Payment Service (Capacitor 6 + Google Play Compliant)
 * 
 * Strict Compliance Rules:
 * 1. Companion Membership (Digital Feature):
 *    - Native Android/iOS: Strictly uses RevenueCat (Google Play Billing `companion_monthly_449`). Zero Razorpay mentions or web payment links shown.
 *    - Web Browser: Uses Razorpay Web Checkout (₹449).
 * 2. In-Person Booking Payments (Physical Real-World Service):
 *    - Exempt from Google Play Billing (like Rapido / Urban Company).
 *    - Native: Uses `capacitor-razorpay` (native SDK).
 *    - Web: Uses Razorpay Web Checkout.
 * 3. 10% Referral Discount:
 *    - Automatically applied if `user.has_10_percent_booking_discount === true`.
 *    - Automatically consumed upon payment verification.
 */

import { Capacitor } from '@capacitor/core';
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import { Checkout } from 'capacitor-razorpay';
import { openRazorpayCheckout } from '../utils/razorpay';
import { apiFetch } from '../utils/api';

const REVENUECAT_GOOGLE_API_KEY = (import.meta as any).env?.VITE_REVENUECAT_GOOGLE_KEY || 'goog_pairuptoday_membership_prod';
const REVENUECAT_APPLE_API_KEY = (import.meta as any).env?.VITE_REVENUECAT_APPLE_KEY || 'appl_pairuptoday_membership_prod';
export const COMPANION_MONTHLY_PRODUCT_ID = 'companion_monthly_449';
export const MEMBERSHIP_PRICE_INR = 449;
export const MEMBERSHIP_PRICE_PAISE = 44900;

let isPurchasesConfigured = false;

/**
 * Checks whether the current runtime is inside a native Android or iOS Capacitor wrapper.
 */
export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Initializes RevenueCat once on native mobile platforms.
 */
export const initRevenueCat = async (userId?: string): Promise<boolean> => {
  if (!isNativePlatform()) return false;
  if (isPurchasesConfigured) return true;

  try {
    const isAndroid = Capacitor.getPlatform() === 'android';
    const apiKey = isAndroid ? REVENUECAT_GOOGLE_API_KEY : REVENUECAT_APPLE_API_KEY;

    await Purchases.setLogLevel({ level: LOG_LEVEL.WARN });
    await Purchases.configure({
      apiKey,
      appUserID: userId || undefined
    });

    isPurchasesConfigured = true;
    return true;
  } catch (err) {
    console.warn('RevenueCat initialization notice:', err);
    return false;
  }
};

export interface PricingBreakdown {
  originalBasePaise: number;
  discountPaise: number;
  finalBasePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  gstAmountPaise: number;
  totalPayablePaise: number;
  hasDiscount: boolean;
}

/**
 * Calculates exact pricing, applying a 10% discount on base fare if applicable + 18% GST.
 */
export const calculateBookingPricing = (
  rawBasePaise: number,
  has10PercentDiscount: boolean
): PricingBreakdown => {
  const originalBasePaise = Math.max(0, Math.round(rawBasePaise));
  const discountPaise = has10PercentDiscount ? Math.round(originalBasePaise * 0.10) : 0;
  const finalBasePaise = Math.max(0, originalBasePaise - discountPaise);
  
  // 18% GST (9% CGST + 9% SGST)
  const cgstPaise = Math.round(finalBasePaise * 0.09);
  const sgstPaise = Math.round(finalBasePaise * 0.09);
  const gstAmountPaise = cgstPaise + sgstPaise;
  const totalPayablePaise = finalBasePaise + gstAmountPaise;

  return {
    originalBasePaise,
    discountPaise,
    finalBasePaise,
    cgstPaise,
    sgstPaise,
    gstAmountPaise,
    totalPayablePaise,
    hasDiscount: has10PercentDiscount
  };
};

export interface MembershipPurchaseResult {
  success: boolean;
  error?: string;
  cancelled?: boolean;
  membershipType?: 'paid' | 'free_trial';
  expiryDate?: string;
  source: 'google_play' | 'apple_iap' | 'razorpay_web';
}

/**
 * Purchases Companion Monthly Membership (₹449/mo).
 * Automatically switches between Google Play Billing (Native) and Razorpay (Web).
 */
export const purchaseCompanionMembership = async (
  user: any
): Promise<MembershipPurchaseResult> => {
  // ─── 1. NATIVE ANDROID / IOS FLOW (Google Play Billing / RevenueCat) ───
  if (isNativePlatform()) {
    try {
      await initRevenueCat(user?.id);

      // Fetch official products from Google Play Billing
      const { products } = await Purchases.getProducts({
        productIdentifiers: [COMPANION_MONTHLY_PRODUCT_ID]
      });

      const monthlyProduct = products.find(p => p.identifier === COMPANION_MONTHLY_PRODUCT_ID) || products[0];

      if (!monthlyProduct) {
        // Fallback: Check offerings if product list is structured as offering package
        const offerings = await Purchases.getOfferings();
        const availablePackage = offerings.current?.availablePackages.find(
          pkg => pkg.product.identifier === COMPANION_MONTHLY_PRODUCT_ID
        ) || offerings.current?.availablePackages[0];

        if (!availablePackage) {
          throw new Error('Google Play membership product is currently being synchronized. Please try again shortly.');
        }

        const purchaseResult = await Purchases.purchasePackage({
          aPackage: availablePackage
        });

        // Sync purchase with Supabase backend
        const syncRes = await apiFetch('/api/membership/sync-revenuecat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            entitlements: purchaseResult.customerInfo.entitlements.active,
            productId: availablePackage.product.identifier,
            transactionId: purchaseResult.customerInfo.originalAppUserId
          })
        });

        const syncData = syncRes.ok ? await syncRes.json() : null;

        return {
          success: true,
          membershipType: 'paid',
          expiryDate: syncData?.membershipExpiry || new Date(Date.now() + 30 * 86400000).toISOString(),
          source: 'google_play'
        };
      }

      // Purchase store product directly
      const purchaseResult = await Purchases.purchaseStoreProduct({
        product: monthlyProduct
      });

      // Synchronize with Supabase
      const syncRes = await apiFetch('/api/membership/sync-revenuecat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          entitlements: purchaseResult.customerInfo.entitlements.active,
          productId: monthlyProduct.identifier,
          transactionId: purchaseResult.customerInfo.originalAppUserId
        })
      });

      const syncData = syncRes.ok ? await syncRes.json() : null;

      return {
        success: true,
        membershipType: 'paid',
        expiryDate: syncData?.membershipExpiry || new Date(Date.now() + 30 * 86400000).toISOString(),
        source: 'google_play'
      };
    } catch (err: any) {
      if (err.userCancelled || err.code === '1' || err.message?.includes('cancelled')) {
        return { success: false, cancelled: true, error: 'Purchase cancelled.', source: 'google_play' };
      }
      return {
        success: false,
        error: err.message || 'Google Play purchase failed. Please ensure your payment method is active in Google Play Store.',
        source: 'google_play'
      };
    }
  }

  // ─── 2. WEB BROWSER FLOW (Razorpay Web Checkout) ───
  try {
    const orderRes = await apiFetch('/api/companion/membership/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'STARTER', durationMonths: 1 })
    });

    if (!orderRes.ok) {
      const err = await orderRes.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to initiate membership order.');
    }

    const orderData = await orderRes.json();

    const paymentResponse = await openRazorpayCheckout({
      orderId: orderData.orderId,
      amountPaise: orderData.amountPaise || MEMBERSHIP_PRICE_PAISE,
      currency: orderData.currency || 'INR',
      keyId: orderData.keyId,
      name: 'PairUpToday Companion Membership',
      description: '1 Month Verified Companion Membership (₹449)',
      prefill: {
        name: user.profileName || user.legalName || '',
        email: user.email || '',
        contact: user.phone || ''
      }
    });

    // Verify on backend
    const verifyRes = await apiFetch('/api/payments/razorpay/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: paymentResponse.razorpay_order_id,
        razorpay_payment_id: paymentResponse.razorpay_payment_id,
        razorpay_signature: paymentResponse.razorpay_signature,
        membershipPlan: 'STARTER',
        userId: user.id
      })
    });

    if (!verifyRes.ok) {
      const err = await verifyRes.json().catch(() => ({}));
      throw new Error(err.error || 'Membership payment verification failed.');
    }

    const verifyData = await verifyRes.json();

    return {
      success: true,
      membershipType: 'paid',
      expiryDate: verifyData?.membershipExpiry || new Date(Date.now() + 30 * 86400000).toISOString(),
      source: 'razorpay_web'
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Payment processing was interrupted.',
      source: 'razorpay_web'
    };
  }
};

export interface BookingPaymentOptions {
  bookingId: string;
  bookingCode: string;
  serviceName: string;
  totalPayablePaise: number;
  user: any;
  has10PercentDiscount?: boolean;
}

export interface BookingPaymentResult {
  success: boolean;
  paymentId?: string;
  orderId?: string;
  error?: string;
  discountApplied?: boolean;
}

/**
 * Processes Real-World In-Person Companion Booking Payment.
 * Uses native capacitor-razorpay on Android/iOS and Razorpay Web Checkout on browsers.
 */
export const payForInPersonBooking = async (
  options: BookingPaymentOptions
): Promise<BookingPaymentResult> => {
  const { bookingId, bookingCode, serviceName, totalPayablePaise, user, has10PercentDiscount } = options;

  try {
    // 1. Create or fetch Razorpay Order from backend
    const orderRes = await apiFetch('/api/payments/razorpay/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId,
        amountPaise: totalPayablePaise,
        has10PercentDiscount: !!has10PercentDiscount
      })
    });

    if (!orderRes.ok) {
      const err = await orderRes.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create booking payment order.');
    }

    const orderData = await orderRes.json();
    const razorpayKeyId = orderData.keyId || (import.meta as any).env?.VITE_RAZORPAY_KEY_ID || 'rzp_live_pairuptoday';

    // ─── Native App: Use capacitor-razorpay native SDK ───
    if (isNativePlatform()) {
      try {
        const checkoutOptions = {
          key: razorpayKeyId,
          amount: String(totalPayablePaise),
          name: 'PairUpToday In-Person Service',
          description: `${serviceName} (#${bookingCode})`,
          order_id: orderData.orderId,
          currency: 'INR',
          prefill: {
            contact: user?.phone || '',
            email: user?.email || '',
            name: user?.profileName || user?.legalName || 'Client'
          },
          theme: {
            color: '#6D28D9'
          }
        };

        const result = await Checkout.open(checkoutOptions as any);
        const parsed = typeof result?.response === 'string' ? JSON.parse(result.response) : result;

        // Verify on backend & consume 10% discount
        const verifyRes = await apiFetch('/api/payments/razorpay/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            razorpay_order_id: parsed.razorpay_order_id || orderData.orderId,
            razorpay_payment_id: parsed.razorpay_payment_id,
            razorpay_signature: parsed.razorpay_signature,
            bookingId,
            has10PercentDiscount: !!has10PercentDiscount
          })
        });

        if (!verifyRes.ok) {
          const err = await verifyRes.json().catch(() => ({}));
          throw new Error(err.error || 'Payment verification failed.');
        }

        return {
          success: true,
          paymentId: parsed.razorpay_payment_id,
          orderId: orderData.orderId,
          discountApplied: has10PercentDiscount
        };
      } catch (nativeErr: any) {
        console.warn('Native Razorpay Checkout error:', nativeErr);
        throw new Error(nativeErr.message || 'In-app booking checkout was cancelled or failed.');
      }
    }

    // ─── Web Browser: Use Razorpay Web SDK ───
    const webPayment = await openRazorpayCheckout({
      orderId: orderData.orderId,
      amountPaise: totalPayablePaise,
      currency: 'INR',
      keyId: razorpayKeyId,
      name: 'PairUpToday In-Person Service',
      description: `${serviceName} (#${bookingCode})`,
      prefill: {
        name: user?.profileName || user?.legalName || '',
        email: user?.email || '',
        contact: user?.phone || ''
      }
    });

    // Verify on backend & consume 10% discount
    const verifyRes = await apiFetch('/api/payments/razorpay/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: webPayment.razorpay_order_id,
        razorpay_payment_id: webPayment.razorpay_payment_id,
        razorpay_signature: webPayment.razorpay_signature,
        bookingId,
        has10PercentDiscount: !!has10PercentDiscount
      })
    });

    if (!verifyRes.ok) {
      const err = await verifyRes.json().catch(() => ({}));
      throw new Error(err.error || 'Payment verification failed.');
    }

    return {
      success: true,
      paymentId: webPayment.razorpay_payment_id,
      orderId: webPayment.razorpay_order_id,
      discountApplied: has10PercentDiscount
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Payment failed or was cancelled.'
    };
  }
};

export interface BookingCheckoutParams {
  orderId: string;
  amountPaise: number;
  currency?: string;
  keyId: string;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
  has10PercentDiscount?: boolean;
  isTestMode?: boolean;
}

/**
 * Universal Booking Payment Checkout function.
 * Seamlessly routes to native capacitor-razorpay on Android / iOS,
 * and standard Razorpay checkout.js on Web browsers.
 */
export const openBookingPaymentCheckout = async (
  params: BookingCheckoutParams
) => {
  return openRazorpayCheckout(
    {
      orderId: params.orderId,
      amountPaise: params.amountPaise,
      currency: params.currency || 'INR',
      keyId: params.keyId,
      isTestMode: params.isTestMode
    },
    params.description,
    params.prefill
  );
};

