const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mangaShelfDesktop', {
  getVersion: () => ipcRenderer.invoke('mangashelf:app-version'),
  checkForUpdates: () => ipcRenderer.invoke('mangashelf:check-updates'),
  installUpdate: () => ipcRenderer.invoke('mangashelf:install-update'),
  onUpdateStatus: callback => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('mangashelf:update-status', listener);
    return () => ipcRenderer.removeListener('mangashelf:update-status', listener);
  }
});
