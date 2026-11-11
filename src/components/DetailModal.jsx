import React, { useEffect, useState } from 'react';
import { useLibrary } from '../context/LibraryContext';
import { STATUS_LABELS } from '../utils/constants';
import { translateMangaInfo } from '../utils/translation';
import CoverImage from './CoverImage';

const DetailModal = ({ isOpen, onClose, manga }) => {
  const { setLibrary } = useLibrary();
  const [activeTab, setActiveTab] = useState('info');
  const [showTranslated, setShowTranslated] = useState(false);
  const [translationLoading, setTranslationLoading] = useState(false);
  const [translationError, setTranslationError] = useState('');

  useEffect(() => {
    setShowTranslated(false);
    setTranslationLoading(false);
    setTranslationError('');
  }, [manga?.id]);

  if (!isOpen || !manga) return null;

  const progress = manga.capituloTotal
    ? Math.round((manga.capitulo / manga.capituloTotal) * 100)
    : 0;

  const toggleFavorite = (e) => {
    e.stopPropagation();
    setLibrary(prev => prev.map(m =>
      m.id === manga.id ? { ...m, favorito: !m.favorito, lastUpdatedAt: new Date().toISOString() } : m
    ));
  };

  const hasTranslation = Boolean(manga.translatedSynopsis || manga.translatedGenres?.length);
  const handleTranslate = async () => {
    if (hasTranslation) {
      setShowTranslated(value => !value);
      return;
    }
    setTranslationLoading(true);
    setTranslationError('');
    try {
      const translated = await translateMangaInfo(manga.synopsis || '', manga.genres || []);
      if (!translated.synopsis && !translated.genres.some((genre, index) => genre !== manga.genres?.[index])) {
        throw new Error('Não há descrição ou gêneros para traduzir.');
      }
      setLibrary(prev => prev.map(item => item.id === manga.id ? {
        ...item,
        translatedSynopsis: translated.synopsis,
        translatedGenres: translated.genres,
        translationProviders: translated.providers,
        lastUpdatedAt: new Date().toISOString()
      } : item));
      setShowTranslated(true);
    } catch (error) {
      setTranslationError('Não foi possível traduzir agora. Tente novamente mais tarde.');
      console.error('[MangaShelf:translate] Falha ao traduzir mangá', {
        title: manga.nome,
        error: error.message
      });
    } finally {
      setTranslationLoading(false);
    }
  };

  return (
    <div className="modal-overlay open">
      <div className="modal" style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <h2>Detalhes do Mangá</h2>
          <button className="btn btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="detail-cover-wrapper">
            <CoverImage
              src={manga.cover}
              className="detail-cover-img"
              alt={manga.nome}
              fallback={<div className="detail-cover-img cover-placeholder">Sem Capa</div>}
            />
            <div className="detail-info">
              <div className="detail-title">{manga.nome}</div>
              <div className="detail-author">{manga.autor || 'Autor desconhecido'}</div>
              <div className="detail-meta">
                <span className="meta-badge" style={{ borderColor: `var(--status-${manga.status})`, color: `var(--status-${manga.status})` }}>
                  {STATUS_LABELS[manga.status]}
                </span>
                {manga.nota && (
                  <span className="meta-badge" style={{ borderColor: '#fde68a', color: '#fde68a' }}>
                    ⭐ {manga.nota}
                  </span>
                )}
                <span className="meta-badge">
                  📅 Início: {manga.dataInicio || 'Não informada'}
                </span>
              </div>
            </div>
          </div>

          <div className="tabs">
            <button
              className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`}
              onClick={() => setActiveTab('info')}
            >
              Informações
            </button>
            <button
              className={`tab-btn ${activeTab === 'progress' ? 'active' : ''}`}
              onClick={() => setActiveTab('progress')}
            >
              Progresso
            </button>
          </div>

          <div className={`tab-pane ${activeTab === 'info' ? 'active' : ''}`}>
            <div className="translation-controls">
              <button className="btn btn-sm" onClick={handleTranslate} disabled={translationLoading}>
                {translationLoading ? 'Traduzindo…' : hasTranslation ? (showTranslated ? 'Ver original' : 'Ver em português') : 'Traduzir para português'}
              </button>
              {hasTranslation && <span>Tradução salva neste mangá</span>}
            </div>
            {translationError && <div className="translation-error" role="status">{translationError}</div>}
            <div className="detail-synopsis" style={{ fontSize: '0.85rem', color: 'var(--text2)', lineHeight: '1.75' }}>
              {(showTranslated && manga.translatedSynopsis) || manga.synopsis || 'Nenhuma sinopse disponível para este título.'}
            </div>
            <div className="card-tags" style={{ marginTop: '1rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
              {(showTranslated && manga.translatedGenres?.length ? manga.translatedGenres : manga.genres)?.map((g, i) => (
                <span key={i} className="tag">{g}</span>
              ))}
            </div>
          </div>

          <div className={`tab-pane ${activeTab === 'progress' ? 'active' : ''}`}>
            <div className="detail-stats">
              <div className="detail-stat">
                <div className="detail-stat-label">Capítulo Atual</div>
                <div className="detail-stat-value">{manga.capitulo}</div>
              </div>
              <div className="detail-stat">
                <div className="detail-stat-label">Total de Capítulos</div>
                <div className="detail-stat-value">{manga.capituloTotal || '—'}</div>
              </div>
            </div>
            <div className="detail-progress">
              <div className="detail-progress-label">
                <span>Progresso Total</span>
                <span>{progress}%</span>
              </div>
              <div className="detail-progress-bar">
                <div
                  className="detail-progress-fill"
                  style={{
                    width: `${progress}%`,
                    background: progress === 100 ? 'var(--status-concluido)' : 'var(--accent)'
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            className={`btn ${manga.favorito ? 'btn-primary' : ''}`}
            onClick={toggleFavorite}
          >
            {manga.favorito ? '❤️ Favoritado' : '🤍 Favoritar'}
          </button>
          <button className="btn" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
};

export default DetailModal;
