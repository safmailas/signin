# Sign in with Google — hand-off page

A small static page that gives Volunteer Hub (and any other app without its own Google sign-in) a
**Sign in with Google** button. The app sends people here, Google confirms who they are, and this page hands
Google's signed ID token back to that app's registered link. The app checks the token on its own server. Nothing is
stored here. MIT licensed.

Lives at **https://safmailas.github.io/signin/** (its own repository, `safmailas/signin`, with its own settings).

## How it works

1. The app's sign-in screen opens `https://safmailas.github.io/signin/?app=vh&nonce=…&state=…&return=…`
2. This page shows Google's button. The first time, Google asks the person to share their name, email address and
   profile picture.
3. Google gives this page an ID token, and the page sends the person straight back:
   `<registered app link>#id_token=…&state=…`
4. The app checks the token with Google (audience, issuer, expiry, verified email, nonce) and signs the person in.

## Set up (once, about 10 minutes)

### 1. Get a Client ID from Google Cloud

Sign in to Google as the account that owns the app (for Volunteer Hub, the account that owns the Sheet).

1. Go to **console.cloud.google.com** → project picker → **New project** → name it e.g. `Volunteer Hub sign-in` →
   **Create**, then select it.
2. Menu → **Google Auth Platform** → **Get started**: app name `Volunteer Hub`, your support email → Audience
   **External** → contact email → agree → **Create**.
3. **Audience:** leave the publishing status on **Testing**. Because this only asks for basic sign-in (name, email,
   profile picture), any personal Google account can sign in; people see a note that the app is in testing.
   **Google Workspace (organization) accounts must be added under Test users** (up to 100).
4. **Clients → Create client** → Application type **Web application** → name `Sign-in page` →
   **Authorized JavaScript origins → Add URI** → `https://safmailas.github.io` (no path, no trailing slash) →
   **Create**. Leave redirect URIs empty.
5. Copy the **Client ID** (it ends in `.apps.googleusercontent.com`). You don't need the client secret.

### 2. Put the Client ID in `config.json`

On GitHub open `config.json` → ✏️ **Edit** → replace `PASTE_YOUR_CLIENT_ID.apps.googleusercontent.com` with your
Client ID → **Commit changes**. GitHub Pages can take up to 10 minutes to pick up a change.

### 3. Register app links

Every app link allowed to receive a sign-in goes in that app's `returnUrls`. Volunteer Hub 4.2's links
(`…/vh/v42/app/`, and `…/vh/v41/app/` in case 4.2 replaces 4.1 there) are already listed. If you put the app
somewhere else (for example `…/vh/app/`), add that link too. The links are the app's address on GitHub Pages, so
they stay the same when you make a new Apps Script deployment.

### 4. Turn it on in the app

In Volunteer Hub, sign in as an Admin → **More → Settings → Google sign-in** → paste the **same** Client ID → Save.
Then give people access with their Google account: **More → Give access → Google account**.

## `config.json`

| Field | Meaning |
|---|---|
| `googleClientId` | The Web client ID from step 1. |
| `updated` | Date you last changed this file (for your records). |
| `apps.<key>` | One entry per app. The key is what the app sends as `?app=` (lowercase letters, digits, `-`, `_`). |
| `apps.<key>.name` | Shown on this page: "Sign in to *name*". |
| `apps.<key>.returnUrls` | Links allowed to receive sign-ins. `https` only (`http://localhost` for testing). For Apps Script, `…/macros/s/<id>/exec` and `…/a/macros/<domain>/s/<id>/exec` count as the same link; `/dev` is separate. |

## For app builders

**Request** — open this page in the same browser tab:

| Parameter | |
|---|---|
| `app` | Required. A key under `apps`. |
| `nonce` | Required. A new random value for every attempt, 16–128 characters of `A–Z a–z 0–9 _ -`. Keep it in the browser. |
| `return` | Optional. The app's own link. Must match one of its `returnUrls`; defaults to the first. |
| `state` | Optional. Handed back unchanged, 1–256 characters of `A–Z a–z 0–9 . _ ~ -`. |

**Hand-back** — `<registered link>#id_token=<Google ID token>&state=<state>`. The part after `#` never reaches a
server or a log; read it in the browser, then clear it.

**The app must, on its server:**
- verify the token with Google (for example `GET https://oauth2.googleapis.com/tokeninfo?id_token=…`, or a JWT
  library with Google's public keys);
- check `aud` is the Client ID, `iss` is `accounts.google.com` or `https://accounts.google.com`, `exp` is in the
  future, `email_verified` is true, and `nonce` matches the value this browser made;
- refuse a token it has already used;
- treat `sub` as the person's permanent Google ID (an email address can change).

## Security notes

- Sign-ins only go to links listed in `config.json`, and only in the part after `#`.
- The nonce ties each sign-in to the browser that started it. Apps must check it.
- This page stores nothing, loads only Google's sign-in script, and sets a strict Content-Security-Policy.
- Anything published on `safmailas.github.io` shares this page's web origin. Only publish your own code there, or
  move this page to its own domain (then add that origin in Google Cloud).
- Whoever can edit this repository decides where sign-ins go. Keep its collaborators to people you trust.

## Troubleshooting

| You see | Fix |
|---|---|
| *Error 400: origin_mismatch*, or the button doesn't appear | The JavaScript origin in Google Cloud must be exactly `https://safmailas.github.io`. A content blocker can also hide the button. |
| *Error 403: access_denied* for an organization account | Add that account under **Audience → Test users**. |
| "Link not registered" | Add the link shown to `returnUrls` for that app. |
| "Not set up yet" | Put the Client ID in `config.json` (step 2). |
| The hub says the sign-in was for a different Client ID | The hub's Settings and this `config.json` must have the same Client ID. |
| A change to `config.json` isn't showing | Wait up to 10 minutes and reload. |

## Files

`index.html`, `app.js`, `style.css`, `config.json`, `LICENSE`, `.nojekyll`. Works on any static host (GitHub Pages,
Cloudflare Pages, Netlify); add that host's origin in Google Cloud if you move it.
