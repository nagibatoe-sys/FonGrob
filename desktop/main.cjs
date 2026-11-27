const { app, BrowserWindow, ipcMain, Menu, nativeImage, safeStorage } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const DEFAULT_URL = 'https://fongrob.89-125-34-144.sslip.io'
const icon = path.join(__dirname, 'assets', 'icon.png')
let mainWindow
let settingsWindow
let settings
let connectionError = ''
const settingPath = () => path.join(app.getPath('userData'), 'settings.json')
const tokenPath = () => path.join(app.getPath('userData'), 'session.bin.json')
const isValidUrl = value => {
  try {
    const url = new URL(value)
    return url.username === '' && url.password === '' && url.pathname === '/' && !url.search && !url.hash &&
      (url.protocol === 'https:' || (!app.isPackaged && url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)))
  } catch { return false }
}
const defaults = () => ({ serverUrl: process.env.FONGROB_DESKTOP_URL || DEFAULT_URL, notificationsEnabled: true, windowBounds: { width: 1280, height: 800 } })
function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback } }
function writeJson(file, value) {
  const temporary = file + '.tmp'
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(temporary, JSON.stringify(value), { mode: 0o600 })
  fs.renameSync(temporary, file)
}
function loadSettings() {
  const saved = readJson(settingPath(), {})
  const merged = { ...defaults(), ...saved }
  if (!isValidUrl(merged.serverUrl)) merged.serverUrl = DEFAULT_URL
  if (typeof merged.notificationsEnabled !== 'boolean') merged.notificationsEnabled = true
  if (!merged.windowBounds || !Number.isInteger(merged.windowBounds.width) || !Number.isInteger(merged.windowBounds.height)) merged.windowBounds = defaults().windowBounds
  return merged
}
const serverOrigin = () => new URL(settings.serverUrl).origin
const isServerSender = event => { try { return new URL(event.senderFrame.url).origin === serverOrigin() } catch { return false } }
const isSettingsSender = event => event.senderFrame.url.startsWith('file://' + path.join(__dirname, 'settings.html'))
const isOfflineSender = event => event.senderFrame.url.startsWith('file://' + path.join(__dirname, 'offline.html'))
const validKey = key => typeof key === 'string' && /^sb-[a-zA-Z0-9._-]{1,120}-auth-token$/.test(key)
const tokens = () => readJson(tokenPath(), {})
function saveTokens(value) { writeJson(tokenPath(), value) }
function setupIpc() {
  ipcMain.handle('session:get', (event, key) => {
    if (!isServerSender(event) || !validKey(key) || !safeStorage.isEncryptionAvailable()) return null
    try { const encrypted = tokens()[key]; return encrypted ? safeStorage.decryptString(Buffer.from(encrypted, 'base64')) : null } catch { return null }
  })
  ipcMain.handle('session:set', (event, key, value) => {
    if (!isServerSender(event) || !validKey(key) || typeof value !== 'string' || value.length > 200000 || !safeStorage.isEncryptionAvailable()) return false
    const current = tokens(); current[key] = safeStorage.encryptString(value).toString('base64'); saveTokens(current); return true
  })
  ipcMain.handle('session:remove', (event, key) => {
    if (!isServerSender(event) || !validKey(key)) return false
    const current = tokens(); delete current[key]; saveTokens(current); return true
  })
  ipcMain.handle('settings:get', event => isSettingsSender(event) ? { serverUrl: settings.serverUrl, notificationsEnabled: settings.notificationsEnabled } : null)
  ipcMain.handle('settings:set', (event, value) => {
    if (!isSettingsSender(event) || !value || !isValidUrl(value.serverUrl) || typeof value.notificationsEnabled !== 'boolean') return { error: 'Укажите корректный HTTPS-адрес сервера.' }
    settings = { ...settings, serverUrl: value.serverUrl, notificationsEnabled: value.notificationsEnabled }
    writeJson(settingPath(), settings)
    loadServer()
    return { ok: true }
  })
  ipcMain.handle('offline:retry', event => { if (!isOfflineSender(event)) return false; loadServer(); return true })
  ipcMain.handle('offline:status', event => isOfflineSender(event) ? { serverUrl: settings.serverUrl, error: connectionError } : null)
  ipcMain.handle('offline:settings', event => { if (!isOfflineSender(event)) return false; openSettings(); return true })
}
function loadServer() { if (mainWindow) void mainWindow.loadURL(settings.serverUrl).catch(() => {}) }
function openSettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) { settingsWindow.focus(); return }
  settingsWindow = new BrowserWindow({ width: 480, height: 420, parent: mainWindow, modal: true, title: 'Настройки ФОНГРОБ', icon, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } })
  settingsWindow.setMenu(null)
  settingsWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  settingsWindow.loadFile(path.join(__dirname, 'settings.html'))
}
function createWindow() {
  const bounds = settings.windowBounds
  mainWindow = new BrowserWindow({ width: Math.max(800, bounds.width), height: Math.max(600, bounds.height), x: Number.isInteger(bounds.x) ? bounds.x : undefined, y: Number.isInteger(bounds.y) ? bounds.y : undefined, title: 'ФОНГРОБ', icon: nativeImage.createFromPath(icon), webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, partition: 'persist:fongrob' } })
  const allowed = url => { try { return new URL(url).origin === serverOrigin() } catch { return false } }
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, url) => { if (!allowed(url)) event.preventDefault() })
  mainWindow.webContents.on('did-fail-load', (event, code, description, url, isMainFrame) => {
    if (isMainFrame && code !== -3 && allowed(url)) {
      connectionError = `${description} (${code})`
      void mainWindow.loadFile(path.join(__dirname, 'offline.html'))
    }
  })
  mainWindow.webContents.session.setPermissionRequestHandler((contents, permission, callback) => callback(permission === 'notifications' && settings.notificationsEnabled && allowed(contents.getURL())))
  mainWindow.on('close', () => { settings.windowBounds = mainWindow.getBounds(); writeJson(settingPath(), settings) })
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: 'ФОНГРОБ', submenu: [{ label: 'Настройки', click: openSettings }, { label: 'Обновить', click: loadServer }, { role: 'quit', label: 'Выход' }] }, { label: 'Вид', submenu: [{ role: 'reload', label: 'Перезагрузить' }, { role: 'togglefullscreen', label: 'На весь экран' }] }]))
  loadServer()
}
app.whenReady().then(() => { settings = loadSettings(); setupIpc(); createWindow() })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
