export const normalizeMangaTitle = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

const titleVariants = manga => [manga?.nome, ...(Array.isArray(manga?.nomesAlternativos) ? manga.nomesAlternativos : [])]
  .map(normalizeMangaTitle)
  .filter(Boolean);

const editSimilarity = (left, right) => {
  const rows = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let previous = rows[0];
    rows[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const saved = rows[j];
      rows[j] = Math.min(rows[j] + 1, rows[j - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return 1 - rows[right.length] / Math.max(left.length, right.length, 1);
};

const tokenSimilarity = (left, right) => {
  const leftTokens = new Set(left.split(' ').filter(token => token.length > 1));
  const rightTokens = new Set(right.split(' ').filter(token => token.length > 1));
  if (!leftTokens.size || !rightTokens.size) return 0;
  const overlap = [...leftTokens].filter(token => rightTokens.has(token)).length;
  return (2 * overlap) / (leftTokens.size + rightTokens.size);
};

export const findMangaDuplicateCandidates = (candidate, library = [], excludeId = null) => {
  const candidateTitles = titleVariants(candidate);
  if (!candidateTitles.length) return [];

  return library
    .filter(existing => existing && existing.id !== excludeId)
    .map(existing => {
      const sameProviderId = candidate.apiSource && candidate.apiSourceId != null &&
        existing.apiSource === candidate.apiSource && String(existing.apiSourceId) === String(candidate.apiSourceId);
      const existingTitles = titleVariants(existing);
      const exactTitle = candidateTitles.some(title => existingTitles.includes(title));
      if (sameProviderId || exactTitle) {
        return { manga: existing, score: 1, matchType: sameProviderId ? 'id' : 'exact' };
      }

      let score = 0;
      for (const left of candidateTitles) {
        for (const right of existingTitles) {
          if (Math.min(left.length, right.length) < 6) continue;
          score = Math.max(score, editSimilarity(left, right), tokenSimilarity(left, right));
        }
      }
      return score >= .88 ? { manga: existing, score, matchType: 'similar' } : null;
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || left.manga.nome.localeCompare(right.manga.nome, 'pt-BR'));
};

const isBlank = value => value == null || value === '' || (Array.isArray(value) && value.length === 0);
const API_METADATA_FIELDS = ['autor', 'cover', 'synopsis', 'genres', 'capituloTotal', 'ano', 'apiSource', 'apiSourceId', 'nomesAlternativos'];

export const mergeApiMetadata = (existing, incoming, { overwrite = false } = {}) => {
  const merged = { ...existing };
  const changedFields = [];
  for (const field of API_METADATA_FIELDS) {
    const value = incoming?.[field];
    if (isBlank(value) || (!overwrite && !isBlank(existing?.[field]))) continue;
    const normalizedValue = Array.isArray(value) ? [...new Set(value.filter(Boolean))] : value;
    if (JSON.stringify(existing?.[field]) !== JSON.stringify(normalizedValue)) {
      merged[field] = normalizedValue;
      changedFields.push(field);
    }
  }

  if (changedFields.includes('synopsis')) delete merged.translatedSynopsis;
  if (changedFields.includes('genres')) delete merged.translatedGenres;
  return { manga: merged, changedFields };
};

export const getMissingMangaMetadata = manga => API_METADATA_FIELDS
  .filter(field => isBlank(manga?.[field]) && !['apiSource', 'apiSourceId', 'nomesAlternativos'].includes(field));
