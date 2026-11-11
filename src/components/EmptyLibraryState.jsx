import React from 'react';

const EmptyLibraryState = ({ isLibraryEmpty, hasActiveFilters, onAddClick, onClearFilters }) => (
  <section className="empty-state" aria-live="polite">
    <div className="empty-state-art" aria-hidden="true">
      <span className="empty-book empty-book-one" />
      <span className="empty-book empty-book-two" />
      <span className="empty-book empty-book-three" />
      <span className="empty-spark">✦</span>
    </div>
    <span className="empty-state-kicker">MANGASHELF</span>
    <h3>{isLibraryEmpty ? 'Sua estante começa aqui' : hasActiveFilters ? 'Nenhum título encontrado' : 'Sua estante está vazia'}</h3>
    <p>{isLibraryEmpty
      ? 'Adicione seu primeiro mangá e acompanhe sua leitura em um só lugar.'
      : hasActiveFilters
        ? 'Tente outro termo ou limpe os filtros para ver sua coleção completa.'
        : 'Adicione um mangá para começar a organizar sua coleção.'}</p>
    {hasActiveFilters ? (
      <button className="btn btn-primary" onClick={onClearFilters}>Limpar filtros</button>
    ) : (
      <button className="btn btn-primary" onClick={onAddClick}>＋ Adicionar primeiro mangá</button>
    )}
  </section>
);

export default EmptyLibraryState;
