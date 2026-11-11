import { findMangaDuplicateCandidates } from './mangaDuplicates';

const fetchJson = async (url, options = {}, signal) => {
  const response = await fetch(url, { ...options, signal });
  if (!response.ok) throw new Error(`${url} respondeu HTTP ${response.status}`);
  return response.json();
};

const mapJikan = item => ({
  nome: item.title_english || item.title || '',
  nomesAlternativos: [item.title, item.title_english, item.title_japanese, ...(item.title_synonyms || [])].filter(Boolean),
  autor: (item.authors || []).map(author => author.name).filter(Boolean).join(', '),
  cover: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || '',
  synopsis: item.synopsis || '',
  genres: (item.genres || []).map(genre => genre.name).filter(Boolean),
  capituloTotal: item.chapters ?? '',
  ano: item.published?.from ? new Date(item.published.from).getFullYear() : '',
  apiSource: 'jikan',
  apiSourceId: item.mal_id
});

const mapMangaDex = item => {
  const attributes = item.attributes || {};
  const cover = item.relationships?.find(relationship => relationship.type === 'cover_art')?.attributes?.fileName;
  const descriptions = attributes.description || {};
  const authors = item.relationships?.filter(relationship => relationship.type === 'author') || [];
  const title = attributes.title || {};
  return {
    nome: title.en || title['ja-ro'] || Object.values(title)[0] || '',
    nomesAlternativos: Object.values(attributes.altTitles || {}).flatMap(entry => Object.values(entry || {})).filter(Boolean),
    autor: authors.map(author => author.attributes?.name).filter(Boolean).join(', '),
    cover: cover ? `https://uploads.mangadex.org/covers/${item.id}/${cover}.256.jpg` : '',
    synopsis: descriptions['pt-br'] || descriptions.pt || descriptions.en || Object.values(descriptions)[0] || '',
    genres: (attributes.tags || []).filter(tag => tag.attributes?.group === 'genre').map(tag => tag.attributes?.name?.en).filter(Boolean),
    capituloTotal: attributes.lastChapter || '',
    ano: attributes.year || '',
    apiSource: 'mangadex',
    apiSourceId: item.id
  };
};

const mapAniList = item => ({
  nome: item.title?.english || item.title?.romaji || item.title?.native || '',
  nomesAlternativos: [item.title?.english, item.title?.romaji, item.title?.native].filter(Boolean),
  autor: '',
  cover: item.coverImage?.extraLarge || item.coverImage?.large || item.coverImage?.medium || '',
  synopsis: item.description || '',
  genres: item.genres || [],
  capituloTotal: item.chapters ?? '',
  ano: item.startDate?.year || '',
  apiSource: 'anilist',
  apiSourceId: item.id
});

const mapBySource = { jikan: mapJikan, mangadex: mapMangaDex, anilist: mapAniList };

const fetchExactById = async (manga, signal) => {
  const source = manga.apiSource;
  const id = manga.apiSourceId;
  if (!source || id == null || !mapBySource[source]) return null;

  if (source === 'jikan') {
    const json = await fetchJson(`/api-jikan/manga/${encodeURIComponent(id)}/full`, {}, signal);
    return json.data ? mapJikan(json.data) : null;
  }
  if (source === 'mangadex') {
    const params = new URLSearchParams();
    params.append('includes[]', 'cover_art');
    params.append('includes[]', 'author');
    const json = await fetchJson(`/api-mangadex/manga/${encodeURIComponent(id)}?${params}`, {}, signal);
    return json.data ? mapMangaDex(json.data) : null;
  }

  const query = `query ($id: Int) {
    Media(id: $id, type: MANGA) {
      id title { english romaji native } description coverImage { extraLarge large medium }
      genres chapters startDate { year }
    }
  }`;
  const json = await fetchJson('/api-anilist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables: { id: Number(id) } })
  }, signal);
  return json.data?.Media ? mapAniList(json.data.Media) : null;
};

const searchJikan = async (title, signal) => {
  const params = new URLSearchParams({ q: title, limit: '5', order_by: 'popularity', sort: 'desc' });
  const json = await fetchJson(`/api-jikan/manga?${params}`, {}, signal);
  return (json.data || []).map(mapJikan);
};

const searchMangaDex = async (title, signal) => {
  const params = new URLSearchParams({ title, limit: '5', 'order[relevance]': 'desc' });
  params.append('includes[]', 'cover_art');
  params.append('includes[]', 'author');
  params.append('contentRating[]', 'safe');
  params.append('contentRating[]', 'suggestive');
  const json = await fetchJson(`/api-mangadex/manga?${params}`, {}, signal);
  return (json.data || []).map(mapMangaDex);
};

const searchAniList = async (title, signal) => {
  const query = `query ($search: String) {
    Page(perPage: 5) {
      media(search: $search, type: MANGA, sort: SEARCH_MATCH) {
        id title { english romaji native } description coverImage { extraLarge large medium }
        genres chapters startDate { year }
      }
    }
  }`;
  const json = await fetchJson('/api-anilist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables: { search: title } })
  }, signal);
  return (json.data?.Page?.media || []).map(mapAniList);
};

const sourceSearches = { jikan: searchJikan, mangadex: searchMangaDex, anilist: searchAniList };

export const lookupMangaMetadata = async (manga, signal) => {
  if (!manga?.nome?.trim()) return null;

  if (manga.apiSource && manga.apiSourceId != null) {
    try {
      const exact = await fetchExactById(manga, signal);
      if (exact) return exact;
    } catch (error) {
      if (signal?.aborted) throw error;
      console.warn('[MangaShelf:metadata] Busca por ID falhou; tentando pelo título', {
        title: manga.nome,
        source: manga.apiSource,
        error: error.message
      });
    }
  }

  const results = await Promise.allSettled(Object.entries(sourceSearches).map(async ([source, search]) => ({
    source,
    mangas: await search(manga.nome.trim(), signal)
  })));
  if (signal?.aborted) throw new DOMException('A atualização foi cancelada.', 'AbortError');

  const candidates = results.flatMap(result => result.status === 'fulfilled' ? result.value.mangas : []);
  if (!candidates.length) {
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length === results.length) throw failures[0].reason;
    return null;
  }

  const matches = findMangaDuplicateCandidates(manga, candidates);
  return matches[0]?.score >= .88 ? matches[0].manga : null;
};
