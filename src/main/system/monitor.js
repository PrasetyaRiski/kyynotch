const os = require('os');
let si;
try {
  si = require('systeminformation');
} catch (_) {}

class SystemMonitor {
  constructor() {
    this.lastNetTime = Date.now();
    this.lastNetStats = null;
  }

  async getStats() {
    // Basic fallback using node os
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = Math.round((usedMem / totalMem) * 100);

    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    const uptimeSec = os.uptime();

    const fallbackStats = {
      cpu: Math.min(100, Math.round((loadAvg[0] / (cpus.length || 1)) * 100)),
      ram: memPercent,
      ramUsedGb: (usedMem / (1024 ** 3)).toFixed(1),
      ramTotalGb: (totalMem / (1024 ** 3)).toFixed(1),
      temp: 0,
      battery: {
        percent: 100,
        isCharging: false,
        hasBattery: false,
      },
      disk: {
        usedGb: 0,
        totalGb: 0,
        percent: 0,
      },
      net: {
        rx: 0,
        tx: 0,
      },
      uptime: this._formatUptime(uptimeSec),
    };

    if (!si) return fallbackStats;

    try {
      const [cpuLoad, mem, battery, fsSize, temp, netStats] = await Promise.all([
        si.currentLoad().catch(() => null),
        si.mem().catch(() => null),
        si.battery().catch(() => null),
        si.fsSize().catch(() => null),
        si.cpuTemperature().catch(() => null),
        si.networkStats().catch(() => null),
      ]);

      const cpu = cpuLoad ? Math.round(cpuLoad.currentLoad) : fallbackStats.cpu;
      const ram = mem ? Math.round((mem.active / mem.total) * 100) : fallbackStats.ram;
      const ramUsedGb = mem ? (mem.active / (1024 ** 3)).toFixed(1) : fallbackStats.ramUsedGb;
      const ramTotalGb = mem ? (mem.total / (1024 ** 3)).toFixed(1) : fallbackStats.ramTotalGb;

      // Primary disk partition
      let disk = fallbackStats.disk;
      if (fsSize && fsSize.length > 0) {
        const rootFs = fsSize.find(f => f.mount === '/' || f.mount === 'C:') || fsSize[0];
        if (rootFs) {
          disk = {
            usedGb: (rootFs.used / (1024 ** 3)).toFixed(1),
            totalGb: (rootFs.size / (1024 ** 3)).toFixed(1),
            percent: Math.round(rootFs.use || 0),
          };
        }
      }

      // Network speed
      let net = { rx: 0, tx: 0 };
      if (netStats && netStats.length > 0) {
        const primary = netStats.find(n => n.operstate === 'up') || netStats[0];
        if (primary) {
          net = {
            rx: Math.max(0, Math.round(primary.rx_sec / 1024)), // KB/s
            tx: Math.max(0, Math.round(primary.tx_sec / 1024)), // KB/s
          };
        }
      }

      return {
        cpu,
        ram,
        ramUsedGb,
        ramTotalGb,
        temp: temp?.main ? Math.round(temp.main) : 0,
        battery: {
          percent: battery ? Math.round(battery.percent) : 100,
          isCharging: !!battery?.isCharging,
          hasBattery: !!battery?.hasBattery,
        },
        disk,
        net,
        uptime: this._formatUptime(uptimeSec),
      };
    } catch (e) {
      return fallbackStats;
    }
  }

  _formatUptime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }
}

module.exports = new SystemMonitor();
