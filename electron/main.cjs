const { app, BrowserWindow, shell, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const APP_HOST = '127.0.0.1';
const APP_PORT = 4173;
let mainWindow = null;
let isManualUpdateCheck = false;
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const sendJsonError = (response, status, message) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify({ error: message }));
};

const readRequestBody = request => new Promise((resolve, reject) => {
  const chunks = [];
  request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => resolve(Buffer.concat(chunks)));
  request.on('error', reject);
});

const proxyApiRequest = async (request, response, requestUrl) => {
  let targetUrl;
  let upstreamHeaders = {};

  if (requestUrl.pathname.startsWith('/api-mangadex-covers/')) {
    const resourcePath = requestUrl.pathname.slice('/api-mangadex-covers'.length);
    if (!/^\/covers\/[0-9a-f-]+\/[^/]+$/i.test(resourcePath)) {
      sendJsonError(response, 400, 'Caminho de capa inválido.');
      return;
    }
    targetUrl = `https://uploads.mangadex.org${resourcePath}${requestUrl.search}`;
  } else if (requestUrl.pathname.startsWith('/api-mangadex/')) {
    targetUrl = `https://api.mangadex.org${requestUrl.pathname.slice('/api-mangadex'.length)}${requestUrl.search}`;
    upstreamHeaders['User-Agent'] = 'MangaShelfApp/1.0';
  } else if (requestUrl.pathname.startsWith('/api-jikan/')) {
    targetUrl = `https://api.jikan.moe/v4${requestUrl.pathname.slice('/api-jikan'.length)}${requestUrl.search}`;
  } else if (requestUrl.pathname === '/api-anilist') {
    targetUrl = 'https://graphql.anilist.co';
  } else {
    return false;
  }

  try {
    const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await readRequestBody(request);
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers: {
        ...upstreamHeaders,
        ...(request.headers['content-type'] ? { 'Content-Type': request.headers['content-type'] } : {})
      },
      body
    });
    const responseBody = Buffer.from(await upstream.arrayBuffer());
    response.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
      'Cache-Control': upstream.headers.get('cache-control') || 'no-store'
    });
    response.end(responseBody);
  } catch (error) {
    console.error('[MangaShelf:desktop-proxy] Falha na solicitação externa', error);
    sendJsonError(response, 502, 'Não foi possível acessar o serviço externo.');
  }
  return true;
};

const startLocalServer = () => new Promise((resolve, reject) => {
  const rendererDirectory = path.join(__dirname, '..', 'dist');
  const server = http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url || '/', `http://${APP_HOST}:${APP_PORT}`);
    if (await proxyApiRequest(request, response, requestUrl)) return;

    let pathname;
    try {
      pathname = decodeURIComponent(requestUrl.pathname);
    } catch {
      response.writeHead(400);
      response.end('Invalid path');
      return;
    }
    const safePath = path.resolve(rendererDirectory, `.${pathname}`);
    if (safePath !== rendererDirectory && !safePath.startsWith(`${rendererDirectory}${path.sep}`)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    let filePath = safePath;
    try {
      if ((await fs.promises.stat(filePath)).isDirectory()) filePath = path.join(filePath, 'index.html');
      const contents = await fs.promises.readFile(filePath);
      response.writeHead(200, {
        'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff'
      });
      response.end(contents);
    } catch {
      try {
        const indexHtml = await fs.promises.readFile(path.join(rendererDirectory, 'index.html'));
        response.writeHead(200, { 'Content-Type': MIME_TYPES['.html'] });
        response.end(indexHtml);
      } catch {
        sendJsonError(response, 503, 'A interface ainda não foi compilada. Execute npm run build.');
      }
    }
  });

  server.once('error', reject);
  server.listen(APP_PORT, APP_HOST, () => resolve(server));
});

const createWindow = async () => {
  let appServer = null;
  const isDev = process.argv.includes('--dev');
  if (!isDev) appServer = await startLocalServer();

  const window = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 760,
    minHeight: 600,
    backgroundColor: '#111014',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow = window;

  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    await window.loadURL('http://127.0.0.1:5173');
    window.webContents.openDevTools({ mode: 'detach' });
  } else {
    await window.loadURL(`http://${APP_HOST}:${APP_PORT}`);
  }

  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null;
    appServer?.close();
  });

  if (app.isPackaged) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('checking-for-update', () => {
      if (isManualUpdateCheck) sendUpdateStatus({ state: 'checking' });
    });
    autoUpdater.on('update-available', info => sendUpdateStatus({ state: 'available', version: info.version }));
    autoUpdater.on('update-not-available', info => {
      if (isManualUpdateCheck) sendUpdateStatus({ state: 'up-to-date', version: info.version });
    });
    autoUpdater.on('download-progress', progress => sendUpdateStatus({ state: 'downloading', percent: Math.round(progress.percent) }));
    autoUpdater.on('update-downloaded', info => sendUpdateStatus({ state: 'downloaded', version: info.version }));
    autoUpdater.on('error', error => {
      console.warn('[MangaShelf:update] Falha ao verificar ou baixar atualização', error);
      if (isManualUpdateCheck) sendUpdateStatus({ state: 'error', message: error.message });
    });
    setTimeout(() => autoUpdater.checkForUpdates().catch(error => {
      console.warn('[MangaShelf:update] Não foi possível consultar o GitHub Releases', error);
    }), 6000);
  }
};

const sendUpdateStatus = status => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('mangashelf:update-status', status);
};

ipcMain.handle('mangashelf:app-version', () => app.getVersion());
ipcMain.handle('mangashelf:check-updates', async () => {
  if (!app.isPackaged) return { state: 'development' };
  isManualUpdateCheck = true;
  try {
    await autoUpdater.checkForUpdates();
    return { state: 'checking' };
  } finally {
    setTimeout(() => { isManualUpdateCheck = false; }, 30000);
  }
});
ipcMain.handle('mangashelf:install-update', () => {
  if (app.isPackaged) autoUpdater.quitAndInstall();
});

app.whenReady().then(createWindow).catch(error => {
  console.error('[MangaShelf:desktop] Não foi possível iniciar o aplicativo', error);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
