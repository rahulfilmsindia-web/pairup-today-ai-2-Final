/**
 * PairUpToday Cross-Platform URL and Intent Handling Utilities
 * Supports Website (Desktop/Mobile), Android (Capacitor/WebView), and iOS (Capacitor/WebView)
 */

export function openExternalUrl(url: string): void {
  try {
    // Check if running inside Capacitor native container
    const isCapacitor = typeof (window as any).Capacitor !== 'undefined' && 
      typeof (window as any).Capacitor.isNativePlatform === 'function' &&
      (window as any).Capacitor.isNativePlatform();

    if (isCapacitor) {
      // In native Capacitor shell, request system browser to prevent in-app webview trapping
      window.open(url, '_system');
    } else {
      // In standard web browser: open in separate tab without altering current window
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  } catch (err) {
    console.warn('Failed to open external URL:', err);
  }
}

export function openMailtoUri(email: string = 'pairuptoday@gmail.com'): boolean {
  const mailtoUri = `mailto:${encodeURIComponent(email)}`;
  try {
    const isCapacitor = typeof (window as any).Capacitor !== 'undefined' && 
      typeof (window as any).Capacitor.isNativePlatform === 'function' &&
      (window as any).Capacitor.isNativePlatform();

    if (isCapacitor) {
      window.open(mailtoUri, '_system');
    } else {
      window.open(mailtoUri, '_blank');
    }
    return true;
  } catch (err) {
    console.warn('Failed to invoke mailto URI directly:', err);
    return false;
  }
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback for older WebViews without clipboard API
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Copy to clipboard failed:', err);
    return false;
  }
}
