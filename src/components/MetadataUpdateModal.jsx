import React, { useEffect, useRef, useState } from 'react';
import { useLibrary } from '../context/LibraryContext';
import { getMissingMangaMetadata, mergeApiMetadata } from '../utils/mangaDuplicates';
import { lookupMangaMetadata } from '../utils/mangaMetadata';

const wait = milliseconds => new Promise(resolve => window.setTimeout(resolve, milliseconds));

const MetadataUpdateModal = ({ isOpen, onClose }) => {
  const { library, setLibrary } = useLibrary();
  const [overwrite, setOverwrite] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [summary, setSummary] = useState(null);
  const [activity, setActivity] = useState([]);
  const abortControllerRef = useRef(null);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  if (!isOpen) return null;

  const incompleteCount = library.filter(manga => getMissingMangaMetadata(manga).length > 0).length;
  const targets = overwrite ? library : library.filter(manga => getMissingMangaMetadata(manga).length > 0);

  const closeModal = () => {
    abortControllerRef.current?.abort();
    setIsRunning(false);
    onClose();
  };

  const updateMetadata = async () => {
    if (isRunning || targets.length === 0) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setSummary(null);
    setActivity([]);
    setProgress({ current: 0, total: targets.length });
    setIsRunning(true);
    const counts = { updated: 0, notFound: 0, failed: 0, unchanged: 0 };

    for (let index = 0; index < targets.length; index += 1) {
      if (controller.signal.aborted) break;
      const manga = targets[index];
      let activityItem;
      try {
        const metadata = await lookupMangaMetadata(manga, controller.signal);
        if (!metadata) {
          counts.notFound += 1;
          activityItem = { type: 'muted', text: `${manga.nome}: nenhuma correspondência segura encontrada.` };
        } else {
          const merge = mergeApiMetadata(manga, metadata, { overwrite });
          if (merge.changedFields.length) {
            setLibrary(current => current.map(item => item.id === manga.id
              ? { ...mergeApiMetadata(item, metadata, { overwrite }).manga, lastUpdatedAt: new Date().toISOString() }
              : item));
            counts.updated += 1;
            activityItem = { type: 'success', text: `${manga.nome}: ${merge.changedFields.length} campo(s) preenchido(s) via ${metadata.apiSource}.` };
          } else {
            counts.unchanged += 1;
            activityItem = { type: 'muted', text: `${manga.nome}: já estava completo.` };
          }
        }
      } catch (error) {
        if (error?.name === 'AbortError' || controller.signal.aborted) break;
        counts.failed += 1;
        activityItem = { type: 'error', text: `${manga.nome}: falha na consulta à API.` };
        console.warn('[MangaShelf:metadata] Não foi possível atualizar os dados do mangá', manga.nome, error);
      }

      setActivity(current => [...current.slice(-4), activityItem]);
      setProgress({ current: index + 1, total: targets.length });
      if (index < targets.length - 1 && !controller.signal.aborted) await wait(350);
    }

    setSummary({ ...counts, cancelled: controller.signal.aborted });
    setIsRunning(false);
    abortControllerRef.current = null;
  };

  const progressPercent = progress.total ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="modal-overlay open" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !isRunning) onClose(); }}>
      <section className="modal metadata-update-modal" role="dialog" aria-modal="true" aria-labelledby="metadataUpdateTitle">
        <div className="modal-header">
          <div><h2 id="metadataUpdateTitle">Completar dados dos mangás</h2><p>Busque metadados nas APIs e preencha os campos vazios com correspondências confiáveis.</p></div>
          <button className="btn btn-sm btn-icon" onClick={closeModal} aria-label={isRunning ? 'Cancelar e fechar' : 'Fechar'}>✕</button>
        </div>

        <div className="modal-body">
          <div className="metadata-update-summary">
            <div><strong>{library.length}</strong><span>na biblioteca</span></div>
            <div><strong>{incompleteCount}</strong><span>com dados faltando</span></div>
            <div><strong>{targets.length}</strong><span>nesta atualização</span></div>
          </div>

          <label className="metadata-overwrite-option">
            <input type="checkbox" checked={overwrite} disabled={isRunning} onChange={event => setOverwrite(event.target.checked)} />
            <span><strong>Atualizar também os campos já preenchidos</strong><small>Desmarcado: preserva capas, autores e descrições que já existem.</small></span>
          </label>

          {!isRunning && !summary && <p className="metadata-update-note">A atualização preserva capítulo lido, status, nota, datas e favoritos. Títulos sem correspondência próxima são ignorados.</p>}

          {(isRunning || progress.total > 0) && (
            <div className="metadata-progress" role="status" aria-live="polite">
              <div className="metadata-progress-label"><span>{isRunning ? 'Consultando catálogos…' : summary?.cancelled ? 'Atualização cancelada' : 'Atualização concluída'}</span><strong>{progress.current}/{progress.total}</strong></div>
              <div className="metadata-progress-track"><span style={{ width: `${progressPercent}%` }} /></div>
            </div>
          )}

          {summary && <div className="metadata-result-summary" role="status">
            <strong>{summary.updated} mangá(s) atualizado(s)</strong>
            <span>{summary.notFound} sem correspondência · {summary.failed} falha(s){summary.unchanged ? ` · ${summary.unchanged} sem campos novos` : ''}</span>
          </div>}

          {activity.length > 0 && <ul className="metadata-activity">
            {activity.map((entry, index) => <li className={entry.type} key={`${index}-${entry.text}`}>{entry.text}</li>)}
          </ul>}
        </div>

        <div className="modal-footer">
          {isRunning && <button className="btn btn-danger" onClick={() => abortControllerRef.current?.abort()}>Cancelar atualização</button>}
          {!isRunning && <button className="btn" onClick={closeModal}>Fechar</button>}
          <button className="btn btn-primary" disabled={isRunning || targets.length === 0} onClick={updateMetadata}>
            {isRunning ? 'Atualizando…' : summary ? 'Atualizar novamente' : `Atualizar ${targets.length} mangá(s)`}
          </button>
        </div>
      </section>
    </div>
  );
};

export default MetadataUpdateModal;
