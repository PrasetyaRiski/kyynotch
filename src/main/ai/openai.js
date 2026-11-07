class OpenAIProvider {
  async ask({ baseUrl, apiKey, model, prompt, imageBase64, imageMime }) {
    if (!apiKey) {
      throw new Error('API Key belum diatur. Silakan atur di tab Settings.');
    }

    const host = (baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const endpoint = `${host}/chat/completions`;
    const modelName = model || 'gpt-4o-mini';

    const content = [];
    if (imageBase64) {
      const mime = imageMime || 'image/jpeg';
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:${mime};base64,${imageBase64}`,
        },
      });
    }

    if (prompt) {
      content.push({
        type: 'text',
        text: prompt,
      });
    }

    const body = {
      model: modelName,
      messages: [
        {
          role: 'user',
          content: content.length === 1 && content[0].type === 'text' ? prompt : content,
        },
      ],
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      let errorMsg = `HTTP ${res.status}`;
      try {
        const parsed = JSON.parse(err);
        if (parsed.error?.message) errorMsg = parsed.error.message;
      } catch (_) {}
      throw new Error(`AI Provider Error: ${errorMsg}`);
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content;
    return (reply || '').trim() || 'Balasan kosong.';
  }
}

module.exports = new OpenAIProvider();
