import React from 'react';

const UpdateModal = ({ isOpen, onClose, currentVersion, update, onCheck, onInstall }) => {
  if (!isOpen) return null;

  const state = update?.state || 'idle';
  const isBusy = ['checking', 'available', 'downloading'].includes(state);
  const percent = Math.min(100, Math.max(0, Number(update?.percent) || 0));
  const status = {
    idle: { icon: '↻', title: 'Pronto para verificar', detail: 'Confira se há uma versão mais recente do MangaShelf.' },
    development: { icon: 'ⓘ', title: 'Atualizador da versão instalada', detail: 'A verificação de atualizações está disponível no aplicativo instalado.' },
    checking: { icon: '⌕', title: 'Procurando atualizações', detail: 'Consultando o canal oficial de versões.' },
    'up-to-date': { icon: '✓', title: 'Você está em dia', detail: 'Esta é a versão mais recente disponível.' },
    available: { icon: '↓', title: 'Nova versão encontrada', detail: 'O download começou e será feito em segundo plano.' },
    downloading: { icon: '↓', title: 'Baixando atualização', detail: 'Você pode continuar usando o MangaShelf durante o download.' },
    downloaded: { icon: '✓', title: 'Atualização pronta', detail: 'Reinicie o MangaShelf para concluir a instalação.' },
    error: { icon: '!', title: 'Não foi possível atualizar', detail: update?.message || 'Verifique sua conexão e tente novamente.' }
  }[state] || { icon: '↻', title: 'Pronto para verificar', detail: 'Confira se há uma versão mais recente do MangaShelf.' };

  return (
    <div className="modal-overlay open update-modal-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal update-modal" role="dialog" aria-modal="true" aria-labelledby="updateModalTitle">
        <header className="modal-header update-modal-header">
          <div><span className="update-modal-kicker">MANGASHELF DESKTOP</span><h2 id="updateModalTitle">Atualizações</h2></div>
          <button className="modal-close" onClick={onClose} aria-label="Fechar atualizações">×</button>
        </header>
        <div className="modal-body update-modal-body">
          <div className={`update-status-card ${state}`} aria-live="polite">
            <span className="update-status-icon" aria-hidden="true">{status.icon}</span>
            <div className="update-status-copy"><strong>{status.title}</strong><p>{status.detail}</p></div>
            {state === 'checking' && <span className="update-spinner" aria-label="Verificando" />}
          </div>
          <div className="update-version-row">
            <div><span>Versão instalada</span><strong>v{currentVersion || '—'}</strong></div>
            {update?.version && ['available', 'downloading', 'downloaded'].includes(state) && <div><span>Nova versão</span><strong>v{update.version}</strong></div>}
          </div>
          {state === 'downloading' && <div className="update-progress-wrap"><div className="update-progress-label"><span>Download</span><strong>{percent}%</strong></div><div className="update-progress-track" role="progressbar" aria-label="Download da atualização" aria-valuemin="0" aria-valuemax="100" aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div></div>}
          <p className="update-modal-footnote">As atualizações são obtidas pelo canal oficial do MangaShelf e instaladas após reiniciar o aplicativo.</p>
        </div>
        <footer className="modal-footer update-modal-footer">
          <button className="btn" onClick={onClose}>Fechar</button>
          {state === 'downloaded'
            ? <button className="btn btn-primary" onClick={onInstall}>Reiniciar e instalar</button>
            : <button className="btn btn-primary" onClick={onCheck} disabled={isBusy || state === 'development'}>{state === 'checking' ? 'Verificando…' : state === 'downloading' || state === 'available' ? 'Baixando…' : state === 'development' ? 'Disponível no app instalado' : 'Verificar atualizações'}</button>}
        </footer>
      </section>
    </div>
  );
};

export default UpdateModal;
