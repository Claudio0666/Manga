import React, { useRef, useState } from 'react';
import { useLibrary } from '../context/LibraryContext';

const Header = ({ search, setSearch, searchInputRef, onBackupClick, onAccountClick, onSaveClick, savingMainFile, onUpdateClick, desktopVersion, desktopUpdateState, onTutorialClick, tutorialOpen }) => {
  const { toggleTheme, driveConnected } = useLibrary();
  const desktopUpdatesAvailable = typeof window !== 'undefined' && Boolean(window.mangaShelfDesktop);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileSearchRef = useRef(null);

  const toggleMobileSearch = () => {
    if (!mobileSearchOpen) window.setTimeout(() => mobileSearchRef.current?.focus(), 0);
    setMobileSearchOpen(!mobileSearchOpen);
  };

  return (
    <header role="banner">
      <div className="header-inner">
        <a href="#" className="logo" aria-label="MangaShelf — página inicial">漫 MangaShelf</a>

        <div className="header-search" role="search">
          <span className="search-icon-abs" aria-hidden="true">⌕</span>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Filtrar por nome… (Ctrl+K)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
            aria-label="Buscar mangás na biblioteca"
          />
        </div>

        <div className="header-actions">
          <button className="btn btn-sm tutorial-nav-btn" onClick={onTutorialClick} data-tooltip={tutorialOpen ? 'Voltar para a estante' : 'Aprenda a usar o MangaShelf'}>
            {tutorialOpen ? '⌂' : '?'} <span className="btn-label">{tutorialOpen ? 'Estante' : 'Tutorial'}</span>
          </button>
          <button className="btn btn-sm main-save-btn" onClick={onSaveClick} disabled={savingMainFile} data-tooltip="Salvar a biblioteca em um arquivo local">
            💾 <span className="btn-label">{savingMainFile ? 'Salvando…' : 'Salvar'}</span>
          </button>
          {desktopUpdatesAvailable && (
            <button className={`btn btn-sm update-check-btn ${desktopUpdateState === 'downloaded' ? 'update-ready' : ''}`} onClick={onUpdateClick} data-tooltip={`MangaShelf ${desktopVersion ? `v${desktopVersion} · ` : ''}ver atualizações`} aria-label="Abrir atualizações do MangaShelf">
              <span aria-hidden="true">{desktopUpdateState === 'downloaded' ? '↓' : '↻'}</span><span className="btn-label">{desktopUpdateState === 'downloaded' ? 'Pronta para instalar' : 'Atualizações'}</span>
            </button>
          )}
          <button
            className="btn btn-sm search-toggle"
            onClick={toggleMobileSearch}
            aria-label={mobileSearchOpen ? 'Fechar busca' : 'Buscar na biblioteca'}
            aria-expanded={mobileSearchOpen}
          >⌕</button>
          <button className="btn btn-sm account-btn" onClick={onAccountClick} data-tooltip="Conectar e fazer backup no Google Drive">
            ☁️ <span className="btn-label">
              {driveConnected ? 'Drive conectado' : 'Google Drive'}
            </span>
          </button>
          <button className="btn btn-sm" onClick={onBackupClick} data-tooltip="Exportar / Importar biblioteca">
            📦 Backup
          </button>
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Alternar tema claro/escuro" />
        </div>
      </div>
      <div className={`search-drawer ${mobileSearchOpen ? 'open' : ''}`} role="search">
        <label className="sr-only" htmlFor="mobileLibrarySearch">Buscar mangás na biblioteca</label>
        <input
          ref={mobileSearchRef}
          id="mobileLibrarySearch"
          type="search"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Buscar por título ou autor…"
          autoComplete="off"
        />
      </div>
    </header>
  );
};

export default Header;
