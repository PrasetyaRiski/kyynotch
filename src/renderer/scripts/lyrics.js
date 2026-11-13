class LyricsEngine {
  constructor() {
    this.cache = new Map();
    this.currentKey = null;
    this.loading = false;
  }

  cleanTrackInfo(rawTitle, rawArtist) {
    let title = (rawTitle || '').trim();
    let artist = (rawArtist || '').trim();

    // Check if title has separator like " - "
    if (title.includes(' - ')) {
      const parts = title.split(' - ');
      const p0 = parts[0].trim();
      const p1 = parts.slice(1).join(' - ').trim();

      if (artist && p0.toLowerCase().includes(artist.toLowerCase().slice(0, 10))) {
        title = p1;
      } else if (artist && p1.toLowerCase().includes(artist.toLowerCase().slice(0, 10))) {
        title = p0;
      } else if (!artist || artist.includes('Topic') || artist.includes('VEVO')) {
        artist = p0;
        title = p1;
      }
    }

    // Strip YouTube tags
    title = title.replace(/\((official\s*(music\s*)?video|audio|lyrics?|visualizer|feat\.?[^)]*|ft\.?[^)]*)\)/gi, '');
    title = title.replace(/\[(official\s*(music\s*)?video|audio|lyrics?|visualizer|feat\.?[^\]]*|ft\.?[^\]]*)\]/gi, '');
    title = title.replace(/\|\s*(lirik\s*lagu|official\s*video|lyrics?).*$/gi, '');
    title = title.trim();

    artist = artist.replace(/(\s*-\s*Topic|VEVO)$/gi, '').trim();

    return { title, artist };
  }

  parseLRC(lrcText) {
    if (!lrcText) return [];
    const lines = lrcText.split('\n');
    const result = [];
    const tagRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

    for (const line of lines) {
      const match = tagRegex.exec(line);
      if (match) {
        const min = parseInt(match[1], 10);
        const sec = parseInt(match[2], 10);
        const ms = parseFloat('0.' + match[3]);
        const time = min * 60 + sec + ms;
        const text = match[4].trim();
        if (text) {
          result.push({ time, text });
        }
      }
    }
    return result.sort((a, b) => a.time - b.time);
  }

  async _fetchJson(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Kyynotch/1.0 (https://github.com/NexVar/NexNotch)' },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (_) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /* Pick the best candidate from LRCLIB results. Prefer synced lyrics, then
     the entry whose duration is closest to the player's reported length;
     fall back to the first usable result. */
  _pickCandidate(items, durationSec) {
    if (!Array.isArray(items)) return null;
    const usable = items.filter(i => i && (i.syncedLyrics || i.plainLyrics));
    if (!usable.length) return null;

    if (durationSec && durationSec > 0) {
      usable.sort((a, b) => {
        const da = a.duration ? Math.abs(a.duration - durationSec) : Number.MAX_SAFE_INTEGER;
        const db = b.duration ? Math.abs(b.duration - durationSec) : Number.MAX_SAFE_INTEGER;
        return da - db;
      });
    }

    const synced = usable.find(i => i.syncedLyrics);
    return synced || usable[0];
  }

  _toData(item) {
    if (!item) return null;
    if (item.syncedLyrics) {
      return {
        synced: true,
        lines: this.parseLRC(item.syncedLyrics),
        track: item.trackName,
        artist: item.artistName,
      };
    }
    return {
      synced: false,
      plain: item.plainLyrics || '',
      track: item.trackName,
      artist: item.artistName,
    };
  }

  async _fetchFromLrclib(title, artist, durationSec) {
    const base = 'https://lrclib.net/api';
    const track = encodeURIComponent(title || '');
    const name = encodeURIComponent(artist || '');

    const urls = [];
    // Exact structured lookup first — LRCLIB /api/get is the most reliable,
    // but it only answers when artist + track + duration line up.
    if (title && artist) {
      let getUrl = `${base}/get?track_name=${track}&artist_name=${name}`;
      if (durationSec && durationSec > 0) getUrl += `&duration=${Math.round(durationSec)}`;
      urls.push(getUrl);
    }
    if (title) {
      urls.push(`${base}/search?track_name=${track}${artist ? `&artist_name=${name}` : ''}`);
      urls.push(`${base}/search?q=${encodeURIComponent(`${title} ${artist}`.trim())}`);
    }

    for (const url of urls) {
      const json = await this._fetchJson(url);
      if (!json) continue;

      if (Array.isArray(json)) {
        const picked = this._pickCandidate(json, durationSec);
        const data = this._toData(picked);
        if (data) return data;
      } else if (json && (json.syncedLyrics || json.plainLyrics)) {
        return this._toData(json);
      }
    }

    return null;
  }

  async loadLyrics(rawTitle, rawArtist, durationSec) {
    if (!rawTitle) {
      this.currentKey = null;
      return null;
    }

    const { title, artist } = this.cleanTrackInfo(rawTitle, rawArtist);
    const key = `${title.toLowerCase()}::${artist.toLowerCase()}`;

    if (this.cache.has(key)) {
      this.currentKey = key;
      return this.cache.get(key);
    }

    this.currentKey = key;
    this.loading = true;

    try {
      const data = await this._fetchFromLrclib(title, artist, durationSec);
      this.cache.set(key, data);
      this.loading = false;
      return data;
    } catch (_) {
      this.cache.set(key, null);
      this.loading = false;
      return null;
    }
  }

  getActiveLyrics() {
    if (!this.currentKey) return null;
    return this.cache.get(this.currentKey) || null;
  }

  findActiveLineIndex(lines, currentSeconds) {
    if (!lines || lines.length === 0) return -1;
    let activeIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (currentSeconds >= lines[i].time) {
        activeIdx = i;
      } else {
        break;
      }
    }
    return activeIdx;
  }
}

window.lyricsEngine = new LyricsEngine();
