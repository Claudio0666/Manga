import React, { useEffect, useState } from 'react';
import { useLibrary } from '../context/LibraryContext';

const AccountModal = ({ isOpen, onClose }) => {
  const {
    library,
    meta,
    driveClientId,
    updateDriveClientId,
    driveConnected,
    driveIdentityReady,
    connectGoogleDrive,
    disconnectGoogleDrive,
    saveToDrive,
    loadFromDrive
  } = useLibrary();
  const [clientId, setClientId] = useState(driveClientId);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => setClientId(driveClientId), [driveClientId]);

  if (!isOpen) return null;

  const handleConnect = async () => {
    setFeedback(null);
    setLoading(true);
    try {
      const nextClientId = clientId.trim();
      if (nextClientId !== driveClientId) updateDriveClientId(nextClientId);
      await connectGoogleDrive(nextClientId);
      setFeedback({ type: 'success', text: 'Google Drive conectado. Sua biblioteca local continua sendo a principal.' });
    } catch (error) {
      setFeedback({ type: 'error', text: error.message || 'Não foi possível conectar ao Google Drive.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (library.length === 0 && !window.confirm('Sua biblioteca local está vazia. Salvar agora pode substituir um backup existente no Google Drive por uma biblioteca vazia. Continuar?')) return;
    setFeedback(null);
    setLoading(true);
    try {
      const result = await saveToDrive();
      setFeedback({ type: 'success', text: `Backup salvo no Google Drive em ${new Date(result.updatedAt).toLocaleString('pt-BR')}.` });
    } catch (error) {
      setFeedback({ type: 'error', text: error.message || 'Não foi possível salvar no Google Drive.' });
    } finally {
      setLoading(false);
    }
  };

  const handleLoad = async () => {
    if (!window.confirm('Carregar o backup do Google Drive substituirá a biblioteca deste dispositivo. Deseja continuar?')) return;
    setFeedback(null);
    setLoading(true);
    try {
      const result = await loadFromDrive();
      setFeedback(result
        ? { type: 'success', text: `Backup carregado: ${result.count} mangá(s).` }
        : { type: 'info', text: 'Ainda não existe um backup do MangaShelf neste Google Drive.' });
    } catch (error) {
      setFeedback({ type: 'error', text: error.message || 'Não foi possível carregar do Google Drive.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    disconnectGoogleDrive();
    setFeedback({ type: 'info', text: 'Google Drive desconectado. Seus dados locais não foram alterados.' });
  };

  const handleUpdateClientId = () => {
    const nextClientId = clientId.trim();
    if (!nextClientId) {
      setFeedback({ type: 'error', text: 'Informe um Client ID válido.' });
      return;
    }
    updateDriveClientId(nextClientId);
    setFeedback({ type: 'info', text: 'Client ID atualizado. Conecte novamente para autorizar o Drive.' });
  };

  const lastBackup = meta.driveBackupAt ? new Date(meta.driveBackupAt).toLocaleString('pt-BR') : '';

  return (
    <div className="modal-overlay open auth-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="auth-shell drive-shell" role="dialog" aria-modal="true" aria-labelledby="driveTitle">
        <aside className="auth-brand-panel">
          <button className="auth-close mobile-auth-close" onClick={onClose} aria-label="Fechar">×</button>
          <div className="auth-brand"><span className="auth-brand-mark">漫</span><span>MangaShelf</span></div>
          <div className="auth-brand-copy">
            <span className="auth-kicker">ARMAZENAMENTO LOCAL + GOOGLE DRIVE</span>
            <h2>Sua estante fica com você.</h2>
            <p>O MangaShelf salva as alterações neste dispositivo. Use o Drive para guardar uma cópia e restaurá-la em outro aparelho.</p>
          </div>
          <div className="auth-book-art" aria-hidden="true">
            <span className="auth-book auth-book-back" />
            <span className="auth-book auth-book-middle" />
            <span className="auth-book auth-book-front"><i /><i /><i /></span>
            <span className="auth-art-spark spark-one">✦</span>
            <span className="auth-art-spark spark-two">✧</span>
          </div>
          <div className="auth-brand-foot"><span />Seu backup fica na pasta privada de dados do MangaShelf no Drive.</div>
        </aside>

        <section className="auth-form-panel drive-form-panel">
          <button className="auth-close desktop-auth-close" onClick={onClose} aria-label="Fechar">×</button>
          <div className="drive-content">
            <div className="auth-mobile-brand"><span className="auth-brand-mark">漫</span> MangaShelf</div>
            <span className="auth-kicker">BACKUP DA BIBLIOTECA</span>
            <h1 id="driveTitle">Google Drive</h1>
            <p className="auth-subtitle">A biblioteca continua salva localmente. Conecte o Drive para criar e restaurar seu backup manualmente.</p>

            <div className={`drive-connection-status ${driveConnected ? 'connected' : ''}`}>
              <span className="drive-status-dot" />
              <span>{driveConnected ? 'Google Drive conectado' : 'Drive ainda não conectado'}</span>
            </div>

            {driveConnected ? (
              <>
                <div className="drive-backup-summary">
                  <div><span>Biblioteca local</span><strong>{library.length} {library.length === 1 ? 'mangá' : 'mangás'}</strong></div>
                  <div><span>Último backup</span><strong>{lastBackup || 'Ainda não foi criado'}</strong></div>
                </div>
                <div className="auth-cloud-actions">
                  <button className="btn btn-primary auth-submit" onClick={handleSave} disabled={loading}>↑ Salvar backup no Drive</button>
                  <button className="btn auth-submit" onClick={handleLoad} disabled={loading}>↓ Restaurar backup do Drive</button>
                </div>
                <button className="auth-text-button drive-disconnect" onClick={handleDisconnect} disabled={loading}>Desconectar Google Drive</button>
                <details className="auth-advanced-settings">
                  <summary>Alterar Client ID do Google</summary>
                  <label className="auth-field drive-client-id-field">
                    <span>Google OAuth Client ID</span>
                    <input type="text" value={clientId} onChange={event => setClientId(event.target.value)} autoComplete="off" />
                  </label>
                  <button className="btn" onClick={handleUpdateClientId}>Atualizar Client ID</button>
                </details>
              </>
            ) : (
              <>
                <label className="auth-field drive-client-id-field">
                  <span>Google OAuth Client ID</span>
                  <input type="text" value={clientId} onChange={event => setClientId(event.target.value)} placeholder="000000000000-xxxxxxxx.apps.googleusercontent.com" autoComplete="off" />
                </label>
                <button className="btn btn-primary auth-submit" onClick={handleConnect} disabled={loading || !clientId.trim() || !driveIdentityReady}>
                  {loading ? 'Conectando…' : !driveIdentityReady ? 'Carregando Google…' : 'Conectar Google Drive'}
                  {!loading && driveIdentityReady && <span aria-hidden="true">→</span>}
                </button>
                <p className="drive-setup-note">Precisa de um Client ID OAuth do tipo Aplicativo da Web, com o Google Drive API ativado e este domínio cadastrado como origem autorizada.</p>
                <details className="auth-advanced-settings drive-help">
                  <summary>Como configurar o acesso ao Drive</summary>
                  <ol>
                    <li>Crie um ID de cliente OAuth para aplicativo Web no Google Cloud.</li>
                    <li>Ative a Google Drive API e cadastre a origem deste app nos domínios autorizados.</li>
                    <li>Use o Client ID acima. O acesso solicitado é restrito aos dados do MangaShelf no Drive.</li>
                  </ol>
                  <p className="drive-doc-links">
                    <a href="https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid" target="_blank" rel="noreferrer">Guia para criar o Client ID</a>
                    <a href="https://console.cloud.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noreferrer">Ativar Google Drive API</a>
                  </p>
                </details>
              </>
            )}

            {feedback && <div className={`auth-feedback ${feedback.type}`} role="status">{feedback.text}</div>}
            <p className="auth-local-note">A sincronização é manual. Salvar envia a biblioteca local; restaurar substitui a biblioteca local pela cópia do Drive.</p>
            <div className="drive-privacy-note">A conexão usa o Google Identity Services e guarda apenas um token temporário em memória. Ao recarregar a página, conecte novamente.</div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AccountModal;
