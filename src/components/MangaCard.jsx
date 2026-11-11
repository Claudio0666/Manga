import React from 'react';
import { useLibrary } from '../context/LibraryContext';
import { STATUS_LABELS } from '../utils/constants';
import CoverImage from './CoverImage';
import { adjustMangaChapter } from '../utils/mangaProgress';

const MangaCard = ({ manga, onEditManga, onViewDetail, onDeleteManga }) => {
  const { setLibrary } = useLibrary();

  const progress = manga.capituloTotal
    ? Math.round((manga.capitulo / manga.capituloTotal) * 100)
    : 0;

  const progressClass = progress === 100 ? 'done' : progress < 20 ? 'low' : '';

  const handleToggleFavorite = (e) => {
    e.stopPropagation();
    setLibrary(prev => prev.map(m =>
      m.id === manga.id ? { ...m, favorito: !m.favorito } : m
    ));
  };

  const handleCardClick = () => {
    if (onViewDetail) {
      onViewDetail(manga);
    }
  };

  const handleKeyDown = (e) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick();
    }
  };

  return (
    <div
      className="manga-card"
      tabIndex="0"
      role="button"
      aria-label={`Ver detalhes de ${manga.nome}`}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
    >
      <div className="card-cover">
        {manga.cover ? (
          <CoverImage
            src={manga.cover}
            alt={manga.nome}
            fallback={(
              <div className="cover-placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 19.5V4.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v15"/>
                  <path d="M6.5 2v2M12 2v2M17.5 2v2"/>
                </svg>
                <span>Sem Capa</span>
              </div>
            )}
          />
        ) : (
          <div className="cover-placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5V4.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v15"/>
              <path d="M6.5 2v2M12 2v2M17.5 2v2"/>
            </svg>
            <span>Sem Capa</span>
          </div>
        )}

        <div className={`card-status status-${manga.status}`}>
          {STATUS_LABELS[manga.status]}
        </div>

        {manga.nota && (
          <div className="card-score">
            ⭐ {manga.nota}
          </div>
        )}

        <button
          className={`fav-btn ${manga.favorito ? 'active' : ''}`}
          title="Favoritar"
          onClick={handleToggleFavorite}
        >
          ❤
        </button>
      </div>

      <div className="card-body">
        <div className="card-title">{manga.nome}</div>
        <div className="card-author">{manga.autor || 'Autor desconhecido'}</div>
        <div className="chapter-stepper" aria-label={`Progresso: capítulo ${manga.capitulo}${manga.capituloTotal ? ` de ${manga.capituloTotal}` : ''}`}>
          <button
            type="button"
            aria-label={`Diminuir capítulo de ${manga.nome}`}
            disabled={Number(manga.capitulo) <= 0}
            onClick={event => { event.stopPropagation(); adjustMangaChapter(setLibrary, manga.id, -1); }}
          >−</button>
          <span>Cap. {manga.capitulo}{manga.capituloTotal ? ` / ${manga.capituloTotal}` : ''}</span>
          <button
            type="button"
            aria-label={`Avançar capítulo de ${manga.nome}`}
            disabled={manga.capituloTotal && Number(manga.capitulo) >= Number(manga.capituloTotal)}
            onClick={event => { event.stopPropagation(); adjustMangaChapter(setLibrary, manga.id, 1); }}
          >＋</button>
        </div>

        <div className="progress-wrap">
          <div className="progress-bar">
            <div
              className={`progress-fill ${progressClass}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="progress-label">
            {progress}% {manga.capituloTotal ? `de ${manga.capituloTotal}` : ''}
          </div>
        </div>

        <div className="card-synopsis">{manga.translatedSynopsis || manga.synopsis || 'Sem sinopse disponível.'}</div>

        <div className="card-tags">
          {(manga.translatedGenres?.length ? manga.translatedGenres : manga.genres)?.map((genre, i) => (
            <span key={i} className="tag">{genre}</span>
          ))}
        </div>
      </div>

      <div className="card-actions">
        <button
          className="btn btn-sm"
          onClick={(e) => {
            e.stopPropagation();
            onEditManga && onEditManga(manga);
          }}
        >
          ✏️ Editar
        </button>
        <button
          className="btn btn-sm btn-danger"
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`Tem certeza que deseja excluir "${manga.nome}"?`)) {
              onDeleteManga && onDeleteManga(manga.id);
            }
          }}
        >
          🗑 Excluir
        </button>
      </div>
    </div>
  );
};

export default MangaCard;
