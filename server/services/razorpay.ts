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

function getCredentials(): { keyId: string; keySecret: string } | null {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret || keyId === 'MY_RAZORPAY_KEY_ID' || keySecret === 'MY_RAZORPAY_KEY_SECRET') {
    return null;
  }
  return { keyId, keySecret };
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

  if (!Number.isSafeInteger(params.amountPaise) || params.amountPaise <= 0) {
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
      }),
      signal: AbortSignal.timeout(15_000)
    });

    const data = await response.json();
    if (!response.ok) {
      return {
        success: false,
        error: data.error?.description || 'Razorpay order creation failed.'
      };
    }
    if (typeof data.id !== 'string' || data.amount !== params.amountPaise || data.currency !== 'INR' ||
        typeof data.receipt !== 'string' || data.receipt !== params.receipt) {
      return { success: false, error: 'Razorpay returned an order that did not match the requested amount and receipt.' };
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
  const keySecret = params.keySecret || process.env.RAZORPAY_KEY_SECRET;
  
  if (!keySecret || !params.orderId || !params.paymentId || !/^[a-f0-9]{64}$/i.test(params.signature)) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest('hex');

  // Constant-time buffer comparison to prevent timing attacks
  const expectedBuf = Buffer.from(expectedSignature, 'hex');
  const actualBuf = Buffer.from(params.signature, 'hex');

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
  const secret = webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !rawBody || !/^[a-f0-9]{64}$/i.test(webhookSignature)) return false;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const expectedBuf = Buffer.from(expectedSignature, 'hex');
  const actualBuf = Buffer.from(webhookSignature, 'hex');

  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

export async function fetchRazorpayPayment(paymentId: string): Promise<{
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
}> {
  const credentials = getCredentials();
  if (!credentials) throw new Error('Razorpay verification requires configured server credentials.');
  if (!paymentId || !/^[A-Za-z0-9_]+$/.test(paymentId)) throw new Error('Invalid Razorpay payment identifier.');
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString('base64')}`,
      'User-Agent': 'PairUpToday-Backend/1.0'
    },
    signal: AbortSignal.timeout(15_000)
  });
  const result = await response.json();
  if (!response.ok || !result || typeof result !== 'object') {
    throw new Error('Razorpay payment lookup failed.');
  }
  return {
    id: result.id,
    order_id: result.order_id,
    amount: result.amount,
    currency: result.currency,
    status: result.status
  };
}

export async function createRazorpayRefund(params: {
  paymentId: string;
  amountPaise: number;
  idempotencyKey: string;
  reason: string;
}): Promise<{ id: string; paymentId: string; amountPaise: number; status: string }> {
  const credentials = getCredentials();
  if (!credentials) throw new Error('Razorpay refunds require configured server credentials.');
  if (!/^[A-Za-z0-9_]+$/.test(params.paymentId) ||
      !Number.isSafeInteger(params.amountPaise) || params.amountPaise <= 0 ||
      !/^[A-Za-z0-9_-]{10,255}$/.test(params.idempotencyKey)) {
    throw new Error('Invalid Razorpay refund parameters.');
  }
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(params.paymentId)}/refund`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
      'X-Refund-Idempotency': params.idempotencyKey,
      'User-Agent': 'PairUpToday-Backend/1.0'
    },
    body: JSON.stringify({
      amount: params.amountPaise,
      speed: 'normal',
      notes: { reason: params.reason.slice(0, 500), idempotency_key: params.idempotencyKey }
    }),
    signal: AbortSignal.timeout(15_000)
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.description || `Razorpay refund request failed with HTTP ${response.status}.`);
  }
  if (typeof data?.id !== 'string' || data.payment_id !== params.paymentId ||
      data.amount !== params.amountPaise || typeof data.status !== 'string') {
    throw new Error('Razorpay returned a refund that did not match the requested payment and amount.');
  }
  return { id: data.id, paymentId: data.payment_id, amountPaise: data.amount, status: data.status };
}

export async function fetchRazorpayPaymentRefunds(paymentId: string): Promise<Array<{
  id: string;
  payment_id: string;
  amount: number;
  status: string;
  notes?: Record<string, string>;
}>> {
  const credentials = getCredentials();
  if (!credentials) throw new Error('Razorpay refund reconciliation requires configured server credentials.');
  if (!/^[A-Za-z0-9_]+$/.test(paymentId)) throw new Error('Invalid Razorpay payment identifier.');
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refunds`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString('base64')}`,
      'User-Agent': 'PairUpToday-Backend/1.0'
    },
    signal: AbortSignal.timeout(15_000)
  });
  const result = await response.json();
  if (!response.ok || !Array.isArray(result?.items)) {
    throw new Error('Razorpay refund reconciliation lookup failed.');
  }
  return result.items.map((item: any) => ({
    id: item.id,
    payment_id: item.payment_id,
    amount: item.amount,
    status: item.status,
    notes: item.notes
  }));
}
