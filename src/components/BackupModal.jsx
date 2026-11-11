import React, { useEffect, useState } from 'react';
import { useLibrary } from '../context/LibraryContext';
import { STATUS_LABELS } from '../utils/constants';
import { createLocalRecoveryPoint, listLocalRecoveryPoints, readLocalRecoveryPoint } from '../utils/localPersistence';
import { findMangaDuplicateCandidates, mergeApiMetadata } from '../utils/mangaDuplicates';

const BackupModal = ({ isOpen, onClose, onDriveClick }) => {
  const {
    library, meta, setLibrary, saveMainFile, restoreMainFile,
    draftSavedAt, draftStorageMode, mainFileName, mainFileSavedAt, savingMainFile
  } = useLibrary();
  const [recoveryPoints, setRecoveryPoints] = useState([]);
  const [pendingImport, setPendingImport] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    listLocalRecoveryPoints().then(points => {
      if (active) setRecoveryPoints(points);
    }).catch(error => console.warn('[MangaShelf:storage] Não foi possível carregar os pontos de restauração', error));
    return () => { active = false; };
  }, [isOpen]);

  if (!isOpen) return null;

  const createRecoveryPoint = async () => {
    try {
      await createLocalRecoveryPoint({ app: 'MangaShelf', version: 1, updatedAt: new Date().toISOString(), library, meta });
      setRecoveryPoints(await listLocalRecoveryPoints());
      alert('Ponto de restauração criado.');
    } catch (error) {
      alert(`Não foi possível criar o ponto de restauração: ${error.message}`);
    }
  };

  const restoreRecoveryPoint = async point => {
    if (!window.confirm(`Restaurar a biblioteca de ${new Date(point.updatedAt).toLocaleString('pt-BR')}? Isso substituirá os dados atuais.`)) return;
    try {
      const snapshot = await readLocalRecoveryPoint(point.id);
      if (!Array.isArray(snapshot?.library)) throw new Error('O ponto de restauração está em formato inválido.');
      await createLocalRecoveryPoint({ app: 'MangaShelf', version: 1, updatedAt: new Date().toISOString(), library, meta });
      setLibrary(snapshot.library);
      setMeta(snapshot.meta && typeof snapshot.meta === 'object' ? snapshot.meta : { updatedAt: snapshot.updatedAt || '' });
      alert('Ponto de restauração aplicado. Os dados anteriores também foram guardados.');
    } catch (error) {
      alert(`Não foi possível restaurar o ponto: ${error.message}`);
    }
  };

  const exportJSON = () => {
    const dataStr = JSON.stringify({
      app: 'MangaShelf',
      version: 1,
      updatedAt: meta.updatedAt || new Date().toISOString(),
      library: library
    }, null, 2);

    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mangashelf_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    if (library.length === 0) return alert("Biblioteca vazia");

    const csvCell = value => {
      let text = value == null ? '' : String(value);
      if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };

    const headers = ["Nome", "Autor", "Status", "Nota", "Capitulo", "Total", "Data Inicio", "Data Fim"];
    const rows = library.map(m => [
      m.nome,
      m.autor,
      m.status,
      m.nota,
      m.capitulo,
      m.capituloTotal,
      m.dataInicio,
      m.dataFim
    ]);

    const csvContent = [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mangashelf_library.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveMainFile = async () => {
    try {
      const result = await saveMainFile();
      alert(result.downloaded
        ? 'Arquivo MangaShelf.json baixado. Escolha uma pasta para guardá-lo.'
        : `Arquivo principal salvo: ${result.fileName}`);
    } catch (error) {
      if (error?.name !== 'AbortError') alert(`Não foi possível salvar o arquivo principal: ${error.message}`);
    }
  };

  const handleRestoreMainFile = async () => {
    if (!window.confirm('Restaurar o arquivo principal substituirá a biblioteca atual. Continuar?')) return;
    try {
      const result = await restoreMainFile();
      alert(`Biblioteca restaurada de ${result.fileName} (${result.count} mangá(s)).`);
    } catch (error) {
      if (error?.name !== 'AbortError') alert(`Não foi possível restaurar o arquivo: ${error.message}`);
    }
  };

  const formatSavedAt = value => value
    ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : 'ainda não salvo';

  const normalizeImportedCover = cover => {
    if (typeof cover !== 'string' || !cover) return '';
    try {
      const url = new URL(cover, window.location.origin);
      if (url.pathname.endsWith('/.netlify/functions/manga-proxy') && url.searchParams.get('api') === 'cover') {
        const mangaId = url.searchParams.get('id');
        const fileName = url.searchParams.get('file');
        if (mangaId && fileName) {
          return `https://uploads.mangadex.org/covers/${encodeURIComponent(mangaId)}/${encodeURIComponent(fileName)}.256.jpg`;
        }
      }
      return cover;
    } catch {
      return cover;
    }
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setPendingImport(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target.result);
        const sourceLibrary = Array.isArray(json) ? json : json?.library;
        if (Array.isArray(sourceLibrary)) {
          const usedIds = new Set();
          const importedLibrary = sourceLibrary.map((entry, index) => {
            if (!entry || typeof entry !== 'object' || Array.isArray(entry) || typeof entry.nome !== 'string' || !entry.nome.trim()) {
              throw new Error(`Mangá inválido na posição ${index + 1}: o nome é obrigatório.`);
            }

            const originalId = entry.id == null ? '' : String(entry.id);
            const id = originalId && !usedIds.has(originalId)
              ? originalId
              : `import-${Date.now()}-${index}`;
            usedIds.add(id);
            const numberOrDefault = (value, fallback = 0) => {
              if (value === '' || value == null) return fallback;
              const number = Number(value);
              return Number.isFinite(number) ? number : fallback;
            };

            return {
              ...entry,
              id,
              nome: entry.nome.trim(),
              autor: typeof entry.autor === 'string' ? entry.autor : '',
              status: Object.hasOwn(STATUS_LABELS, entry.status) ? entry.status : 'lendo',
              nota: entry.nota === '' || entry.nota == null ? '' : numberOrDefault(entry.nota, ''),
              capitulo: numberOrDefault(entry.capitulo),
              capituloTotal: numberOrDefault(entry.capituloTotal, ''),
              dataInicio: typeof entry.dataInicio === 'string' ? entry.dataInicio : '',
              dataFim: typeof entry.dataFim === 'string' ? entry.dataFim : '',
              cover: normalizeImportedCover(entry.cover),
              synopsis: typeof entry.synopsis === 'string' ? entry.synopsis : '',
              genres: Array.isArray(entry.genres) ? entry.genres.filter(genre => typeof genre === 'string') : [],
              favorito: Boolean(entry.favorito)
            };
          });

          const existingDuplicates = importedLibrary.filter(entry => findMangaDuplicateCandidates(entry, library).length > 0).length;
          const fileDuplicates = importedLibrary.filter((entry, index) => findMangaDuplicateCandidates(entry, importedLibrary.slice(0, index)).length > 0).length;
          const updatedAt = (!Array.isArray(json) && json.updatedAt) || new Date().toISOString();
          if (existingDuplicates || fileDuplicates) {
            setPendingImport({ library: importedLibrary, updatedAt, existingDuplicates, fileDuplicates });
            return;
          }
          if (!window.confirm(`Importar ${importedLibrary.length} mangá(s) substituirá a biblioteca atual. Continuar?`)) return;
          await applyImport(importedLibrary, 'replace', updatedAt);
        } else {
          throw new Error("Formato de arquivo inválido");
        }
      } catch (err) {
        alert("Erro ao importar arquivo: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const applyImport = async (incomingLibrary, mode, updatedAt) => {
    await createLocalRecoveryPoint({ app: 'MangaShelf', version: 1, updatedAt: new Date().toISOString(), library, meta })
      .catch(error => console.warn('[MangaShelf:storage] Não foi possível criar um ponto de restauração antes de importar', error));

    if (mode === 'replace') {
      setLibrary(incomingLibrary);
    } else {
      let mergedLibrary = [...library];
      const usedIds = new Set(mergedLibrary.map(manga => String(manga.id)));
      let mergedCount = 0;
      for (const entry of incomingLibrary) {
        const match = mode === 'merge' ? findMangaDuplicateCandidates(entry, mergedLibrary)[0]?.manga : null;
        if (match) {
          mergedLibrary = mergedLibrary.map(manga => manga.id === match.id
            ? mergeApiMetadata(manga, entry, { overwrite: false }).manga
            : manga);
          mergedCount += 1;
          continue;
        }
        let id = String(entry.id || `import-${Date.now()}-${mergedLibrary.length}`);
        if (usedIds.has(id)) id = `import-${Date.now()}-${mergedLibrary.length}`;
        usedIds.add(id);
        mergedLibrary.push({ ...entry, id });
      }
      setLibrary(mergedLibrary);
      if (mode === 'merge') alert(`Importação mesclada. ${mergedCount} registro(s) existente(s) receberam dados; novos mangás foram adicionados e o progresso pessoal foi preservado.`);
    }

    setMeta(previous => ({ ...previous, updatedAt: updatedAt || new Date().toISOString() }));
    if (mode !== 'merge') alert(`Biblioteca importada com ${incomingLibrary.length} mangá(s).`);
    setRecoveryPoints(await listLocalRecoveryPoints());
    setPendingImport(null);
  };

  const chooseImportMode = async mode => {
    if (!pendingImport) return;
    if (mode === 'replace' && !window.confirm(`Substituir a biblioteca atual pelos ${pendingImport.library.length} mangá(s) do arquivo?`)) return;
    try {
      await applyImport(pendingImport.library, mode, pendingImport.updatedAt);
    } catch (error) {
      alert(`Não foi possível concluir a importação: ${error.message}`);
    }
  };

  return (
    <div className="modal-overlay open">
      <div className="modal" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <h2>📦 Backup & Restauração</h2>
          <button className="btn btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '.875rem', color: 'var(--text2)', marginBottom: '1.25rem', lineHeight: '1.7' }}>
            Sua biblioteca é salva automaticamente neste dispositivo. Exporte um JSON para ter uma cópia ou um CSV para abrir em planilhas.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
            <button className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={handleSaveMainFile} disabled={savingMainFile}>
              {savingMainFile ? 'Salvando…' : '💾 Salvar arquivo principal'}
            </button>
            <button className="btn" style={{ justifyContent: 'center' }} onClick={handleRestoreMainFile}>
              📂 Restaurar arquivo principal
            </button>
            <p style={{ fontSize: '.75rem', color: 'var(--text2)', margin: 0, lineHeight: 1.6 }}>
              Rascunho local: {formatSavedAt(draftSavedAt)} ({draftStorageMode === 'opfs' ? 'armazenamento persistente do navegador' : 'armazenamento local'}).<br />
              Arquivo principal{mainFileName ? ` (${mainFileName})` : ''}: {formatSavedAt(mainFileSavedAt)}.
            </p>
            <div className="recovery-panel">
              <div className="recovery-panel-heading">
                <div><strong>Histórico local</strong><span>{recoveryPoints.length} ponto(s) de restauração</span></div>
                <button className="btn btn-sm" onClick={createRecoveryPoint}>＋ Criar ponto</button>
              </div>
              {recoveryPoints.length > 0 ? (
                <div className="recovery-point-list">
                  {recoveryPoints.slice(0, 6).map(point => (
                    <button key={point.id} className="recovery-point" onClick={() => restoreRecoveryPoint(point)}>
                      <span>{new Date(point.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      <small>{point.libraryCount} mangá(s) · Restaurar</small>
                    </button>
                  ))}
                </div>
              ) : <p className="recovery-empty">Crie um ponto antes de mudanças importantes. O app também cria um ao salvar o arquivo principal.</p>}
            </div>
            <button className="btn" style={{ justifyContent: 'center' }} onClick={exportJSON}>
              ⬇️ Exportar JSON (backup completo)
            </button>
            <button className="btn" style={{ justifyContent: 'center' }} onClick={exportCSV}>
              📊 Exportar CSV (planilha)
            </button>
            <label className="btn" style={{ justifyContent: 'center', cursor: 'pointer' }}>
              ⬆️ Importar backup (JSON)
              <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
            </label>
            {pendingImport && <div className="import-duplicate-review" role="alert">
              <strong>Encontramos possíveis duplicados</strong>
              <p>{pendingImport.existingDuplicates} item(ns) coincidem com a estante atual e {pendingImport.fileDuplicates} repetição(ões) aparecem no próprio arquivo.</p>
              <button className="btn btn-primary" onClick={() => chooseImportMode('merge')}>Mesclar e preservar meu progresso</button>
              <button className="btn" onClick={() => chooseImportMode('append')}>Manter todos como itens separados</button>
              <button className="btn btn-sm" onClick={() => chooseImportMode('replace')}>Substituir pela importação</button>
              <button className="import-cancel-btn" onClick={() => setPendingImport(null)}>Cancelar</button>
            </div>}
          </div>

          <div style={{ height: '1px', background: 'var(--border)', margin: '1rem 0' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem', marginTop: '.75rem' }}>
            <button className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={onDriveClick}>
              ☁️ Configurar backup no Google Drive
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackupModal;
