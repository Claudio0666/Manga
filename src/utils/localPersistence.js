const WORKING_FILE_NAME = 'mangashelf-working.json';
const HANDLE_DB_NAME = 'mangashelf-file-handles';
const HANDLE_STORE_NAME = 'files';
const MAIN_FILE_HANDLE_KEY = 'main-file';
const RECOVERY_DIRECTORY_NAME = 'mangashelf-recovery-points';
const RECOVERY_FALLBACK_KEY = 'mangashelf_recovery_points';
const MAX_RECOVERY_POINTS = 20;

let handleDbPromise;

const openHandleDb = () => {
  if (handleDbPromise) return handleDbPromise;
  handleDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(HANDLE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(HANDLE_STORE_NAME)) {
        request.result.createObjectStore(HANDLE_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Não foi possível abrir o armazenamento de arquivos.'));
  });
  return handleDbPromise;
};

export const storeMainFileHandle = async handle => {
  const db = await openHandleDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(HANDLE_STORE_NAME, 'readwrite');
    transaction.objectStore(HANDLE_STORE_NAME).put(handle, MAIN_FILE_HANDLE_KEY);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('Não foi possível lembrar o arquivo principal.'));
  });
};

export const getStoredMainFileHandle = async () => {
  const db = await openHandleDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(HANDLE_STORE_NAME, 'readonly');
    const request = transaction.objectStore(HANDLE_STORE_NAME).get(MAIN_FILE_HANDLE_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Não foi possível recuperar o arquivo principal.'));
  });
};

export const readWorkingSnapshot = async () => {
  if (!navigator.storage?.getDirectory) return null;
  try {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(WORKING_FILE_NAME);
    const file = await handle.getFile();
    return JSON.parse(await file.text());
  } catch (error) {
    if (error?.name !== 'NotFoundError') console.warn('[MangaShelf:storage] Não foi possível ler o rascunho OPFS', error);
    return null;
  }
};

export const writeWorkingSnapshot = async snapshot => {
  if (!navigator.storage?.getDirectory) return false;
  const root = await navigator.storage.getDirectory();
  const handle = await root.getFileHandle(WORKING_FILE_NAME, { create: true });
  const writable = await handle.createWritable();
  try {
    await writable.write(JSON.stringify(snapshot));
    await writable.close();
    return true;
  } catch (error) {
    await writable.abort?.();
    throw error;
  }
};

export const createLocalRecoveryPoint = async snapshot => {
  const updatedAt = snapshot.updatedAt || new Date().toISOString();
  const recoverySnapshot = { ...snapshot, app: 'MangaShelf', version: 1, updatedAt };
  const safeTimestamp = updatedAt.replace(/[:.]/g, '-');
  const id = `mangashelf-backup-${safeTimestamp}.json`;

  if (navigator.storage?.getDirectory) {
    const root = await navigator.storage.getDirectory();
    const directory = await root.getDirectoryHandle(RECOVERY_DIRECTORY_NAME, { create: true });
    const fileHandle = await directory.getFileHandle(id, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(recoverySnapshot));
    await writable.close();

    const names = [];
    for await (const [name, entry] of directory.entries()) {
      if (entry.kind === 'file' && name.startsWith('mangashelf-backup-') && name.endsWith('.json')) names.push(name);
    }
    names.sort().reverse();
    await Promise.all(names.slice(MAX_RECOVERY_POINTS).map(name => directory.removeEntry(name)));
    return { id, updatedAt, libraryCount: recoverySnapshot.library?.length || 0 };
  }

  const existing = JSON.parse(localStorage.getItem(RECOVERY_FALLBACK_KEY) || '[]');
  const points = [
    { id, updatedAt, snapshot: recoverySnapshot },
    ...(Array.isArray(existing) ? existing.filter(point => point?.id !== id) : [])
  ].slice(0, 5);
  localStorage.setItem(RECOVERY_FALLBACK_KEY, JSON.stringify(points));
  return { id, updatedAt, libraryCount: recoverySnapshot.library?.length || 0 };
};

export const listLocalRecoveryPoints = async () => {
  if (navigator.storage?.getDirectory) {
    try {
      const root = await navigator.storage.getDirectory();
      const directory = await root.getDirectoryHandle(RECOVERY_DIRECTORY_NAME);
      const points = [];
      for await (const [id, entry] of directory.entries()) {
        if (entry.kind !== 'file' || !/^mangashelf-backup-[\dTZ-]+\.json$/.test(id)) continue;
        const file = await entry.getFile();
        try {
          const snapshot = JSON.parse(await file.text());
          points.push({ id, updatedAt: snapshot.updatedAt || file.lastModified, libraryCount: snapshot.library?.length || 0 });
        } catch (error) {
          console.warn('[MangaShelf:storage] Ponto de restauração inválido', id, error);
        }
      }
      return points.sort((a, b) => b.id.localeCompare(a.id));
    } catch (error) {
      if (error?.name !== 'NotFoundError') console.warn('[MangaShelf:storage] Não foi possível listar os pontos de restauração', error);
    }
  }

  try {
    return JSON.parse(localStorage.getItem(RECOVERY_FALLBACK_KEY) || '[]').map(({ id, updatedAt, snapshot }) => ({
      id,
      updatedAt,
      libraryCount: snapshot?.library?.length || 0
    }));
  } catch {
    return [];
  }
};

export const readLocalRecoveryPoint = async id => {
  if (!/^mangashelf-backup-[\dTZ-]+\.json$/.test(id || '')) throw new Error('Ponto de restauração inválido.');
  if (navigator.storage?.getDirectory) {
    const root = await navigator.storage.getDirectory();
    const directory = await root.getDirectoryHandle(RECOVERY_DIRECTORY_NAME);
    const fileHandle = await directory.getFileHandle(id);
    return JSON.parse(await (await fileHandle.getFile()).text());
  }

  const points = JSON.parse(localStorage.getItem(RECOVERY_FALLBACK_KEY) || '[]');
  const point = points.find(item => item.id === id);
  if (!point) throw new Error('Este ponto de restauração não está mais disponível.');
  return point.snapshot;
};

export const verifyMainFilePermission = async (handle, allowPrompt = true) => {
  const options = { mode: 'readwrite' };
  let permission = await handle.queryPermission(options);
  if (permission !== 'granted' && allowPrompt) permission = await handle.requestPermission(options);
  if (permission !== 'granted') throw new Error('O navegador precisa de permissão para gravar no arquivo principal. Clique em Salvar para autorizar novamente.');
};

export const writeMainFileHandle = async (handle, contents, allowPrompt = true) => {
  await verifyMainFilePermission(handle, allowPrompt);
  const writable = await handle.createWritable();
  try {
    await writable.write(contents);
    await writable.close();
  } catch (error) {
    await writable.abort?.();
    throw error;
  }
};
