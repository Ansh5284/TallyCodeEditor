var electron = require('electron');
var app = electron.app;
var BrowserWindow = electron.BrowserWindow;
var path = require('path');

// isPackaged is true if the app is packaged.
// When running from source (e.g., with `electron .`), it's false.
var isDev = !app.isPackaged;

function createWindow() {
  var mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // Important for security: keep these settings
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
  });

  if (isDev) {
    // In development, load from the Vite dev server.
    // The `dev` script in package.json ensures this is running.
    mainWindow.loadURL('http://localhost:5173');
    // Open the DevTools automatically for debugging.
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the production-ready index.html
    // from the 'dist' folder created by Vite.
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(function() {
  createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  // Quit when all windows are closed, except on macOS.
  if (process.platform !== 'darwin') app.quit();
});