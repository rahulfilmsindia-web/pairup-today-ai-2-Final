import crypto from 'crypto';

export interface RazorpayOrderResponse {
  success: boolean;
  orderId?: string;
  amountPaise?: number;
  currency?: string;
  receipt?: string;
  keyId?: string;
  error?: string;
}

export interface VerifySignatureParams {
  orderId: string;
  paymentId: string;
  signature: string;
  keySecret?: string;
}

/**
 * Creates a Razorpay payment order on the backend
 */
export async function createRazorpayOrder(params: {
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
  keyId?: string;
  keySecret?: string;
}): Promise<RazorpayOrderResponse> {
  const keyId = params.keyId || process.env.RAZORPAY_KEY_ID;
  const keySecret = params.keySecret || process.env.RAZORPAY_KEY_SECRET;

  if (!params.amountPaise || params.amountPaise <= 0) {
    return {
      success: false,
      error: 'Order amount in paise must be a positive integer.'
    };
  }

  // Do not fabricate successful live orders when production credentials are absent.
  if (!keyId || !keySecret || keyId === 'MY_RAZORPAY_KEY_ID' || keySecret === 'MY_RAZORPAY_KEY_SECRET' || keyId.trim() === '' || keySecret.trim() === '') {
    return {
      success: false,
      error: 'Razorpay service configuration unavailable. RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are not configured in the server environment.'
    };
  }

  const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  try {
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        'User-Agent': 'PairUpToday-Backend/1.0'
      },
      body: JSON.stringify({
        amount: params.amountPaise,
        currency: 'INR',
        receipt: params.receipt,
        notes: params.notes || {}
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return {
        success: false,
        error: data.error?.description || 'Razorpay order creation failed.'
      };
    }

    return {
      success: true,
      orderId: data.id,
      amountPaise: data.amount,
      currency: data.currency,
      receipt: data.receipt,
      keyId
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Network error connecting to Razorpay: ${err.message}`
    };
  }
}

/**
 * Verifies Razorpay payment signature cryptographically on the server
 */
export function verifyRazorpayPaymentSignature(params: VerifySignatureParams): boolean {
  const keySecret = params.keySecret || process.env.RAZORPAY_KEY_SECRET || 'pairup_secure_vault_secret_2026';
  
  if (!params.orderId || !params.paymentId || !params.signature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest('hex');

  // Constant-time buffer comparison to prevent timing attacks
  const expectedBuf = Buffer.from(expectedSignature, 'utf-8');
  const actualBuf = Buffer.from(params.signature, 'utf-8');

  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Verifies Razorpay Webhook signature
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  webhookSignature: string,
  webhookSecret?: string
): boolean {
  const secret = webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET || 'pairup_webhook_secret_2026';
  if (!rawBody || !webhookSignature) return false;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const expectedBuf = Buffer.from(expectedSignature, 'utf-8');
  const actualBuf = Buffer.from(webhookSignature, 'utf-8');

  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
