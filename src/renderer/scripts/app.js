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

  // Tabs
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  // State
  let config = await window.api.getAllStore();
  let isExpanded = false;
  let hoverTimeout = null;
  let collapseTimeout = null;
  let activeTab = config.activeTab || 'system';

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

  function expand() {
    if (isExpanded) return;
    clearTimeout(collapseTimeout);
    isExpanded = true;

    const w = config.expandedWidth || 620;
    const h = config.expandedHeight || 460;
    window.api.resizeWindow(w, h);

    island.classList.remove('collapsed');
    island.classList.add('expanded');
    collapsedPill.classList.add('hidden');
    expandedContainer.classList.remove('hidden');

    switchTab(activeTab);
  }

  function collapse() {
    if (!isExpanded) return;
    clearTimeout(hoverTimeout);
    isExpanded = false;

    const w = measureCollapsedWidth();
    const h = config.collapsedHeight || 34;
    window.api.resizeWindow(w, h);

    island.classList.remove('expanded');
    island.classList.add('collapsed');
    expandedContainer.classList.add('hidden');
    collapsedPill.classList.remove('hidden');
  }

  function toggle() {
    if (isExpanded) collapse();
    else expand();
  }

  // Hover detection with debouncing
  island.addEventListener('mouseenter', () => {
    clearTimeout(collapseTimeout);
    if (!isExpanded) {
      hoverTimeout = setTimeout(expand, 180);
    }
  });

  island.addEventListener('mouseleave', () => {
    clearTimeout(hoverTimeout);
    if (isExpanded) {
      collapseTimeout = setTimeout(collapse, 320);
    }
  });

  window.api.onToggleNotch(() => toggle());
  btnCloseApp.addEventListener('click', () => window.api.closeWindow());

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
  let latestMedia = null;
  let activeLyricIdx = -1;
  let lyricSyncTimer = null;
  let lastPositionSec = 0;
  let lastPositionTimestamp = Date.now();

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
        return;
      }

      // Update Collapsed Pill
      pillMusic.classList.remove('hidden');
      pillMusicTitle.textContent = (media.title || '').slice(0, 18);
      pillMusicArtist.textContent = (media.artist || '').slice(0, 16);

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

        await window.lyricsEngine.loadLyrics(media.title, media.artist);
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
  const btnRemoveAttachment = document.getElementById('btn-remove-attachment');
  const btnAiClear = document.getElementById('btn-ai-clear');
  const aiActiveProvider = document.getElementById('ai-active-provider');

  let selectedImage = null; // { base64, mime, name }

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

  btnAiAttach.addEventListener('click', () => aiFileInput.click());

  aiFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      selectedImage = {
        base64,
        mime: file.type,
        name: file.name,
      };
      aiAttachmentName.textContent = file.name;
      aiAttachmentPreview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  });

  btnRemoveAttachment.addEventListener('click', () => {
    selectedImage = null;
    aiFileInput.value = '';
    aiAttachmentPreview.classList.add('hidden');
  });

  btnAiClear.addEventListener('click', () => {
    aiMessages.innerHTML = `
      <div class="msg assistant">
        Obrolan telah dibersihkan. Silakan tanyakan hal lain atau lampirkan gambar!
      </div>
    `;
    selectedImage = null;
    aiAttachmentPreview.classList.add('hidden');
  });

  async function sendAiMessage() {
    const text = (aiPromptInput.value || '').trim();
    if (!text && !selectedImage) return;

    const img = selectedImage;
    selectedImage = null;
    aiFileInput.value = '';
    aiAttachmentPreview.classList.add('hidden');
    aiPromptInput.value = '';

    // Append user message
    const userMsg = document.createElement('div');
    userMsg.className = 'msg user';
    if (img) {
      userMsg.innerHTML = `<div class="msg-attachment">🖼️ ${img.name}</div>${text || 'Jelaskan gambar ini.'}`;
    } else {
      userMsg.textContent = text;
    }
    aiMessages.appendChild(userMsg);

    // Append loading placeholder
    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'msg assistant';
    loadingMsg.textContent = 'Sedang berpikir...';
    aiMessages.appendChild(loadingMsg);
    aiMessages.scrollTop = aiMessages.scrollHeight;

    try {
      const answer = await window.api.askAI({
        prompt: text,
        imageBase64: img?.base64,
        imageMime: img?.mime,
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
  // 6. WEATHER FORECAST
  // ==========================================
  const weatherTemp = document.getElementById('weather-temp');
  const weatherLoc = document.getElementById('weather-loc');
  const weatherDesc = document.getElementById('weather-desc');
  const weatherHum = document.getElementById('weather-hum');
  const weatherWind = document.getElementById('weather-wind');

  async function pollWeather() {
    try {
      const data = await window.api.fetchWeather({
        location: config.weather?.location || '',
        unit: config.weather?.unit || 'metric',
      });
      if (data && data.current_condition && data.current_condition[0]) {
        const c = data.current_condition[0];
        const temp = config.weather?.unit === 'imperial' ? c.temp_F + '°F' : c.temp_C + '°C';
        const area = data.nearest_area?.[0]?.areaName?.[0]?.value || config.weather?.location || 'Lokasi Terdeteksi';

        weatherTemp.textContent = temp;
        weatherLoc.textContent = area;
        weatherDesc.textContent = c.weatherDesc?.[0]?.value || 'Cerah';
        weatherHum.textContent = c.humidity;
        weatherWind.textContent = c.windspeedKmph;
      }
    } catch (_) {
      weatherDesc.textContent = 'Cuaca tidak dapat diakses';
    }
  }

  setInterval(pollWeather, 30 * 60 * 1000);
  pollWeather();

  // ==========================================
  // 7. NOTES (MARKDOWN DRAFTS)
  // ==========================================
  const notesList = document.getElementById('notes-list');
  const btnNoteNew = document.getElementById('btn-note-new');
  let notes = await window.api.getNotes();

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
          } else {
            pomoKind = 'work';
            pomoRemainSec = pomoWorkMin * 60;
          }
          pomoState = 'running';
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
      location: setWeatherLoc.value,
      unit: config.weather?.unit || 'metric',
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
    updateAiBadge();
    pollWeather();

    btnSaveSettings.textContent = '✓ Tersimpan!';
    setTimeout(() => {
      btnSaveSettings.textContent = 'Simpan Pengaturan';
    }, 1500);
  });
});
