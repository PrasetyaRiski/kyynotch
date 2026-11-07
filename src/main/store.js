const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class Store {
  constructor() {
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'config.json');
    this.notesPath = path.join(userDataPath, 'notes.json');
    this.pomoPath = path.join(userDataPath, 'pomodoro.json');

    this.defaultConfig = {
      theme: 'apple',
      collapsedWidth: 260,
      collapsedHeight: 34,
      expandedWidth: 620,
      expandedHeight: 460,
      borderRadius: 22,
      opacity: 0.95,
      weather: {
        location: '',
        unit: 'metric', // metric or imperial
      },
      ai: {
        provider: 'gemini', // 'gemini' | 'ollama' | 'openai'
        geminiApiKey: '',
        geminiModel: 'gemini-1.5-flash',
        ollamaUrl: 'http://localhost:11434',
        ollamaModel: 'llama3',
        openaiBaseUrl: 'https://api.openai.com/v1',
        openaiApiKey: '',
        openaiModel: 'gpt-4o-mini',
      },
      pomodoro: {
        workMin: 25,
        breakMin: 5,
        longBreakMin: 15,
        cycles: 4,
      },
      activeTab: 'system',
    };

    this.data = this._load(this.configPath, this.defaultConfig);
    this.notes = this._load(this.notesPath, []);
    this.pomoStats = this._load(this.pomoPath, []);
  }

  _load(filePath, defaults) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        return Object.assign({}, defaults, JSON.parse(content));
      }
    } catch (e) {
      console.error(`Failed to load ${filePath}:`, e);
    }
    return defaults;
  }

  _save(filePath, data) {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error(`Failed to save ${filePath}:`, e);
    }
  }

  get(key) {
    return this.data[key] ?? this.defaultConfig[key];
  }

  set(key, value) {
    this.data[key] = value;
    this._save(this.configPath, this.data);
  }

  getAll() {
    return this.data;
  }

  saveAll(newData) {
    this.data = Object.assign({}, this.defaultConfig, newData);
    this._save(this.configPath, this.data);
  }

  // Notes Management
  getNotes() {
    return this.notes;
  }

  saveNotes(notes) {
    this.notes = notes;
    this._save(this.notesPath, this.notes);
  }

  // Pomodoro History
  getPomoStats() {
    return this.pomoStats;
  }

  logPomoSession(session) {
    this.pomoStats.push(session);
    this._save(this.pomoPath, this.pomoStats);
  }
}

module.exports = new Store();
