import React from 'react';
import { useLibrary } from '../context/LibraryContext';

const StatsBar = () => {
  const { library } = useLibrary();

  const ratedManga = library.filter(m => m &&
    m.nota !== '' && m.nota !== null && m.nota !== undefined && Number.isFinite(Number(m.nota))
  );
  const average = ratedManga.length
    ? ratedManga.reduce((sum, manga) => sum + Number(manga.nota), 0) / ratedManga.length
    : null;

  const stats = {
    total: library.length,
    lendo: library.filter(m => m?.status === 'lendo').length,
    concluido: library.filter(m => m?.status === 'concluido').length,
    pausado: library.filter(m => m?.status === 'pausado').length,
    media: average === null ? '—' : average.toFixed(1)
  };

  return (
    <div className="stats-bar" role="region" aria-label="Estatísticas da biblioteca">
      <div className="stat-card stat-card-total">
        <span className="stat-icon" aria-hidden="true">▤</span>
        <div className="stat-label">Na coleção</div>
        <div className="stat-value" id="statTotal">{stats.total}</div>
      </div>
      <div className="stat-card">
        <span className="stat-icon" aria-hidden="true">◉</span>
        <div className="stat-label">Lendo</div>
        <div className="stat-value" style={{ color: 'var(--status-lendo)' }}>{stats.lendo}</div>
      </div>
      <div className="stat-card">
        <span className="stat-icon" aria-hidden="true">✓</span>
        <div className="stat-label">Concluídos</div>
        <div className="stat-value" style={{ color: 'var(--status-concluido)' }}>{stats.concluido}</div>
      </div>
      <div className="stat-card">
        <span className="stat-icon" aria-hidden="true">Ⅱ</span>
        <div className="stat-label">Pausados</div>
        <div className="stat-value" style={{ color: 'var(--status-pausado)' }}>{stats.pausado}</div>
      </div>
      <div className="stat-card">
        <span className="stat-icon" aria-hidden="true">★</span>
        <div className="stat-label">Nota Média</div>
        <div className="stat-value">{stats.media}<span className="stat-suffix">/10</span></div>
      </div>
    </div>
  );
};

export default StatsBar;
