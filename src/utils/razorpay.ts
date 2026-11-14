export interface RazorpayOrder {
  orderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
}

interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutInstance {
  open(): void;
  on(event: 'payment.failed', handler: (response: { error?: { description?: string } }) => void): void;
}

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
  handler(response: RazorpaySuccessResponse): void;
  modal: { ondismiss(): void };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
  }
}

function loadRazorpayCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout]');
    if (existing) {
      if (existing.dataset.loadState === 'error' || existing.dataset.loadState === 'loaded') {
        reject(new Error('Razorpay checkout could not be loaded.'));
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Razorpay checkout could not be loaded.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = 'true';
    script.onload = () => {
      script.dataset.loadState = 'loaded';
      resolve();
    };
    script.onerror = () => {
      script.dataset.loadState = 'error';
      reject(new Error('Razorpay checkout could not be loaded.'));
    };
    document.head.appendChild(script);
  });
}

export async function openRazorpayCheckout(
  order: RazorpayOrder,
  description: string,
  prefill?: { name?: string; email?: string; contact?: string }
): Promise<RazorpaySuccessResponse> {
  if (!order.keyId || !order.orderId || !Number.isSafeInteger(order.amountPaise) || order.amountPaise <= 0) {
    throw new Error('The server returned invalid Razorpay checkout details.');
  }
  await loadRazorpayCheckout();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error('Razorpay checkout did not initialize.');

  return new Promise((resolve, reject) => {
    const checkout = new Razorpay({
      key: order.keyId,
      amount: order.amountPaise,
      currency: order.currency || 'INR',
      order_id: order.orderId,
      name: 'PairUpToday',
      description,
      prefill,
      handler: resolve,
      modal: { ondismiss: () => reject(new Error('Payment checkout was closed before completion.')) }
    });
    checkout.on('payment.failed', response => {
      reject(new Error(response.error?.description || 'Razorpay reported that the payment failed.'));
    });
    checkout.open();
  });
}
