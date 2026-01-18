const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  openFile: () => ipcRenderer.invoke("open-file"),
  saveFileAs: (data) => ipcRenderer.invoke("save-file-as", data),
  saveFile: (path, data) => ipcRenderer.invoke("save-file", { path, data }),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),

  // ✅ restore tabs
  readFileByPath: (path) => ipcRenderer.invoke("read-file-by-path", path),

  // ✅ close workflow
  quitApp: () => ipcRenderer.invoke("app:quit"),
  onCloseRequested: (cb) => {
    ipcRenderer.removeAllListeners("app:close-requested");
    ipcRenderer.on("app:close-requested", cb);
  }
});
