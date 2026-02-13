const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('caliAPI', {
  queryCali: (text) => ipcRenderer.invoke('cali-query', text),
  stopCore: (coreName) => ipcRenderer.invoke('cali-stop-core', coreName),
  restartCore: (coreName) => ipcRenderer.invoke('cali-restart-core', coreName),
  stopAll: () => ipcRenderer.invoke('cali-stop-all'),
  getSystemStatus: () => ipcRenderer.invoke('cali-get-status'),
  getLogs: (limit) => ipcRenderer.invoke('cali-get-logs', limit),
  onCoreStatus: (callback) => ipcRenderer.on('core-status', (_e, data) => callback(data)),
  onCaliLog: (callback) => ipcRenderer.on('cali-log', (_e, data) => callback(data)),
  onSystemStatus: (callback) => ipcRenderer.on('system-status', (_e, data) => callback(data)),
  onAppShutdown: (callback) => ipcRenderer.on('app-shutdown', callback),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
