const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("adminApp", {
  appName: "SNPSU Admin Desktop",
  version: "1.0.0",
  getDatabaseStatus: () => ipcRenderer.invoke("db:status"),
  ensureDatabaseSchema: () => ipcRenderer.invoke("db:ensure-schema"),
  loginAdmin: (payload) => ipcRenderer.invoke("admin:login", payload),
  logoutAdmin: () => ipcRenderer.invoke("admin:logout"),
  getAdminOverview: () => ipcRenderer.invoke("admin:overview"),
  getAdminSectionReport: (payload) => ipcRenderer.invoke("admin:section-report", payload),
  getAdminEditDataset: (payload) => ipcRenderer.invoke("admin:edit-dataset", payload),
  saveAdminSectionMeta: (payload) => ipcRenderer.invoke("admin:edit-section-meta", payload),
  saveAdminStudents: (payload) => ipcRenderer.invoke("admin:edit-students", payload),
  saveAdminAssignments: (payload) => ipcRenderer.invoke("admin:edit-assignments", payload),
  exportAdminReportPdf: (payload) => ipcRenderer.invoke("admin:export-pdf", payload)
});
