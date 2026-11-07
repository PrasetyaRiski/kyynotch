const { exec } = require('child_process');

class WindowsMedia {
  constructor() {
    this.latestState = {
      playing: false,
      paused: false,
      title: '',
      artist: '',
      album: '',
      artUrl: '',
      position: 0,
      canNext: true,
      canPrev: true,
      canPlay: true,
      canPause: true,
    };
  }

  _execPs(command) {
    return new Promise((resolve) => {
      const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "${command}"`;
      exec(psCmd, { timeout: 3500 }, (err, stdout) => {
        if (err) return resolve('');
        resolve(stdout.trim());
      });
    });
  }

  async poll() {
    // Query Windows Media Transport Controls Session Manager via WinRT
    const script = `
      [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media, ContentType=WindowsRuntime] | Out-Null
      $asyncOp = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()
      while ($asyncOp.Status -eq 'Started') { Start-Sleep -Milliseconds 20 }
      $mgr = $asyncOp.GetResults()
      $session = $mgr.GetCurrentSession()
      if (-not $session) { exit }

      $info = $session.GetPlaybackInfo()
      $status = $info.PlaybackStatus

      $propOp = $session.TryGetMediaPropertiesAsync()
      while ($propOp.Status -eq 'Started') { Start-Sleep -Milliseconds 20 }
      $props = $propOp.GetResults()

      $timeline = $session.GetTimelineProperties()
      $posSec = $timeline.Position.TotalSeconds

      [PSCustomObject]@{
        Status = $status.ToString()
        Title = $props.Title
        Artist = $props.Artist
        Album = $props.AlbumTitle
        Position = $posSec
      } | ConvertTo-Json -Compress
    `;

    try {
      const jsonStr = await this._execPs(script.replace(/\n\s+/g, ' '));
      if (jsonStr && jsonStr.startsWith('{')) {
        const data = JSON.parse(jsonStr);
        this.latestState = {
          playing: data.Status === 'Playing',
          paused: data.Status === 'Paused',
          title: data.Title || '',
          artist: data.Artist || '',
          album: data.Album || '',
          artUrl: '',
          position: data.Position || 0,
          canNext: true,
          canPrev: true,
          canPlay: true,
          canPause: true,
        };
        return this.latestState;
      }
    } catch (_) {}

    return this.latestState;
  }

  async playPause() {
    const script = `
      [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media, ContentType=WindowsRuntime] | Out-Null
      $mgr = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync().GetResults()
      $session = $mgr.GetCurrentSession()
      if ($session) { $session.TryTogglePlayPauseAsync() | Out-Null }
    `;
    await this._execPs(script.replace(/\n\s+/g, ' '));
  }

  async next() {
    const script = `
      [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media, ContentType=WindowsRuntime] | Out-Null
      $mgr = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync().GetResults()
      $session = $mgr.GetCurrentSession()
      if ($session) { $session.TrySkipNextAsync() | Out-Null }
    `;
    await this._execPs(script.replace(/\n\s+/g, ' '));
  }

  async previous() {
    const script = `
      [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media, ContentType=WindowsRuntime] | Out-Null
      $mgr = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync().GetResults()
      $session = $mgr.GetCurrentSession()
      if ($session) { $session.TrySkipPreviousAsync() | Out-Null }
    `;
    await this._execPs(script.replace(/\n\s+/g, ' '));
  }
}

module.exports = new WindowsMedia();
