import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { STORAGE_KEY, THEME_KEY, META_KEY } from '../utils/constants';
import {
  getStoredMainFileHandle,
  createLocalRecoveryPoint,
  readWorkingSnapshot,
  storeMainFileHandle,
  verifyMainFilePermission,
  writeMainFileHandle,
  writeWorkingSnapshot
} from '../utils/localPersistence';

const LibraryContext = createContext();
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const DRIVE_BACKUP_NAME = 'mangashelf-library.json';
const DRIVE_CLIENT_ID_KEY = 'mangashelf_google_drive_client_id';
const MAIN_FILE_SAVED_AT_KEY = 'mangashelf_main_file_saved_at';

const normalizeLegacyCover = cover => {
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

const getSavedDriveClientId = () => {
  try {
    return localStorage.getItem(DRIVE_CLIENT_ID_KEY) || import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  } catch {
    return import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  }
};

const getDriveIdentity = () => window.google?.accounts?.oauth2;

const fetchDriveJson = async (url, accessToken, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const responseText = await response.text();
    let message = `Google Drive respondeu HTTP ${response.status}.`;
    try {
      message = JSON.parse(responseText).error?.message || message;
    } catch {
      // Keep the HTTP message when the API response isn't JSON.
    }
    if (response.status === 401) throw new Error('A autorização do Google expirou. Conecte o Drive novamente.');
    throw new Error(message);
  }

  if (response.status === 204) return null;
  const responseType = response.headers.get('content-type') || '';
  return responseType.includes('application/json') ? response.json() : response.text();
};

export const LibraryProvider = ({ children }) => {
  const [library, setLibrary] = useState([]);
  const [meta, setMeta] = useState({ updatedAt: '', ownerId: '' });
  const [theme, setTheme] = useState(localStorage.getItem(THEME_KEY) || 'dark');
  const [driveClientId, setDriveClientId] = useState(getSavedDriveClientId);
  const [driveAccessToken, setDriveAccessToken] = useState('');
  const [driveTokenExpiresAt, setDriveTokenExpiresAt] = useState(0);
  const [driveIdentityReady, setDriveIdentityReady] = useState(Boolean(getDriveIdentity()));
  const [storageReady, setStorageReady] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState('');
  const [draftStorageMode, setDraftStorageMode] = useState('local');
  const [mainFileHandle, setMainFileHandle] = useState(null);
  const [mainFileName, setMainFileName] = useState('');
  const [mainFileSavedAt, setMainFileSavedAt] = useState(() => localStorage.getItem(MAIN_FILE_SAVED_AT_KEY) || '');
  const [savingMainFile, setSavingMainFile] = useState(false);
  const latestSnapshotRef = useRef(null);
  const mainFileHandleRef = useRef(null);
  const workingWriteQueueRef = useRef(Promise.resolve());
  const mainFileWriteQueueRef = useRef(Promise.resolve());
  const lastAutoSavedVersionRef = useRef('');

  useEffect(() => {
    localStorage.removeItem('mangashelf_supabase_config');
    Object.keys(localStorage)
      .filter(key => /^sb-.+-auth-token$/.test(key))
      .forEach(key => localStorage.removeItem(key));

    let cancelled = false;
    const loadLocalData = async () => {
      let savedLibrary = [];
      let savedMeta = { updatedAt: '' };
      try {
        const parsedLibrary = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        if (Array.isArray(parsedLibrary)) savedLibrary = parsedLibrary;
      } catch (error) {
        console.error('[MangaShelf:storage] Não foi possível ler a biblioteca local', error);
      }

      try {
        const parsedMeta = JSON.parse(localStorage.getItem(META_KEY) || '{}');
        if (parsedMeta && typeof parsedMeta === 'object' && !Array.isArray(parsedMeta)) {
          savedMeta = { ...parsedMeta };
          delete savedMeta.ownerId;
        }
      } catch (error) {
        console.error('[MangaShelf:storage] Não foi possível ler os metadados locais', error);
      }

      const [workingSnapshot, storedHandle] = await Promise.all([
        readWorkingSnapshot().catch(error => {
          console.warn('[MangaShelf:storage] Não foi possível recuperar o rascunho', error);
          return null;
        }),
        getStoredMainFileHandle().catch(error => {
          console.warn('[MangaShelf:storage] Não foi possível recuperar o arquivo principal', error);
          return null;
        })
      ]);
      const hasWorkingLibrary = Array.isArray(workingSnapshot?.library);

      if (cancelled) return;
      setLibrary(hasWorkingLibrary ? workingSnapshot.library : savedLibrary);
      setMeta(workingSnapshot?.meta && typeof workingSnapshot.meta === 'object' ? workingSnapshot.meta : savedMeta);
      setDraftSavedAt(workingSnapshot?.updatedAt || '');
      setDraftStorageMode(navigator.storage?.getDirectory ? 'opfs' : 'local');
      if (storedHandle) {
        setMainFileHandle(storedHandle);
        mainFileHandleRef.current = storedHandle;
        setMainFileName(storedHandle.name || 'MangaShelf.json');
      }
      setStorageReady(true);
    }
    loadLocalData();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    const updatedAt = new Date().toISOString();
    const snapshot = { app: 'MangaShelf', version: 1, updatedAt, library, meta };
    latestSnapshotRef.current = snapshot;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
      localStorage.setItem(META_KEY, JSON.stringify(meta));
    } catch (error) {
      console.error('[MangaShelf:storage] Não foi possível salvar a biblioteca local', error);
    }
    workingWriteQueueRef.current = workingWriteQueueRef.current
      .catch(() => {})
      .then(() => writeWorkingSnapshot(snapshot))
      .then(writtenToOpfs => {
        setDraftStorageMode(writtenToOpfs ? 'opfs' : 'local');
        setDraftSavedAt(updatedAt);
      })
      .catch(error => console.error('[MangaShelf:storage] Falha ao salvar o rascunho local', error));
  }, [library, meta, storageReady]);

  useEffect(() => {
    if (!storageReady) return undefined;
    const snapshot = latestSnapshotRef.current;
    const handle = mainFileHandleRef.current;
    if (!handle || !snapshot || snapshot.updatedAt === lastAutoSavedVersionRef.current) return undefined;

    const contents = JSON.stringify({
      app: 'MangaShelf',
      version: 1,
      updatedAt: snapshot.updatedAt,
      library: snapshot.library
    }, null, 2);
    mainFileWriteQueueRef.current = mainFileWriteQueueRef.current
      .catch(() => {})
      .then(async () => {
        // Keep the main file current during normal use when permission was already granted.
        if (await handle.queryPermission({ mode: 'readwrite' }) !== 'granted') return;
        await writeMainFileHandle(handle, contents, false);
        lastAutoSavedVersionRef.current = snapshot.updatedAt;
        setMainFileSavedAt(snapshot.updatedAt);
        localStorage.setItem(MAIN_FILE_SAVED_AT_KEY, snapshot.updatedAt);
      })
      .catch(error => console.warn('[MangaShelf:storage] Não foi possível atualizar o arquivo principal automaticamente', error));
    return undefined;
  }, [library, meta, storageReady]);

  useEffect(() => {
    if (!storageReady) return undefined;
    const autoSaveMainFile = () => {
      const handle = mainFileHandleRef.current;
      const snapshot = latestSnapshotRef.current;
      if (!handle || !snapshot || snapshot.updatedAt === lastAutoSavedVersionRef.current) return;
      const filePayload = JSON.stringify({
        app: 'MangaShelf',
        version: 1,
        updatedAt: snapshot.updatedAt,
        library: snapshot.library
      }, null, 2);
      mainFileWriteQueueRef.current = mainFileWriteQueueRef.current
        .catch(() => {})
        .then(() => writeMainFileHandle(handle, filePayload, false))
        .then(() => {
          lastAutoSavedVersionRef.current = snapshot.updatedAt;
          setMainFileSavedAt(snapshot.updatedAt);
          localStorage.setItem(MAIN_FILE_SAVED_AT_KEY, snapshot.updatedAt);
        })
        .catch(error => console.warn('[MangaShelf:storage] Salvamento automático do arquivo principal não foi concluído', error));
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') autoSaveMainFile();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', autoSaveMainFile);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', autoSaveMainFile);
    };
  }, [storageReady]);

  useEffect(() => {
    if (driveIdentityReady) return undefined;
    const interval = window.setInterval(() => {
      if (getDriveIdentity()) setDriveIdentityReady(true);
    }, 200);
    const timeout = window.setTimeout(() => window.clearInterval(interval), 15000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [driveIdentityReady]);

  useEffect(() => {
    if (!driveTokenExpiresAt) return undefined;
    const timeout = window.setTimeout(() => {
      setDriveAccessToken('');
      setDriveTokenExpiresAt(0);
    }, Math.max(0, driveTokenExpiresAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [driveTokenExpiresAt]);

  const saveMainFile = async () => {
    setSavingMainFile(true);
    try {
      const updatedAt = new Date().toISOString();
      const snapshot = { app: 'MangaShelf', version: 1, updatedAt, library, meta };
      const contents = JSON.stringify({ app: 'MangaShelf', version: 1, updatedAt, library }, null, 2);
      latestSnapshotRef.current = snapshot;
      await createLocalRecoveryPoint(snapshot).catch(error => {
        console.warn('[MangaShelf:storage] Não foi possível criar um ponto de restauração antes de salvar', error);
      });

      if (typeof window.showSaveFilePicker !== 'function') {
        const blobUrl = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = 'MangaShelf.json';
        link.click();
        URL.revokeObjectURL(blobUrl);
        setMainFileName('MangaShelf.json (download)');
        setMainFileSavedAt(updatedAt);
        return { fileName: 'MangaShelf.json', updatedAt, downloaded: true };
      }

      let handle = mainFileHandleRef.current;
      if (!handle) {
        handle = await window.showSaveFilePicker({
          suggestedName: 'MangaShelf.json',
          types: [{ description: 'Arquivo MangaShelf', accept: { 'application/json': ['.json'] } }]
        });
        await storeMainFileHandle(handle);
        mainFileHandleRef.current = handle;
        setMainFileHandle(handle);
        setMainFileName(handle.name);
      }

      await writeMainFileHandle(handle, contents, true);
      lastAutoSavedVersionRef.current = updatedAt;
      setMainFileSavedAt(updatedAt);
      setMainFileName(handle.name);
      localStorage.setItem(MAIN_FILE_SAVED_AT_KEY, updatedAt);
      return { fileName: handle.name, updatedAt, downloaded: false };
    } finally {
      setSavingMainFile(false);
    }
  };

  const restoreMainFile = async () => {
    let handle = mainFileHandleRef.current;
    if (!handle) {
      if (typeof window.showOpenFilePicker !== 'function') {
        throw new Error('Este navegador não permite abrir o arquivo principal diretamente. Use Importar backup JSON.');
      }
      [handle] = await window.showOpenFilePicker({
        multiple: false,
        mode: 'readwrite',
        types: [{ description: 'Backup MangaShelf', accept: { 'application/json': ['.json'] } }]
      });
      await storeMainFileHandle(handle);
      mainFileHandleRef.current = handle;
      setMainFileHandle(handle);
      setMainFileName(handle.name);
    }

    await verifyMainFilePermission(handle, true);
    const file = await handle.getFile();
    const backup = JSON.parse(await file.text());
    const restoredLibrary = Array.isArray(backup) ? backup : backup?.library;
    if (!Array.isArray(restoredLibrary) || restoredLibrary.some(manga => !manga || typeof manga.nome !== 'string')) {
      throw new Error('O arquivo principal está em formato inválido.');
    }
    await createLocalRecoveryPoint({ app: 'MangaShelf', version: 1, updatedAt: new Date().toISOString(), library, meta })
      .catch(error => console.warn('[MangaShelf:storage] Não foi possível criar um ponto de restauração antes de restaurar', error));
    setLibrary(restoredLibrary.map(manga => ({ ...manga, cover: normalizeLegacyCover(manga.cover) })));
    setMeta(previous => ({ ...previous, updatedAt: (!Array.isArray(backup) && backup.updatedAt) || '' }));
    setMainFileName(handle.name);
    setMainFileSavedAt((!Array.isArray(backup) && backup.updatedAt) || '');
    return { fileName: handle.name, count: restoredLibrary.length };
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
  };

  const updateDriveClientId = value => {
    const nextClientId = value.trim();
    setDriveClientId(nextClientId);
    localStorage.setItem(DRIVE_CLIENT_ID_KEY, nextClientId);
    setDriveAccessToken('');
    setDriveTokenExpiresAt(0);
  };

  const connectGoogleDrive = clientIdOverride => {
    const clientId = clientIdOverride?.trim() || driveClientId;
    if (!clientId) throw new Error('Informe o Client ID OAuth do Google antes de conectar o Drive.');
    const oauth = getDriveIdentity();
    if (!oauth) throw new Error('O serviço de login do Google ainda está carregando. Aguarde alguns segundos e tente novamente.');

    return new Promise((resolve, reject) => {
      const tokenClient = oauth.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPE,
        callback: response => {
          if (response.error || !response.access_token) {
            reject(new Error(response.error_description || response.error || 'O Google não autorizou o acesso ao Drive.'));
            return;
          }
          setDriveAccessToken(response.access_token);
          setDriveTokenExpiresAt(Date.now() + Number(response.expires_in || 3600) * 1000);
          resolve(true);
        },
        error_callback: error => reject(new Error(error?.message || 'A janela de autorização do Google foi bloqueada.'))
      });
      tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  };

  const disconnectGoogleDrive = () => {
    if (driveAccessToken) getDriveIdentity()?.revoke(driveAccessToken, () => {});
    setDriveAccessToken('');
    setDriveTokenExpiresAt(0);
  };

  const getValidDriveToken = () => {
    if (!driveAccessToken || driveTokenExpiresAt <= Date.now() + 15000) {
      setDriveAccessToken('');
      setDriveTokenExpiresAt(0);
      throw new Error('Conecte o Google Drive novamente para continuar.');
    }
    return driveAccessToken;
  };

  const findDriveBackup = async accessToken => {
    const params = new URLSearchParams({
      spaces: 'appDataFolder',
      q: `name='${DRIVE_BACKUP_NAME}' and trashed=false`,
      pageSize: '10',
      fields: 'files(id,name,modifiedTime)'
    });
    const data = await fetchDriveJson(`${DRIVE_FILES_URL}?${params}`, accessToken);
    return (data.files || []).sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime))[0] || null;
  };

  const saveToDrive = async () => {
    const accessToken = getValidDriveToken();
    const existingFile = await findDriveBackup(accessToken);
    const updatedAt = new Date().toISOString();
    const payload = JSON.stringify({ app: 'MangaShelf', version: 1, updatedAt, library });
    const boundary = `mangashelf_${Date.now()}`;
    const metadata = existingFile
      ? { name: DRIVE_BACKUP_NAME }
      : { name: DRIVE_BACKUP_NAME, mimeType: 'application/json', parents: ['appDataFolder'] };
    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify(metadata),
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      payload,
      `--${boundary}--`,
      ''
    ].join('\r\n');
    const uploadUrl = existingFile
      ? `${DRIVE_UPLOAD_URL}/${encodeURIComponent(existingFile.id)}?uploadType=multipart`
      : `${DRIVE_UPLOAD_URL}?uploadType=multipart`;
    const savedFile = await fetchDriveJson(uploadUrl, accessToken, {
      method: existingFile ? 'PATCH' : 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body
    });
    setMeta(previous => ({ ...previous, updatedAt, driveBackupAt: updatedAt, driveFileId: savedFile.id }));
    return { updatedAt, file: savedFile };
  };

  const loadFromDrive = async () => {
    const accessToken = getValidDriveToken();
    const backupFile = await findDriveBackup(accessToken);
    if (!backupFile) return null;

    const params = new URLSearchParams({ alt: 'media' });
    const backup = await fetchDriveJson(`${DRIVE_FILES_URL}/${encodeURIComponent(backupFile.id)}?${params}`, accessToken);
    if (!backup || !Array.isArray(backup.library) || backup.library.some(manga => !manga || typeof manga.nome !== 'string')) {
      throw new Error('O arquivo de backup do Google Drive está em formato inválido.');
    }

    await createLocalRecoveryPoint({ app: 'MangaShelf', version: 1, updatedAt: new Date().toISOString(), library, meta })
      .catch(error => console.warn('[MangaShelf:storage] Não foi possível criar um ponto de restauração antes de carregar o Drive', error));

    setLibrary(backup.library);
    setMeta(previous => ({
      ...previous,
      updatedAt: backup.updatedAt || backupFile.modifiedTime || '',
      driveBackupAt: backup.updatedAt || backupFile.modifiedTime || '',
      driveFileId: backupFile.id
    }));
    return { updatedAt: backup.updatedAt || backupFile.modifiedTime, count: backup.library.length };
  };

  return (
    <LibraryContext.Provider value={{
      library, setLibrary,
      meta, setMeta,
      theme, setTheme, toggleTheme,
      driveClientId, updateDriveClientId,
      driveConnected: Boolean(driveAccessToken && driveTokenExpiresAt > Date.now()),
      driveIdentityReady,
      connectGoogleDrive, disconnectGoogleDrive,
      saveToDrive, loadFromDrive,
      storageReady, draftSavedAt, draftStorageMode,
      mainFileName, mainFileSavedAt, savingMainFile,
      saveMainFile, restoreMainFile,
      mainFileSupported: typeof window.showSaveFilePicker === 'function'
    }}>
      <div data-theme={theme}>{children}</div>
    </LibraryContext.Provider>
  );
};

export const useLibrary = () => useContext(LibraryContext);
