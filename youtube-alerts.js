class YouTubeAlerts {
  constructor(config) {
    this.config = config;
    this.liveChatId = null;
    this.nextPageToken = null;
    this.pollTimer = null;
    this.alertQueue = [];
    this.isShowingAlert = false;
    this.seenIds = new Set();
  }

  async init() {
    await this.waitForVideo();
    await document.fonts.ready;
    this.preloadSounds();
    await this.refreshAccessToken();
    this.liveChatId = await this.findLiveChatId();
    if (!this.liveChatId) {
      console.error('No active live stream found. Make sure you are live on YouTube.');
      return;
    }
    this.poll();
  }

  async refreshAccessToken() {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: this.config.refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const data = await res.json();
    if (data.access_token) {
      this.config.accessToken = data.access_token;
      const expiresIn = (data.expires_in ?? 3600) - 300;
      setTimeout(() => this.refreshAccessToken(), expiresIn * 1000);
    } else {
      console.error('Token refresh failed:', data.error_description);
    }
  }

  waitForVideo() {
    const video = document.getElementById('alert-video');
    if (video.readyState >= 1) return Promise.resolve();
    return new Promise(resolve => video.addEventListener('loadedmetadata', resolve, { once: true }));
  }

  async findLiveChatId() {
    const res = await fetch(
      'https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet&broadcastStatus=active&broadcastType=all',
      { headers: { Authorization: `Bearer ${this.config.accessToken}` } }
    );
    const data = await res.json();
    return data.items?.[0]?.snippet?.liveChatId ?? null;
  }

  async poll() {
    const url = new URL('https://www.googleapis.com/youtube/v3/liveChatMessages');
    url.searchParams.set('part', 'snippet,authorDetails');
    url.searchParams.set('liveChatId', this.liveChatId);
    if (this.nextPageToken) url.searchParams.set('pageToken', this.nextPageToken);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.config.accessToken}` },
    });
    const data = await res.json();

    if (data.error) {
      console.error('YouTube API error:', data.error.message);
      return;
    }

    this.nextPageToken = data.nextPageToken;

    for (const item of data.items ?? []) {
      if (this.seenIds.has(item.id)) continue;
      this.seenIds.add(item.id);
      this.handleMessage(item);
    }

    this.pollTimer = setTimeout(() => this.poll(), data.pollingIntervalMillis ?? 10000);
  }

  handleMessage(item) {
    const type = item.snippet.type;
    const author = item.authorDetails.displayName;
    let alertData = null;

    switch (type) {
      case 'superChatEvent': {
        const sc = item.snippet.superChatDetails;
        alertData = {
          type: 'superchat',
          title: 'Super Chat!',
          message: `${author} - ${sc.amountDisplayString}`,
        };
        break;
      }
      case 'superStickerEvent': {
        const ss = item.snippet.superStickerDetails;
        alertData = {
          type: 'supersticker',
          title: 'Super Sticker!',
          message: `${author} - ${ss.amountDisplayString}`,
        };
        break;
      }
      case 'newSponsorEvent':
        alertData = {
          type: 'member',
          title: 'New Member!',
          message: `${author} just joined!`,
        };
        break;
      case 'memberMilestoneChatEvent': {
        const months = item.snippet.memberMilestoneChatDetails.memberMonth;
        alertData = {
          type: 'member',
          sound: 'milestone',
          title: `${months} Month Member!`,
          message: `${author} has been a member for ${months} months!`,
        };
        break;
      }
    }

    if (alertData) this.queueAlert(alertData);
  }

  queueAlert(alertData) {
    this.alertQueue.push(alertData);
    if (!this.isShowingAlert) this.showNextAlert();
  }

  preloadSounds() {
    this.soundCache = {};
    const sounds = this.config.sounds ?? {};
    for (const [key, path] of Object.entries(sounds)) {
      const audio = new Audio(path);
      audio.preload = 'auto';
      audio.load();
      this.soundCache[key] = audio;
    }
  }

  playAlertSound(type) {
    const audio = this.soundCache?.[type];
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  fitText(msg) {
    const video = document.getElementById('alert-video');
    const maxWidth = (video.offsetWidth || video.videoWidth) * 0.80;
    const originalSize = 5;
    let size = originalSize;
    msg.style.fontSize = size + 'rem';
    while (msg.scrollWidth > maxWidth && size > 1) {
      size -= 0.1;
      msg.style.fontSize = size.toFixed(1) + 'rem';
    }
    const drop = (originalSize - size) / 2;
    msg.style.top = drop > 0 ? `calc(46.5% + ${drop.toFixed(2)}rem)` : '';
  }

  showNextAlert() {
    if (this.alertQueue.length === 0) {
      this.isShowingAlert = false;
      return;
    }

    this.isShowingAlert = true;
    const data = this.alertQueue.shift();
    const el = document.getElementById('alert');
    const video = document.getElementById('alert-video');
    video.currentTime = 0;

    const msg = el.querySelector('.alert__message');
    const content = el.querySelector('.alert__content');
    el.className = `alert alert--${data.type}`;
    el.querySelector('.alert__title').textContent = data.title;
    msg.style.fontSize = '';
    msg.style.top = '';
    msg.textContent = data.message;
    content.classList.remove('alert__content--fade');
    void el.offsetHeight;
    el.classList.add('alert--visible');
    video.play();
    this.playAlertSound(data.sound ?? data.type);
    requestAnimationFrame(() => requestAnimationFrame(() => this.fitText(msg)));

    setTimeout(() => content.classList.add('alert__content--fade'), this.config.alertDuration - 500);

    setTimeout(() => {
      el.classList.add('alert--hiding');
      el.classList.remove('alert--visible');
      setTimeout(() => {
        el.classList.remove('alert--hiding');
        video.pause();
        video.currentTime = 0;
        setTimeout(() => this.showNextAlert(), this.config.alertCooldown);
      }, 300);
    }, this.config.alertDuration);
  }
}

const ytAlerts = new YouTubeAlerts(YT_CONFIG);
ytAlerts.init();
