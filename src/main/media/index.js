const os = require('os');
const linuxMpris = require('./linux-mpris');
const windowsMedia = require('./windows-media');

class MediaManager {
  constructor() {
    this.platform = os.platform();
    this.provider = null;

    if (this.platform === 'linux') {
      this.provider = linuxMpris;
    } else if (this.platform === 'win32') {
      this.provider = windowsMedia;
    }
  }

  async poll() {
    if (!this.provider) {
      return { playing: false, paused: false, title: '', artist: '' };
    }
    return await this.provider.poll();
  }

  async playPause() {
    if (this.provider) await this.provider.playPause();
  }

  async next() {
    if (this.provider) await this.provider.next();
  }

  async previous() {
    if (this.provider) await this.provider.previous();
  }
}

module.exports = new MediaManager();
