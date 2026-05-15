class TwitchAlerts {
  constructor(config) {
    this.config = config;
    this.ws = null;
    this.sessionId = null;
    this.broadcasterId = null;
    this.alertQueue = [];
    this.isShowingAlert = false;
    this.reconnectUrl = null;
  }

  async init() {
    this.broadcasterId = await this.fetchBroadcasterId();
    if (!this.broadcasterId) {
      console.error('Failed to fetch broadcaster ID. Check your clientId, accessToken, and broadcasterLogin.');
      return;
    }
    await this.waitForVideo();
    await document.fonts.ready;
    this.connect();
  }

  waitForVideo() {
    const video = document.getElementById('alert-video');
    if (video.readyState >= 1) return Promise.resolve();
    return new Promise(resolve => video.addEventListener('loadedmetadata', resolve, { once: true }));
  }

  async fetchBroadcasterId() {
    const res = await fetch(`https://api.twitch.tv/helix/users?login=${this.config.broadcasterLogin}`, {
      headers: {
        'Client-Id': this.config.clientId,
        'Authorization': `Bearer ${this.config.accessToken}`,
      },
    });
    const data = await res.json();
    return data?.data?.[0]?.id ?? null;
  }

  connect(url = 'wss://eventsub.wss.twitch.tv/ws') {
    this.ws = new WebSocket(url);
    this.ws.onmessage = (e) => this.handleMessage(JSON.parse(e.data));
    this.ws.onclose = () => this.handleClose();
    this.ws.onerror = (err) => console.error('WebSocket error:', err);
  }

  handleMessage(msg) {
    const type = msg.metadata?.message_type;
    if (type === 'session_welcome') {
      this.sessionId = msg.payload.session.id;
      this.createSubscriptions();
    } else if (type === 'session_reconnect') {
      this.reconnectUrl = msg.payload.session.reconnect_url;
      this.connect(this.reconnectUrl);
    } else if (type === 'notification') {
      this.handleNotification(msg.payload);
    }
  }

  handleClose() {
    if (this.reconnectUrl) {
      this.connect(this.reconnectUrl);
      this.reconnectUrl = null;
    } else {
      setTimeout(() => this.connect(), 5000);
    }
  }

  async createSubscriptions() {
    const id = this.broadcasterId;
    const subscriptions = [
      { type: 'channel.follow',               version: '2', condition: { broadcaster_user_id: id, moderator_user_id: id } },
      { type: 'channel.subscribe',            version: '1', condition: { broadcaster_user_id: id } },
      { type: 'channel.subscription.message', version: '1', condition: { broadcaster_user_id: id } },
      { type: 'channel.cheer',                version: '1', condition: { broadcaster_user_id: id } },
      { type: 'channel.raid',                 version: '1', condition: { to_broadcaster_user_id: id } },
    ];

    for (const sub of subscriptions) {
      await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
        method: 'POST',
        headers: {
          'Client-Id': this.config.clientId,
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...sub,
          transport: { method: 'websocket', session_id: this.sessionId },
        }),
      }).catch((err) => console.error(`Failed to subscribe to ${sub.type}:`, err));
    }
  }

  handleNotification({ subscription, event }) {
    let alertData = null;

    switch (subscription.type) {
      case 'channel.follow':
        alertData = {
          type: 'follow',
          title: 'New Follower!',
          message: `${event.user_name} just followed!`,
        };
        break;
      case 'channel.subscribe':
        alertData = {
          type: 'subscribe',
          title: 'New Subscriber!',
          message: `${event.user_name} just subscribed!`,
        };
        break;
      case 'channel.subscription.message':
        alertData = {
          type: 'subscribe',
          title: `${event.cumulative_months} Month Sub!`,
          message: `${event.user_name} resubscribed for ${event.cumulative_months} months!`,
        };
        break;
      case 'channel.cheer':
        alertData = {
          type: 'cheer',
          title: `${event.bits} Bits!`,
          message: `${event.user_name} cheered ${event.bits} bits!`,
        };
        break;
      case 'channel.raid':
        alertData = {
          type: 'raid',
          title: 'Incoming Raid!',
          message: `${event.from_broadcaster_user_name} is raiding with ${event.viewers} viewers!`,
        };
        break;
    }

    if (alertData) this.queueAlert(alertData);
  }

  queueAlert(alertData) {
    this.alertQueue.push(alertData);
    if (!this.isShowingAlert) this.showNextAlert();
  }

  fitText(msg) {
    const originalSize = 5;
    const video = document.getElementById('alert-video');
    const maxWidth = (video.offsetWidth || video.videoWidth) * 0.80;
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

const alerts = new TwitchAlerts(CONFIG);
alerts.init();
