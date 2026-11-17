/* Batas sesi login: 1 jam sejak login, lalu logout otomatis.
 * Dipakai oleh index.html (login) dan app.html (dasbor).
 * Waktu login disimpan di localStorage sehingga berlaku untuk semua tab. */
(function () {
  'use strict';
  var LIMIT_MS = 60 * 60 * 1000;           // 1 jam
  var KEY = 'kantin_login_at';
  var db = function () { return window.supabaseClient; };

  function stored() {
    var v = Number(localStorage.getItem(KEY));
    return isFinite(v) && v > 0 ? v : 0;
  }
  // Waktu login: catatan lokal; jika belum ada (sesi lama), pakai last_sign_in_at dari Supabase.
  function loginAt(session) {
    var t = stored();
    if (t) return t;
    var iso = session && session.user && session.user.last_sign_in_at;
    var p = iso ? Date.parse(iso) : NaN;
    t = isFinite(p) ? p : Date.now();
    localStorage.setItem(KEY, String(t));
    return t;
  }

  window.KantinSession = {
    LIMIT_MS: LIMIT_MS,
    markLogin: function () { localStorage.setItem(KEY, String(Date.now())); },
    clear: function () { localStorage.removeItem(KEY); },
    remainingMs: function (session) { return loginAt(session) + LIMIT_MS - Date.now(); },
    isExpired: function (session) { return this.remainingMs(session) <= 0; },
    /* Keluar paksa lalu kembali ke halaman login dengan pesan "sesi berakhir" */
    expire: function (reason) {
      var self = this;
      var go = function () { self.clear(); location.replace('index.html?error=' + (reason || 'session_timeout')); };
      try { Promise.resolve(db().auth.signOut()).then(go, go); } catch (e) { go(); }
    }
  };
})();
