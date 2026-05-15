# Stream Alert Boxes

Custom Twitch and YouTube alert overlays for OBS. Uses the Twitch EventSub WebSocket API and the YouTube Live Chat API to display real-time alerts with a custom animation.

---

## Alerts Supported

**Twitch:** Follows, Subscriptions, Resubscriptions, Cheers (Bits), Raids

**YouTube:** Super Chats, Super Stickers, New Members, Member Milestones

---

## OBS Setup

Add each alert box as a **Browser Source** in OBS:

- **Source:** `Twitch Alert Box.html` or `YouTube Alert Box.html`
- **Width/Height:** Match your stream resolution (e.g. 1920x1080)
- **Shutdown source when not visible:** Checked
- **Refresh browser when scene becomes active:** Checked

To test alerts without going live, open the **Interact** window in OBS and press the **backtick key (`)** to toggle the test buttons.

---

## Twitch Setup

### 1. Create a Twitch Application

1. Go to [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps) and log in
2. Click **Register Your Application**
3. Fill in the form:
   - **Name:** Anything (e.g. "My Stream Alerts")
   - **OAuth Redirect URLs:** `http://localhost`
   - **Category:** Other
4. Click **Create**
5. Copy your **Client ID**

### 2. Get an Access Token

1. Go to [twitchtokengenerator.com](https://twitchtokengenerator.com)
2. Paste your **Client ID** and **Client Secret** (found on the same page as your Client ID)
3. Select the following scopes:
   - `moderator:read:followers`
   - `channel:read:subscriptions`
   - `bits:read`
4. Click **Generate Token** and complete the sign-in
5. Copy the **Access Token**

### 3. Configure

Open `twitch-config.js` and fill in:

```js
const CONFIG = {
  clientId: 'YOUR_CLIENT_ID_HERE',
  accessToken: 'YOUR_ACCESS_TOKEN_HERE',
  broadcasterLogin: 'your_twitch_username',
  ...
};
```

> **Note:** Twitch access tokens do not expire automatically but can be revoked. If alerts stop working, generate a new token.

---

## YouTube Setup

### 1. Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **Select a project → New Project**, name it anything, and click **Create**

### 2. Enable the YouTube Data API

1. Go to **APIs & Services → Library**
2. Search for **YouTube Data API v3** and click **Enable**

### 3. Configure the OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**
2. Select **External** and click **Create**
3. Fill in the required fields (App name, support email) and click **Save and Continue** through each step
4. On the **Test users** step, click **Add users** and add your Google account email
5. Click **Save and Continue**

### 4. Create OAuth Credentials

1. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**
2. Set **Application type** to **Web application**
3. Under **Authorized redirect URIs**, add:
   ```
   https://developers.google.com/oauthplayground
   ```
4. Click **Create**
5. Copy your **Client ID** and **Client Secret**

### 5. Get a Refresh Token

1. Go to [developers.google.com/oauthplayground](https://developers.google.com/oauthplayground)
2. Click the **gear icon** (top right) and check **Use your own OAuth credentials**
3. Paste your **Client ID** and **Client Secret**
4. In the scope list (Step 1), find and select:
   ```
   https://www.googleapis.com/auth/youtube.readonly
   ```
5. Click **Authorize APIs** and complete sign-in with your Google account
6. In Step 2, click **Exchange authorization code for tokens**
7. Copy the **Refresh Token** and **Access Token**

### 6. Configure

Open `youtube-config.js` and fill in:

```js
const YT_CONFIG = {
  clientId: 'YOUR_CLIENT_ID_HERE',
  clientSecret: 'YOUR_CLIENT_SECRET_HERE',
  accessToken: 'YOUR_ACCESS_TOKEN_HERE',
  refreshToken: 'YOUR_REFRESH_TOKEN_HERE',
  ...
};
```

> **Note:** The access token expires after 1 hour but is refreshed automatically using the refresh token. The refresh token does not expire unless revoked.

---

## File Structure

```
Alert Boxes/
├── Twitch Alert Box.html        # Twitch overlay (add this to OBS)
├── YouTube Alert Box.html       # YouTube overlay (add this to OBS)
├── twitch-config.js             # Twitch credentials (your real values go here)
├── twitch-config.example.js     # Twitch credentials template
├── twitch-alerts.js             # Twitch EventSub logic
├── youtube-config.js            # YouTube credentials (your real values go here)
├── youtube-config.example.js    # YouTube credentials template
├── youtube-alerts.js            # YouTube polling logic
├── style.css                    # Shared styles
├── Animation/
│   └── SpectreAlert.webm        # Alert animation
└── Fonts/
    └── Teko-Medium.ttf          # Alert font
```

To get started, copy the relevant example config file, rename it by removing `.example` from the filename, and fill in your credentials:

- `twitch-config.example.js` → `twitch-config.js`
- `youtube-config.example.js` → `youtube-config.js`
