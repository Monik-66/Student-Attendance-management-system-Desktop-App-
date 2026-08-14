const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("teacherApp", {
  appName: "SNPSU Teacher Desktop",
  version: "1.0.0",
  getDatabaseStatus: () => ipcRenderer.invoke("db:status"),
  ensureDatabaseSchema: () => ipcRenderer.invoke("db:ensure-schema"),
  loginTeacher: (payload) => ipcRenderer.invoke("teacher:login", payload),
  logoutTeacher: () => ipcRenderer.invoke("teacher:logout"),
  syncOfflineAttendance: (payload) => ipcRenderer.invoke("teacher:sync-offline", payload),
  getSectionSummary: (payload) => ipcRenderer.invoke("attendance:section-summary", payload),
  getSectionAnalytics: (payload) => ipcRenderer.invoke("sections:analytics", payload),
  getAvailableDates: (payload) => ipcRenderer.invoke("attendance:available-dates", payload),
  loadSectionAttendance: (payload) => ipcRenderer.invoke("attendance:load-section", payload),
  saveAttendanceDate: (payload) => ipcRenderer.invoke("attendance:save-date", payload),
  resetAttendanceDate: (payload) => ipcRenderer.invoke("attendance:reset-date", payload),
  openExternal: (target) => ipcRenderer.invoke("system:open-external", target),
  sendAbsenteeSms: (payload) => ipcRenderer.invoke("messaging:send-absentees-sms", payload)
});
