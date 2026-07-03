// Study Notes — Electron shell.
//
// Production: forks the bundled Next.js standalone server (resources/app-server)
// on a free localhost port and points the window at it. All data lives in the
// per-user app-data folder (STUDY_NOTES_DATA_DIR), so the app works fully
// offline and user files survive app updates.
//
// Dev: `npm run electron:dev` starts `next dev` itself and sets
// STUDY_NOTES_DEV_URL; the shell just opens that URL (repo-local data/).
const { app, BrowserWindow, Menu, shell, utilityProcess } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("node:path");
const fs = require("node:fs");
const net = require("node:net");
const http = require("node:http");

app.setName("Study Notes");

const DEV_URL = process.env.STUDY_NOTES_DEV_URL || null;
const DATA_DIR = path.join(app.getPath("userData"), "data");
const BOUNDS_PATH = path.join(app.getPath("userData"), "window-bounds.json");

let mainWindow = null;
let serverProc = null;

// ── Local server (production) ────────────────────────────────────────────────
// The port must be STABLE across launches: the window's localStorage (which
// holds the Supabase session) is keyed to the origin 127.0.0.1:<port>, so a
// random port would sign the user out on every relaunch. Fall back to a
// random port only if something else occupies the stable one.
const STABLE_PORT = 48653;

const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", () => {
      const fallback = net.createServer();
      fallback.listen(0, "127.0.0.1", () => {
        const { port } = fallback.address();
        console.warn(`[shell] port ${STABLE_PORT} busy — using ${port} (session may reset)`);
        fallback.close(() => resolve(port));
      });
      fallback.on("error", reject);
    });
    srv.listen(STABLE_PORT, "127.0.0.1", () => {
      srv.close(() => resolve(STABLE_PORT));
    });
  });

const waitForServer = (url, timeoutMs = 15000) =>
  new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - started > timeoutMs) reject(new Error("server did not start"));
        else setTimeout(tick, 150);
      });
    };
    tick();
  });

// Runtime env bundled with the server (.env.local — Anthropic key etc.).
// Parsed here and injected into the fork explicitly, so it works regardless
// of whether the standalone server loads env files itself.
function bundledEnv(serverDir) {
  const env = {};
  try {
    const raw = fs.readFileSync(path.join(serverDir, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2];
    }
  } catch {
    // no bundled env — fine
  }
  return env;
}

async function startServer() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const serverDir = path.join(process.resourcesPath, "app-server");
  const port = await freePort();
  serverProc = utilityProcess.fork(path.join(serverDir, "server.js"), [], {
    cwd: serverDir,
    stdio: "pipe",
    env: {
      ...bundledEnv(serverDir),
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      STUDY_NOTES_DATA_DIR: DATA_DIR,
    },
  });
  serverProc.stdout?.on("data", (d) => console.log("[server]", String(d).trim()));
  serverProc.stderr?.on("data", (d) => console.error("[server]", String(d).trim()));
  const url = `http://127.0.0.1:${port}`;
  await waitForServer(url);
  console.log("[shell] server ready at", url, "data:", DATA_DIR);
  return url;
}

// ── Window ───────────────────────────────────────────────────────────────────
function loadBounds() {
  try {
    const b = JSON.parse(fs.readFileSync(BOUNDS_PATH, "utf8"));
    if (typeof b.width === "number" && typeof b.height === "number") return b;
  } catch {
    // first run — defaults below
  }
  return { width: 1320, height: 880 };
}

function createWindow(url) {
  const bounds = loadBounds();
  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 900,
    minHeight: 600,
    title: "Study Notes",
    backgroundColor: "#e6e8eb", // matches --frame so launch doesn't flash white
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  mainWindow.loadURL(url);
  mainWindow.once("ready-to-show", () => mainWindow.show());

  const persist = () => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMinimized()) return;
    try {
      fs.writeFileSync(BOUNDS_PATH, JSON.stringify(mainWindow.getBounds()));
    } catch {
      // bounds persistence is best-effort
    }
  };
  mainWindow.on("resize", persist);
  mainWindow.on("move", persist);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // external links (if any) open in the real browser, never in-app
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (e, target) => {
    if (!target.startsWith(url) && !DEV_URL) {
      e.preventDefault();
      shell.openExternal(target);
    }
  });
}

// ── App menu — adds a "Open Data Folder" escape hatch ────────────────────────
function buildMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        {
          label: "Open Data Folder",
          click: () => shell.openPath(DEV_URL ? path.join(process.cwd(), "data") : DATA_DIR),
        },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    buildMenu();
    // Auto-update from GitHub Releases: check on launch, download in the
    // background, install on quit. Never blocks startup; offline is a no-op.
    if (!DEV_URL) {
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        console.warn("[updater]", err?.message ?? err);
      });
    }
    try {
      const url = DEV_URL ?? (await startServer());
      createWindow(url);
      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow(url);
      });
    } catch (err) {
      console.error("[shell] failed to start:", err);
      app.quit();
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("quit", () => {
    serverProc?.kill();
  });
}
