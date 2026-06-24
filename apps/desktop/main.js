const { app, BrowserWindow, Menu, Tray, nativeImage, dialog, shell } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");

// ── Config ──────────────────────────────────────────────────────────
const WEB_PORT = 3100;
const API_PORT = 3101;
const RUNTIME_PORT = 8101;
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const WEB_STANDALONE = path.resolve(__dirname, "../../web/.next/standalone");
const API_DIR = path.resolve(__dirname, "../../api");
const RUNTIME_DIR = path.resolve(__dirname, "../../../packages/agent-runtime");
const DEV_MODE = !app.isPackaged;

// ── State ───────────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;
let apiProcess = null;
let runtimeProcess = null;
let webProcess = null;
let isQuitting = false;

// ── Helpers ─────────────────────────────────────────────────────────
function log(msg) {
  console.log(`[FlowMind] ${msg}`);
}

function waitForServer(host, port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function check() {
      const req = http.get(`http://${host}:${port}/`, (res) => {
        res.resume();
        resolve(true);
      });
      req.on("error", () => {
        if (Date.now() - start > timeout) {
          reject(new Error(`Server on ${host}:${port} not ready after ${timeout}ms`));
        } else {
          setTimeout(check, 500);
        }
      });
      req.end();
    }
    check();
  });
}

function killProcess(proc, name) {
  if (proc && !proc.killed) {
    try {
      proc.kill("SIGTERM");
      log(`${name} stopped`);
    } catch (e) {
      log(`Error stopping ${name}: ${e.message}`);
    }
  }
}

// ── Start Services ───────────────────────────────────────────────────
async function startServices() {
  const env = {
    ...process.env,
    PORT: String(WEB_PORT),
    AGENT_RUNTIME_URL: `http://127.0.0.1:${RUNTIME_PORT}`,
    DATABASE_URL: process.env.DATABASE_URL || "postgresql://flowmind:flowmind@localhost:5432/flowmind",
  };

  if (DEV_MODE) {
    // ── Start API ──────────────────────────────────────────────────
    log("Starting API server (dev)...");
    apiProcess = spawn("pnpm", ["--filter", "@flowmind/api", "dev"], {
      cwd: PROJECT_ROOT,
      env: { ...env, PORT: String(API_PORT) },
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });
    apiProcess.stdout.on("data", (d) => process.stdout.write(`[API] ${d}`));
    apiProcess.stderr.on("data", (d) => process.stderr.write(`[API] ${d}`));
    apiProcess.on("exit", (code) => log(`API exited with code ${code}`));

    // ── Start Python Runtime ───────────────────────────────────────
    log("Starting Agent Runtime...");
    runtimeProcess = spawn("python3", [
      "-m", "uvicorn", "src.main:app",
      "--host", "127.0.0.1",
      "--port", String(RUNTIME_PORT),
    ], {
      cwd: RUNTIME_DIR,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });
    runtimeProcess.stdout.on("data", (d) => process.stdout.write(`[Runtime] ${d}`));
    runtimeProcess.stderr.on("data", (d) => process.stderr.write(`[Runtime] ${d}`));
    runtimeProcess.on("exit", (code) => log(`Runtime exited with code ${code}`));

    // ── Start Web ──────────────────────────────────────────────────
    log("Starting Web UI (dev)...");
    webProcess = spawn("pnpm", ["--filter", "@flowmind/web", "dev", "--port", String(WEB_PORT)], {
      cwd: PROJECT_ROOT,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });
    webProcess.stdout.on("data", (d) => process.stdout.write(`[Web] ${d}`));
    webProcess.stderr.on("data", (d) => process.stderr.write(`[Web] ${d}`));
    webProcess.on("exit", (code) => log(`Web exited with code ${code}`));
  } else {
    // Production: use standalone Next.js
    log("Starting Web UI (production)...");
    webProcess = spawn("node", ["server.js"], {
      cwd: WEB_STANDALONE,
      env: { ...env, PORT: String(WEB_PORT) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    webProcess.stdout.on("data", (d) => process.stdout.write(`[Web] ${d}`));
    webProcess.stderr.on("data", (d) => process.stderr.write(`[Web] ${d}`));
  }

  // Wait for web to be ready
  log("Waiting for Web UI...");
  try {
    await waitForServer("127.0.0.1", WEB_PORT);
    log("Web UI ready!");
  } catch (e) {
    log(`Web UI failed: ${e.message}`);
    dialog.showErrorBox("FlowMind", `Failed to start the Web UI:\n${e.message}`);
  }
}

// ── Create Window ───────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "FlowMind AI OS",
    icon: path.join(__dirname, "public", "icon.svg"),
    backgroundColor: "#0a0a0b",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${WEB_PORT}`);

  // ── Application Menu ─────────────────────────────────────────────
  const menuTemplate = [
    {
      label: "FlowMind",
      submenu: [
        {
          label: "About FlowMind",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "About FlowMind AI OS",
              message: "FlowMind AI OS v0.1.0",
              detail: "The open-source AI Operating System.\nManage local and cloud AI models, build agents and pipelines.\n\nServers:\n  Web UI:     http://127.0.0.1:" + WEB_PORT + "\n  API:        http://127.0.0.1:" + API_PORT + "\n  Runtime:    http://127.0.0.1:" + RUNTIME_PORT,
            });
          },
        },
        { type: "separator" },
        {
          label: "Settings",
          accelerator: "CmdOrCtrl+,",
          click: () => mainWindow.loadURL(`http://127.0.0.1:${WEB_PORT}/settings`),
        },
        { type: "separator" },
        {
          label: "Quit FlowMind",
          accelerator: "CmdOrCtrl+Q",
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        {
          label: "Dashboard",
          accelerator: "CmdOrCtrl+1",
          click: () => mainWindow.loadURL(`http://127.0.0.1:${WEB_PORT}/home`),
        },
        {
          label: "Models",
          accelerator: "CmdOrCtrl+2",
          click: () => mainWindow.loadURL(`http://127.0.0.1:${WEB_PORT}/models`),
        },
        {
          label: "Chat",
          accelerator: "CmdOrCtrl+3",
          click: () => mainWindow.loadURL(`http://127.0.0.1:${WEB_PORT}/chat`),
        },
        {
          label: "Pipelines",
          accelerator: "CmdOrCtrl+4",
          click: () => mainWindow.loadURL(`http://127.0.0.1:${WEB_PORT}/pipelines`),
        },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Documentation",
          accelerator: "F1",
          click: () => mainWindow.loadURL(`http://127.0.0.1:${WEB_PORT}/docs`),
        },
        {
          label: "Open Terminal",
          accelerator: "CmdOrCtrl+T",
          click: () => {
            shell.openPath("/");
          },
        },
      ],
    },
  ];

  if (process.platform === "darwin") {
    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
  } else {
    mainWindow.setMenu(Menu.buildFromTemplate(menuTemplate));
  }

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── System Tray ─────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, "public", "icon.svg");
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip("FlowMind AI OS");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open FlowMind",
      click: () => {
        if (mainWindow) mainWindow.show();
        else createWindow();
      },
    },
    { type: "separator" },
    {
      label: "Dashboard",
      click: () => mainWindow && mainWindow.loadURL(`http://127.0.0.1:${WEB_PORT}/home`),
    },
    {
      label: "Models",
      click: () => mainWindow && mainWindow.loadURL(`http://127.0.0.1:${WEB_PORT}/models`),
    },
    {
      label: "Chat",
      click: () => mainWindow && mainWindow.loadURL(`http://127.0.0.1:${WEB_PORT}/chat`),
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });
}

// ── App Lifecycle ───────────────────────────────────────────────────
app.whenReady().then(async () => {
  await startServices();
  createWindow();
  createTray();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // Don't quit - keep running in tray
  }
});

app.on("activate", () => {
  if (mainWindow) mainWindow.show();
  else createWindow();
});

app.on("before-quit", () => {
  isQuitting = true;
  killProcess(apiProcess, "API");
  killProcess(runtimeProcess, "Runtime");
  killProcess(webProcess, "Web");
});
