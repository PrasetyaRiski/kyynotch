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

      if (artist && p0.toLowerCase().includes(artist.toLowerCase().slice(0, 8))) {
        title = p1;
      } else if (artist && p1.toLowerCase().includes(artist.toLowerCase().slice(0, 8))) {
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

  async loadLyrics(rawTitle, rawArtist) {
    if (!rawTitle) return null;

    const { title, artist } = this.cleanTrackInfo(rawTitle, rawArtist);
    const key = `${title.toLowerCase()}::${artist.toLowerCase()}`;

    if (this.cache.has(key)) {
      this.currentKey = key;
      return this.cache.get(key);
    }

    this.currentKey = key;
    this.loading = true;

    try {
      const q = encodeURIComponent(`${title} ${artist}`);
      const res = await fetch(`https://lrclib.net/api/search?q=${q}`, {
        headers: { 'User-Agent': 'Kyynotch/1.0' },
      });

      if (!res.ok) {
        this.cache.set(key, null);
        this.loading = false;
        return null;
      }

      const items = await res.json();
      if (Array.isArray(items) && items.length > 0) {
        const synced = items.find(i => i.syncedLyrics);
        if (synced) {
          const parsed = this.parseLRC(synced.syncedLyrics);
          const data = {
            synced: true,
            lines: parsed,
            track: synced.trackName,
            artist: synced.artistName,
          };
          this.cache.set(key, data);
          this.loading = false;
          return data;
        }

        if (items[0].plainLyrics) {
          const data = {
            synced: false,
            plain: items[0].plainLyrics,
            track: items[0].trackName,
            artist: items[0].artistName,
          };
          this.cache.set(key, data);
          this.loading = false;
          return data;
        }
      }

      this.cache.set(key, null);
      this.loading = false;
      return null;
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
