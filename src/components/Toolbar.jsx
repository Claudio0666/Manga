import React, { useState } from 'react';
import { STATUS_LABELS, STATUS_ICONS_SVG } from '../utils/constants';

const Toolbar = ({ filter, setFilter, sortBy, setSortBy, view, setView, genres = [], authors = [], statusCounts = {}, advancedFilters, setAdvancedFilters, activeAdvancedFilters = 0 }) => {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const updateFilter = (key, value) => setAdvancedFilters(current => ({ ...current, [key]: value }));

  return (
    <div className="toolbar-shell">
      <div className="toolbar" role="toolbar" aria-label="Filtros e ordenação">
        <div className="filter-pills" role="group" aria-label="Filtrar por status">
          <button className={`pill ${filter === 'todos' ? 'active' : ''}`} onClick={() => setFilter('todos')} aria-pressed={filter === 'todos'}>
            Todos <span className="pill-count">{statusCounts.todos || 0}</span>
          </button>

          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <button
              key={key}
              className={`pill ${key} ${filter === key ? 'active' : ''}`}
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              dangerouslySetInnerHTML={{ __html: `${STATUS_ICONS_SVG[key]} ${label}<span class="pill-count">${statusCounts[key] || 0}</span>` }}
            />
          ))}

          <button className={`pill favoritos ${filter === 'favoritos' ? 'active' : ''}`} onClick={() => setFilter('favoritos')} aria-pressed={filter === 'favoritos'}>
            ❤ Favoritos <span className="pill-count">{statusCounts.favoritos || 0}</span>
          </button>
        </div>

        <div className="toolbar-right">
          <button className={`filter-toggle ${activeAdvancedFilters ? 'has-filters' : ''}`} onClick={() => setFiltersOpen(open => !open)} aria-expanded={filtersOpen}>
            <span aria-hidden="true">☷</span> Filtros {activeAdvancedFilters > 0 && <span className="filter-count">{activeAdvancedFilters}</span>}
          </button>
          <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Ordenar por">
            <option value="data_add">Mais recentes</option>
            <option value="data_old">Mais antigos</option>
            <option value="updated">Atualizados recentemente</option>
            <option value="nota">Maior nota</option>
            <option value="nota_menor">Menor nota</option>
            <option value="nome">Nome A-Z</option>
            <option value="nome_za">Nome Z-A</option>
            <option value="capitulo">Último capítulo</option>
            <option value="progresso">Maior progresso</option>
          </select>

          <div className="view-toggle" role="group" aria-label="Modo de exibição">
            <button className={`view-btn ${view === 'grid' ? 'active' : ''}`} onClick={() => setView('grid')} aria-label="Visualização em grade" aria-pressed={view === 'grid'}>▦</button>
            <button className={`view-btn ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')} aria-label="Visualização em lista" aria-pressed={view === 'list'}>☰</button>
          </div>
        </div>
      </div>

      {filtersOpen && (
        <div className="advanced-filter-panel" role="region" aria-label="Filtros avançados">
          <label className="advanced-filter-field">
            <span>Gênero</span>
            <select value={advancedFilters.genre} onChange={event => updateFilter('genre', event.target.value)}>
              <option value="">Todos os gêneros</option>
              {genres.map(genre => <option key={genre} value={genre}>{genre}</option>)}
            </select>
          </label>
          <label className="advanced-filter-field">
            <span>Autor</span>
            <select value={advancedFilters.author} onChange={event => updateFilter('author', event.target.value)}>
              <option value="">Todos os autores</option>
              {authors.map(author => <option key={author} value={author}>{author}</option>)}
            </select>
          </label>
          <label className="advanced-filter-field">
            <span>Nota mínima</span>
            <select value={advancedFilters.rating} onChange={event => updateFilter('rating', event.target.value)}>
              <option value="">Qualquer nota</option>
              {[6, 7, 8, 9, 10].map(rating => <option key={rating} value={rating}>{rating}+ estrelas</option>)}
            </select>
          </label>
          <label className="advanced-filter-field">
            <span>Progresso</span>
            <select value={advancedFilters.progress} onChange={event => updateFilter('progress', event.target.value)}>
              <option value="">Qualquer progresso</option>
              <option value="in_progress">Em andamento</option>
              <option value="not_started">Não iniciado</option>
              <option value="finished">Capítulos concluídos</option>
            </select>
          </label>
          {activeAdvancedFilters > 0 && <button className="advanced-filter-clear" onClick={() => setAdvancedFilters({ genre: '', author: '', rating: '', progress: '' })}>Limpar filtros</button>}
        </div>
      )}
    </div>
  );
};

export default Toolbar;
