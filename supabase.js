/* Supabase client - Kantin Uimsya Putri
 * Frontend-safe: gunakan Publishable/anon key, BUKAN service_role.
 */
(function () {
  'use strict';
  const SUPABASE_URL = 'https://eusyxssmytqnmlbnxigl.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_ts62tbo3Z5cdZ9-fHTWxxQ_z9ox4OB-';

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('Supabase JS belum dimuat.');
    return;
  }

  window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage
      }
    }
  );
})();
