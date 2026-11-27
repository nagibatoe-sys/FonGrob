const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('fongrobDesktop', {
  storage: {
    getItem: key => ipcRenderer.invoke('session:get', key),
    setItem: (key, value) => ipcRenderer.invoke('session:set', key, value),
    removeItem: key => ipcRenderer.invoke('session:remove', key)
  },
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: value => ipcRenderer.invoke('settings:set', value),
  retry: () => ipcRenderer.invoke('offline:retry'),
  getConnectionStatus: () => ipcRenderer.invoke('offline:status'),
  openSettings: () => ipcRenderer.invoke('offline:settings')
})
