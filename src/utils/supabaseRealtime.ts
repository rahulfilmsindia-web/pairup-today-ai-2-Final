import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { apiFetch } from './api';

let cachedClient: SupabaseClient | null = null;
let clientPromise: Promise<SupabaseClient | null> | null = null;

export async function getRealtimeClient(): Promise<SupabaseClient | null> {
  if (cachedClient) return cachedClient;
  if (clientPromise) return clientPromise;

  clientPromise = (async () => {
    try {
      const res = await apiFetch('/api/realtime/config');
      if (res.ok) {
        const { supabaseUrl, anonKey } = await res.json();
        if (supabaseUrl && anonKey) {
          cachedClient = createClient(supabaseUrl, anonKey, {
            realtime: {
              params: {
                eventsPerSecond: 10
              }
            }
          });
          return cachedClient;
        }
      }
    } catch (e) {
      console.warn('Realtime config fetch failed', e);
    }
    return null;
  })();

  return clientPromise;
}
