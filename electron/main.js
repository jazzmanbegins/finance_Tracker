const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let mongod;

// Must be set before mongodb-memory-server is imported
const userDataPath = app.getPath('userData');
if (app.isPackaged) {
  process.env.MONGOMS_SYSTEM_BINARY = path.join(process.resourcesPath, 'mongodb-bin', 'mongod.exe');
} else {
  process.env.MONGOMS_DOWNLOAD_DIR = path.join(userDataPath, 'mongodb-binaries');
}

const { ParseServer } = require('parse-server');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');

const APP_ID     = 'finance-app';
const MASTER_KEY = 'master-key-local';
const PORT       = 1337;

async function startServer() {
  const dataDir = path.join(userDataPath, '.data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  mongod = await MongoMemoryServer.create({
    instance: { dbPath: dataDir, storageEngine: 'wiredTiger' },
  });

  const cloudPath = app.isPackaged
    ? path.join(process.resourcesPath, 'cloud', 'main.js')
    : path.join(__dirname, '..', 'cloud', 'main.js');

  const publicPath = app.isPackaged
    ? path.join(process.resourcesPath, 'public')
    : path.join(__dirname, '..', 'public');

  const api = new ParseServer({
    databaseURI: mongod.getUri(),
    appId: APP_ID,
    masterKey: MASTER_KEY,
    serverURL: `http://localhost:${PORT}/parse`,
    cloud: cloudPath,
    allowClientClassCreation: true,
    enforcePrivateUsers: false,
    encodeParseObjectInCloudFunction: true,
  });

  await api.start();

  const expressApp = express();
  expressApp.use('/parse', api.app);
  expressApp.use(express.static(publicPath));

  expressApp.post('/shutdown', (_req, res) => {
    res.json({ ok: true });
    setTimeout(() => app.quit(), 400);
  });

  await new Promise((resolve) => expressApp.listen(PORT, resolve));
}

function createWindow() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'icon.ico')
    : path.join(__dirname, '..', 'assets', 'icon.ico');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    icon: iconPath,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
    title: 'Finance Tracker',
    show: false,
    backgroundColor: '#0d1117',
  });

  mainWindow.setMenuBarVisibility(false);

  const loadingPath = app.isPackaged
    ? path.join(process.resourcesPath, 'loading.html')
    : path.join(__dirname, '..', 'loading.html');

  mainWindow.loadFile(loadingPath);
  mainWindow.once('ready-to-show', () => mainWindow.show());

  startServer()
    .then(() => mainWindow.loadURL(`http://localhost:${PORT}`))
    .catch((err) => console.error('Server start failed:', err));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => app.quit());

app.on('will-quit', async (event) => {
  if (mongod) {
    event.preventDefault();
    await mongod.stop().catch(() => {});
    app.exit(0);
  }
});
