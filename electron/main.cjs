const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const fs = require("fs");
const path = require("path");

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1450,
    height: 920,
    backgroundColor: "#0b0f1a",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.removeMenu();

  // Безопасно запрещаем window.open внутрь приложения
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  const isDev = !app.isPackaged;

  if (isDev) {
    // DEV: грузим vite сервер (это НЕ "сайт", просто dev-режим)
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    // PROD: грузим локальный файл (чистый EXE, без localhost)
    const indexHtml = path.join(__dirname, "..", "dist", "index.html");
    win.loadFile(indexHtml);
  }
}

app.whenReady().then(createWindow);

ipcMain.handle("open-file", async () => {
  const { filePaths } = await dialog.showOpenDialog({
    filters: [{ name: "Connections", extensions: ["connections"] }],
    properties: ["openFile"]
  });

  if (!filePaths || !filePaths[0]) return null;

  const p = filePaths[0];
  const data = fs.readFileSync(p, "utf-8");
  return { path: p, data };
});

ipcMain.handle("save-file-as", async (_, data) => {
  const { filePath } = await dialog.showSaveDialog({
    filters: [{ name: "Connections", extensions: ["connections"] }]
  });

  if (!filePath) return null;
  fs.writeFileSync(filePath, data, "utf-8");
  return filePath;
});

ipcMain.handle("save-file", async (_, payload) => {
  const { path: p, data } = payload || {};
  if (!p) return false;
  fs.writeFileSync(p, data, "utf-8");
  return true;
});

ipcMain.handle("open-external", async (_, url) => {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    await shell.openExternal(url);
    return true;
  } catch {
    return false;
  }
});
