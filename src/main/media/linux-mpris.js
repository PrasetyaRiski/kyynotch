const { exec, spawn } = require('child_process');

class LinuxMpris {
  constructor() {
    this.activePlayer = null;
    this.latestState = {
      playing: false,
      paused: false,
      title: '',
      artist: '',
      album: '',
      artUrl: '',
      length: 0,
      position: 0,
      canNext: true,
      canPrev: true,
      canPlay: true,
      canPause: true,
    };
  }

  _exec(cmd) {
    return new Promise((resolve, reject) => {
      exec(cmd, { timeout: 3000 }, (err, stdout) => {
        if (err) return resolve('');
        resolve(stdout.trim());
      });
    });
  }

  async findActivePlayer() {
    // 1. Check with playerctl if available
    try {
      const pctl = await this._exec('playerctl -l 2>/dev/null');
      if (pctl) {
        const players = pctl.split('\n').filter(Boolean);
        if (players.length > 0) {
          return players[0];
        }
      }
    } catch (_) {}

    // 2. Fallback to gdbus ListNames
    const out = await this._exec(
      'gdbus call --session --dest org.freedesktop.DBus --object-path /org/freedesktop/DBus --method org.freedesktop.DBus.ListNames'
    );
    const match = out.match(/'(org\.mpris\.MediaPlayer2\.[^']+)'/g);
    if (match && match.length > 0) {
      return match[0].replace(/'/g, '');
    }
    return null;
  }

  async poll() {
    const playerBus = await this.findActivePlayer();
    if (!playerBus) {
      this.activePlayer = null;
      this.latestState = { playing: false, paused: false, title: '', artist: '' };
      return this.latestState;
    }

    this.activePlayer = playerBus;

    // Check with playerctl first if present
    try {
      const pctlCheck = await this._exec(`playerctl -p "${playerBus}" status 2>/dev/null`);
      if (pctlCheck) {
        const status = pctlCheck.trim();
        const title = await this._exec(`playerctl -p "${playerBus}" metadata title 2>/dev/null`);
        const artist = await this._exec(`playerctl -p "${playerBus}" metadata artist 2>/dev/null`);
        const album = await this._exec(`playerctl -p "${playerBus}" metadata album 2>/dev/null`);
        const artUrl = await this._exec(`playerctl -p "${playerBus}" metadata mpris:artUrl 2>/dev/null`);
        const posStr = await this._exec(`playerctl -p "${playerBus}" position 2>/dev/null`);
        const pos = parseFloat(posStr) || 0;
        const lenStr = await this._exec(`playerctl -p "${playerBus}" metadata mpris:length 2>/dev/null`);
        const length = parseFloat(lenStr) ? parseFloat(lenStr) / 1000000 : 0;

        this.latestState = {
          playing: status === 'Playing',
          paused: status === 'Paused',
          title: title || '',
          artist: artist || '',
          album: album || '',
          artUrl: artUrl || '',
          position: pos,
          length,
          bus: playerBus,
          canNext: true,
          canPrev: true,
          canPlay: true,
          canPause: true,
        };
        return this.latestState;
      }
    } catch (_) {}

    // Fallback to gdbus GetAll
    try {
      const gdbusOut = await this._exec(
        `gdbus call --session --dest ${playerBus} --object-path /org/mpris/MediaPlayer2 --method org.freedesktop.DBus.Properties.GetAll org.mpris.MediaPlayer2.Player`
      );

      const statusMatch = gdbusOut.match(/'PlaybackStatus': <'([^']+)'/);
      const status = statusMatch ? statusMatch[1] : '';

      const titleMatch = gdbusOut.match(/'xesam:title': <'([^']+)'/);
      const title = titleMatch ? titleMatch[1] : '';

      const artistMatch = gdbusOut.match(/'xesam:artist': <\['([^']+)'/);
      const artist = artistMatch ? artistMatch[1] : '';

      const albumMatch = gdbusOut.match(/'xesam:album': <'([^']+)'/);
      const album = albumMatch ? albumMatch[1] : '';

      const artMatch = gdbusOut.match(/'mpris:artUrl': <'([^']+)'/);
      const artUrl = artMatch ? artMatch[1] : '';

      const posMatch = gdbusOut.match(/'Position': <int64 ([0-9]+)>/);
      const pos = posMatch ? parseInt(posMatch[1], 10) / 1000000 : 0;

      const lenMatch = gdbusOut.match(/'mpris:length': <int64 ([0-9]+)>/);
      const length = lenMatch ? parseInt(lenMatch[1], 10) / 1000000 : 0;

      this.latestState = {
        playing: status === 'Playing',
        paused: status === 'Paused',
        title,
        artist,
        album,
        artUrl,
        position: pos,
        length,
        bus: playerBus,
        canNext: true,
        canPrev: true,
        canPlay: true,
        canPause: true,
      };
      return this.latestState;
    } catch (_) {}

    return this.latestState;
  }

  async playPause() {
    if (!this.activePlayer) return;
    await this._exec(`playerctl -p "${this.activePlayer}" play-pause 2>/dev/null`);
    await this._exec(
      `gdbus call --session --dest ${this.activePlayer} --object-path /org/mpris/MediaPlayer2 --method org.mpris.MediaPlayer2.Player.PlayPause`
    );
  }

  async next() {
    if (!this.activePlayer) return;
    await this._exec(`playerctl -p "${this.activePlayer}" next 2>/dev/null`);
    await this._exec(
      `gdbus call --session --dest ${this.activePlayer} --object-path /org/mpris/MediaPlayer2 --method org.mpris.MediaPlayer2.Player.Next`
    );
  }

  async previous() {
    if (!this.activePlayer) return;
    await this._exec(`playerctl -p "${this.activePlayer}" previous 2>/dev/null`);
    await this._exec(
      `gdbus call --session --dest ${this.activePlayer} --object-path /org/mpris/MediaPlayer2 --method org.mpris.MediaPlayer2.Player.Previous`
    );
  }
}

module.exports = new LinuxMpris();
