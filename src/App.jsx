import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { LibraryProvider, useLibrary } from './context/LibraryContext';
import Header from './components/Header';
import StatsBar from './components/StatsBar';
import Toolbar from './components/Toolbar';
import MangaGrid from './components/MangaGrid';
import MangaList from './components/MangaList';
import AddEditModal from './components/AddEditModal';
import DetailModal from './components/DetailModal';
import BackupModal from './components/BackupModal';
import AccountModal from './components/AccountModal';
import TutorialPage from './components/TutorialPage';
import MetadataUpdateModal from './components/MetadataUpdateModal';
import UpdateModal from './components/UpdateModal';

const MainApp = () => {
  const { library, setLibrary, saveMainFile, savingMainFile } = useLibrary();
  const [view, setView] = useState('grid'); // 'grid' or 'list'
  const [filter, setFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('data_add');
  const [advancedFilters, setAdvancedFilters] = useState({ genre: '', author: '', rating: '', progress: '' });
  const searchInputRef = useRef(null);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isMetadataUpdateOpen, setIsMetadataUpdateOpen] = useState(false);
  const [mangaToEdit, setMangaToEdit] = useState(null);
  const [mangaToDetail, setMangaToDetail] = useState(null);
  const [desktopVersion, setDesktopVersion] = useState('');
  const [desktopUpdate, setDesktopUpdate] = useState(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  useEffect(() => {
    const desktop = window.mangaShelfDesktop;
    if (!desktop) return undefined;
    desktop.getVersion().then(setDesktopVersion).catch(error => console.warn('[MangaShelf:desktop] Não foi possível ler a versão do app', error));
    return desktop.onUpdateStatus(setDesktopUpdate);
  }, []);

  const openAddModal = useCallback(() => {
    setMangaToEdit(null);
    setIsAddModalOpen(true);
  }, []);

  const openEditModal = useCallback((manga) => {
    setMangaToEdit(manga);
    setIsAddModalOpen(true);
  }, []);

  const openDetailModal = useCallback((manga) => {
    setMangaToDetail(manga);
    setIsDetailModalOpen(true);
  }, []);

  const handleSaveMainFile = useCallback(async () => {
    try {
      const result = await saveMainFile();
      window.alert(result.downloaded
        ? 'Arquivo MangaShelf.json baixado. Escolha uma pasta para guardá-lo.'
        : `Arquivo principal salvo: ${result.fileName}`);
    } catch (error) {
      if (error?.name !== 'AbortError') window.alert(`Não foi possível salvar o arquivo principal: ${error.message}`);
    }
  }, [saveMainFile]);

  const handleCheckForUpdates = useCallback(async () => {
    setIsUpdateModalOpen(true);
    try {
      setDesktopUpdate({ state: 'checking' });
      const result = await window.mangaShelfDesktop?.checkForUpdates();
      if (result?.state === 'development') setDesktopUpdate(result);
    } catch (error) {
      setDesktopUpdate({ state: 'error', message: error.message });
    }
  }, []);

  const handleInstallUpdate = useCallback(() => {
    window.mangaShelfDesktop?.installUpdate();
  }, []);

  const handleDeleteManga = useCallback((mangaId) => {
    setLibrary(prev => prev.filter(manga => manga.id !== mangaId));
  }, [setLibrary]);

  useEffect(() => {
    const handleShortcut = event => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;

      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      } else if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        openAddModal();
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [openAddModal]);

  const filteredLibrary = useMemo(() => {
    // 1. Filtramos primeiro para trabalhar com um array menor antes de ordenar
    let result = library.filter(m => {
      if (!m || typeof m.nome !== 'string') return false;
      // Search filter
      if (search && !(
        m.nome.toLowerCase().includes(search.toLowerCase()) ||
        (m.autor && m.autor.toLowerCase().includes(search.toLowerCase()))
      )) {
        return false;
      }

      // Status filter
      if (filter !== 'todos') {
        if (filter === 'favoritos' && !m.favorito) return false;
        if (filter !== 'favoritos' && m.status !== filter) return false;
      }

      if (advancedFilters.genre && !(m.genres || []).includes(advancedFilters.genre) && !(m.translatedGenres || []).includes(advancedFilters.genre)) return false;
      if (advancedFilters.author && !(m.autor || '').split(',').map(author => author.trim()).includes(advancedFilters.author)) return false;
      if (advancedFilters.rating && Number(m.nota || 0) < Number(advancedFilters.rating)) return false;
      if (advancedFilters.progress === 'in_progress' && !(m.status !== 'concluido' && Number(m.capitulo) > 0 && (!Number(m.capituloTotal) || Number(m.capitulo) < Number(m.capituloTotal)))) return false;
      if (advancedFilters.progress === 'not_started' && Number(m.capitulo || 0) > 0) return false;
      if (advancedFilters.progress === 'finished' && !(m.status === 'concluido' || (Number(m.capituloTotal) > 0 && Number(m.capitulo) >= Number(m.capituloTotal)))) return false;

      return true;
    });

    // 2. Ordenamos criando uma cópia para evitar mutação do estado original
    return [...result].sort((a, b) => {
      switch (sortBy) {
        case 'nome': return a.nome.localeCompare(b.nome);
        case 'nome_za': return b.nome.localeCompare(a.nome);
        case 'nota': return (b.nota || 0) - (a.nota || 0);
        case 'nota_menor': return (a.nota || 0) - (b.nota || 0);
        case 'capitulo': return (b.capitulo || 0) - (a.capitulo || 0);
        case 'progresso': {
          const progressA = a.capituloTotal ? a.capitulo / a.capituloTotal : 0;
          const progressB = b.capituloTotal ? b.capitulo / b.capituloTotal : 0;
          return progressB - progressA;
        }
        case 'data_add': {
          const dateA = a.addedAt ? new Date(a.addedAt).getTime() : 0;
          const dateB = b.addedAt ? new Date(b.addedAt).getTime() : 0;
          return dateB - dateA;
        }
        case 'data_old': {
          const dateA = a.addedAt ? new Date(a.addedAt).getTime() : 0;
          const dateB = b.addedAt ? new Date(b.addedAt).getTime() : 0;
          return dateA - dateB;
        }
        default: return 0;
      }
    });
  }, [library, search, filter, sortBy, advancedFilters]);

  const filterOptions = useMemo(() => ({
    genres: [...new Set(library.flatMap(manga => [...(manga.genres || []), ...(manga.translatedGenres || [])]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    authors: [...new Set(library.flatMap(manga => (manga.autor || '').split(',').map(author => author.trim()).filter(Boolean)))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    statusCounts: {
      todos: library.length,
      lendo: library.filter(manga => manga.status === 'lendo').length,
      concluido: library.filter(manga => manga.status === 'concluido').length,
      pausado: library.filter(manga => manga.status === 'pausado').length,
      dropado: library.filter(manga => manga.status === 'dropado').length,
      favoritos: library.filter(manga => manga.favorito).length
    }
  }), [library]);
  const activeAdvancedFilters = Object.values(advancedFilters).filter(Boolean).length;
  const clearFilters = () => {
    setSearch('');
    setFilter('todos');
    setAdvancedFilters({ genre: '', author: '', rating: '', progress: '' });
  };

  return (
    <>
      <Header
        search={search}
        setSearch={setSearch}
        searchInputRef={searchInputRef}
        onBackupClick={() => setIsBackupModalOpen(true)}
        onAccountClick={() => setIsAccountModalOpen(true)}
        onSaveClick={handleSaveMainFile}
        savingMainFile={savingMainFile}
        onUpdateClick={() => setIsUpdateModalOpen(true)}
        desktopVersion={desktopVersion}
        desktopUpdateState={desktopUpdate?.state}
        onTutorialClick={() => setTutorialOpen(open => !open)}
        tutorialOpen={tutorialOpen}
      />
      {tutorialOpen ? (
        <TutorialPage
          onAddClick={() => { setTutorialOpen(false); openAddModal(); }}
          onBackupClick={() => { setTutorialOpen(false); setIsBackupModalOpen(true); }}
          onBackClick={() => setTutorialOpen(false)}
        />
      ) : <main>
        <section className="shelf-intro" aria-labelledby="shelfTitle">
          <div className="shelf-intro-copy">
            <div className="shelf-eyebrow"><span /> SUA BIBLIOTECA PESSOAL</div>
            <h1 id="shelfTitle">Minha estante</h1>
            <p>Organize sua leitura, acompanhe seu progresso e mantenha seus títulos favoritos por perto.</p>
          </div>
          <div className="shelf-intro-side">
            <span className="shelf-intro-count">{library.length}</span>
            <span>{library.length === 1 ? 'mangá na coleção' : 'mangás na coleção'}</span>
          </div>
        </section>
        <StatsBar />
        <div className="collection-toolbar-label">
          <div>
            <h2>Seus títulos</h2>
            <span>{filteredLibrary.length} de {library.length} {library.length === 1 ? 'título' : 'títulos'}</span>
          </div>
          <div className="collection-toolbar-actions">
            <button className="btn btn-sm metadata-update-open-btn" disabled={!library.length} onClick={() => setIsMetadataUpdateOpen(true)}>
              ✨ Completar dados via API
            </button>
            {(search || filter !== 'todos' || activeAdvancedFilters > 0) && (
              <button className="clear-filters-btn" onClick={clearFilters}>
                Limpar filtros <span aria-hidden="true">×</span>
              </button>
            )}
          </div>
        </div>
        <Toolbar
          filter={filter} setFilter={setFilter}
          sortBy={sortBy} setSortBy={setSortBy}
          view={view} setView={setView}
          {...filterOptions}
          advancedFilters={advancedFilters}
          setAdvancedFilters={setAdvancedFilters}
          activeAdvancedFilters={activeAdvancedFilters}
        />

        {view === 'grid' ? (
          <MangaGrid
            mangas={filteredLibrary}
            onEditManga={openEditModal}
            onViewDetail={openDetailModal}
            onDeleteManga={handleDeleteManga}
            isLibraryEmpty={library.length === 0}
            hasActiveFilters={Boolean(search || filter !== 'todos' || activeAdvancedFilters)}
            onAddClick={openAddModal}
            onClearFilters={clearFilters}
          />
        ) : (
          <MangaList
            mangas={filteredLibrary}
            onEditManga={openEditModal}
            onViewDetail={openDetailModal}
            onDeleteManga={handleDeleteManga}
            isLibraryEmpty={library.length === 0}
            hasActiveFilters={Boolean(search || filter !== 'todos' || activeAdvancedFilters)}
            onAddClick={openAddModal}
            onClearFilters={clearFilters}
          />
        )}
      </main>}

      <nav className="mobile-nav" aria-label="Ações rápidas">
        <button className={`mnav-btn ${!tutorialOpen ? 'active' : ''}`} onClick={() => { setTutorialOpen(false); clearFilters(); }} aria-pressed={!tutorialOpen}>
          <span aria-hidden="true">⌂</span><span>Estante</span>
        </button>
        <button className="mnav-btn mnav-add" onClick={() => { setTutorialOpen(false); openAddModal(); }}>
          <span aria-hidden="true">＋</span><span>Adicionar</span>
        </button>
        <button className={`mnav-btn ${tutorialOpen ? 'active' : ''}`} onClick={() => setTutorialOpen(open => !open)} aria-pressed={tutorialOpen}>
          <span aria-hidden="true">✦</span><span>Tutorial</span>
        </button>
        <button className="mnav-btn" onClick={() => setIsBackupModalOpen(true)}>
          <span aria-hidden="true">⇧</span><span>Backup</span>
        </button>
        <button className="mnav-btn" onClick={() => setIsAccountModalOpen(true)}>
          <span aria-hidden="true">☁</span><span>Drive</span>
        </button>
      </nav>
      {!tutorialOpen && <button className="desktop-add-fab" onClick={openAddModal}>
        <span aria-hidden="true">＋</span> Adicionar mangá
      </button>}

      <AddEditModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        mangaToEdit={mangaToEdit}
      />

      <DetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        manga={mangaToDetail}
      />

      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onDriveClick={() => { setIsBackupModalOpen(false); setIsAccountModalOpen(true); }}
      />

      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
      />

      <MetadataUpdateModal
        isOpen={isMetadataUpdateOpen}
        onClose={() => setIsMetadataUpdateOpen(false)}
      />

      <UpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        currentVersion={desktopVersion}
        update={desktopUpdate}
        onCheck={handleCheckForUpdates}
        onInstall={handleInstallUpdate}
      />
    </>
  );
};

function App() {
  return (
    <LibraryProvider>
      <MainApp />
    </LibraryProvider>
  );
}

export default App;
