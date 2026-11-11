import React, { useEffect, useMemo, useState } from 'react';

const isImageProxy = hostname => hostname === 'wsrv.nl' || hostname === 'images.weserv.nl';

const normalizeSource = (value, depth = 0) => {
  if (!value) return null;
  if (depth > 3) return null;

  try {
    let url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;

    if (isImageProxy(url.hostname)) {
      const original = url.searchParams.get('url');
      if (!original) return null;
      if (!/^https?:\/\//i.test(original)) return normalizeSource(`https://${original}`, depth + 1);
      return normalizeSource(original, depth + 1);
    }

    if (url.hostname === 'uploads.mangadex.org' && /\/covers\//.test(url.pathname) && !/\.(256|512)\.jpg$/i.test(url.pathname)) {
      url.pathname += '.256.jpg';
    }

    return url.toString();
  } catch {
    return null;
  }
};

const getImageSources = src => {
  const direct = normalizeSource(src);
  if (!direct) return [];

  const candidates = [];
  const isDesktopApp = navigator.userAgent.includes('Electron');
  if (import.meta.env.DEV || isDesktopApp) {
    const directUrl = new URL(direct);
    if (directUrl.hostname === 'uploads.mangadex.org') {
      candidates.push(`/api-mangadex-covers${directUrl.pathname}${directUrl.search}`);
    }
  }
  candidates.push(direct);
  if (src && src !== direct) candidates.push(src);
  candidates.push(`https://wsrv.nl/?url=${encodeURIComponent(direct)}&w=512`);
  candidates.push(`https://images.weserv.nl/?url=${encodeURIComponent(direct)}`);
  return [...new Set(candidates)];
};

const CoverImage = ({ src, alt = '', className, style, loading = 'lazy', fallback = null, onError }) => {
  const sources = useMemo(() => getImageSources(src), [src]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [cachedSource, setCachedSource] = useState('');

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setSourceIndex(0);
    setFailed(false);
    setCachedSource('');
    if (src && sources.length === 0) {
      console.error('[MangaShelf:image] URL de capa inválida ou não suportada', {
        title: alt || '(sem título)',
        sourceUrl: src
      });
    }
    if (window.caches && window.URL?.createObjectURL) {
      (async () => {
        try {
          const cache = await window.caches.open('mangashelf-covers-v1');
          for (const source of sources) {
            const url = new URL(source, window.location.origin);
            const response = await cache.match(url.toString());
            if (!response || response.type === 'opaque' || !response.headers.get('content-type')?.startsWith('image/')) continue;
            objectUrl = URL.createObjectURL(await response.blob());
            if (active) setCachedSource(objectUrl);
            else URL.revokeObjectURL(objectUrl);
            return;
          }
        } catch (error) {
          console.warn('[MangaShelf:image-cache] Não foi possível ler o cache de capas', error);
        }
      })();
    }
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, sources]);

  const cacheLoadedCover = async imageUrl => {
    if (!window.caches || !imageUrl) return;
    try {
      const url = new URL(imageUrl, window.location.origin);
      const response = await fetch(url.toString(), { cache: 'force-cache' });
      if (response.ok && response.headers.get('content-type')?.startsWith('image/')) {
        const cache = await window.caches.open('mangashelf-covers-v1');
        await cache.put(url.toString(), response.clone());
        const cachedRequests = await cache.keys();
        if (cachedRequests.length > 350) {
          await Promise.all(cachedRequests.slice(0, cachedRequests.length - 350).map(request => cache.delete(request)));
        }
      }
    } catch (error) {
      console.warn('[MangaShelf:image-cache] Não foi possível guardar a capa para uso offline', error);
    }
  };

  if (!sources.length || failed) return fallback;

  return (
    <img
      src={cachedSource || sources[sourceIndex]}
      alt={alt}
      className={className}
      style={style}
      loading={loading}
      decoding="async"
      referrerPolicy="strict-origin-when-cross-origin"
      onLoad={event => {
        if (!cachedSource) cacheLoadedCover(event.currentTarget.currentSrc || sources[sourceIndex]);
        if (sourceIndex > 0) {
          console.info('[MangaShelf:image] Capa carregada por fallback', {
            title: alt || '(sem título)',
            originalUrl: src,
            loadedUrl: event.currentTarget.currentSrc || sources[sourceIndex],
            failedUrls: sources.slice(0, sourceIndex)
          });
        }
      }}
      onError={event => {
        if (cachedSource) {
          setCachedSource('');
          return;
        }
        const attemptedUrl = event.currentTarget.currentSrc || sources[sourceIndex];
        const nextUrl = sources[sourceIndex + 1] || null;
        console.warn('[MangaShelf:image] Falha ao carregar uma fonte de capa', {
          title: alt || '(sem título)',
          originalUrl: src,
          attemptedUrl,
          attempt: sourceIndex + 1,
          totalAttempts: sources.length,
          naturalWidth: event.currentTarget.naturalWidth,
          naturalHeight: event.currentTarget.naturalHeight,
          nextUrl
        });

        if (sourceIndex + 1 < sources.length) {
          setSourceIndex(index => index + 1);
        } else {
          console.error('[MangaShelf:image] Todas as fontes da capa falharam', {
            title: alt || '(sem título)',
            originalUrl: src,
            attemptedUrls: sources
          });
          setFailed(true);
          onError?.();
        }
      }}
    />
  );
};

export default CoverImage;
