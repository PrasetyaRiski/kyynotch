class OllamaProvider {
  async ask({ baseUrl, model, prompt, imageBase64 }) {
    const host = (baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
    const endpoint = `${host}/api/generate`;
    const modelName = model || 'llama3';

    const body = {
      model: modelName,
      prompt: prompt || 'Jelaskan gambar ini.',
      stream: false,
    };

    if (imageBase64) {
      body.images = [imageBase64];
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Ollama Error (HTTP ${res.status}): ${err.slice(0, 150)}`);
      }

      const data = await res.json();
      return (data.response || '').trim() || 'Balasan kosong dari Ollama.';
    } catch (e) {
      if (e.message.includes('ECONNREFUSED')) {
        throw new Error('Tidak dapat terhubung ke Ollama. Pastikan Ollama sudah berjalan (`ollama serve`).');
      }
      throw e;
    }
  }
}

module.exports = new OllamaProvider();
