/*
 * Sign in with Google — hand-off page (MIT License).
 *
 * An app sends people here, Google confirms who they are, and this page hands Google's ID token
 * back to that app's registered link. The app checks the token itself; this page stores nothing.
 *
 *   ?app=vh       which app: a key under "apps" in config.json                        required
 *   &nonce=…      random value made by the app, 16–128 of A–Z a–z 0–9 _ -              required
 *   &return=…     the app's own link; must be listed in that app's "returnUrls"       optional (default: the first one)
 *   &state=…      handed back unchanged, 1–256 of A–Z a–z 0–9 . _ ~ -                  optional
 *
 * Hand-back:  <registered link>#id_token=<Google ID token>&state=<state>
 * The part after # never reaches a server or a log; the app reads it in the browser.
 */
(function () {
  'use strict';

  var GSI_SRC = 'https://accounts.google.com/gsi/client';
  var CLIENT_RE = /^[0-9]+-[0-9a-z]+\.apps\.googleusercontent\.com$/;
  var APP_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/;
  var NONCE_RE = /^[A-Za-z0-9_-]{16,128}$/;
  var STATE_RE = /^[A-Za-z0-9._~-]{1,256}$/;

  var q = new URLSearchParams(location.search);
  var ctx = { appName: '', returnUrl: '', clientId: '', nonce: '', state: '' };

  function el(id) { return document.getElementById(id); }
  function show(id, on) { el(id).hidden = !on; }
  function setText(id, s) { el(id).textContent = s; }

  function status(message, bad, detail) {
    var box = el('status');
    box.className = 'note' + (bad ? ' bad' : '');
    box.textContent = message;
    if (detail) {
      var c = document.createElement('code');
      c.textContent = detail;
      box.appendChild(document.createElement('br'));
      box.appendChild(c);
    }
    show('status', true);
  }

  function backLink(url, label) {
    var a = el('backlink');
    a.href = url;
    a.textContent = label;
    show('back', true);
  }

  // Ends the page with a message. Errors are red; `info` is for "nothing to do here".
  function stop(title, message, detail, info) {
    setText('title', title);
    show('lead', false);
    show('gbtn', false);
    show('fine', false);
    status(message, !info, detail);
    if (ctx.returnUrl) backLink(ctx.returnUrl, 'Back to ' + ctx.appName);
  }

  /* ---------- Registered links ---------- */

  // Apps Script links /macros/s/<id>/exec and /a/macros/<domain>/s/<id>/exec are the same deployment.
  function linkKey(raw) {
    var u;
    try { u = new URL(String(raw)); } catch (e) { return null; }
    var local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    if (!(u.protocol === 'https:' || (local && u.protocol === 'http:'))) return null;
    if (u.username || u.password) return null;
    if (u.hostname === 'script.google.com') {
      var m = u.pathname.match(/^\/(?:macros|a\/macros\/[^\/]+)\/s\/([A-Za-z0-9_-]+)\/(exec|dev)$/);
      return m ? { key: 'gas:' + m[1] + ':' + m[2], gas: true, url: u } : null;
    }
    return { key: u.origin + u.pathname.replace(/\/+$/, ''), gas: false, url: u };
  }

  function bare(u) { var c = new URL(u.toString()); c.search = ''; c.hash = ''; return c.toString(); }

  function pickReturn(list, requested) {
    var allowed = (Array.isArray(list) ? list : []).map(linkKey).filter(Boolean);
    if (!allowed.length) return { error: 'none' };
    if (requested === null || requested === '') return { url: bare(allowed[0].url) };
    var r = linkKey(requested);
    var hit = r && allowed.filter(function (a) { return a.key === r.key; })[0];
    if (!hit) return { error: 'unregistered', requested: String(requested).slice(0, 300) };
    // Apps Script: go back to the exact form the app used (keeps a Workspace domain path); otherwise the registered link.
    return { url: bare(r.gas ? r.url : hit.url) };
  }

  /* ---------- Start ---------- */

  // Opened on its own (for example as the home page): say what the page is for and link to the apps it serves.
  function about(apps) {
    apps = apps && typeof apps === 'object' ? apps : {};
    var list = Object.keys(apps).filter(function (k) { return APP_RE.test(k) && apps[k] && typeof apps[k] === 'object'; })
      .map(function (k) { return { name: String(apps[k].name || k), pick: pickReturn(apps[k].returnUrls, null) }; });
    var names = list.map(function (a) { return a.name; });
    setText('title', 'Sign in with Google');
    setText('lead', (names.length ? 'Staff use this page to sign in to ' + names.join(' and ') + ' with their Google account.'
      : 'Apps send staff here to sign in with their Google account.') + ' Start from your app’s sign-in screen.');
    show('lead', true);
    var first = list.filter(function (a) { return a.pick.url; })[0];
    if (first) backLink(first.pick.url, 'Open ' + first.name);
  }

  function start(cfg) {
    cfg = cfg && typeof cfg === 'object' ? cfg : {};
    var appKey = String(q.get('app') || '');
    if (!appKey) { about(cfg.apps); return; }

    var apps = cfg.apps && typeof cfg.apps === 'object' ? cfg.apps : {};
    var app = APP_RE.test(appKey) && Object.prototype.hasOwnProperty.call(apps, appKey) ? apps[appKey] : null;
    if (!app) { stop('Unknown app', 'This sign-in link is for an app that isn’t set up on this page:', appKey); return; }
    ctx.appName = String(app.name || appKey);

    var pick = pickReturn(app.returnUrls, q.get('return'));
    if (pick.error === 'none') {
      stop('Not set up yet', 'No links are registered for ' + ctx.appName + '. Add its link to "returnUrls" under "' + appKey + '" in config.json.');
      return;
    }
    if (pick.error === 'unregistered') {
      stop('Link not registered', 'This ' + ctx.appName + ' link isn’t registered here. Add it to "returnUrls" under "' + appKey + '" in config.json:', pick.requested);
      return;
    }
    ctx.returnUrl = pick.url;

    var nonce = q.get('nonce') || '', state = q.get('state');
    if (!NONCE_RE.test(nonce) || (state !== null && !STATE_RE.test(state))) {
      stop('Link incomplete', 'This sign-in link is missing a part. Go back to ' + ctx.appName + ' and tap “Sign in with Google” again.');
      return;
    }

    var clientId = String(cfg.googleClientId || '').trim();
    if (!CLIENT_RE.test(clientId)) {
      stop('Not set up yet', 'Add your Google Client ID to config.json to turn on Google sign-in.');
      return;
    }

    ctx.clientId = clientId;
    ctx.nonce = nonce;
    ctx.state = state || '';
    setText('title', 'Sign in to ' + ctx.appName);
    document.title = 'Sign in · ' + ctx.appName;
    setText('lead', 'Use your Google account.');
    setText('fine', 'Google shares your name, email address and profile picture with ' + ctx.appName +
      '. This page only passes the sign-in along and keeps nothing.');
    show('fine', true);
    backLink(ctx.returnUrl, 'Back to ' + ctx.appName);
    loadGoogle();
  }

  /* ---------- Google ---------- */

  function loadGoogle() {
    var settled = false;
    function once(fn) { return function () { if (settled) return; settled = true; fn(); }; }
    var s = document.createElement('script');
    s.src = GSI_SRC;
    s.async = true;
    s.onload = once(ready);
    s.onerror = once(googleDown);
    document.head.appendChild(s);
    setTimeout(once(googleDown), 20000);
  }

  function googleDown() {
    show('gbtn', false);
    status('Couldn’t reach Google sign-in. Check your connection, or allow this page in your content blocker, then reload.', true);
  }

  function ready() {
    var gid = window.google && window.google.accounts && window.google.accounts.id;
    if (!gid) { googleDown(); return; }
    gid.initialize({
      client_id: ctx.clientId,
      callback: onCredential,
      nonce: ctx.nonce,
      ux_mode: 'popup',
      auto_select: false,
      context: 'signin'
    });
    var box = el('gbtn');
    show('gbtn', true);
    var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var width = Math.round(Math.max(200, Math.min(320, box.clientWidth || 320)));
    gid.renderButton(box, {
      type: 'standard', theme: dark ? 'filled_black' : 'outline', size: 'large',
      text: 'signin_with', shape: 'pill', logo_alignment: 'left', width: width
    });
  }

  function claimsOf(jwt) {
    try {
      var b64 = String(jwt).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      var bin = atob(b64), bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) { return null; }
  }

  function onCredential(resp) {
    var token = resp && resp.credential;
    var claims = token ? claimsOf(token) : null;
    if (!claims) { status('Google didn’t return a sign-in. Try again.', true); return; }
    // A quick sanity check only; the app does the real check on its server.
    if (claims.nonce !== ctx.nonce || claims.aud !== ctx.clientId) {
      status('That sign-in doesn’t match this request. Go back to ' + ctx.appName + ' and start again.', true);
      return;
    }
    show('gbtn', false);
    show('fine', false);
    show('back', false);
    status('Signing you in to ' + ctx.appName + (claims.email ? ' as ' + claims.email : '') + '…');
    var url = ctx.returnUrl + '#id_token=' + encodeURIComponent(token) +
      (ctx.state ? '&state=' + encodeURIComponent(ctx.state) : '');
    location.replace(url);
    setTimeout(function () { backLink(url, 'Continue to ' + ctx.appName); }, 3000);
  }

  /* ---------- Settings ---------- */

  // GitHub Pages caches files for about 10 minutes; fetch a fresh copy at most once a minute.
  var bucket = Math.floor(Date.now() / 60000);
  fetch('config.json?v=' + bucket, { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (cfg) {
      try { start(cfg); } catch (e) { stop('Something went wrong', 'Reload the page and try again.', String(e && e.message || e)); }
    }, function (e) {
      stop('Sign-in isn’t available', 'Couldn’t load this page’s settings (config.json).', String(e && e.message || e));
    });
})();
