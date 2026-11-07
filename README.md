# 🏝️ Kyynotch — Dynamic Island

**Kyynotch** adalah aplikasi desktop **Dynamic Island** (notch bergaya MacBook / iOS) yang modern, elegan, dan lintas platform (**Windows 10/11 & Seluruh Distro Linux**). 

Aplikasi ini melayang transparan di bagian atas layar dan otomatis membesar (*expand*) saat disentuh kursor kursor atau melalui pintasan keyboard, memberikan akses instan ke pemutar musik, lirik sinkron waktu-nyata, asisten AI universal, monitor hardware, cuaca, catatan cepat, dan pengatur waktu fokus.

---

## ✨ Fitur Unggulan

### 🎵 1. Media Player & Lirik Realtime (Karaoke-Style)
- **Kompatibel Lintas OS**:
  - **Linux**: Terhubung otomatis ke D-Bus MPRIS (YouTube di Chrome/Firefox/Brave, Spotify, VLC, dll.).
  - **Windows**: Terhubung ke Windows Media Controls API (GSMTC) untuk menangkap musik dari browser dan aplikasi desktop.
- **Lirik Waktu-Nyata (Synced Lyrics)**:
  - Didukung oleh API **LRCLIB** (tanpa perlu API key, gratis, dan open-source).
  - Sinkronisasi otomatis ke detik lagu yang sedang berjalan.
  - Tampilan baris sebelumnya, **baris lirik aktif bersinar (glowing karaoke)**, dan baris berikutnya.
- **Kontrol Cepat di Pill**:
  - Klik pil musik atau ikon lagu pada notch untuk langsung melakukan **Play/Pause**.
  - Tombol **Previous**, **Play/Pause**, dan **Next** di tab Music.

### 🤖 2. Universal AI Assistant
Tidak lagi bergantung pada token internal yang rumit. Kyynotch mendukung API standar yang fleksibel:
- **Google Gemini**: Menggunakan API Key resmi Google Gemini (`gemini-1.5-flash`, `gemini-2.0-flash`, dll.). Mendukung obrolan teks dan analisis gambar (multimodal).
- **Ollama (Lokal & Gratis)**: Terhubung ke `http://localhost:11434` (model `llama3`, `mistral`, `deepseek-r1`, dll.). Berjalan 100% offline tanpa kuota!
- **OpenAI / Universal Compatible**: Mendukung OpenAI (`gpt-4o-mini`), Groq, OpenRouter, atau provider kompatibel lainnya cukup dengan mengisi `Base URL` dan `API Key`.

### 📊 3. Telemetri Sistem Real-Time
- Pembacaan metrik hardware langsung lintas OS:
  - **CPU Load %** dengan progress bar dinamis.
  - **RAM Usage** (persentase & GB terpakai vs total).
  - **Storage / Partisi Utama** (persentase & kapasitas disk).
  - **Status Baterai Laptop** (persentase, status pengisian daya ⚡).
  - **Uptime Sistem**.

### 🌤️ 4. Cuaca & Lokasi
- Prakiraan cuaca akurat melalui `wttr.in`.
- Deteksi lokasi otomatis berdasarkan IP atau dapat memasukkan kota pilihan di pengaturan.
- Menampilkan suhu, deskripsi kondisi cuaca, kelembapan, dan kecepatan angin.

### ⏱️ 5. Pomodoro Focus Timer
- Timer fokus produktivitas (25/5 min, 50/10 min, atau 15/3 min).
- Siklus otomatis antara sesi fokus dan istirahat.
- Saat timer berjalan, badge mini pomodoro (`⏱ 24:59`) otomatis muncul di pil notch kecil.
- Riwayat sesi fokus disimpan secara lokal.

### 📝 6. Catatan Cepat (Sticky Notes)
- Scratchpad catatan bergaya Markdown.
- Auto-save instan saat mengetik.
- Mendukung multi-catatan dengan tombol hapus dan tambah catatan baru.

### 🎨 7. Pilihan Tema Estetik
- **Apple Dark**: Frosted glass transparan dengan efek blur Apple-style.
- **True Black**: Warna hitam pekat OLED minimalis.
- **Nordic Frost**: Nuansa biru slate ala Nord theme.
- **Dracula Purple**: Aksen ungu elegan bertema Dracula.

---

## 🚀 Cara Menjalankan (Development)

### Prasyarat
- **Node.js** (v18 atau lebih baru).
- **npm** (bawaan Node.js).

### Langkah-langkah
1. Masuk ke direktori proyek:
   ```bash
   cd "/run/media/kiki/Data Gua/kyynotch"
   ```

2. Jalankan aplikasi:
   ```bash
   npm start
   ```

3. **Interaksi**:
   - Arahkan kursor mouse ke bagian atas tengah layar untuk membuka (*expand*) notch.
   - Jauhkan kursor untuk menutup kembali (*collapse*) ke bentuk pil.
   - Tekan **`Ctrl + Shift + N`** (atau `Cmd + Shift + N` di macOS) untuk toggle buka/tutup via keyboard.
   - Klik ikon **✕** di kanan atas expanded notch untuk keluar dari aplikasi.

---

## 📦 Membangun Paket Standalone (Build / Distributable)

Aplikasi dapat dikemas menjadi berkas instalasi mandiri (*standalone binary*) yang siap dibagikan ke pengguna lain tanpa memerlukan Node.js:

### Untuk Linux (AppImage, DEB, RPM, tar.gz)
```bash
npm run build -- --linux
```
*Hasil berkas installer akan berada di folder `dist/` (misal: `Kyynotch-1.0.0.AppImage`, `kyynotch_1.0.0_amd64.deb`, dll.).*

### Untuk Windows (Installer .exe & Portable .exe)
```bash
npm run build -- --win
```
*Hasil berkas installer akan berada di folder `dist/` (misal: `Kyynotch Setup 1.0.0.exe` dan versi portable).*

---

## 📂 Struktur Proyek

```
kyynotch/
├── package.json               # Konfigurasi dependensi dan skrip build
├── electron-builder.yml       # Konfigurasi packaging Windows & Linux
├── README.md                  # Dokumentasi proyek
└── src/
    ├── main/                  # Proses Utama Electron (Backend Node.js)
    │   ├── index.js           # Lifecycle, tray, shortcut, & IPC dispatcher
    │   ├── window.js          # Pengaturan jendela transparan & positioning
    │   ├── store.js           # Penyimpanan data lokal (config, notes, pomo)
    │   ├── media/             # Abstraksi pemutar media lintas OS
    │   │   ├── index.js       # Media provider switcher
    │   │   ├── linux-mpris.js # Linux D-Bus MPRIS bridge
    │   │   └── windows-media.js# Windows GSMTC WinRT bridge
    │   ├── system/
    │   │   └── monitor.js     # Telemetri CPU, RAM, Disk, Baterai
    │   └── ai/                # Penyedia AI Universal
    │       ├── index.js       # AI dispatcher
    │       ├── gemini.js      # Google Gemini API
    │       ├── ollama.js      # Ollama local API
    │       └── openai.js      # OpenAI / Groq / OpenRouter API
    ├── preload/
    │   └── index.js           # Jembatan IPC aman (contextBridge)
    └── renderer/              # Antarmuka Pengguna (Frontend Web UI)
        ├── index.html         # Struktur HTML Dynamic Island & Tab-tab
        ├── assets/
        │   └── icon.png       # Ikon aplikasi
        ├── styles/
        │   ├── island.css     # Animasi notch, morphing, layout pil & tema
        │   ├── tabs.css       # Tampilan grid system, chat AI, notes, dll.
        │   └── lyrics.css     # Tampilan lirik realtime karaoke
        └── scripts/
            ├── lyrics.js      # Engine LRCLIB & timestamp parser
            └── app.js         # Kontroller state, event listener & audio sync
```

---

## 📄 Lisensi
Didistribusikan di bawah lisensi MIT. Bebas dimodifikasi dan dikembangkan lebih lanjut.
Dibuat dengan ❤️ oleh **Kiki**.
