const appState = {
  loadingScreen: document.getElementById("loading-screen"),
  loginScreen: document.getElementById("login-screen"),
  dashboardScreen: document.getElementById("dashboard-screen"),
  sectionsScreen: document.getElementById("sections-screen"),
  attendancePageScreen: document.getElementById("attendance-page-screen"),
  loginForm: document.getElementById("login-form"),
  loginMessage: document.getElementById("login-message"),
  teacherName: document.getElementById("teacher-name"),
  teacherMeta: document.getElementById("teacher-meta"),
  welcomeTitle: document.getElementById("welcome-title"),
  heroCopy: document.getElementById("hero-copy"),
  dashboardSubjectSelect: document.getElementById("dashboard-subject-select"),
  todayClassesCount: document.getElementById("today-classes-count"),
  todaySummary: document.getElementById("today-summary"),
  sectionCount: document.getElementById("section-count"),
  attendanceRate: document.getElementById("attendance-rate"),
  pendingCount: document.getElementById("pending-count"),
  sectionCards: document.getElementById("section-cards"),
  registerTitle: document.getElementById("register-title"),
  registerSummary: document.getElementById("register-summary"),
  activeSectionHeading: document.getElementById("active-section-heading"),
  activeSectionSubtitle: document.getElementById("active-section-subtitle"),
  sectionSwitcher: document.getElementById("section-switcher"),
  attendanceOverview: document.getElementById("attendance-overview"),
  openAttendancePageBtn: document.getElementById("open-attendance-page-btn"),
  logoutBtn: document.getElementById("logout-btn"),
  markAttendanceBtn: document.getElementById("mark-attendance-btn"),
  dashboardNavBtn: document.getElementById("dashboard-nav-btn"),
  mySectionsNavBtn: document.getElementById("my-sections-nav-btn"),
  attendanceNavBtn: document.getElementById("attendance-nav-btn"),
  sectionsDashboardNavBtn: document.getElementById("sections-dashboard-nav-btn"),
  sectionsMySectionsNavBtn: document.getElementById("sections-my-sections-nav-btn"),
  sectionsAttendanceNavBtn: document.getElementById("sections-attendance-nav-btn"),
  sectionsTeacherName: document.getElementById("sections-teacher-name"),
  sectionsTeacherMeta: document.getElementById("sections-teacher-meta"),
  sectionsRiskCount: document.getElementById("sections-risk-count"),
  sectionsRiskNote: document.getElementById("sections-risk-note"),
  sectionsAnalysisCopy: document.getElementById("sections-analysis-copy"),
  sectionsSubjectSelect: document.getElementById("sections-subject-select"),
  refreshSectionsAnalysisBtn: document.getElementById("refresh-sections-analysis-btn"),
  sectionsBackDashboardBtn: document.getElementById("sections-back-dashboard-btn"),
  analysisSectionCount: document.getElementById("analysis-section-count"),
  analysisAverageRate: document.getElementById("analysis-average-rate"),
  analysisLowCount: document.getElementById("analysis-low-count"),
  sectionsAnalysisGrid: document.getElementById("sections-analysis-grid"),
  attendancePageTitle: document.getElementById("attendance-page-title"),
  attendancePageSubtitle: document.getElementById("attendance-page-subtitle"),
  attendanceSubjectSelect: document.getElementById("attendance-subject-select"),
  attendanceTableHeading: document.getElementById("attendance-table-heading"),
  attendanceTableSummary: document.getElementById("attendance-table-summary"),
  attendanceTableHead: document.getElementById("attendance-table-head"),
  attendanceTableBody: document.getElementById("attendance-table-body"),
  backToDashboardBtn: document.getElementById("back-to-dashboard-btn"),
  saveAttendancePageBtn: document.getElementById("save-attendance-page-btn"),
  attendanceDatePicker: document.getElementById("attendance-date-picker"),
  loadDateBtn: document.getElementById("load-date-btn"),
  deleteDateBtn: document.getElementById("delete-date-btn"),
  dateModeNote: document.getElementById("date-mode-note"),
  dbNote: document.getElementById("db-note"),
  absenteeModal: document.getElementById("absentee-modal"),
  absenteeModalTitle: document.getElementById("absentee-modal-title"),
  absenteeModalSubtitle: document.getElementById("absentee-modal-subtitle"),
  absenteeModalSummary: document.getElementById("absentee-modal-summary"),
  absenteeModalBody: document.getElementById("absentee-modal-body"),
  absenteeModalCloseBtn: document.getElementById("absentee-modal-close-btn"),
  absenteeSendSmsBtn: document.getElementById("absentee-send-sms-btn"),
  absenteeCallBtn: document.getElementById("absentee-call-btn")
};

let currentTeacher = null;
let activeSectionCode = null;
let activeSubjectCode = null;
let dbReady = false;
let dbSyncInFlight = false;
let dbSyncPromise = null;
let attendancePageLoadPromise = null;
let sectionAnalyticsPromise = null;
let offlineSyncIntervalId = null;
let attendanceSubmitInFlight = false;
let selectedIsoDate = getTodayIsoDate();
let loadedAttendanceIsoDate = null;
let unlockedDateKey = null;
let pendingStatuses = new Map();
let absenteeModalState = null;

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function getDisplaySubject(account) {
  const assignment = getCurrentSubjectAssignment(account);
  return assignment?.courseName || account?.courseName || account?.subject || "";
}

function getSubjectCode(account) {
  const assignment = getCurrentSubjectAssignment(account);
  return assignment?.courseShortCode || assignment?.subjectCode || account?.courseShortCode || account?.subjectCode || account?.subject || "";
}

function getCurrentSubjectAssignment(account = currentTeacher) {
  if (!account) {
    return null;
  }

  const assignments = Array.isArray(account.subjectAssignments) ? account.subjectAssignments : [];
  if (!assignments.length) {
    return null;
  }

  const requestedCode = activeSubjectCode || account.courseShortCode || account.subjectCode || account.subject;
  return assignments.find((assignment) => assignment.courseShortCode === requestedCode || assignment.subjectCode === requestedCode) || assignments[0];
}

function getSubjectSections(account = currentTeacher, subjectCode = getSubjectCode(account)) {
  return (account?.sections || []).filter((section) => (section.subjectCodes || []).includes(subjectCode));
}

function getSectionData(section, subjectCode = getSubjectCode(currentTeacher)) {
  return section?.subjects?.[subjectCode] || {
    students: [],
    availableDates: [],
    summary: null,
    studentsLoaded: false
  };
}

function shouldShowBatchColumn(section = getActiveSection(), account = currentTeacher) {
  const assignment = getCurrentSubjectAssignment(account);
  if (!assignment) {
    return false;
  }

  const sectionCode = section?.code || activeSectionCode || "";
  const sectionBatches = assignment.sectionBatches?.[sectionCode] || [];
  return sectionBatches.length > 0 || (assignment.batchLabels || []).length > 0;
}

function listSubjectLabels(assignment) {
  return assignment?.courseShortCode || "";
}

function renderSubjectSelectors() {
  const assignmentList = Array.isArray(currentTeacher?.subjectAssignments) ? currentTeacher.subjectAssignments : [];
  const optionsMarkup = assignmentList
    .map((assignment) => {
      const selected = assignment.courseShortCode === getSubjectCode(currentTeacher) ? "selected" : "";
      return `<option value="${escapeHtml(assignment.courseShortCode)}" ${selected}>${escapeHtml(listSubjectLabels(assignment))}</option>`;
    })
    .join("");

  [
    appState.dashboardSubjectSelect,
    appState.sectionsSubjectSelect,
    appState.attendanceSubjectSelect
  ].forEach((select) => {
    if (!select) {
      return;
    }

    select.innerHTML = optionsMarkup;
    select.disabled = assignmentList.length <= 1;
  });
}

function setActiveSubject(subjectCode, options = {}) {
  if (!currentTeacher) {
    return;
  }

  activeSubjectCode = subjectCode || getSubjectCode(currentTeacher);
  const availableSections = getSubjectSections(currentTeacher, activeSubjectCode);
  activeSectionCode = availableSections.some((section) => section.code === activeSectionCode)
    ? activeSectionCode
    : availableSections[0]?.code || null;

  loadedAttendanceIsoDate = null;
  unlockedDateKey = null;
  pendingStatuses.clear();
  renderSubjectSelectors();
  paintDashboard(currentTeacher);

  if (!options.skipReload) {
    if (!appState.sectionsScreen.classList.contains("hidden")) {
      void openSectionsAnalysis();
    }
    if (!appState.attendancePageScreen.classList.contains("hidden")) {
      void refreshActiveSectionData().then(() => renderAttendancePage());
    }
  }
}

function buildTeacherSections(teacherPayload) {
  const assignments = Array.isArray(teacherPayload?.subjectAssignments) ? teacherPayload.subjectAssignments : [];
  const existingSections = new Map(
    (teacherPayload?.sections || [])
      .filter((section) => section && typeof section === "object")
      .map((section) => [section.code || section.sectionCode, section])
  );
  const sectionMap = new Map();

  for (const assignment of assignments) {
    for (const sectionCode of assignment.sections || []) {
      const existingSection = existingSections.get(sectionCode);
      const existingSubjectState = existingSection?.subjects?.[assignment.courseShortCode] || {};
      const section = sectionMap.get(sectionCode) || {
        code: sectionCode,
        subjectCodes: [],
        subjects: {}
      };

      if (!section.subjectCodes.includes(assignment.courseShortCode)) {
        section.subjectCodes.push(assignment.courseShortCode);
      }

      section.subjects[assignment.courseShortCode] = {
        students: existingSubjectState.students || [],
        availableDates: existingSubjectState.availableDates || [],
        summary: existingSubjectState.summary || null,
        studentsLoaded: Boolean(existingSubjectState.studentsLoaded)
      };

      sectionMap.set(sectionCode, section);
    }
  }

  if (!sectionMap.size) {
    for (const sectionCode of teacherPayload?.sections || []) {
      if (typeof sectionCode !== "string") {
        continue;
      }
      sectionMap.set(sectionCode, {
        code: sectionCode,
        subjectCodes: [teacherPayload.courseShortCode || teacherPayload.subjectCode || teacherPayload.subject || ""].filter(Boolean),
        subjects: {}
      });
    }
  }

  return [...sectionMap.values()].sort((left, right) => left.code.localeCompare(right.code));
}

function formatIsoDateToLabel(isoDate) {
  if (!isoDate) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${isoDate}T00:00:00`));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatPhoneNumber(phoneNumber) {
  return String(phoneNumber || "").trim();
}

function buildSmsQueue(absentees, sectionCode, attendanceDate) {
  const dateLabel = formatIsoDateToLabel(attendanceDate);
  const subjectLabel = getDisplaySubject(currentTeacher);

  return absentees.map((student, index) => ({
    serialNo: index + 1,
    srn: student.srn,
    name: student.name,
    phone: formatPhoneNumber(student.parentPhoneNo),
    message: `Dear Parent, your ward ${student.name} (${student.srn}) was absent for ${subjectLabel} in section ${sectionCode} on ${dateLabel}. Please contact the class teacher if needed.`
  }));
}

function buildCallQueue(absentees, sectionCode, attendanceDate) {
  const dateLabel = formatIsoDateToLabel(attendanceDate);
  const subjectLabel = getDisplaySubject(currentTeacher);

  return absentees.map((student, index) => ({
    serialNo: index + 1,
    srn: student.srn,
    name: student.name,
    phone: formatPhoneNumber(student.parentPhoneNo),
    script: `Call parent of ${student.name} (${student.srn}), ${student.gender || "student"}, from section ${sectionCode}. Inform them the student was absent for ${subjectLabel} on ${dateLabel} and ask if there is any update.`
  }));
}

async function copyTextToClipboard(text) {
  if (!navigator.clipboard?.writeText) {
    throw new Error("Clipboard access is unavailable in this environment.");
  }

  await navigator.clipboard.writeText(text);
}

function closeAbsenteeModal() {
  absenteeModalState = null;
  document.body.style.overflow = "";
  appState.absenteeModal.classList.add("hidden");
  appState.absenteeModal.setAttribute("aria-hidden", "true");
}

function openAbsenteeModal({ sectionCode, attendanceDate, absentees }) {
  absenteeModalState = {
    sectionCode,
    attendanceDate,
    absentees: Array.isArray(absentees) ? absentees : []
  };

  renderAbsenteeModal();
  document.body.style.overflow = "hidden";
  appState.absenteeModal.classList.remove("hidden");
  appState.absenteeModal.setAttribute("aria-hidden", "false");
}

function renderAbsenteeModal() {
  const modalState = absenteeModalState || {
    sectionCode: activeSectionCode || "",
    attendanceDate: loadedAttendanceIsoDate || selectedIsoDate,
    absentees: []
  };
  const absentees = modalState.absentees || [];
  const dateLabel = formatIsoDateToLabel(modalState.attendanceDate);

  appState.absenteeModalTitle.textContent = absentees.length
    ? "Recently Submitted Absentees"
    : "Attendance Submitted Successfully";
  appState.absenteeModalSubtitle.textContent = absentees.length
    ? `${modalState.sectionCode} | ${getDisplaySubject(currentTeacher)} | ${dateLabel}`
    : `${modalState.sectionCode} has no absentees for ${dateLabel}.`;
  appState.absenteeModalSummary.innerHTML = `
    <div class="absentee-summary-pill">
      <span>Section</span>
      <strong>${escapeHtml(modalState.sectionCode || "-")}</strong>
    </div>
    <div class="absentee-summary-pill">
      <span>Subject</span>
      <strong>${escapeHtml(getDisplaySubject(currentTeacher) || "-")}</strong>
    </div>
    <div class="absentee-summary-pill">
      <span>Absent Count</span>
      <strong>${absentees.length}</strong>
    </div>
    <div class="absentee-summary-pill">
      <span>Date</span>
      <strong>${escapeHtml(dateLabel || "-")}</strong>
    </div>
  `;

  appState.absenteeModalBody.innerHTML = absentees.length
    ? absentees
        .map(
          (student, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(student.srn)}</td>
              <td>${escapeHtml(student.name)}</td>
              <td>${escapeHtml(formatPhoneNumber(student.parentPhoneNo) || "Not available")}</td>
              <td>${escapeHtml(student.gender || "-")}</td>
              <td>${escapeHtml(student.attendanceDate || modalState.attendanceDate)}</td>
            </tr>
          `
        )
        .join("")
    : `
      <tr>
        <td colspan="6" class="absentee-empty">No students were marked absent for this submission.</td>
      </tr>
    `;

  appState.absenteeSendSmsBtn.disabled = absentees.length === 0;
  appState.absenteeCallBtn.disabled = absentees.length === 0;
}

async function handleAbsenteeSms() {
  if (!absenteeModalState?.absentees?.length) {
    return;
  }

  const originalLabel = appState.absenteeSendSmsBtn.textContent;
  appState.absenteeSendSmsBtn.disabled = true;
  appState.absenteeSendSmsBtn.textContent = "Sending...";

  try {
    const response = await window.teacherApp.sendAbsenteeSms({
      absentees: absenteeModalState.absentees,
      sectionCode: absenteeModalState.sectionCode,
      attendanceDate: absenteeModalState.attendanceDate,
      subjectName: getDisplaySubject(currentTeacher)
    });

    if (!response.ok) {
      throw new Error(response.message || "SMS sending failed.");
    }

    const failedItems = (response.results || []).filter((entry) => !entry.ok);
    if (failedItems.length) {
      const failedSummary = failedItems
        .slice(0, 3)
        .map((entry) => `${entry.name}: ${entry.error}`)
        .join(" | ");

      appState.todaySummary.textContent = `SMS sent to ${response.sentCount} parent${response.sentCount === 1 ? "" : "s"}, failed for ${response.failedCount}. ${failedSummary}`;
      return;
    }

    appState.todaySummary.textContent = `SMS sent successfully to ${response.sentCount} parent${response.sentCount === 1 ? "" : "s"} via Ozeki.`;
  } finally {
    appState.absenteeSendSmsBtn.disabled = false;
    appState.absenteeSendSmsBtn.textContent = originalLabel;
  }
}

async function handleAbsenteeCall() {
  if (!absenteeModalState?.absentees?.length) {
    return;
  }

  const callQueue = buildCallQueue(
    absenteeModalState.absentees,
    absenteeModalState.sectionCode,
    absenteeModalState.attendanceDate
  );
  const callText = callQueue
    .map((entry) => `${entry.serialNo}. ${entry.name} (${entry.srn}) | ${entry.phone || "No phone"} | ${entry.script}`)
    .join("\n");

  await copyTextToClipboard(callText);

  const firstCallable = callQueue.find((entry) => entry.phone);
  if (firstCallable && window.teacherApp?.openExternal) {
    await window.teacherApp.openExternal(`tel:${encodeURIComponent(firstCallable.phone)}`);
  }

  appState.todaySummary.textContent = firstCallable
    ? `AI call notes copied. Opened calling action for ${firstCallable.name}.`
    : "AI call notes copied. No parent phone number was available to start a call.";
}

function showScreen(screenName) {
  appState.loadingScreen.classList.add("hidden");
  appState.loginScreen.classList.add("hidden");
  appState.dashboardScreen.classList.add("hidden");
  appState.sectionsScreen.classList.add("hidden");
  appState.attendancePageScreen.classList.add("hidden");
  closeAbsenteeModal();
  appState[screenName].classList.remove("hidden");

  if (screenName === "attendancePageScreen") {
    stopOfflineSyncLoop();
  } else if (currentTeacher) {
    startOfflineSyncLoop();
  }
}

function getActiveSection() {
  const section = currentTeacher?.sections.find((entry) => entry.code === activeSectionCode) || null;
  return section ? { ...section, ...getSectionData(section) } : null;
}

function getDateColumns(section) {
  const dates = new Set((section.availableDates || []).map((entry) => entry.isoDate));

  for (const student of section.students || []) {
    Object.keys(student.attendanceHistory || {}).forEach((isoDate) => dates.add(isoDate));
  }

  if (loadedAttendanceIsoDate) {
    dates.add(loadedAttendanceIsoDate);
  }

  return [...dates].sort((left, right) => left.localeCompare(right));
}

function getEffectiveStatus(student, isoDate) {
  if (pendingStatuses.has(`${student.srn}|${isoDate}`)) {
    return pendingStatuses.get(`${student.srn}|${isoDate}`);
  }

  return student.attendanceHistory?.[isoDate] || null;
}

function getTotalPresent(student) {
  const sectionDates = getDateColumns(getActiveSection());
  const pendingPresentDelta = sectionDates.reduce((count, isoDate) => {
    const pendingStatus = pendingStatuses.get(`${student.srn}|${isoDate}`);
    const storedStatus = student.attendanceHistory?.[isoDate] || null;

    if (!pendingStatus || pendingStatus === storedStatus) {
      return count;
    }

    if (pendingStatus === "P" && storedStatus !== "P") {
      return count + 1;
    }

    if (pendingStatus !== "P" && storedStatus === "P") {
      return count - 1;
    }

    return count;
  }, 0);

  return Math.max(0, (student.totalPresent || 0) + pendingPresentDelta);
}

function getSectionTotals(section, isoDate) {
  const presentCount = (section.students || []).filter((student) => getEffectiveStatus(student, isoDate) === "P").length;
  const absentCount = (section.students || []).filter((student) => getEffectiveStatus(student, isoDate) === "A").length;
  return { presentCount, absentCount };
}

function renderSectionCards(account) {
  appState.sectionCards.innerHTML = getSubjectSections(account)
    .map((section) => {
      const sectionState = { ...section, ...getSectionData(section, getSubjectCode(account)) };
      const { presentCount, absentCount } = getSectionTotals(sectionState, selectedIsoDate);
      return `
        <div class="section-card">
          <div class="section-card__top">
            <div>
              <strong>${getDisplaySubject(account)}</strong>
              <p>${section.code} | ${account.semester}</p>
            </div>
            <span class="section-badge">${presentCount}/${sectionState.students.length} present</span>
          </div>
          <div class="section-meta">
            <span>${sectionState.students.length} students</span>
            <span>${presentCount} present</span>
            <span>${absentCount} absent</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderSectionTabs() {
  appState.sectionSwitcher.innerHTML = getSubjectSections(currentTeacher)
    .map(
      (section) => `
        <button class="section-tab ${section.code === activeSectionCode ? "active" : ""}" data-section-code="${section.code}">
          ${section.code}
        </button>
      `
    )
    .join("");
}

function renderOverview() {
  const section = getActiveSection();

  if (!section) {
    appState.attendanceOverview.innerHTML = "";
    return;
  }

  const activeDate = loadedAttendanceIsoDate || selectedIsoDate;
  const { presentCount, absentCount } = getSectionTotals(section, activeDate);
  const selectedLabel = loadedAttendanceIsoDate ? formatIsoDateToLabel(loadedAttendanceIsoDate) : "No date loaded";

  appState.registerTitle.textContent = `${getDisplaySubject(currentTeacher)} | ${section.code}`;
  appState.registerSummary.textContent = `Present ${presentCount} | Absent ${absentCount}`;
  appState.activeSectionHeading.textContent = `Section ${section.code} overview`;
  appState.activeSectionSubtitle.textContent = currentTeacher.offlineMode
    ? `Showing cached ${getDisplaySubject(currentTeacher)} attendance details for ${section.students.length} students in ${currentTeacher.semester}.`
    : `Showing ${getDisplaySubject(currentTeacher)} attendance details from PostgreSQL for ${section.students.length} students in ${currentTeacher.semester}.`;
  appState.dbNote.textContent = currentTeacher.offlineMode
    ? "You are viewing cached PostgreSQL data. Any attendance submitted while offline is stored on this laptop and synced later."
    : "Sections, teacher subject mappings, students, and attendance now come from PostgreSQL. Add data to sections, teacher_subject_assignments, students, and attendance to keep the app in sync.";

  appState.attendanceOverview.innerHTML = `
    <div class="overview-card">
      <div class="student-meta">
        <strong>Section strength</strong>
        <p>Total students mapped to ${section.code}</p>
      </div>
      <div class="student-roll">${section.students.length} students</div>
      <div class="student-roll">${presentCount} present</div>
      <div class="student-roll">${absentCount} absent</div>
    </div>
    <div class="overview-card">
      <div class="student-meta">
        <strong>Selected date</strong>
        <p>Submit creates or updates only the chosen date column.</p>
      </div>
      <div class="student-roll">${selectedLabel}</div>
      <div class="student-roll">${getDisplaySubject(currentTeacher)}</div>
      <div class="student-roll">${currentTeacher.offlineMode ? "Offline cache active" : dbReady ? "PostgreSQL connected" : "Database unavailable"}</div>
    </div>
    <div class="overview-card">
      <div class="student-meta">
        <strong>Section mapping</strong>
        <p>Teacher access is controlled by the teacher subject assignments stored in PostgreSQL.</p>
      </div>
      <div class="student-roll">${currentTeacher.teacherId}</div>
      <div class="student-roll">${getSubjectSections(currentTeacher).length} assigned sections</div>
      <div class="student-roll">${section.availableDates.length} stored dates</div>
    </div>
  `;
}

function formatPercentage(value) {
  return value === null || value === undefined ? "No data" : `${Math.round(Number(value))}%`;
}

function renderLowAttendanceRows(students) {
  if (!students.length) {
    return `
      <div class="low-attendance-empty">
        No students below 75% in this section.
      </div>
    `;
  }

  return `
    <div class="low-attendance-list">
      ${students
        .map(
          (student) => `
            <div class="risk-student-row">
              <div>
                <strong>${student.name}</strong>
                <p>${student.srn}</p>
              </div>
              <div class="risk-student-metrics">
                <span>${student.presentCount}/${student.totalClasses} present</span>
                <strong>${formatPercentage(student.attendancePercentage)}</strong>
              </div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function escapeCsvValue(value) {
  const normalized = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function downloadTextFile(filename, content, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function exportSectionAttendanceCsv(sectionCode) {
  if (!currentTeacher || !sectionCode) {
    return;
  }

  const [studentsResponse, datesResponse] = await Promise.all([
    window.teacherApp.loadSectionAttendance({
      sectionCode,
      subjectCode: getSubjectCode(currentTeacher)
    }),
    window.teacherApp.getAvailableDates({
      sectionCode,
      subjectCode: getSubjectCode(currentTeacher)
    })
  ]);

  if (!studentsResponse.ok || !datesResponse.ok) {
    throw new Error("Could not load section attendance for CSV export.");
  }

  const students = studentsResponse.students || [];
  const dateColumns = (datesResponse.dates || [])
    .map((entry) => entry.isoDate)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));

  const header = [
    "Section Code",
    "Subject Code",
    "Subject Name",
    "Student SRN",
    "Student Name",
    ...dateColumns,
    "Present Count",
    "Absent Count",
    "Total Classes",
    "Attendance Percentage"
  ];

  const rows = students.map((student) => {
    const attendanceHistory = student.attendanceHistory || {};
    const presentCount = dateColumns.filter((isoDate) => attendanceHistory[isoDate] === "P").length;
    const absentCount = dateColumns.filter((isoDate) => attendanceHistory[isoDate] === "A").length;
    const totalClasses = dateColumns.length;
    const attendancePercentage = totalClasses === 0 ? "" : ((presentCount / totalClasses) * 100).toFixed(2);

    return [
      sectionCode,
      getSubjectCode(currentTeacher),
      getDisplaySubject(currentTeacher),
      student.srn,
      student.name,
      ...dateColumns.map((isoDate) => attendanceHistory[isoDate] || ""),
      presentCount,
      absentCount,
      totalClasses,
      attendancePercentage
    ];
  });

  const csv = [header, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join("\n");
  const filename = `${sectionCode}_${getSubjectCode(currentTeacher)}_attendance.csv`;
  downloadTextFile(filename, csv, "text/csv;charset=utf-8");
}

function renderSectionAnalytics(sections, options = {}) {
  const offline = Boolean(options.offline);
  const lowAttendanceCount = sections.reduce((count, section) => count + (section.low_attendance_count || 0), 0);
  const sectionsWithAverage = sections.filter((section) => section.average_percentage !== null && section.average_percentage !== undefined);
  const averageRate = sectionsWithAverage.length
    ? sectionsWithAverage.reduce((sum, section) => sum + Number(section.average_percentage || 0), 0) / sectionsWithAverage.length
    : null;

  appState.sectionsTeacherName.textContent = currentTeacher?.name || "Faculty";
  appState.sectionsTeacherMeta.textContent = `${currentTeacher?.teacherId || ""} | ${getDisplaySubject(currentTeacher)}`;
  appState.sectionsRiskCount.textContent = `${lowAttendanceCount} student${lowAttendanceCount === 1 ? "" : "s"}`;
  appState.sectionsRiskNote.textContent = offline
    ? "Showing cached offline analysis. It will refresh from PostgreSQL when online."
    : "Calculated from PostgreSQL attendance records for this subject.";
  appState.sectionsAnalysisCopy.textContent = offline
    ? `Offline view for ${getDisplaySubject(currentTeacher)}. Cached attendance is used until sync is available.`
    : `Live PostgreSQL analysis for ${getDisplaySubject(currentTeacher)} across assigned sections.`;
  appState.analysisSectionCount.textContent = String(sections.length);
  appState.analysisAverageRate.textContent = formatPercentage(averageRate);
  appState.analysisLowCount.textContent = String(lowAttendanceCount);

  if (!sections.length) {
    appState.sectionsAnalysisGrid.innerHTML = `
      <article class="panel sections-empty-panel">
        <h3>No assigned sections found</h3>
        <p class="subtle">Add rows to teacher subject assignments for this faculty account, then refresh the dashboard.</p>
      </article>
    `;
    return;
  }

  appState.sectionsAnalysisGrid.innerHTML = sections
    .map(
      (section) => `
        <article class="panel section-analysis-card">
          <div class="panel-head">
            <div>
              <p class="card-label">${section.total_classes || 0} attendance date${section.total_classes === 1 ? "" : "s"}</p>
              <h3>${section.section_code}</h3>
            </div>
            <span class="status-pill ${section.low_attendance_count > 0 ? "danger-pill" : ""}">
              ${section.low_attendance_count || 0} below 75%
            </span>
          </div>

          <div class="analysis-metrics-row">
            <div>
              <span>Students</span>
              <strong>${section.student_count || 0}</strong>
            </div>
            <div>
              <span>Average</span>
              <strong>${formatPercentage(section.average_percentage)}</strong>
            </div>
            <div>
              <span>Risk</span>
              <strong>${section.low_attendance_count || 0}</strong>
            </div>
          </div>

          <div class="risk-list-header">
            <strong>Students below 75%</strong>
            <span>${getDisplaySubject(currentTeacher)}</span>
          </div>

          ${renderLowAttendanceRows(section.low_attendance_students || [])}

          <div class="section-analysis-actions">
            <button class="secondary-page-btn section-download-btn" type="button" data-section-code="${section.section_code}">
              Download Section CSV
            </button>
          </div>
        </article>
      `
    )
    .join("");
}

async function openSectionsAnalysis() {
  if (!currentTeacher) {
    return;
  }

  showScreen("sectionsScreen");
  appState.sectionsAnalysisGrid.innerHTML = `
    <article class="panel">
      <p class="subtle">Loading section analytics from PostgreSQL...</p>
    </article>
  `;

  if (sectionAnalyticsPromise) {
    return sectionAnalyticsPromise;
  }

  sectionAnalyticsPromise = (async () => {
    try {
      await syncCurrentTeacherFromDatabase();
      const sectionCodes = getSubjectSections(currentTeacher).map((section) => section.code);
      const response = await window.teacherApp.getSectionAnalytics({
        sectionCodes,
        subjectCode: getSubjectCode(currentTeacher)
      });

      renderSectionAnalytics(response.sections || [], { offline: response.offline });
      appState.todaySummary.textContent = response.offline
        ? "Section analytics is using cached offline attendance."
        : "Section analytics refreshed from PostgreSQL.";
    } catch (error) {
      appState.sectionsAnalysisGrid.innerHTML = `
        <article class="panel sections-empty-panel">
          <h3>Could not load section analytics</h3>
          <p class="subtle">${error.message}</p>
        </article>
      `;
    } finally {
      sectionAnalyticsPromise = null;
    }
  })();

  return sectionAnalyticsPromise;
}

function isDateLocked(section, isoDate) {
  const existsInDatabase = section.availableDates.some((entry) => entry.isoDate === isoDate);
  return existsInDatabase && unlockedDateKey !== isoDate;
}

function renderAttendancePage() {
  const section = getActiveSection();

  if (!section) {
    return;
  }

  const dateColumns = getDateColumns(section);
  const activeDate = loadedAttendanceIsoDate;
  const { presentCount, absentCount } = activeDate ? getSectionTotals(section, activeDate) : { presentCount: 0, absentCount: 0 };
  const selectedLabel = activeDate ? formatIsoDateToLabel(activeDate) : "No date loaded";
  const locked = activeDate ? isDateLocked(section, activeDate) : false;
  const showBatchColumn = shouldShowBatchColumn(section);

  appState.attendanceDatePicker.value = appState.attendanceDatePicker.value || selectedIsoDate;
  appState.attendancePageTitle.textContent = `${getDisplaySubject(currentTeacher)} | ${section.code}`;
  appState.attendancePageSubtitle.textContent = `Choose a date from the calendar, submit that column, and reset only that column if you need to edit a previously saved date.`;
  appState.attendanceTableHeading.textContent = `${section.code} Student Register`;
  appState.attendanceTableSummary.textContent = `${selectedLabel} | Present ${presentCount} | Absent ${absentCount}`;
  appState.dateModeNote.textContent = !activeDate
    ? "Choose a date in the calendar and click Load Date to add that date column to the table."
    : locked
      ? `The ${selectedLabel} column is already saved in PostgreSQL. Use Reset in the table to reopen that column, or Delete Selected Date to remove that date completely.`
      : `The ${selectedLabel} column is ready for entry. Toggle P or A for each student, then submit to store this date in PostgreSQL.`;

  const selectedDateExists = activeDate
    ? section.availableDates.some((entry) => entry.isoDate === activeDate)
    : false;
  appState.deleteDateBtn.disabled = !activeDate || !selectedDateExists;

  appState.attendanceTableHead.innerHTML = `
    <tr>
      <th class="sticky-col-1">Student Name</th>
      <th class="sticky-col-2">Student SRN</th>
      ${showBatchColumn ? "<th>Batch</th>" : ""}
      ${dateColumns
        .map((isoDate) => `
          <th class="date-header">
            <div class="date-header__content">
              <span>${formatIsoDateToLabel(isoDate)}</span>
              <button class="date-reset-btn" type="button" data-action="reopen-date" data-date="${isoDate}">
                Reset
              </button>
            </div>
          </th>
        `)
        .join("")}
      <th>Total Present</th>
    </tr>
  `;

  if (section.students.length === 0) {
    if (!section.studentsLoaded && !attendancePageLoadPromise) {
      void ensureAttendancePageData();
    }

    appState.attendanceTableBody.innerHTML = `
      <tr>
        <td colspan="${dateColumns.length + (showBatchColumn ? 4 : 3)}" class="attendance-empty">
          ${
            section.studentsLoaded
              ? `No students are mapped to ${getSubjectCode(currentTeacher)} for ${section.code}. Add their SRNs to student_electives in PostgreSQL.`
              : `Loading students for ${section.code} from PostgreSQL...`
          }
        </td>
      </tr>
    `;
    return;
  }

  appState.attendanceTableBody.innerHTML = section.students
    .map((student) => `
      <tr>
        <td class="sticky-col-1">${student.name}</td>
        <td class="sticky-col-2">${student.srn}</td>
        ${showBatchColumn ? `<td>${student.batchLabel || "-"}</td>` : ""}
        ${dateColumns.map((isoDate) => renderDateCell(section, student, isoDate)).join("")}
        <td>${getTotalPresent(student)}</td>
      </tr>
    `)
    .join("");

}

function renderDateCell(section, student, isoDate) {
  const status = getEffectiveStatus(student, isoDate);
  const isSelected = isoDate === loadedAttendanceIsoDate;
  const isEditable = isSelected && !isDateLocked(section, isoDate);

  if (!status && !isSelected) {
    return `<td class="date-cell">-</td>`;
  }

  const buttonLabel = status || "A";
  const statusClass = buttonLabel === "P" ? "present" : "absent";
  const lockedClass = isEditable ? "" : "locked";
  const disabledAttr = isEditable ? "" : "disabled";

  return `
    <td class="date-cell">
      <button
        type="button"
        class="date-status-btn ${statusClass} ${lockedClass}"
        data-action="toggle-attendance"
        data-srn="${student.srn}"
        data-date="${isoDate}"
        ${disabledAttr}
      >
        ${buttonLabel}
      </button>
    </td>
  `;
}

function findAttendanceStatusButton(srn, isoDate) {
  return [...appState.attendanceTableBody.querySelectorAll(".date-status-btn")].find(
    (button) => button.dataset.srn === srn && button.dataset.date === isoDate
  ) || null;
}

function updateAttendanceStatusButton(button, status, locked = false) {
  if (!button) {
    return;
  }

  button.textContent = status;
  button.classList.toggle("present", status === "P");
  button.classList.toggle("absent", status !== "P");
  button.classList.toggle("locked", locked);
  button.disabled = locked;
}

function refreshAttendanceSummary(section, isoDate) {
  const selectedLabel = isoDate ? formatIsoDateToLabel(isoDate) : "No date loaded";
  const { presentCount, absentCount } = isoDate ? getSectionTotals(section, isoDate) : { presentCount: 0, absentCount: 0 };
  appState.attendanceTableSummary.textContent = `${selectedLabel} | Present ${presentCount} | Absent ${absentCount}`;
}

function isAttendanceInteractionActive() {
  return (
    !appState.attendancePageScreen.classList.contains("hidden") &&
    Boolean(loadedAttendanceIsoDate) &&
    (
      attendanceSubmitInFlight ||
      pendingStatuses.size > 0 ||
      unlockedDateKey === loadedAttendanceIsoDate
    )
  );
}

function paintDashboard(account) {
  currentTeacher = account;
  const visibleSections = getSubjectSections(account);
  activeSectionCode = activeSectionCode && visibleSections.some((section) => section.code === activeSectionCode)
    ? activeSectionCode
    : visibleSections[0]?.code || null;

  appState.teacherName.textContent = account.name;
  appState.teacherMeta.textContent = `${account.teacherId} | ${getDisplaySubject(account)} (${getSubjectCode(account)})`;
  appState.welcomeTitle.textContent = `Welcome, ${account.name}`;
  appState.heroCopy.textContent = account.offlineMode
    ? `${account.name} is working in offline mode. Cached sections and queued attendance will sync automatically when the connection returns.`
    : `${account.name} is currently assigned to ${getDisplaySubject(account)} and section access is loaded directly from PostgreSQL.`;
  appState.todayClassesCount.textContent = `${visibleSections.length} assigned sections`;
  appState.todaySummary.textContent = account.offlineMode
    ? `${getDisplaySubject(account)} attendance is available offline for ${visibleSections.map((section) => section.code).join(", ")}.`
    : `${getDisplaySubject(account)} attendance is active for ${visibleSections.map((section) => section.code).join(", ")}.`;
  appState.sectionCount.textContent = String(visibleSections.length);

  const allStudents = visibleSections.flatMap((section) => getSectionData(section, getSubjectCode(account)).students);
  const presentCount = allStudents.filter((student) => getEffectiveStatus(student, selectedIsoDate) === "P").length;
  const absentCount = allStudents.filter((student) => getEffectiveStatus(student, selectedIsoDate) === "A").length;
  const attendanceRate = allStudents.length === 0 ? 0 : Math.round((presentCount / allStudents.length) * 100);

  appState.attendanceRate.textContent = `${attendanceRate}%`;
  appState.pendingCount.textContent = String(absentCount);

  renderSubjectSelectors();
  renderSectionCards(account);
  renderSectionTabs();
  renderOverview();
}

async function ensureDatabaseReady(options = {}) {
  const { silent = false } = options;

  try {
    const status = await window.teacherApp.getDatabaseStatus();

    if (!status.ok) {
      dbReady = false;
      if (!silent) {
        appState.loginMessage.textContent = status.configured
          ? `Online service unavailable: ${status.message}`
          : "The backend service is not configured yet.";
      }
      return false;
    }

    const schemaResult = await window.teacherApp.ensureDatabaseSchema();
    dbReady = schemaResult.ok;
    return schemaResult.ok;
  } catch (error) {
    dbReady = false;
    if (!silent) {
      appState.loginMessage.textContent = `Online service unavailable: ${error.message}`;
    }
    return false;
  }
}

async function syncCurrentTeacherFromDatabase(options = {}) {
  const { force = false } = options;

  if (!currentTeacher) {
    return;
  }

  if (!force && isAttendanceInteractionActive()) {
    return;
  }

  if (dbSyncInFlight && dbSyncPromise) {
    return dbSyncPromise;
  }

  dbSyncInFlight = true;
  dbSyncPromise = (async () => {
    try {
      await ensureDatabaseReady({ silent: true });

      const subjectSections = getSubjectSections(currentTeacher);
      const sectionCodes = subjectSections.map((section) => section.code);
      const [summaryResponse, ...sectionResponses] = await Promise.all([
        window.teacherApp.getSectionSummary({
          sectionCodes,
          selectedIsoDate,
          subjectCode: getSubjectCode(currentTeacher)
        }),
        ...subjectSections.flatMap((section) => [
          window.teacherApp.loadSectionAttendance({ sectionCode: section.code, subjectCode: getSubjectCode(currentTeacher) }),
          window.teacherApp.getAvailableDates({ sectionCode: section.code, subjectCode: getSubjectCode(currentTeacher) })
        ])
      ]);

      const updatedSections = [];
      let responseIndex = 0;

      for (const section of currentTeacher.sections) {
        const isCurrentSubjectSection = (section.subjectCodes || []).includes(getSubjectCode(currentTeacher));
        if (!isCurrentSubjectSection) {
          updatedSections.push(section);
          continue;
        }

        const studentsResponse = sectionResponses[responseIndex];
        const datesResponse = sectionResponses[responseIndex + 1];
        responseIndex += 2;
        const existingSubjectState = getSectionData(section);
        updatedSections.push({
          ...section,
          subjects: {
            ...(section.subjects || {}),
            [getSubjectCode(currentTeacher)]: {
              ...existingSubjectState,
              students: studentsResponse.ok ? studentsResponse.students : existingSubjectState.students,
              availableDates: datesResponse.ok ? datesResponse.dates : existingSubjectState.availableDates,
              studentsLoaded: true
            }
          }
        });
      }

      currentTeacher.sections = updatedSections;
      currentTeacher.offlineMode = !dbReady || summaryResponse.offline || sectionResponses.some((response) => response.offline);

      if (summaryResponse.ok) {
        const summaryMap = new Map(summaryResponse.sections.map((row) => [row.section_code, row]));
        currentTeacher.sections = currentTeacher.sections.map((section) => ({
          ...section,
          subjects: {
            ...(section.subjects || {}),
            [getSubjectCode(currentTeacher)]: {
              ...getSectionData(section),
              summary: summaryMap.get(section.code) || null
            }
          }
        }));
      }

      paintDashboard(currentTeacher);

      if (!appState.attendancePageScreen.classList.contains("hidden")) {
        renderAttendancePage();
      }
    } finally {
      dbSyncInFlight = false;
      dbSyncPromise = null;
    }
  })();

  return dbSyncPromise;
}

function renderDashboard(account) {
  paintDashboard(account);
  void syncCurrentTeacherFromDatabase();
}

async function openAttendancePage() {
  if (!currentTeacher) {
    return;
  }

  appState.attendanceDatePicker.value = selectedIsoDate;
  loadedAttendanceIsoDate = null;
  showScreen("attendancePageScreen");
  renderAttendancePage();

  try {
    await syncCurrentTeacherFromDatabase();
    await refreshActiveSectionData();
    renderAttendancePage();
  } catch (error) {
    appState.todaySummary.textContent = `Could not load attendance page: ${error.message}`;
  }
}

async function ensureAttendancePageData() {
  if (attendancePageLoadPromise) {
    return attendancePageLoadPromise;
  }

  attendancePageLoadPromise = (async () => {
    await refreshActiveSectionData();
    renderAttendancePage();
  })();

  try {
    await attendancePageLoadPromise;
  } finally {
    attendancePageLoadPromise = null;
  }
}

async function refreshActiveSectionData(options = {}) {
  const { force = false } = options;

  if (!currentTeacher || !activeSectionCode) {
    return;
  }

  if (!force && isAttendanceInteractionActive()) {
    return;
  }

  await ensureDatabaseReady({ silent: true });

  const [studentsResponse, datesResponse] = await Promise.all([
    window.teacherApp.loadSectionAttendance({
      sectionCode: activeSectionCode,
      subjectCode: getSubjectCode(currentTeacher)
    }),
    window.teacherApp.getAvailableDates({
      sectionCode: activeSectionCode,
      subjectCode: getSubjectCode(currentTeacher)
    })
  ]);

  currentTeacher.sections = currentTeacher.sections.map((section) =>
    section.code === activeSectionCode
      ? {
          ...section,
          subjects: {
            ...(section.subjects || {}),
            [getSubjectCode(currentTeacher)]: {
              ...getSectionData(section),
              students: studentsResponse.ok ? studentsResponse.students : getSectionData(section).students,
              availableDates: datesResponse.ok ? datesResponse.dates : getSectionData(section).availableDates,
              studentsLoaded: true
            }
          }
        }
      : section
  );

  currentTeacher.offlineMode = !dbReady || studentsResponse.offline || datesResponse.offline;
}

function loginTeacher(account) {
  activeSubjectCode = account.subjectAssignments?.[0]?.courseShortCode || account.courseShortCode || account.subjectCode || account.subject || null;
  renderDashboard(account);
  startOfflineSyncLoop();
  showScreen("dashboardScreen");
}

async function handleLogin(event) {
  event.preventDefault();

  appState.loginMessage.textContent = "";
  appState.loginMessage.classList.remove("success");

  try {
    await ensureDatabaseReady({ silent: true });

    const formData = new FormData(appState.loginForm);
    const teacherName = String(formData.get("teacherName") || "").trim();
    const teacherId = String(formData.get("teacherId") || "").trim().toUpperCase();

    if (!teacherName || !teacherId) {
      appState.loginMessage.textContent = "Enter both teacher name and teacher SRN.";
      return;
    }

    const response = await window.teacherApp.loginTeacher({ teacherName, teacherId });

    if (!response.ok || !response.teacher) {
      appState.loginMessage.textContent = response.message || "Invalid teacher name or teacher SRN. Please try again.";
      return;
    }

    const subjectAssignments = Array.isArray(response.teacher.subjectAssignments) ? response.teacher.subjectAssignments : [];
    const teacher = {
      teacherId: response.teacher.teacherId || teacherId,
      name: response.teacher.name || "Teacher",
      subject: response.teacher.subject || "DBMS",
      subjectCode: response.teacher.subjectCode || response.teacher.courseShortCode || response.teacher.subject || "DBMS",
      courseName: response.teacher.courseName || response.teacher.subject || "DBMS",
      courseShortCode: response.teacher.courseShortCode || response.teacher.subjectCode || response.teacher.subject || "DBMS",
      subjectAssignments,
      department: response.teacher.department || "Department of Computer Science",
      designation: response.teacher.designation || "Faculty",
      semester: response.teacher.semester || "Semester 4",
      offlineMode: Boolean(response.offline),
      sections: buildTeacherSections(response.teacher)
    };

    if (teacher.sections.length === 0 || subjectAssignments.length === 0) {
      appState.loginMessage.textContent = "This teacher has no assigned subject mappings in PostgreSQL.";
      return;
    }

    appState.loginMessage.textContent = response.offline
      ? response.message || "Offline mode enabled. Opening cached dashboard..."
      : response.syncedCount > 0
        ? `Login successful. Synced ${response.syncedCount} offline attendance update(s).`
        : "Login successful. Opening dashboard...";
    appState.loginMessage.classList.add("success");
    window.setTimeout(() => loginTeacher(teacher), 450);
  } catch (error) {
    appState.loginMessage.textContent = `Login failed: ${error.message}`;
  }
}

function logoutTeacher() {
  if (window.teacherApp?.logoutTeacher) {
      void window.teacherApp.logoutTeacher();
  }

  stopOfflineSyncLoop();

  currentTeacher = null;
  activeSectionCode = null;
  activeSubjectCode = null;
  dbReady = false;
  selectedIsoDate = getTodayIsoDate();
  loadedAttendanceIsoDate = null;
  unlockedDateKey = null;
  pendingStatuses.clear();
  appState.loginForm.reset();
  appState.loginMessage.textContent = "";
  appState.loginMessage.classList.remove("success");
  showScreen("loginScreen");
}

function loadSelectedDate() {
  loadedAttendanceIsoDate = appState.attendanceDatePicker.value || getTodayIsoDate();
  selectedIsoDate = loadedAttendanceIsoDate;
  const section = getActiveSection();
  const alreadyExists = section.availableDates.some((entry) => entry.isoDate === loadedAttendanceIsoDate);
  unlockedDateKey = alreadyExists ? null : loadedAttendanceIsoDate;
  pendingStatuses.clear();
  renderAttendancePage();
  renderOverview();
  appState.todaySummary.textContent = alreadyExists
    ? `${formatIsoDateToLabel(loadedAttendanceIsoDate)} already exists in PostgreSQL. Use Reset to reopen that column or Delete Selected Date to remove it fully.`
    : `${formatIsoDateToLabel(loadedAttendanceIsoDate)} loaded as a new date column. Mark P or A and then click Save Attendance.`;
}

function togglePendingStatus(srn, isoDate) {
  const section = getActiveSection();
  if (!section) {
    appState.todaySummary.textContent = "No active section is selected for attendance.";
    return;
  }

  if (isDateLocked(section, isoDate)) {
    appState.todaySummary.textContent = `${formatIsoDateToLabel(isoDate)} is locked. Click Reset for that date first.`;
    return;
  }

  const student = section.students.find((entry) => entry.srn === srn);
  if (!student) {
    return;
  }

  const currentStatus = getEffectiveStatus(student, isoDate) || "A";
  const nextStatus = currentStatus === "P" ? "A" : "P";
  pendingStatuses.set(`${srn}|${isoDate}`, nextStatus);

  const button = findAttendanceStatusButton(srn, isoDate);
  updateAttendanceStatusButton(button, nextStatus, false);
  if (button?.closest("tr")?.lastElementChild) {
    button.closest("tr").lastElementChild.textContent = String(getTotalPresent(student));
  }
  refreshAttendanceSummary(section, isoDate);
}

async function submitSelectedDate() {
  if (attendanceSubmitInFlight) {
    return;
  }

  const section = getActiveSection();
  const attendanceDate = loadedAttendanceIsoDate;

  if (!section) {
    appState.todaySummary.textContent = "No active section is selected for attendance.";
    return;
  }

  if (!attendanceDate) {
    appState.todaySummary.textContent = "Choose a date in the calendar and click Load Date before saving attendance.";
    return;
  }

  if (section.students.length === 0) {
    appState.todaySummary.textContent = `No students found for ${section.code}. Insert student rows into PostgreSQL first.`;
    return;
  }

  const entries = section.students.map((student) => ({
    srn: student.srn,
    status: getEffectiveStatus(student, attendanceDate) || "A"
  }));

  const originalLabel = appState.saveAttendancePageBtn.textContent;
  attendanceSubmitInFlight = true;
  appState.saveAttendancePageBtn.disabled = true;
  appState.saveAttendancePageBtn.textContent = "Submitting...";

  try {
    const response = await window.teacherApp.saveAttendanceDate({
      sectionCode: section.code,
      attendanceDate,
      subjectCode: getSubjectCode(currentTeacher),
      entries
    });

    if (!response.ok) {
      appState.todaySummary.textContent = `Could not save attendance: ${response.message}`;
      return;
    }

    const absentees = Array.isArray(response.absentees) ? response.absentees : [];
    unlockedDateKey = null;
    pendingStatuses.clear();
    await refreshActiveSectionData({ force: true });
    renderAttendancePage();
    renderOverview();
    appState.todaySummary.textContent = response.offline
      ? `${section.code} attendance saved offline for ${formatIsoDateToLabel(attendanceDate)}. It will sync automatically when the internet returns.`
      : `${section.code} attendance saved for ${formatIsoDateToLabel(attendanceDate)}.`;
    openAbsenteeModal({
      sectionCode: section.code,
      attendanceDate,
      absentees
    });
  } catch (error) {
    appState.todaySummary.textContent = `Could not save attendance: ${error.message}`;
  } finally {
    attendanceSubmitInFlight = false;
    appState.saveAttendancePageBtn.disabled = false;
    appState.saveAttendancePageBtn.textContent = originalLabel;
  }
}

function reopenAttendanceDate(isoDate) {
  const section = getActiveSection();

  if (!isoDate || !section) {
    return;
  }

  const existingStatuses = new Map(
    section.students.map((student) => [student.srn, student.attendanceHistory?.[isoDate] || "A"])
  );

  loadedAttendanceIsoDate = isoDate;
  selectedIsoDate = isoDate;
  unlockedDateKey = isoDate;
  pendingStatuses.clear();

  for (const student of section.students) {
    pendingStatuses.set(`${student.srn}|${isoDate}`, existingStatuses.get(student.srn) || "A");
  }
  appState.attendanceDatePicker.value = isoDate;
  renderAttendancePage();
  renderOverview();
  appState.todaySummary.textContent = `${section.code} reopened ${formatIsoDateToLabel(isoDate)} for editing. Update the statuses and click Submit Attendance to overwrite that date in PostgreSQL.`;
}

async function deleteAttendanceDate(isoDate) {
  const section = getActiveSection();

  if (!isoDate || !section) {
    return;
  }

  const confirmed = window.confirm(
    `Permanently delete attendance for ${section.code} on ${formatIsoDateToLabel(isoDate)}?\n\nThis will remove the ${getSubjectCode(currentTeacher)} attendance for that date from PostgreSQL and from the UI. This action cannot be undone.`
  );
  if (!confirmed) {
    return;
  }

  const response = await window.teacherApp.resetAttendanceDate({
    sectionCode: section.code,
    attendanceDate: isoDate,
    subjectCode: getSubjectCode(currentTeacher)
  });

  if (!response.ok) {
    appState.todaySummary.textContent = `Could not delete attendance: ${response.message}`;
    return;
  }

  pendingStatuses.clear();
  unlockedDateKey = null;
  loadedAttendanceIsoDate = null;
  selectedIsoDate = isoDate;

  await refreshActiveSectionData();
  appState.attendanceDatePicker.value = isoDate;
  renderAttendancePage();
  renderOverview();
  appState.todaySummary.textContent = response.offline
    ? `${section.code} date cleared locally for ${formatIsoDateToLabel(isoDate)}. Save it again once you are ready to sync online.`
    : `${section.code} attendance deleted for ${formatIsoDateToLabel(isoDate)} from PostgreSQL and removed from the table.`;
}

async function deleteSelectedAttendanceDate() {
  const isoDate = appState.attendanceDatePicker.value || loadedAttendanceIsoDate;
  const section = getActiveSection();

  if (!section || !isoDate) {
    appState.todaySummary.textContent = "Choose an attendance date first.";
    return;
  }

  const exists = section.availableDates.some((entry) => entry.isoDate === isoDate);
  if (!exists) {
    appState.todaySummary.textContent = `${formatIsoDateToLabel(isoDate)} does not have saved attendance to delete.`;
    return;
  }

  await deleteAttendanceDate(isoDate);
}

function stopOfflineSyncLoop() {
  if (offlineSyncIntervalId) {
    window.clearInterval(offlineSyncIntervalId);
    offlineSyncIntervalId = null;
  }
}

async function syncOfflineQueue() {
  if (!currentTeacher || !window.teacherApp?.syncOfflineAttendance) {
    return;
  }

  const result = await window.teacherApp.syncOfflineAttendance({
    teacherName: currentTeacher.name,
    teacherId: currentTeacher.teacherId
  });

  if (!result.ok) {
    return;
  }

  dbReady = Boolean(result.online);

  if (result.teacher) {
    currentTeacher = {
      ...currentTeacher,
      ...result.teacher,
      sections: buildTeacherSections(result.teacher),
      offlineMode: false
    };
  }

  if (result.syncedCount > 0) {
    await syncCurrentTeacherFromDatabase();
    appState.todaySummary.textContent = `Synced ${result.syncedCount} offline attendance update(s) to PostgreSQL.`;
  }
}

function startOfflineSyncLoop() {
  stopOfflineSyncLoop();
  offlineSyncIntervalId = window.setInterval(() => {
    void syncOfflineQueue();
  }, 20000);
}

appState.loginForm.addEventListener("submit", (event) => {
  void handleLogin(event);
});
[
  appState.dashboardSubjectSelect,
  appState.sectionsSubjectSelect,
  appState.attendanceSubjectSelect
].forEach((select) => {
  select?.addEventListener("change", (event) => {
    setActiveSubject(event.target.value);
  });
});
appState.logoutBtn.addEventListener("click", logoutTeacher);
appState.dashboardNavBtn.addEventListener("click", () => {
  renderDashboard(currentTeacher);
  showScreen("dashboardScreen");
});
appState.mySectionsNavBtn.addEventListener("click", () => {
  void openSectionsAnalysis();
});
appState.attendanceNavBtn.addEventListener("click", () => {
  void openAttendancePage();
});
appState.sectionsDashboardNavBtn.addEventListener("click", () => {
  renderDashboard(currentTeacher);
  showScreen("dashboardScreen");
});
appState.sectionsMySectionsNavBtn.addEventListener("click", () => {
  void openSectionsAnalysis();
});
appState.sectionsAttendanceNavBtn.addEventListener("click", () => {
  void openAttendancePage();
});
appState.sectionsBackDashboardBtn.addEventListener("click", () => {
  renderDashboard(currentTeacher);
  showScreen("dashboardScreen");
});
appState.refreshSectionsAnalysisBtn.addEventListener("click", () => {
  void openSectionsAnalysis();
});
appState.markAttendanceBtn.addEventListener("click", () => {
  void openAttendancePage();
});
appState.openAttendancePageBtn.addEventListener("click", () => {
  void openAttendancePage();
});
appState.backToDashboardBtn.addEventListener("click", () => {
  renderDashboard(currentTeacher);
  showScreen("dashboardScreen");
});
appState.loadDateBtn.addEventListener("click", async () => {
  await syncCurrentTeacherFromDatabase();
  loadSelectedDate();
});
appState.deleteDateBtn.addEventListener("click", () => {
  void deleteSelectedAttendanceDate();
});
appState.saveAttendancePageBtn.onclick = () => {
  void submitSelectedDate();
};
document.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) {
    return;
  }

  if (actionButton.dataset.action === "toggle-attendance") {
    if (actionButton.disabled) {
      return;
    }

    try {
      togglePendingStatus(actionButton.dataset.srn, actionButton.dataset.date);
    } catch (error) {
      appState.todaySummary.textContent = `Could not update attendance status: ${error.message}`;
    }
    return;
  }

  if (actionButton.dataset.action === "reopen-date") {
    try {
      reopenAttendanceDate(actionButton.dataset.date);
    } catch (error) {
      appState.todaySummary.textContent = `Could not reopen attendance date: ${error.message}`;
    }
  }
});
appState.absenteeModalCloseBtn.addEventListener("click", closeAbsenteeModal);
appState.absenteeSendSmsBtn.addEventListener("click", () => {
  void handleAbsenteeSms().catch((error) => {
    appState.todaySummary.textContent = `Could not send SMS: ${error.message}`;
  });
});
appState.absenteeCallBtn.addEventListener("click", () => {
  void handleAbsenteeCall().catch((error) => {
    appState.todaySummary.textContent = `Could not prepare call action: ${error.message}`;
  });
});
appState.absenteeModal.addEventListener("click", (event) => {
  if (event.target === appState.absenteeModal) {
    closeAbsenteeModal();
  }
});
appState.sectionSwitcher.addEventListener("click", async (event) => {
  const button = event.target.closest(".section-tab");
  if (!button) {
    return;
  }

  activeSectionCode = button.dataset.sectionCode;
  loadedAttendanceIsoDate = null;
  unlockedDateKey = null;
  pendingStatuses.clear();
  renderSectionTabs();
  renderOverview();
  await refreshActiveSectionData();
  if (!appState.attendancePageScreen.classList.contains("hidden")) {
    renderAttendancePage();
  } else {
    void syncCurrentTeacherFromDatabase();
  }
});

appState.sectionsAnalysisGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".section-download-btn");
  if (!button) {
    return;
  }

  const { sectionCode } = button.dataset;
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Preparing CSV...";

  void exportSectionAttendanceCsv(sectionCode)
    .then(() => {
      appState.todaySummary.textContent = `${sectionCode} attendance CSV downloaded.`;
    })
    .catch((error) => {
      appState.todaySummary.textContent = `Could not download CSV: ${error.message}`;
    })
    .finally(() => {
      button.disabled = false;
      button.textContent = originalLabel;
    });
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && absenteeModalState) {
    closeAbsenteeModal();
  }
});

window.setTimeout(() => {
  appState.attendanceDatePicker.value = selectedIsoDate;
  showScreen("loginScreen");
}, 1800);
