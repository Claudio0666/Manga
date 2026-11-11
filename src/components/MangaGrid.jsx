import React from 'react';
import MangaCard from './MangaCard';
import EmptyLibraryState from './EmptyLibraryState';

const MangaGrid = ({ mangas, onEditManga, onViewDetail, onDeleteManga, isLibraryEmpty, hasActiveFilters, onAddClick, onClearFilters }) => {
  if (!mangas || mangas.length === 0) {
    return <EmptyLibraryState {...{ isLibraryEmpty, hasActiveFilters, onAddClick, onClearFilters }} />;
  }

  return (
    <div className="manga-grid">
      {mangas.map(manga => (
        <MangaCard
          key={manga.id}
          manga={manga}
          onEditManga={onEditManga}
          onViewDetail={onViewDetail}
          onDeleteManga={onDeleteManga}
        />
      ))}
    </div>
  );
};

export default MangaGrid;
