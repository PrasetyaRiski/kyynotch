document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const island = document.getElementById('island');
  const collapsedPill = document.getElementById('collapsed-pill');
  const expandedContainer = document.getElementById('expanded-container');

  // Pill Elements
  const pillClock = document.getElementById('pill-clock');
  const pillDate = document.getElementById('pill-date');
  const pillBattery = document.getElementById('pill-battery');
  const pillBatteryIcon = document.getElementById('pill-battery-icon');
  const pillBatteryPct = document.getElementById('pill-battery-pct');
  const pillPomo = document.getElementById('pill-pomo');
  const pillMusic = document.getElementById('pill-music');
  const pillMusicTitle = document.getElementById('pill-music-title');
  const pillMusicArtist = document.getElementById('pill-music-artist');

  // Expanded Header
  const expandedClock = document.getElementById('expanded-clock');
  const expandedDate = document.getElementById('expanded-date');
  const btnCloseApp = document.getElementById('btn-close-app');
  const btnCollapse = document.getElementById('btn-collapse');
  const btnQuitApp = document.getElementById('btn-quit-app');

  // Tabs
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  // Shared State (Declared up-front to prevent Temporal Dead Zone bugs)
  let config = (await window.api.getAllStore()) || {};
  let isExpanded = false;
  let hoverTimeout = null;
  let collapseTimeout = null;
  let isDraggingFiles = false;
  let activeTab = config.activeTab || 'system';

  let latestMedia = null;
  let activeLyricIdx = -1;
  let lyricSyncTimer = null;
  let lastPositionSec = 0;
  let lastPositionTimestamp = Date.now();

  // Apply Theme
  document.body.className = `theme-${config.theme || 'apple'}`;

  // ==========================================
  // 1. DYNAMIC ISLAND EXPAND & COLLAPSE
  // ==========================================
  function measureCollapsedWidth() {
    const minW = config.collapsedWidth || 260;
    if (latestMedia && (latestMedia.playing || latestMedia.paused) && latestMedia.title) {
      return Math.max(340, minW);
    }
    return minW;
  }

  /* Measure the natural height of the active panel without letting the
     current window height inflate the result. Panels are `height: 100%`
     inside a flex viewport, so reading scrollHeight directly would always
     return at least the current viewport; summing the visible children
     gives us the real content height instead. */
  function measurePanelContentHeight(panel) {
    if (!panel) return 0;
    const style = getComputedStyle(panel);
    const gap = parseFloat(style.rowGap) || 0;
    const children = Array.from(panel.children).filter(el => !el.classList.contains('hidden'));
    let height = 0;
    for (const child of children) height += child.offsetHeight;
    height += gap * Math.max(0, children.length - 1);
    height += (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    return height;
  }

  function contentHeightForActivePanel() {
    const header = document.querySelector('.expanded-header');
    const tabsNav = document.querySelector('.tabs-nav');
    const activePanel = document.querySelector('.tab-panel.active');
    const styles = getComputedStyle(expandedContainer);
    const gap = parseFloat(styles.rowGap) || 0;

    return Math.ceil(
      (parseFloat(styles.paddingTop) || 0) +
      (header ? header.offsetHeight : 0) + gap +
      (tabsNav ? tabsNav.offsetHeight : 0) + gap +
      measurePanelContentHeight(activePanel) +
      (parseFloat(styles.paddingBottom) || 0)
    );
  }

  /* Same idea as the original extension: grow to the content, but never
     beyond 640px and never below the configured expanded height. */
  function fitExpandedHeight() {
    if (!isExpanded) return;
    const natural = contentHeightForActivePanel();
    const minHeight = config.expandedHeight || 460;
    const target = Math.max(minHeight, Math.min(640, natural + 32));
    const width = config.expandedWidth || 620;
    window.api.resizeWindow(width, target);
  }

  function expand() {
    if (isExpanded) return;
    clearTimeout(hoverTimeout);
    clearTimeout(collapseTimeout);
    isExpanded = true;

    island.classList.remove('hover-pulse');
    island.classList.remove('collapsed');
    island.classList.add('expanded');
    collapsedPill.classList.add('hidden');
    expandedContainer.classList.remove('hidden');

    const w = config.expandedWidth || 620;
    const h = config.expandedHeight || 460;
    window.api.resizeWindow(w, h);

    switchTab(activeTab);

    // Let the panel paint once, then fit the window to its real height.
    requestAnimationFrame(() => {
      fitExpandedHeight();
      requestAnimationFrame(fitExpandedHeight);
    });
  }

  function collapse() {
    if (!isExpanded) return;
    clearTimeout(hoverTimeout);
    clearTimeout(collapseTimeout);
    isExpanded = false;

    // Unfocus any active input so keyboard doesn't keep focus on hidden elements
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }

    const w = measureCollapsedWidth();
    const h = config.collapsedHeight || 34;
    window.api.resizeWindow(w, h);

    island.classList.remove('expanded');
    island.classList.remove('drag-over');
    island.classList.remove('hover-pulse');
    island.classList.add('collapsed');
    expandedContainer.classList.add('hidden');
    collapsedPill.classList.remove('hidden');
  }

  function toggle() {
    if (isExpanded) collapse();
    else expand();
  }

  function isAnyInputFocused() {
    const activeEl = document.activeElement;
    return !!(
      activeEl &&
      (activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' ||
        activeEl.isContentEditable)
    );
  }

  /* Defer the collapse while the OS cursor is still inside the window, a
     file drag is in flight, or an input has focus. DOM mouseleave can fire
     a frame early on some window managers, so the cursor guard prevents the
     island from vanishing under the pointer. */
  function scheduleCollapse(delay = 350) {
    clearTimeout(collapseTimeout);
    collapseTimeout = setTimeout(async () => {
      if (!isExpanded) return;
      if (isDraggingFiles || isAnyInputFocused()) {
        scheduleCollapse(450);
        return;
      }
      try {
        const inside = await window.api.isPointerInside(8);
        if (inside) {
          scheduleCollapse(400);
          return;
        }
      } catch (_) {}
      collapse();
    }, delay);
  }

  // Hover detection with debouncing
  island.addEventListener('mouseenter', () => {
    clearTimeout(collapseTimeout);
    if (!isExpanded) {
      island.classList.add('hover-pulse');
      hoverTimeout = setTimeout(expand, 180);
    }
  });

  island.addEventListener('mouseleave', () => {
    clearTimeout(hoverTimeout);
    island.classList.remove('hover-pulse');
    if (isExpanded && !isDraggingFiles && !isAnyInputFocused()) {
      scheduleCollapse(350);
    }
  });

  // Catch cursor leaving document/window boundaries
  document.addEventListener('mouseleave', (e) => {
    clearTimeout(hoverTimeout);
    island.classList.remove('hover-pulse');
    if (isExpanded && !e.relatedTarget && !isDraggingFiles && !isAnyInputFocused()) {
      scheduleCollapse(350);
    }
  });

  // Clicking outside into another window or desktop collapses the notch
  window.addEventListener('blur', () => {
    clearTimeout(hoverTimeout);
    island.classList.remove('hover-pulse');
    if (isExpanded && !isDraggingFiles) {
      collapse();
    }
  });

  // Pressing Escape collapses the notch
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isExpanded) {
      collapse();
    }
  });

  // Clicking on collapsed pill directly expands
  collapsedPill.addEventListener('click', (e) => {
    if (!e.target.closest('#pill-music')) {
      expand();
    }
  });

  window.api.onToggleNotch(() => toggle());

  // Close/Collapse buttons
  if (btnCloseApp) {
    btnCloseApp.addEventListener('click', (e) => {
      e.stopPropagation();
      collapse();
    });
  }

  if (btnCollapse) {
    btnCollapse.addEventListener('click', (e) => {
      e.stopPropagation();
      collapse();
    });
  }

  if (btnQuitApp) {
    btnQuitApp.addEventListener('click', (e) => {
      e.stopPropagation();
      window.api.closeWindow();
    });
  }

  // Click on collapsed music pill toggles Play/Pause directly
  pillMusic.addEventListener('click', async (e) => {
    e.stopPropagation();
    await window.api.mediaPlayPause();
  });

  // Tab switching
  function switchTab(tabName) {
    activeTab = tabName;
    tabButtons.forEach(btn => {
      if (btn.dataset.tab === tabName) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    tabPanels.forEach(panel => {
      if (panel.id === `panel-${tabName}`) panel.classList.add('active');
      else panel.classList.remove('active');
    });

    // Every tab has a different natural height; re-fit after it paints.
    requestAnimationFrame(() => {
      if (isExpanded) fitExpandedHeight();
    });
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // ==========================================
  // 2. CLOCK & DATE UPDATER
  // ==========================================
  function updateClocks() {
    const now = new Date();
    const timeShort = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const timeFull = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

    const dayName = now.toLocaleDateString([], { weekday: 'short' });
    const dayNum = now.getDate();
    const dateShort = `${dayName} ${dayNum}`;

    const dateFull = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    pillClock.textContent = timeShort;
    expandedClock.textContent = timeFull;
    expandedDate.textContent = dateFull;

    // In collapsed notch: hide date when music pill is active to prevent collision!
    const musicActive = latestMedia && (latestMedia.playing || latestMedia.paused) && latestMedia.title;
    if (musicActive) {
      pillDate.classList.add('hidden');
    } else {
      pillDate.classList.remove('hidden');
      pillDate.textContent = dateShort;
    }
  }

  setInterval(updateClocks, 1000);
  updateClocks();

  // ==========================================
  // 3. MEDIA PLAYER & REALTIME SYNCED LYRICS
  // ==========================================
  const musicEmpty = document.getElementById('music-empty');
  const musicPlayerView = document.getElementById('music-player-view');
  const mediaArt = document.getElementById('media-art');
  const mediaStatusPill = document.getElementById('media-status-pill');
  const mediaTitle = document.getElementById('media-title');
  const mediaArtist = document.getElementById('media-artist');
  const btnPrev = document.getElementById('btn-prev');
  const btnPlayPause = document.getElementById('btn-play-pause');
  const btnNext = document.getElementById('btn-next');

  // Lyrics Elements
  const lyricPrev = document.getElementById('lyric-prev');
  const lyricCurr = document.getElementById('lyric-curr');
  const lyricNext = document.getElementById('lyric-next');
  const lyricsSongTitle = document.getElementById('lyrics-song-title');

  btnPlayPause.addEventListener('click', async () => {
    await window.api.mediaPlayPause();
  });
  btnPrev.addEventListener('click', async () => {
    await window.api.mediaPrevious();
  });
  btnNext.addEventListener('click', async () => {
    await window.api.mediaNext();
  });

  async function pollMedia() {
    try {
      const media = await window.api.pollMedia();
      const prevMedia = latestMedia;
      latestMedia = media;

      if (!media || (!media.playing && !media.paused) || !media.title) {
        pillMusic.classList.add('hidden');
        musicEmpty.classList.remove('hidden');
        musicPlayerView.classList.add('hidden');
        stopLyricSync();
        if (!isExpanded && prevMedia && (prevMedia.playing || prevMedia.paused)) {
          window.api.resizeWindow(measureCollapsedWidth(), config.collapsedHeight || 34);
        }
        return;
      }

      // Update Collapsed Pill
      pillMusic.classList.remove('hidden');
      pillMusicTitle.textContent = (media.title || '').slice(0, 18);
      pillMusicArtist.textContent = (media.artist || '').slice(0, 16);

      if (!isExpanded && (!prevMedia || !prevMedia.title)) {
        window.api.resizeWindow(measureCollapsedWidth(), config.collapsedHeight || 34);
      }

      // Update Expanded View
      musicEmpty.classList.add('hidden');
      musicPlayerView.classList.remove('hidden');

      mediaTitle.textContent = media.title || 'Unknown Title';
      mediaArtist.textContent = media.artist || 'Unknown Artist';
      mediaStatusPill.textContent = media.playing ? '▶ SEDANG DIPUTAR' : '⏸ JEDA';
      btnPlayPause.textContent = media.playing ? '⏸' : '▶';

      if (media.artUrl && media.artUrl.startsWith('file://')) {
        mediaArt.style.backgroundImage = `url("${media.artUrl}")`;
        mediaArt.textContent = '';
      } else {
        mediaArt.style.backgroundImage = 'none';
        mediaArt.textContent = '🎵';
      }

      // Track position anchor
      lastPositionSec = media.position || 0;
      lastPositionTimestamp = Date.now();

      // Load lyrics if song changed
      const songChanged = !prevMedia || prevMedia.title !== media.title || prevMedia.artist !== media.artist;
      if (songChanged) {
        activeLyricIdx = -1;
        lyricsSongTitle.textContent = `${media.title} — ${media.artist}`;
        lyricPrev.textContent = '';
        lyricCurr.textContent = 'Mencari lirik realtime...';
        lyricNext.textContent = '';

        await window.lyricsEngine.loadLyrics(media.title, media.artist, media.length || media.duration);
        updateLyricsDisplay();
      }

      if (media.playing) {
        startLyricSync();
      } else {
        stopLyricSync();
        updateLyricsDisplay();
      }
    } catch (_) {}
  }

  function startLyricSync() {
    if (lyricSyncTimer) return;
    lyricSyncTimer = setInterval(updateLyricsDisplay, 300);
  }

  function stopLyricSync() {
    if (lyricSyncTimer) {
      clearInterval(lyricSyncTimer);
      lyricSyncTimer = null;
    }
  }

  function updateLyricsDisplay() {
    const data = window.lyricsEngine.getActiveLyrics();
    if (!data) {
      if (window.lyricsEngine.loading) {
        lyricCurr.textContent = 'Memuat lirik realtime...';
      } else {
        lyricCurr.textContent = 'Lirik tidak ditemukan untuk lagu ini';
      }
      lyricPrev.textContent = '';
      lyricNext.textContent = '';
      return;
    }

    if (!data.synced) {
      const lines = (data.plain || '').split('\n').filter(Boolean);
      lyricPrev.textContent = '';
      lyricCurr.textContent = lines.slice(0, 3).join('\n') || '♪';
      lyricNext.textContent = '';
      return;
    }

    // Synced Karaoke Mode
    let currentSec = lastPositionSec;
    if (latestMedia && latestMedia.playing) {
      const elapsed = (Date.now() - lastPositionTimestamp) / 1000;
      currentSec += elapsed;
    }

    const idx = window.lyricsEngine.findActiveLineIndex(data.lines, currentSec);
    if (idx !== activeLyricIdx) {
      activeLyricIdx = idx;
      const lines = data.lines;

      lyricPrev.textContent = idx > 0 ? lines[idx - 1].text : '';
      lyricCurr.textContent = idx >= 0 ? lines[idx].text : '♪';
      lyricNext.textContent = idx + 1 < lines.length ? lines[idx + 1].text : '';
    }
  }

  setInterval(pollMedia, 1200);
  pollMedia();

  // ==========================================
  // 4. SYSTEM MONITOR
  // ==========================================
  const sysCpu = document.getElementById('sys-cpu');
  const sysCpuBar = document.getElementById('sys-cpu-bar');
  const sysRam = document.getElementById('sys-ram');
  const sysRamBar = document.getElementById('sys-ram-bar');
  const sysRamUsed = document.getElementById('sys-ram-used');
  const sysRamTotal = document.getElementById('sys-ram-total');
  const sysDisk = document.getElementById('sys-disk');
  const sysDiskBar = document.getElementById('sys-disk-bar');
  const sysDiskUsed = document.getElementById('sys-disk-used');
  const sysDiskTotal = document.getElementById('sys-disk-total');
  const sysBatt = document.getElementById('sys-batt');
  const sysCharging = document.getElementById('sys-charging');
  const sysUptime = document.getElementById('sys-uptime');

  async function pollSystem() {
    try {
      const stats = await window.api.getSystemStats();
      sysCpu.textContent = stats.cpu;
      sysCpuBar.style.width = `${stats.cpu}%`;

      sysRam.textContent = stats.ram;
      sysRamBar.style.width = `${stats.ram}%`;
      sysRamUsed.textContent = stats.ramUsedGb;
      sysRamTotal.textContent = stats.ramTotalGb;

      sysDisk.textContent = stats.disk.percent;
      sysDiskBar.style.width = `${stats.disk.percent}%`;
      sysDiskUsed.textContent = stats.disk.usedGb;
      sysDiskTotal.textContent = stats.disk.totalGb;

      sysBatt.textContent = stats.battery.percent;
      sysCharging.textContent = stats.battery.isCharging ? '⚡' : '';
      sysUptime.textContent = stats.uptime;

      // Update Pill Battery
      if (stats.battery.hasBattery) {
        pillBattery.classList.remove('hidden');
        pillBatteryPct.textContent = `${stats.battery.percent}%`;
        pillBatteryIcon.textContent = stats.battery.isCharging ? '⚡' : '🔋';
      } else {
        pillBattery.classList.add('hidden');
      }
    } catch (_) {}
  }

  setInterval(pollSystem, 2000);
  pollSystem();

  // ==========================================
  // 5. UNIVERSAL AI CHAT ASSISTANT
  // ==========================================
  const aiMessages = document.getElementById('ai-messages');
  const aiPromptInput = document.getElementById('ai-prompt-input');
  const btnAiSend = document.getElementById('btn-ai-send');
  const btnAiAttach = document.getElementById('btn-ai-attach');
  const aiFileInput = document.getElementById('ai-file-input');
  const aiAttachmentPreview = document.getElementById('ai-attachment-preview');
  const aiAttachmentName = document.getElementById('ai-attachment-name');
  const aiAttachmentIcon = document.getElementById('ai-attachment-icon');
  const btnRemoveAttachment = document.getElementById('btn-remove-attachment');
  const btnAiClear = document.getElementById('btn-ai-clear');
  const aiActiveProvider = document.getElementById('ai-active-provider');

  /* Attachment shapes returned by the main process:
     image -> { ok, kind: 'image', name, mime, base64 }
     text  -> { ok, kind: 'text', name, mime, text, size }
     error -> { ok: false, error } */
  let selectedAttachment = null;

  function updateAiBadge() {
    const prov = config.ai?.provider || 'gemini';
    const names = {
      gemini: `Gemini (${config.ai?.geminiModel || '1.5-flash'})`,
      ollama: `Ollama (${config.ai?.ollamaModel || 'llama3'})`,
      openai: `OpenAI / Custom (${config.ai?.openaiModel || 'gpt-4o-mini'})`,
    };
    aiActiveProvider.textContent = names[prov] || 'AI Assistant';
  }
  updateAiBadge();

  function setAiAttachment(att) {
    selectedAttachment = att || null;

    if (!att) {
      aiAttachmentPreview.classList.add('hidden');
      if (aiAttachmentIcon) aiAttachmentIcon.textContent = '📄';
      aiAttachmentName.textContent = '';
      aiAttachmentName.title = '';
      return;
    }

    if (aiAttachmentIcon) {
      aiAttachmentIcon.textContent = att.kind === 'image' ? '🖼️' : '📄';
    }
    aiAttachmentName.textContent = att.name;
    aiAttachmentName.title = att.kind === 'text'
      ? `${att.name} · ${att.text.length.toLocaleString()} karakter`
      : att.name;
    aiAttachmentPreview.classList.remove('hidden');
  }

  function appendAiError(message) {
    const msg = document.createElement('div');
    msg.className = 'msg assistant error';
    msg.textContent = message;
    aiMessages.appendChild(msg);
    aiMessages.scrollTop = aiMessages.scrollHeight;
  }

  async function applyAttachmentResult(att) {
    if (!att) return;
    if (!att.ok) {
      appendAiError(att.error || 'Gagal membaca file.');
      return;
    }
    setAiAttachment(att);
  }

  btnAiAttach.addEventListener('click', async () => {
    try {
      await applyAttachmentResult(await window.api.pickAttachment());
    } catch (_) {}
  });

  aiFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const filePath = window.api.getPathForFile(file);
    e.target.value = '';

    // Files dragged from outside usually have a real path; keep a small
    // FileReader fallback for environments where that is unavailable.
    if (!filePath) {
      const reader = new FileReader();
      reader.onload = () => {
        setAiAttachment({
          ok: true,
          kind: 'image',
          name: file.name,
          mime: file.type || 'image/png',
          base64: String(reader.result).split(',')[1],
        });
      };
      reader.readAsDataURL(file);
      return;
    }

    try {
      await applyAttachmentResult(await window.api.attachFile(filePath));
    } catch (_) {}
  });

  btnRemoveAttachment.addEventListener('click', () => {
    setAiAttachment(null);
    aiFileInput.value = '';
  });

  btnAiClear.addEventListener('click', () => {
    aiMessages.innerHTML = `
      <div class="msg assistant">
        Obrolan telah dibersihkan. Silakan tanyakan hal lain atau lampirkan gambar, file teks, atau dokumen.
      </div>
    `;
    setAiAttachment(null);
  });

  async function sendAiMessage() {
    const text = (aiPromptInput.value || '').trim();
    const att = selectedAttachment;
    if (!text && !att) return;

    setAiAttachment(null);
    aiFileInput.value = '';
    aiPromptInput.value = '';

    let outbound = text;
    let fallbackAsk = 'Tolong jelaskan isi file ini.';

    if (att?.kind === 'image') {
      fallbackAsk = 'Tolong jelaskan isi gambar ini.';
    } else if (att?.kind === 'text') {
      const ask = text || 'Tolong ringkas dan jelaskan isi file ini, lalu sebutkan poin-poin pentingnya.';
      outbound = `${ask}\n\n===== ISI FILE: ${att.name} =====\n${att.text}\n===== AKHIR FILE =====`;
      fallbackAsk = 'Tolong ringkas isi file ini.';
    }

    // Append user message
    const userMsg = document.createElement('div');
    userMsg.className = 'msg user';
    if (att) {
      const tag = document.createElement('div');
      tag.className = 'msg-attachment';
      tag.textContent = `${att.kind === 'image' ? '🖼️' : '📄'} ${att.name}`;
      userMsg.appendChild(tag);
    }
    const body = document.createElement('div');
    body.className = 'msg-body';
    body.textContent = text || fallbackAsk;
    userMsg.appendChild(body);
    aiMessages.appendChild(userMsg);

    // Append loading placeholder
    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'msg assistant';
    loadingMsg.textContent = att?.kind === 'image'
      ? 'Menganalisis gambar...'
      : att?.kind === 'text'
        ? `Membaca “${att.name}”...`
        : 'Sedang berpikir...';
    aiMessages.appendChild(loadingMsg);
    aiMessages.scrollTop = aiMessages.scrollHeight;

    try {
      const answer = await window.api.askAI({
        prompt: outbound || fallbackAsk,
        imageBase64: att?.kind === 'image' ? att.base64 : undefined,
        imageMime: att?.kind === 'image' ? att.mime : undefined,
      });
      loadingMsg.textContent = answer;
    } catch (err) {
      loadingMsg.textContent = `Error: ${err.message}`;
    }
    aiMessages.scrollTop = aiMessages.scrollHeight;
  }

  btnAiSend.addEventListener('click', sendAiMessage);
  aiPromptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendAiMessage();
  });

  // ==========================================
  // 6. DROP SHELF
  // ==========================================
  const shelfList = document.getElementById('shelf-list');
  const shelfEmpty = document.getElementById('shelf-empty');
  const shelfDropHint = document.getElementById('shelf-drop-hint');
  const btnShelfAdd = document.getElementById('btn-shelf-add');
  const btnShelfClear = document.getElementById('btn-shelf-clear');

  let shelfItems = [];

  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let idx = 0;
    while (value >= 1024 && idx < units.length - 1) {
      value /= 1024;
      idx++;
    }
    return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
  }

  function shelfIcon(item) {
    if (item.isImage) return '🖼️';
    const ext = (item.ext || '').replace('.', '').toLowerCase();
    if (['doc', 'docx', 'odt', 'pdf', 'txt', 'md', 'rtf'].includes(ext)) return '📄';
    if (['zip', 'tar', 'gz', '7z', 'rar', 'xz'].includes(ext)) return '🗜️';
    if (['mp3', 'wav', 'flac', 'ogg', 'm4a', 'opus'].includes(ext)) return '🎵';
    if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext)) return '🎬';
    return '📎';
  }

  function renderShelf() {
    shelfList.innerHTML = '';
    const hasItems = shelfItems.length > 0;
    shelfEmpty.classList.toggle('hidden', hasItems);
    shelfList.classList.toggle('hidden', !hasItems);

    for (const item of shelfItems) {
      const row = document.createElement('div');
      row.className = 'shelf-item';

      const icon = document.createElement('span');
      icon.className = 'shelf-item-icon';
      icon.textContent = shelfIcon(item);

      const meta = document.createElement('div');
      meta.className = 'shelf-item-meta';

      const name = document.createElement('div');
      name.className = 'shelf-item-name';
      name.textContent = item.name;
      name.title = item.path;

      const sub = document.createElement('div');
      sub.className = 'shelf-item-sub';
      sub.textContent = `${formatBytes(item.size)} · ${new Date(item.mtime).toLocaleDateString()}`;

      meta.append(name, sub);

      const actions = document.createElement('div');
      actions.className = 'shelf-item-actions';

      const aiBtn = document.createElement('button');
      aiBtn.className = 'shelf-action';
      aiBtn.title = 'Kirim ke AI';
      aiBtn.textContent = '🤖';
      aiBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sendShelfItemToAi(item);
      });

      const revealBtn = document.createElement('button');
      revealBtn.className = 'shelf-action';
      revealBtn.title = 'Tampilkan di Folder';
      revealBtn.textContent = '📂';
      revealBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.api.shelfReveal(item.path);
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'shelf-action danger';
      delBtn.title = 'Hapus dari shelf';
      delBtn.textContent = '✕';
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.api.shelfRemove(item.path);
        await loadShelf();
      });

      actions.append(aiBtn, revealBtn, delBtn);
      row.append(icon, meta, actions);
      shelfList.appendChild(row);
    }
  }

  async function loadShelf() {
    try {
      shelfItems = (await window.api.shelfList()) || [];
    } catch (_) {
      shelfItems = [];
    }
    renderShelf();
  }

  async function sendShelfItemToAi(item) {
    try {
      const att = await window.api.attachFile(item.path);
      if (!isExpanded) expand();
      switchTab('ai');
      await applyAttachmentResult(att);
    } catch (_) {}
  }

  async function addPathsToShelf(paths) {
    if (!paths || !paths.length) return;
    try {
      await window.api.shelfAdd(paths);
      await loadShelf();
      if (!isExpanded) expand();
      switchTab('shelf');
    } catch (_) {}
  }

  btnShelfAdd.addEventListener('click', async () => {
    try {
      const added = await window.api.shelfPick();
      if (Array.isArray(added) && added.length) {
        await loadShelf();
        switchTab('shelf');
      }
    } catch (_) {}
  });

  btnShelfClear.addEventListener('click', async () => {
    if (!shelfItems.length) return;
    await window.api.shelfClear();
    await loadShelf();
  });

  loadShelf();

  // ——— Drag & drop onto the island ———
  let dragDepth = 0;

  function isFileDrag(event) {
    const types = event.dataTransfer?.types;
    return types ? Array.from(types).includes('Files') : false;
  }

  function setDragState(on) {
    isDraggingFiles = on;
    island.classList.toggle('drag-over', on);
    if (shelfDropHint) shelfDropHint.classList.toggle('active', on);
  }

  function clearDragState() {
    dragDepth = 0;
    setDragState(false);
  }

  island.addEventListener('dragenter', (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepth++;
    setDragState(true);
    if (!isExpanded) expand();
  });

  island.addEventListener('dragover', (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  island.addEventListener('dragleave', (e) => {
    if (!isFileDrag(e)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) setDragState(false);
  });

  island.addEventListener('drop', async (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files || []);
    clearDragState();

    const paths = files
      .map(file => {
        try { return window.api.getPathForFile(file); } catch (_) { return ''; }
      })
      .filter(Boolean);

    await addPathsToShelf(paths);
  });

  window.addEventListener('dragend', clearDragState);

  // ==========================================
  // 7. WEATHER FORECAST
  // ==========================================
  const weatherTemp = document.getElementById('weather-temp');
  const weatherLoc = document.getElementById('weather-loc');
  const weatherDesc = document.getElementById('weather-desc');
  const weatherHum = document.getElementById('weather-hum');
  const weatherWind = document.getElementById('weather-wind');

  const weatherBox2 = document.getElementById('weather-box-2');
  const weatherTemp2 = document.getElementById('weather-temp-2');
  const weatherLoc2 = document.getElementById('weather-loc-2');
  const weatherDesc2 = document.getElementById('weather-desc-2');
  const weatherHum2 = document.getElementById('weather-hum-2');
  const weatherWind2 = document.getElementById('weather-wind-2');

  function detectedArea(data, fallback) {
    return (
      data?.nearest_area?.[0]?.areaName?.[0]?.value ||
      fallback ||
      'Lokasi Terdeteksi'
    );
  }

  async function fetchWeatherInto(location, refs, label) {
    const unit = config.weather?.unit || 'metric';
    const data = await window.api.fetchWeather({ location, unit });
    const c = data?.current_condition?.[0];
    if (!c) return false;

    refs.temp.textContent = unit === 'imperial' ? `${c.temp_F}°F` : `${c.temp_C}°C`;
    refs.loc.textContent = label || detectedArea(data, location);
    refs.desc.textContent = c.weatherDesc?.[0]?.value || 'Cerah';
    refs.hum.textContent = c.humidity ?? '--';
    refs.wind.textContent = c.windspeedKmph ?? '--';
    return true;
  }

  async function pollWeather() {
    const unit = config.weather?.unit || 'metric';
    const primary = {
      location: config.weather?.location || '',
      label: config.weather?.locationLabel || '',
    };

    try {
      await fetchWeatherInto(
        primary.location,
        { temp: weatherTemp, loc: weatherLoc, desc: weatherDesc, hum: weatherHum, wind: weatherWind },
        primary.label
      );
    } catch (_) {
      weatherDesc.textContent = 'Cuaca tidak dapat diakses';
    }

    const secondary = {
      location: (config.weather?.location2 || '').trim(),
      label: config.weather?.location2Label || '',
    };

    if (!secondary.location) {
      weatherBox2.classList.add('hidden');
      return;
    }

    weatherBox2.classList.remove('hidden');
    try {
      await fetchWeatherInto(
        secondary.location,
        { temp: weatherTemp2, loc: weatherLoc2, desc: weatherDesc2, hum: weatherHum2, wind: weatherWind2 },
        secondary.label
      );
    } catch (_) {
      weatherDesc2.textContent = 'Cuaca tidak dapat diakses';
    }
  }

  let weatherTimer = null;

  function startWeatherLoop() {
    if (weatherTimer) clearInterval(weatherTimer);
    const minutes = Math.max(5, parseInt(config.weather?.refresh, 10) || 30);
    weatherTimer = setInterval(pollWeather, minutes * 60 * 1000);
  }

  startWeatherLoop();
  pollWeather();

  // ==========================================
  // 7. NOTES (MARKDOWN DRAFTS)
  // ==========================================
  const notesList = document.getElementById('notes-list');
  const btnNoteNew = document.getElementById('btn-note-new');
  let rawNotes = await window.api.getNotes();
  let notes = Array.isArray(rawNotes) ? rawNotes : [];

  function renderNotes() {
    notesList.innerHTML = '';
    if (notes.length === 0) {
      notes.push({ id: Date.now(), title: '', body: '' });
    }

    notes.forEach((note, index) => {
      const card = document.createElement('div');
      card.className = 'note-card';

      const top = document.createElement('div');
      top.className = 'note-top';

      const titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.className = 'note-title-input';
      titleInput.placeholder = 'Judul Catatan...';
      titleInput.value = note.title || '';
      titleInput.addEventListener('input', () => {
        note.title = titleInput.value;
        window.api.saveNotes(notes);
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'close-mini';
      delBtn.textContent = '✕';
      delBtn.addEventListener('click', () => {
        notes.splice(index, 1);
        window.api.saveNotes(notes);
        renderNotes();
      });

      top.appendChild(titleInput);
      top.appendChild(delBtn);

      const bodyInput = document.createElement('textarea');
      bodyInput.className = 'note-body-input';
      bodyInput.placeholder = 'Ketik isi catatan di sini...';
      bodyInput.value = note.body || '';
      bodyInput.addEventListener('input', () => {
        note.body = bodyInput.value;
        window.api.saveNotes(notes);
      });

      card.appendChild(top);
      card.appendChild(bodyInput);
      notesList.appendChild(card);
    });
  }

  btnNoteNew.addEventListener('click', () => {
    notes.unshift({ id: Date.now(), title: '', body: '' });
    window.api.saveNotes(notes);
    renderNotes();
  });

  renderNotes();

  // ==========================================
  // 8. POMODORO TIMER
  // ==========================================
  const pomoTime = document.getElementById('pomo-time');
  const pomoMode = document.getElementById('pomo-mode');
  const btnPomoToggle = document.getElementById('btn-pomo-toggle');
  const btnPomoReset = document.getElementById('btn-pomo-reset');
  const presetButtons = document.querySelectorAll('.preset-btn');

  let pomoState = 'idle'; // 'idle' | 'running' | 'paused'
  let pomoKind = 'work'; // 'work' | 'break'
  let pomoWorkMin = 25;
  let pomoBreakMin = 5;
  let pomoRemainSec = 25 * 60;
  let pomoTimer = null;

  function formatTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function updatePomoDisplay() {
    pomoTime.textContent = formatTime(pomoRemainSec);
    pomoMode.textContent = pomoKind === 'work' ? 'WAKTU FOKUS' : 'WAKTU ISTIRAHAT';

    if (pomoState === 'running') {
      pillPomo.classList.remove('hidden');
      pillPomo.textContent = `⏱ ${formatTime(pomoRemainSec)}`;
    } else {
      pillPomo.classList.add('hidden');
    }
  }

  btnPomoToggle.addEventListener('click', () => {
    if (pomoState === 'running') {
      clearInterval(pomoTimer);
      pomoState = 'paused';
      btnPomoToggle.textContent = 'Lanjutkan';
    } else {
      pomoState = 'running';
      btnPomoToggle.textContent = 'Jeda';
      pomoTimer = setInterval(() => {
        pomoRemainSec--;
        if (pomoRemainSec <= 0) {
          clearInterval(pomoTimer);
          if (pomoKind === 'work') {
            pomoKind = 'break';
            pomoRemainSec = pomoBreakMin * 60;
            window.api.logPomoSession({ kind: 'work', durationMin: pomoWorkMin, date: Date.now() });
            pomoState = 'idle';
            btnPomoToggle.textContent = 'Mulai Istirahat';
          } else {
            pomoKind = 'work';
            pomoRemainSec = pomoWorkMin * 60;
            pomoState = 'idle';
            btnPomoToggle.textContent = 'Mulai Fokus';
          }
        }
        updatePomoDisplay();
      }, 1000);
    }
    updatePomoDisplay();
  });

  btnPomoReset.addEventListener('click', () => {
    clearInterval(pomoTimer);
    pomoState = 'idle';
    pomoKind = 'work';
    pomoRemainSec = pomoWorkMin * 60;
    btnPomoToggle.textContent = 'Mulai';
    updatePomoDisplay();
  });

  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      presetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      pomoWorkMin = parseInt(btn.dataset.work, 10);
      pomoBreakMin = parseInt(btn.dataset.break, 10);
      btnPomoReset.click();
    });
  });

  updatePomoDisplay();

  // ==========================================
  // 9. SETTINGS MANAGER
  // ==========================================
  const setTheme = document.getElementById('set-theme');
  const setAiProvider = document.getElementById('set-ai-provider');
  const fieldGemini = document.getElementById('field-gemini');
  const fieldOllama = document.getElementById('field-ollama');
  const fieldOpenai = document.getElementById('field-openai');

  const setGeminiKey = document.getElementById('set-gemini-key');
  const setGeminiModel = document.getElementById('set-gemini-model');
  const setOllamaUrl = document.getElementById('set-ollama-url');
  const setOllamaModel = document.getElementById('set-ollama-model');
  const setOpenaiUrl = document.getElementById('set-openai-url');
  const setOpenaiKey = document.getElementById('set-openai-key');
  const setOpenaiModel = document.getElementById('set-openai-model');
  const setWeatherLoc = document.getElementById('set-weather-loc');
  const setWeatherLabel = document.getElementById('set-weather-label');
  const setWeatherLoc2 = document.getElementById('set-weather-loc2');
  const setWeatherLabel2 = document.getElementById('set-weather-label2');
  const setWeatherRefresh = document.getElementById('set-weather-refresh');
  const setAutostart = document.getElementById('set-autostart');
  const btnSaveSettings = document.getElementById('btn-save-settings');

  // Populate form from config
  setTheme.value = config.theme || 'apple';
  setAiProvider.value = config.ai?.provider || 'gemini';
  setGeminiKey.value = config.ai?.geminiApiKey || '';
  setGeminiModel.value = config.ai?.geminiModel || 'gemini-1.5-flash';
  setOllamaUrl.value = config.ai?.ollamaUrl || 'http://localhost:11434';
  setOllamaModel.value = config.ai?.ollamaModel || 'llama3';
  setOpenaiUrl.value = config.ai?.openaiBaseUrl || 'https://api.openai.com/v1';
  setOpenaiKey.value = config.ai?.openaiApiKey || '';
  setOpenaiModel.value = config.ai?.openaiModel || 'gpt-4o-mini';
  setWeatherLoc.value = config.weather?.location || '';
  setWeatherLabel.value = config.weather?.locationLabel || '';
  setWeatherLoc2.value = config.weather?.location2 || '';
  setWeatherLabel2.value = config.weather?.location2Label || '';
  setWeatherRefresh.value = config.weather?.refresh || 30;

  try {
    const isAuto = await window.api.getAutostart();
    if (setAutostart) setAutostart.checked = !!isAuto;
  } catch (_) {}

  function toggleAiFields() {
    const val = setAiProvider.value;
    fieldGemini.classList.toggle('hidden', val !== 'gemini');
    fieldOllama.classList.toggle('hidden', val !== 'ollama');
    fieldOpenai.classList.toggle('hidden', val !== 'openai');
  }

  setAiProvider.addEventListener('change', toggleAiFields);
  toggleAiFields();

  setTheme.addEventListener('change', () => {
    document.body.className = `theme-${setTheme.value}`;
  });

  btnSaveSettings.addEventListener('click', async () => {
    config.theme = setTheme.value;
    config.weather = {
      location: setWeatherLoc.value.trim(),
      unit: config.weather?.unit || 'metric',
      refresh: Math.max(5, parseInt(setWeatherRefresh.value, 10) || 30),
      locationLabel: setWeatherLabel.value.trim(),
      location2: setWeatherLoc2.value.trim(),
      location2Label: setWeatherLabel2.value.trim(),
    };
    config.ai = {
      provider: setAiProvider.value,
      geminiApiKey: setGeminiKey.value,
      geminiModel: setGeminiModel.value,
      ollamaUrl: setOllamaUrl.value,
      ollamaModel: setOllamaModel.value,
      openaiBaseUrl: setOpenaiUrl.value,
      openaiApiKey: setOpenaiKey.value,
      openaiModel: setOpenaiModel.value,
    };

    await window.api.saveAllStore(config);
    if (setAutostart) {
      try { await window.api.setAutostart(setAutostart.checked); } catch (_) {}
    }
    updateAiBadge();
    startWeatherLoop();
    pollWeather();

    btnSaveSettings.textContent = '✓ Tersimpan!';
    setTimeout(() => {
      btnSaveSettings.textContent = 'Simpan Pengaturan';
    }, 1500);
  });
});
