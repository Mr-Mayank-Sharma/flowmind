const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("flowmind", {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  openUrl: (url) => ipcRenderer.send("open-url", url),
  getAppPath: () => ipcRenderer.invoke("get-app-path"),
});
