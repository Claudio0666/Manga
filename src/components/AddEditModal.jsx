import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLibrary } from '../context/LibraryContext';
import { STATUS_LABELS } from '../utils/constants';
import CoverImage from './CoverImage';
import { findMangaDuplicateCandidates } from '../utils/mangaDuplicates';

const AddEditModal = ({ isOpen, onClose, mangaToEdit = null }) => {
  const { library, setLibrary } = useLibrary();
  const [formData, setFormData] = useState({
    nome: '', autor: '', status: 'lendo', nota: '',
    capitulo: 0, capituloTotal: '', dataInicio: '', dataFim: '',
    cover: '', synopsis: '', genres: [], favorito: false
  });
  const [apiSearch, setApiSearch] = useState('');
  const [apiResults, setApiResults] = useState([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiSource, setApiSource] = useState('all');
  const [apiPreview, setApiPreview] = useState(null);
  const [apiNotice, setApiNotice] = useState(null);
  const [selectedResultId, setSelectedResultId] = useState(null);
  const [selectionLoading, setSelectionLoading] = useState(false);
  const [showDuplicatePrompt, setShowDuplicatePrompt] = useState(false);
  const searchRequestId = useRef(0);

  const duplicateCandidates = useMemo(() => mangaToEdit || !formData.nome.trim()
    ? []
    : findMangaDuplicateCandidates(formData, library), [formData, library, mangaToEdit]);

  const normalizeTitle = title => (title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

  const getResultCover = manga => {
    if (manga.apiSource !== 'mangadex') return manga.cover;

    const normalizedTitle = normalizeTitle(manga.nome);
    const alternate = apiResults.find(result =>
      result.apiSource !== 'mangadex' &&
      result.cover &&
      normalizeTitle(result.nome) === normalizedTitle
    );
    return alternate?.cover || manga.cover;
  };

  const findAlternativeCover = async title => {
    const query = `query ($search: String) {
      Page(perPage: 10) {
        media(search: $search, type: MANGA) {
          title { english romaji native }
          coverImage { extraLarge large medium }
        }
      }
    }`;

    const lookups = await Promise.allSettled([
      fetch(`/api-jikan/manga?q=${encodeURIComponent(title)}&limit=10`)
        .then(response => response.ok ? response.json() : null)
        .then(json => (json?.data || []).map(item => ({
          title: item.title_english || item.title,
          cover: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || ''
        }))),
      fetch('/api-anilist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { search: title } })
      })
        .then(response => response.ok ? response.json() : null)
        .then(json => (json?.data?.Page?.media || []).map(item => ({
          title: item.title?.english || item.title?.romaji || item.title?.native,
          cover: item.coverImage?.extraLarge || item.coverImage?.large || item.coverImage?.medium || ''
        })))
    ]);

    const candidates = lookups.flatMap(result => result.status === 'fulfilled' ? result.value : []);
    const target = normalizeTitle(title);
    const exactMatch = candidates.find(candidate => candidate.cover && normalizeTitle(candidate.title) === target);
    if (exactMatch) return exactMatch.cover;

    const partialMatches = candidates.filter(candidate => {
      const candidateTitle = normalizeTitle(candidate.title);
      return candidate.cover && candidateTitle.length > 3 && target.length > 3 &&
        (candidateTitle.startsWith(target) || target.startsWith(candidateTitle));
    });
    return partialMatches.length === 1 ? partialMatches[0].cover : '';
  };

  useEffect(() => {
    if (isOpen) {
      searchRequestId.current += 1;
      setApiSearch('');
      setApiResults([]);
      setApiLoading(false);
      setApiNotice(null);
      setApiPreview(null);
      setSelectedResultId(null);
      setSelectionLoading(false);
      setShowDuplicatePrompt(false);
      setApiSource('all');
      if (mangaToEdit) {
        setFormData(mangaToEdit);
      } else {
        setFormData({
          nome: '', autor: '', status: 'lendo', nota: '',
          capitulo: 0, capituloTotal: '', dataInicio: '', dataFim: '',
          cover: '', synopsis: '', genres: [], favorito: false
        });
      }
    }
    else {
      searchRequestId.current += 1;
      setApiLoading(false);
    }
  }, [mangaToEdit, isOpen]);

  const searchApi = async event => {
    event?.preventDefault();
    const queryText = apiSearch.trim();
    if (queryText.length < 2) {
      setApiNotice({ type: 'warning', text: 'Digite pelo menos 2 caracteres para pesquisar.' });
      setApiResults([]);
      return;
    }

    const requestId = ++searchRequestId.current;
    setApiLoading(true);
    setApiNotice(null);
    setApiResults([]);
    setApiPreview(null);
    setSelectedResultId(null);

    const fetchJson = async (url, options = {}) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const tasks = [];
    if (apiSource === 'jikan' || apiSource === 'all') {
      tasks.push({ source: 'jikan', run: async () => {
        const json = await fetchJson(`/api-jikan/manga?q=${encodeURIComponent(queryText)}&limit=8&order_by=popularity&sort=desc`);
        return (json.data || []).map(m => ({
          id: `jikan-${m.mal_id}`,
          nome: m.title_english || m.title || 'Sem título',
          nomesAlternativos: [m.title, m.title_japanese].filter(Boolean),
          cover: m.images?.jpg?.large_image_url || m.images?.jpg?.image_url || '',
          synopsis: m.synopsis || '',
          autor: m.authors?.map(author => author.name).filter(Boolean).join(', ') || '',
          genres: m.genres?.map(genre => genre.name) || [],
          capituloTotal: m.chapters ?? '',
          ano: m.published?.from ? new Date(m.published.from).getFullYear() : '',
          apiSource: 'jikan',
          apiSourceId: m.mal_id
        }));
      }});
    }

    if (apiSource === 'mangadex' || apiSource === 'all') {
      tasks.push({ source: 'mangadex', run: async () => {
        const params = new URLSearchParams({ title: queryText, limit: '8', 'order[relevance]': 'desc' });
        params.append('includes[]', 'cover_art');
        params.append('includes[]', 'author');
        params.append('contentRating[]', 'safe');
        params.append('contentRating[]', 'suggestive');
        const json = await fetchJson(`/api-mangadex/manga?${params.toString()}`);
        return (json.data || []).map(m => {
          const attrs = m.attributes || {};
          const coverRel = m.relationships?.find(relationship => relationship.type === 'cover_art');
          const coverFile = coverRel?.attributes?.fileName;
          const titles = attrs.title || {};
          const nome = titles.en || titles['ja-ro'] || Object.values(titles)[0] || 'Sem título';
          const authors = m.relationships?.filter(relationship => relationship.type === 'author') || [];
          const descriptions = attrs.description || {};

          return {
            id: `md-${m.id}`,
            nome,
            nomesAlternativos: Object.values(attrs.altTitles || {}).flatMap(title => Object.values(title || {})).filter(Boolean),
            cover: coverFile ? `https://uploads.mangadex.org/covers/${m.id}/${coverFile}.256.jpg` : '',
            synopsis: descriptions['pt-br'] || descriptions.pt || descriptions.en || Object.values(descriptions)[0] || '',
            autor: authors.map(author => author.attributes?.name).filter(Boolean).join(', '),
            genres: (attrs.tags || []).filter(tag => tag.attributes?.group === 'genre').map(tag => tag.attributes?.name?.en).filter(Boolean),
            capituloTotal: attrs.lastChapter || '',
            ano: attrs.year || '',
            apiSource: 'mangadex',
            apiSourceId: m.id
          };
        });
      }});
    }

    if (apiSource === 'anilist' || apiSource === 'all') {
      tasks.push({ source: 'anilist', run: async () => {
        const query = `query ($search: String) {
          Page(perPage: 8) {
            media(search: $search, type: MANGA, sort: SEARCH_MATCH) {
              id title { english romaji native }
              description coverImage { extraLarge large medium } genres chapters startDate { year }
            }
          }
        }`;
        const json = await fetchJson('/api-anilist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ query, variables: { search: queryText } })
        });
        return (json.data?.Page?.media || []).map(m => ({
          id: `ani-${m.id}`,
          nome: m.title?.english || m.title?.romaji || m.title?.native || 'Sem título',
          nomesAlternativos: [m.title?.english, m.title?.romaji, m.title?.native].filter(Boolean),
          cover: m.coverImage?.extraLarge || m.coverImage?.large || m.coverImage?.medium || '',
          synopsis: m.description || '',
          autor: '',
          genres: m.genres || [],
          capituloTotal: m.chapters ?? '',
          ano: m.startDate?.year || '',
          apiSource: 'anilist',
          apiSourceId: m.id
        }));
      }});
    }

    const settled = await Promise.allSettled(tasks.map(task => task.run()));
    const results = [];
    const failedSources = [];
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') results.push(...result.value);
      else {
        failedSources.push(tasks[index].source);
        console.warn(`[MangaShelf:search] Falha na fonte ${tasks[index].source}`, result.reason);
      }
    });

    if (requestId !== searchRequestId.current) return;

    const queryNormalized = normalizeTitle(queryText);
    const queryWords = queryNormalized.split(' ').filter(Boolean);
    const relevance = manga => {
      const titles = [manga.nome, ...(manga.nomesAlternativos || [])].map(normalizeTitle).filter(Boolean);
      if (titles.some(title => title === queryNormalized)) return 3;
      if (titles.some(title => title.startsWith(queryNormalized))) return 2;
      if (titles.some(title => title.includes(queryNormalized))) return 1;
      const bestWordMatch = titles.reduce((best, title) => {
        const titleWords = title.split(' ');
        const matchedWords = queryWords.filter(word => titleWords.some(titleWord => titleWord.startsWith(word))).length;
        return Math.max(best, queryWords.length ? matchedWords / queryWords.length : 0);
      }, 0);
      return bestWordMatch;
    };
    const completeness = manga => [manga.cover, manga.synopsis, manga.autor, manga.ano, manga.genres?.length].filter(Boolean).length;
    const uniqueByTitle = new Map();
    results.forEach(result => {
      const normalizedName = normalizeTitle(result.nome);
      const key = normalizedName || `${result.apiSource}:${result.apiSourceId}`;
      const existing = uniqueByTitle.get(key);
      if (!existing || completeness(result) > completeness(existing)) uniqueByTitle.set(key, result);
    });
    const uniqueResults = [...uniqueByTitle.values()]
      .sort((a, b) => relevance(b) - relevance(a) || completeness(b) - completeness(a) || a.nome.localeCompare(b.nome));

    setApiResults(uniqueResults);
    if (!uniqueResults.length) {
      setApiNotice({
        type: failedSources.length ? 'error' : 'info',
        text: failedSources.length
          ? `Não foi possível buscar em ${failedSources.join(', ')}. Tente novamente ou escolha outra fonte.`
          : `Nenhum mangá encontrado para “${queryText}”. Tente outro título ou uma fonte diferente.`
      });
    } else if (failedSources.length) {
      setApiNotice({ type: 'warning', text: `Resultados parciais. Não foi possível consultar: ${failedSources.join(', ')}.` });
    } else {
      setApiNotice({ type: 'success', text: `${uniqueResults.length} resultado(s) encontrado(s). Selecione um título para preencher os dados.` });
    }
    setApiLoading(false);
  };

  const selectApiManga = async (manga) => {
    setSelectedResultId(manga.id);
    setSelectionLoading(true);
    try {
      let cover = getResultCover(manga);
      if (manga.apiSource === 'mangadex' && cover === manga.cover) {
        try {
          cover = await findAlternativeCover(manga.nome) || cover;
        } catch (error) {
          console.warn('[MangaShelf:search] Não foi possível buscar uma capa alternativa', {
            title: manga.nome,
            error: error.message
          });
        }
      }

      if (!cover || (manga.apiSource === 'mangadex' && cover === manga.cover)) {
        console.warn('[MangaShelf:search] Não foi encontrada uma capa alternativa acessível', {
          title: manga.nome,
          provider: manga.apiSource,
          providerId: manga.apiSourceId
        });
      } else if (manga.apiSource === 'mangadex' && cover !== manga.cover) {
        console.info('[MangaShelf:search] Usando capa alternativa do mesmo título', {
          title: manga.nome,
          blockedProvider: 'mangadex',
          coverUrl: cover
        });
      }

      const selectedManga = { ...manga, cover };
      setApiPreview(selectedManga);
      setFormData(prev => ({
        ...prev,
        nome: manga.nome,
        autor: manga.autor || '',
        cover,
        synopsis: manga.synopsis || '',
        genres: manga.genres || [],
        capituloTotal: manga.capituloTotal ?? '',
        apiSource: manga.apiSource,
        apiSourceId: manga.apiSourceId
      }));
    } finally {
      setSelectionLoading(false);
    }
  };

  const applyToExisting = existing => {
    const metadataFields = ['autor', 'cover', 'synopsis', 'genres', 'capituloTotal', 'ano', 'apiSource', 'apiSourceId', 'nomesAlternativos'];
    const update = Object.fromEntries(metadataFields
      .filter(field => formData[field] != null && formData[field] !== '' && (!Array.isArray(formData[field]) || formData[field].length))
      .map(field => [field, formData[field]]));
    setLibrary(current => current.map(manga => {
      if (manga.id !== existing.id) return manga;
      const next = { ...manga, ...update, lastUpdatedAt: new Date().toISOString() };
      if (update.synopsis && update.synopsis !== manga.synopsis) delete next.translatedSynopsis;
      if (update.genres && JSON.stringify(update.genres) !== JSON.stringify(manga.genres)) delete next.translatedGenres;
      return next;
    }));
    onClose();
  };

  const handleSave = (keepDuplicate = false) => {
    if (!formData.nome) {
      alert("O nome é obrigatório");
      return;
    }

    if (formData.dataInicio && formData.dataFim) {
      if (new Date(formData.dataFim) < new Date(formData.dataInicio)) {
        alert("A data de término não pode ser anterior à data de início");
        return;
      }
    }

    if (!mangaToEdit && duplicateCandidates.length && !keepDuplicate) {
      setShowDuplicatePrompt(true);
      return;
    }

    if (mangaToEdit) {
      setLibrary(prev => {
        const updated = prev.map(m => m.id === mangaToEdit.id
          ? { ...formData, id: m.id, addedAt: m.addedAt, lastUpdatedAt: new Date().toISOString() }
          : m);
        return [...updated];
      });
    } else {
      const newManga = {
        ...formData,
        id: Date.now().toString(),
        addedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString()
      };
      setLibrary(prev => [...prev, newManga]);
    }
    onClose();
  };

  const changeApiSource = source => {
    searchRequestId.current += 1;
    setApiSource(source);
    setApiLoading(false);
    setApiResults([]);
    setApiNotice(null);
    setApiPreview(null);
    setSelectedResultId(null);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay open">
      <div className="modal">
        <div className="modal-header">
          <h2>{mangaToEdit ? 'Editar Mangá' : 'Adicionar Mangá'}</h2>
          <button className="btn btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {!mangaToEdit && <section className="api-search-section form-group full" id="apiSearchGroup" aria-labelledby="apiSearchTitle">
            <div className="api-search-heading">
              <div>
                <h3 id="apiSearchTitle">Encontrar mangá</h3>
                <p>Busque em catálogos externos e selecione um resultado para preencher os dados.</p>
              </div>
              <span className="field-optional">opcional</span>
            </div>

            <div className="api-source-pills" role="group" aria-label="Fontes da pesquisa">
              {[
                ['all', '✦ Todas'],
                ['jikan', 'MAL / Jikan'],
                ['mangadex', 'MangaDex'],
                ['anilist', 'AniList']
              ].map(([source, label]) => (
                <button
                  key={source}
                  type="button"
                  className={`api-src-pill ${apiSource === source ? 'active' : ''}`}
                  aria-pressed={apiSource === source}
                  onClick={() => changeApiSource(source)}
                >{label}</button>
              ))}
            </div>

            <form className="api-search-form" onSubmit={searchApi}>
              <div className="api-search-input-wrap">
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  placeholder="Ex.: One Piece, Berserk, Witch Hat Atelier"
                  value={apiSearch}
                  onChange={event => {
                    searchRequestId.current += 1;
                    setApiSearch(event.target.value);
                    setApiResults([]);
                    setApiNotice(null);
                    setApiPreview(null);
                    setSelectedResultId(null);
                    setApiLoading(false);
                  }}
                  aria-label="Pesquisar mangá nos catálogos"
                  autoComplete="off"
                />
                {apiSearch && (
                  <button type="button" className="api-search-clear" onClick={() => {
                    searchRequestId.current += 1;
                    setApiSearch('');
                    setApiResults([]);
                    setApiNotice(null);
                    setApiPreview(null);
                    setSelectedResultId(null);
                    setApiLoading(false);
                  }} aria-label="Limpar pesquisa">×</button>
                )}
              </div>
              <button className="btn btn-primary api-search-submit" type="submit" disabled={apiLoading || apiSearch.trim().length < 2}>
                {apiLoading ? 'Pesquisando…' : 'Buscar'}
              </button>
            </form>
            <div className="api-search-hint">Pressione Enter para buscar. A busca começa com 2 caracteres.</div>

            {apiLoading && <div className="api-status loading" role="status" aria-live="polite"><span className="api-search-spinner" />Consultando {apiSource === 'all' ? 'as fontes' : 'a fonte selecionada'}…</div>}
            {apiNotice && <div className={`api-status ${apiNotice.type}`} role="status" aria-live="polite">{apiNotice.text}</div>}

            {apiResults.length > 0 && (
              <div className="search-results-panel" role="region" aria-label="Resultados da pesquisa">
                <div className="search-results-heading">
                  <span>Resultados</span>
                  <span>{apiResults.length} título(s)</span>
                </div>
                {apiResults.map(manga => (
                  <button
                    key={manga.id}
                    type="button"
                    className={`search-result-item ${selectedResultId === manga.id ? 'selected' : ''}`}
                    onClick={() => selectApiManga(manga)}
                    aria-pressed={selectedResultId === manga.id}
                    disabled={selectionLoading}
                  >
                    <CoverImage
                      src={getResultCover(manga)}
                      className="search-result-img"
                      alt=""
                      loading="lazy"
                      fallback={<div className="search-result-img search-result-placeholder" aria-hidden="true">📖</div>}
                    />
                    <span className="search-result-copy">
                      <span className="search-result-topline">
                        <span className="search-result-title">{manga.nome}</span>
                        <span className={`search-source-badge source-${manga.apiSource}`}>
                          {manga.apiSource === 'jikan' ? 'MAL' : manga.apiSource === 'mangadex' ? 'MangaDex' : 'AniList'}
                        </span>
                      </span>
                      <span className="search-result-meta">
                        {[
                          manga.autor,
                          manga.ano,
                          manga.capituloTotal
                            ? manga.apiSource === 'mangadex'
                              ? `último cap. ${manga.capituloTotal}`
                              : `${manga.capituloTotal} capítulos`
                            : '',
                          manga.genres?.slice(0, 2).join(' · ')
                        ].filter(Boolean).join(' · ') || 'Metadados disponíveis'}
                      </span>
                      {manga.synopsis && <span className="search-result-synopsis">{manga.synopsis}</span>}
                    </span>
                    <span className="search-result-action">{selectionLoading && selectedResultId === manga.id ? 'Aplicando…' : 'Usar'}</span>
                  </button>
                ))}
              </div>
            )}

            {apiPreview && (
              <div className="api-preview">
                <CoverImage
                  src={apiPreview.cover}
                  alt=""
                  style={{ width: '64px', height: '96px', objectFit: 'cover', display: 'block' }}
                  fallback={<div className="cover-placeholder" style={{ width: '64px', height: '96px' }}>Sem capa</div>}
                />
                <div className="api-preview-info">
                  <div className="api-preview-title">{apiPreview.nome}</div>
                  <div className="api-preview-synopsis">{apiPreview.synopsis || 'Sem sinopse disponível.'}</div>
                  {apiPreview.capituloTotal && <div className="api-preview-hint">
                    {apiPreview.apiSource === 'mangadex'
                      ? `MangaDex informa o último capítulo disponível: ${apiPreview.capituloTotal}. Pode não ser o total final.`
                      : `Total informado: ${apiPreview.capituloTotal} capítulos`}
                  </div>}
                  <div className="api-preview-hint">Dados aplicados ao formulário. Revise antes de salvar.</div>
                </div>
              </div>
            )}
          </section>}

          <div className="form-grid">
            <div className="form-group full">
              <label>Nome do Mangá <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => { setShowDuplicatePrompt(false); setFormData(prev => ({ ...prev, nome: e.target.value })); }}
                placeholder="Ex: One Piece"
              />
              {duplicateCandidates.length > 0 && <div className="duplicate-candidates" role="status" aria-live="polite">
                <div className="duplicate-warning-heading"><span aria-hidden="true">!</span><strong>Possível mangá já cadastrado</strong></div>
                {duplicateCandidates.slice(0, 3).map(({ manga, matchType }) => (
                  <div className="duplicate-candidate" key={manga.id}>
                    <div><strong>{manga.nome}</strong><span>{matchType === 'id' ? 'Mesmo ID de catálogo' : matchType === 'exact' ? 'Título igual' : 'Título parecido'}</span></div>
                    <button type="button" className="btn btn-sm" onClick={() => applyToExisting(manga)}>Atualizar existente</button>
                  </div>
                ))}
                {showDuplicatePrompt && <div className="duplicate-keep-prompt">
                  <span>Quer guardar este título como um registro separado?</span>
                  <button type="button" className="btn btn-sm" onClick={() => handleSave(true)}>Manter os dois</button>
                </div>}
              </div>}
            </div>
            <div className="form-group full">
              <label>Autor(es) <span className="field-optional">(opcional)</span></label>
              <input
                type="text"
                value={formData.autor}
                onChange={(e) => setFormData(prev => ({ ...prev, autor: e.target.value }))}
                placeholder="Ex: Eiichiro Oda"
              />
            </div>
            <div className="form-group">
              <label>Status <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
              >
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Nota Pessoal (0–10)</label>
              <input
                type="number"
                value={formData.nota}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  nota: e.target.value === '' ? '' : Number(e.target.value)
                }))}
                step="0.5"
                min="0"
                max="10"
              />
            </div>
            <div className="form-group">
              <label>Último Cap. Lido</label>
              <input
                type="number"
                value={formData.capitulo}
                onChange={(e) => setFormData(prev => ({ ...prev, capitulo: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="form-group">
              <label>Capítulos Totais <span className="field-optional">(opcional)</span></label>
              <input
                type="number"
                value={formData.capituloTotal}
                onChange={(e) => setFormData(prev => ({ ...prev, capituloTotal: e.target.value }))}
              />
              {formData.apiSource === 'mangadex' && formData.capituloTotal && (
                <div className="form-hint">Valor do MangaDex: último capítulo disponível, que pode diferir do total final.</div>
              )}
            </div>
            <div className="form-group">
              <label>Data de Início</label>
              <input
                type="date"
                value={formData.dataInicio}
                onChange={(e) => setFormData(prev => ({ ...prev, dataInicio: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Data de Término <span className="field-optional">(opcional)</span></label>
              <input
                type="date"
                value={formData.dataFim}
                onChange={(e) => setFormData(prev => ({ ...prev, dataFim: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => handleSave(false)}>💾 Salvar</button>
        </div>
      </div>
    </div>
  );
};

export default AddEditModal;
