import React from 'react';
import { useLibrary } from '../context/LibraryContext';
import CoverImage from './CoverImage';
import EmptyLibraryState from './EmptyLibraryState';
import { adjustMangaChapter } from '../utils/mangaProgress';

const MangaList = ({ mangas, onEditManga, onViewDetail, onDeleteManga, isLibraryEmpty, hasActiveFilters, onAddClick, onClearFilters }) => {
  const { setLibrary } = useLibrary();
  if (!mangas || mangas.length === 0) return <EmptyLibraryState {...{ isLibraryEmpty, hasActiveFilters, onAddClick, onClearFilters }} />;

  return (
    <div className="manga-list">
      {mangas.map(manga => (
        <div
          key={manga.id}
          className="list-item"
          role="button"
          tabIndex={0}
          aria-label={`Ver detalhes de ${manga.nome}`}
          onClick={() => onViewDetail?.(manga)}
          onKeyDown={event => {
            if (event.target !== event.currentTarget) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onViewDetail?.(manga);
            }
          }}
        >
          {manga.cover ? (
            <CoverImage src={manga.cover} className="list-cover" alt={manga.nome} fallback={<div className="list-cover-ph">📖</div>} />
          ) : (
            <div className="list-cover-ph">📖</div>
          )}
          <div className="list-info">
            <div className="list-title">{manga.nome}</div>
            <div className="list-meta">
              <span className="list-status status-icon" style={{ color: `var(--status-${manga.status})` }}>
                ● {manga.status}
              </span>
            </div>
          </div>
          <div className="list-actions">
            <div className="list-chapter-stepper" aria-label={`Capítulo ${manga.capitulo}${manga.capituloTotal ? ` de ${manga.capituloTotal}` : ''}`}>
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
            <button
              className={`list-fav ${manga.favorito ? 'active' : ''}`}
              aria-label={manga.favorito ? `Remover ${manga.nome} dos favoritos` : `Favoritar ${manga.nome}`}
              onClick={event => {
                event.stopPropagation();
                setLibrary(prev => prev.map(item =>
                  item.id === manga.id ? { ...item, favorito: !item.favorito } : item
                ));
              }}
            >❤</button>
            <button
              className="btn btn-sm"
              aria-label={`Editar ${manga.nome}`}
              onClick={event => {
                event.stopPropagation();
                onEditManga?.(manga);
              }}
            >✏️</button>
            <button
              className="btn btn-sm btn-danger"
              aria-label={`Excluir ${manga.nome}`}
              onClick={event => {
                event.stopPropagation();
                if (window.confirm(`Tem certeza que deseja excluir "${manga.nome}"?`)) {
                  onDeleteManga?.(manga.id);
                }
              }}
            >🗑</button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MangaList;
