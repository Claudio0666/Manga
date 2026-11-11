const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';
const LIBRETRANSLATE_URL = (import.meta.env.VITE_LIBRETRANSLATE_URL || 'https://libretranslate.de').replace(/\/$/, '');

const decodeHtml = value => {
  const element = document.createElement('textarea');
  element.innerHTML = value;
  return element.value;
};

const toPlainText = value => {
  const html = String(value || '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])\s*>/gi, '\n\n');
  return new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim() || '';
};

const byteLength = text => new TextEncoder().encode(text).length;

const chunkText = (text, maxBytes = 420) => {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  let current = '';

  words.forEach(word => {
    if (byteLength(word) > maxBytes) {
      if (current) chunks.push(current);
      let part = '';
      for (const character of word) {
        if (part && byteLength(`${part}${character}`) > maxBytes) {
          chunks.push(part);
          part = character;
        } else {
          part += character;
        }
      }
      if (part) chunks.push(part);
      current = '';
      return;
    }
    if (current && byteLength(`${current} ${word}`) > maxBytes) {
      chunks.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  });

  if (current) chunks.push(current);
  return chunks;
};

const requestTranslation = async (provider, text) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    let response;
    let translated;
    if (provider === 'MyMemory') {
      const params = new URLSearchParams({ q: text, langpair: 'autodetect|pt', mt: '1' });
      response = await fetch(`${MYMEMORY_URL}?${params}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.responseStatus !== 200) throw new Error(data.responseDetails || 'Resposta sem tradução');
      translated = data.responseData?.translatedText;
    } else {
      response = await fetch(`${LIBRETRANSLATE_URL}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, source: 'auto', target: 'pt', format: 'text' }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      translated = data.translatedText;
    }
    if (typeof translated !== 'string' || !translated.trim()) throw new Error('O provedor retornou uma tradução vazia');
    return decodeHtml(translated.trim());
  } finally {
    clearTimeout(timeout);
  }
};

const translateChunk = async text => {
  const failures = [];
  for (const provider of ['MyMemory', 'LibreTranslate']) {
    try {
      return { text: await requestTranslation(provider, text), provider };
    } catch (error) {
      failures.push(`${provider}: ${error.message}`);
      console.warn(`[MangaShelf:translate] Provedor indisponível: ${provider}`, error.message);
    }
  }
  throw new Error(failures.join(' · '));
};

export const translateTextToPortuguese = async value => {
  const sourceText = toPlainText(value);
  if (!sourceText) return { text: '', providers: [] };

  const chunks = chunkText(sourceText);
  const translations = [];
  const providers = new Set();
  // Keep requests sequential to reduce rate-limit pressure on the free endpoints.
  for (const chunk of chunks) {
    const result = await translateChunk(chunk);
    translations.push(result.text);
    providers.add(result.provider);
  }
  return { text: translations.join(' '), providers: [...providers] };
};

export const translateMangaInfo = async (synopsis, genres = []) => {
  const [translatedSynopsis, translatedGenres] = await Promise.all([
    translateTextToPortuguese(synopsis),
    translateTextToPortuguese(genres.join(' | '))
  ]);

  const genreParts = translatedGenres.text.split(/\s*\|\s*/);
  const translatedProviderList = [...new Set([...translatedSynopsis.providers, ...translatedGenres.providers])];
  return {
    synopsis: translatedSynopsis.text,
    genres: genres.map((genre, index) => genreParts[index]?.trim() || genre),
    providers: translatedProviderList
  };
};
