class GeminiProvider {
  async ask({ apiKey, model, prompt, imageBase64, imageMime }) {
    if (!apiKey) {
      throw new Error('API Key Gemini belum diatur. Silakan atur di tab Settings.');
    }

    const modelName = model || 'gemini-1.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${apiKey}`;

    const parts = [];
    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: imageMime || 'image/jpeg',
          data: imageBase64,
        },
      });
    }

    if (prompt) {
      parts.push({ text: prompt });
    }

    const body = {
      contents: [{ parts }],
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      let errorMsg = `HTTP ${res.status}`;
      try {
        const parsed = JSON.parse(err);
        if (parsed.error?.message) errorMsg = parsed.error.message;
      } catch (_) {}
      throw new Error(`Gemini Error: ${errorMsg}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new Error('Tidak ada balasan dari Gemini.');
    }

    const text = candidate.content?.parts?.map(p => p.text).join('') || '';
    return text.trim() || 'Balasan kosong.';
  }
}

module.exports = new GeminiProvider();
