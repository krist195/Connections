const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  openFile: () => ipcRenderer.invoke("open-file"),
  saveFileAs: (data) => ipcRenderer.invoke("save-file-as", data),
  saveFile: (path, data) => ipcRenderer.invoke("save-file", { path, data }),
  openExternal: (url) => ipcRenderer.invoke("open-external", url)
});
