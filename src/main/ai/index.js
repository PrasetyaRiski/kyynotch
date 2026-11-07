const gemini = require('./gemini');
const ollama = require('./ollama');
const openai = require('./openai');
const store = require('../store');

class AIManager {
  async ask({ prompt, imageBase64, imageMime }) {
    const config = store.get('ai') || {};
    const provider = config.provider || 'gemini';

    switch (provider) {
      case 'gemini':
        return await gemini.ask({
          apiKey: config.geminiApiKey,
          model: config.geminiModel,
          prompt,
          imageBase64,
          imageMime,
        });

      case 'ollama':
        return await ollama.ask({
          baseUrl: config.ollamaUrl,
          model: config.ollamaModel,
          prompt,
          imageBase64,
        });

      case 'openai':
        return await openai.ask({
          baseUrl: config.openaiBaseUrl,
          apiKey: config.openaiApiKey,
          model: config.openaiModel,
          prompt,
          imageBase64,
          imageMime,
        });

      default:
        throw new Error(`Penyedia AI "${provider}" tidak didukung.`);
    }
  }
}

module.exports = new AIManager();
