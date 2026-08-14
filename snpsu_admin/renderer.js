const appState = {
  loadingScreen: document.getElementById("loading-screen"),
  loginScreen: document.getElementById("login-screen"),
  adminScreen: document.getElementById("admin-screen"),
  loginForm: document.getElementById("login-form"),
  loginMessage: document.getElementById("login-message"),
  adminName: document.getElementById("admin-name"),
  adminMeta: document.getElementById("admin-meta"),
  adminHeroCopy: document.getElementById("admin-hero-copy"),
  adminOverviewPage: document.getElementById("admin-overview-page"),
  adminReportPage: document.getElementById("admin-report-page"),
  adminEditPage: document.getElementById("admin-edit-page"),
  adminTimetablePage: document.getElementById("admin-timetable-page"),
  adminSectionCount: document.getElementById("admin-section-count"),
  adminFacultyCount: document.getElementById("admin-faculty-count"),
  adminStudentCount: document.getElementById("admin-student-count"),
  adminOverviewPill: document.getElementById("admin-overview-pill"),
  adminSectionGrid: document.getElementById("admin-section-grid"),
  adminReportTitle: document.getElementById("admin-report-title"),
  adminReportPill: document.getElementById("admin-report-pill"),
  adminSectionSelect: document.getElementById("admin-section-select"),
  adminLoadReportBtn: document.getElementById("admin-load-report-btn"),
  adminDownloadReportBtn: document.getElementById("admin-download-report-btn"),
  adminReportSummary: document.getElementById("admin-report-summary"),
  adminFacultyList: document.getElementById("admin-faculty-list"),
  adminMappingHead: document.getElementById("admin-mapping-head"),
  adminMappingBody: document.getElementById("admin-mapping-body"),
  adminReportHead: document.getElementById("admin-report-head"),
  adminReportBody: document.getElementById("admin-report-body"),
  adminRefreshBtn: document.getElementById("admin-refresh-btn"),
  adminLogoutBtn: document.getElementById("admin-logout-btn"),
  adminOverviewNavBtn: document.getElementById("admin-overview-nav-btn"),
  adminRefreshNavBtn: document.getElementById("admin-refresh-nav-btn"),
  adminDownloadNavBtn: document.getElementById("admin-download-nav-btn"),
  adminSidebarHeading: document.getElementById("admin-sidebar-heading"),
  adminSidebarCopy: document.getElementById("admin-sidebar-copy"),
  adminEditDataNavBtn: document.getElementById("admin-edit-data-nav-btn"),
  adminTimetableNavBtn: document.getElementById("admin-timetable-nav-btn"),
  adminEditPill: document.getElementById("admin-edit-pill"),
  adminEditSectionSelect: document.getElementById("admin-edit-section-select"),
  adminLoadEditBtn: document.getElementById("admin-load-edit-btn"),
  adminEditSectionTitle: document.getElementById("admin-edit-section-title"),
  adminEditSectionCopy: document.getElementById("admin-edit-section-copy"),
  adminEditProctorInput: document.getElementById("admin-edit-proctor-input"),
  adminSaveProctorBtn: document.getElementById("admin-save-proctor-btn"),
  adminEditReferenceHead: document.getElementById("admin-edit-reference-head"),
  adminEditReferenceBody: document.getElementById("admin-edit-reference-body"),
  adminEditStudentsHead: document.getElementById("admin-edit-students-head"),
  adminEditStudentsBody: document.getElementById("admin-edit-students-body"),
  adminSaveStudentsBtn: document.getElementById("admin-save-students-btn"),
  adminEditAssignmentsHead: document.getElementById("admin-edit-assignments-head"),
  adminEditAssignmentsBody: document.getElementById("admin-edit-assignments-body"),
  adminAddAssignmentRowBtn: document.getElementById("admin-add-assignment-row-btn"),
  adminSaveAssignmentsBtn: document.getElementById("admin-save-assignments-btn"),
  adminTimetablePill: document.getElementById("admin-timetable-pill"),
  adminTimetableSectionSelect: document.getElementById("admin-timetable-section-select"),
  adminLoadTimetableBtn: document.getElementById("admin-load-timetable-btn"),
  adminSaveTimetableDraftBtn: document.getElementById("admin-save-timetable-draft-btn"),
  adminDownloadTimetableBtn: document.getElementById("admin-download-timetable-btn"),
  adminTimetableSummary: document.getElementById("admin-timetable-summary"),
  adminTimetableSheet: document.getElementById("admin-timetable-sheet")
};

let currentAdmin = null;
let adminSections = [];
let adminSectionReport = null;
let adminEditDataset = null;
let adminTimetableState = null;
let adminActivePage = "overview";

const TIMETABLE_STORAGE_KEY = "snpsu-admin-timetable-drafts";
const TIMETABLE_DAYS = ["MON", "TUE", "WED", "THUR", "FRI"];
const TIMETABLE_PERIODS = [
  { key: "p1", label: "1", time: "9:00 to 10:00" },
  { key: "p2", label: "2", time: "10:00 to 11:00" },
  { key: "p3", label: "3", time: "11.15 to 12.15" },
  { key: "p4", label: "4", time: "12:15 to 1:15" },
  { key: "p5", label: "5", time: "1:15 to 02:15" },
  { key: "p6", label: "6", time: "2:15 to 03:10" },
  { key: "p7", label: "7", time: "3:10 to 04:05" },
  { key: "p8", label: "8", time: "4:05 to 05:00" }
];



function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function formatAdminPercentage(value) {
  return value === null || value === undefined ? "-" : `${Math.round(Number(value))}%`;
}

function showScreen(screenName) {
  appState.loadingScreen.classList.add("hidden");
  appState.loginScreen.classList.add("hidden");
  appState.adminScreen.classList.add("hidden");
  appState[screenName].classList.remove("hidden");
}

function setAdminPage(page) {
  adminActivePage = page === "report" || page === "edit" || page === "timetable" ? page : "overview";
  appState.adminOverviewPage.classList.toggle("hidden", adminActivePage !== "overview");
  appState.adminReportPage.classList.toggle("hidden", adminActivePage !== "report");
  appState.adminEditPage.classList.toggle("hidden", adminActivePage !== "edit");
  appState.adminTimetablePage.classList.toggle("hidden", adminActivePage !== "timetable");
  appState.adminOverviewNavBtn.classList.toggle("active", adminActivePage === "overview");
  appState.adminDownloadNavBtn.classList.toggle("active", adminActivePage === "report");
  appState.adminEditDataNavBtn.classList.toggle("active", adminActivePage === "edit");
  appState.adminTimetableNavBtn.classList.toggle("active", adminActivePage === "timetable");

  if (adminActivePage === "overview") {
    appState.adminHeroCopy.textContent =
      "Review all sections, faculty counts, proctor mapping, and student strength from one clean summary page.";
  } else if (adminActivePage === "edit") {
    appState.adminHeroCopy.textContent =
      "Edit students, subject details, and faculty-section allocation here. Time slots remain unchanged unless you update them separately.";
  } else if (adminActivePage === "timetable") {
    appState.adminHeroCopy.textContent =
      "Build a fresh one-page timetable with editable academic details, period timing, allocation, and course mapping for the selected section.";
  } else {
    appState.adminHeroCopy.textContent =
      "Load one section at a time for the attendance sheet view and download the final report as PDF.";
  }
}

function buildSectionOptions(selectedValue, fallbackLabel = "No section available") {
  if (!adminSections.length) {
    return `<option value="">${fallbackLabel}</option>`;
  }

  return adminSections
    .map((section) => {
      const sectionCode = section.sectionCode || "";
      const selected = sectionCode === selectedValue ? " selected" : "";
      return `<option value="${escapeHtml(sectionCode)}"${selected}>${escapeHtml(sectionCode)}</option>`;
    })
    .join("");
}

function buildSelectOptions(options, selectedValue, fallbackLabel = "") {
  const normalizedSelectedValue = String(selectedValue ?? "");
  return options
    .map((option) => {
      const value = String(option.value ?? "");
      const label = option.label ?? value ?? fallbackLabel;
      const selected = value === normalizedSelectedValue ? " selected" : "";
      return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

function readTimetableDrafts() {
  try {
    return JSON.parse(window.localStorage.getItem(TIMETABLE_STORAGE_KEY) || "{}");
  } catch (_error) {
    return {};
  }
}

function writeTimetableDraft(sectionCode, draft) {
  const drafts = readTimetableDrafts();
  drafts[sectionCode] = draft;
  window.localStorage.setItem(TIMETABLE_STORAGE_KEY, JSON.stringify(drafts));
}

function normalizeFacultyLabel(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function buildCourseAllocationRows(dataset) {
  const sourceRows = (dataset?.assignments || []).length
    ? dataset.assignments.map((assignment, index) => ({
      slNo: index + 1,
      courseCode: assignment.subjectCode || assignment.shortCode || "",
      courseName: assignment.courseName || "",
      shortCode: assignment.shortCode || "",
      faculty: assignment.teacherName || ""
    }))
    : (dataset?.referenceSubjects || []).map((subject) => ({
      slNo: subject.slNo || "",
      courseCode: subject.courseCode || "",
      courseName: subject.courseName || "",
      shortCode: subject.shortCode || "",
      faculty: subject.faculty || ""
    }));

  return sourceRows.map((row, index) => ({
    slNo: row.slNo || index + 1,
    courseCode: row.courseCode || "",
    courseName: row.courseName || "",
    shortCode: row.shortCode || "",
    faculty: normalizeFacultyLabel(row.faculty || "")
  }));
}

function createBlankTimetableGrid() {
  return TIMETABLE_DAYS.map((day) => ({
    day,
    p1: "",
    p2: "",
    p3: "",
    p4: "",
    p5: "",
    p6: "",
    p7: "",
    p8: "",
    allocation: ""
  }));
}

function buildDefaultTimetableState(dataset) {
  return {
    sectionCode: dataset?.sectionCode || "",
    academicYear: "2025-26",
    semester: "IV",
    effectiveDate: "16/02/2026",
    semesterCommences: "16/02/2026",
    semesterEnds: "",
    classAdvisor: dataset?.proctorName || "",
    classroom: "Class Room",
    grid: createBlankTimetableGrid(),
    courseAllocation: buildCourseAllocationRows(dataset)
  };
}

function getTimetableStateForSection(dataset) {
  const sectionCode = dataset?.sectionCode || "";
  const drafts = readTimetableDrafts();
  const stored = sectionCode ? drafts[sectionCode] : null;
  const nextState = stored ? { ...buildDefaultTimetableState(dataset), ...stored } : buildDefaultTimetableState(dataset);
  nextState.sectionCode = sectionCode;
  nextState.classAdvisor = nextState.classAdvisor || dataset?.proctorName || "";
  nextState.courseAllocation = (stored?.courseAllocation?.length ? stored.courseAllocation : buildCourseAllocationRows(dataset)).map((row, index) => ({
    slNo: row.slNo || index + 1,
    courseCode: row.courseCode || "",
    courseName: row.courseName || "",
    shortCode: row.shortCode || "",
    faculty: row.faculty || ""
  }));
  nextState.grid = (stored?.grid?.length ? stored.grid : createBlankTimetableGrid()).map((row, index) => ({
    day: TIMETABLE_DAYS[index] || row.day || "",
    p1: row.p1 || "",
    p2: row.p2 || "",
    p3: row.p3 || "",
    p4: row.p4 || "",
    p5: row.p5 || "",
    p6: row.p6 || "",
    p7: row.p7 || "",
    p8: row.p8 || "",
    allocation: row.allocation || ""
  }));
  return nextState;
}

function buildAdminReportDocumentHtml(report) {
  const generatedLabel = formatIsoDateToLabel(report.generatedAt.slice(0, 10));
  const mappingRows = (report.subjects || [])
    .map(
      (subject, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(subject.subjectCode || subject.subjectKey)}</td>
          <td>${escapeHtml(subject.courseName || subject.shortCode || subject.subjectKey)}</td>
          <td>${escapeHtml(subject.displayShortCode || subject.shortCode || subject.subjectKey)}</td>
          <td>${escapeHtml(subject.facultyNames.join(" / ") || "Not mapped")}</td>
          <td>${subject.totalClasses}</td>
        </tr>
      `
    )
    .join("");

  const subjectHeaders = (report.subjects || [])
    .map(
      (subject) => `
        <th colspan="2">
          <div class="header-stack">
            <strong>${escapeHtml(subject.displayShortCode || subject.shortCode || subject.subjectKey)}</strong>
            <span>${escapeHtml(subject.courseName || "")}</span>
            <span>${escapeHtml(subject.subjectDateLabel || "Attendance %")}</span>
          </div>
        </th>
      `
    )
    .join("");

  const studentRows = (report.students || [])
    .map(
      (student) => `
        <tr>
          <td>${student.serialNo}</td>
          <td>${escapeHtml(student.srn)}</td>
          <td>${escapeHtml(student.name)}</td>
          ${student.metrics
            .map(
              (metric) => `
                <td>${metric.attended}</td>
                <td class="${metric.percentage !== null && metric.percentage < 75 ? "low" : ""}">${formatAdminPercentage(metric.percentage)}</td>
              `
            )
            .join("")}
          <td class="${student.averagePercentage !== null && student.averagePercentage < 75 ? "low" : ""}"><strong>${formatAdminPercentage(student.averagePercentage)}</strong></td>
        </tr>
      `
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(report.sectionCode)} Admin Attendance Report</title>
    <style>
      @page { size: A4 landscape; margin: 10mm; }
      body { font-family: Arial, sans-serif; margin: 0; color: #111; }
      .page { padding: 8px 10px; }
      h1, h2, h3, p { margin: 0; }
      .top { display: grid; gap: 4px; margin-bottom: 12px; text-align: center; }
      .meta { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; font-size: 12px; margin-top: 8px; }
      .meta strong { margin-right: 4px; }
      .mapping-label { margin-top: 10px; font-size: 12px; font-weight: 700; }
      .mapping, .report { width: 100%; border-collapse: collapse; margin-top: 16px; }
      .mapping { margin-top: 8px; }
      th, td { border: 1px solid #222; padding: 4px 6px; font-size: 10px; text-align: center; }
      th { background: #f2f2f2; }
      td:nth-child(3), th:nth-child(3) { text-align: left; }
      .low { background: #fff59d; }
      .header-stack { display: grid; gap: 2px; }
      .header-stack span { font-weight: 400; font-size: 8px; }
      .section-title { margin-top: 8px; font-size: 16px; }
      .mapping th:nth-child(3), .mapping td:nth-child(3), .mapping th:nth-child(4), .mapping td:nth-child(4) { text-align: left; }
      .report thead th { vertical-align: middle; }
      .footer-note { margin-top: 8px; font-size: 9px; color: #555; text-align: right; }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="top">
        <h1>School of Engineering and Technology</h1>
        <h2>Department of CSE - Attendance Sheet</h2>
        <h3 class="section-title">${escapeHtml(report.sectionCode)} Section Attendance Report</h3>
        <div class="meta">
          <span><strong>Class Advisor / Proctor:</strong> ${escapeHtml(report.proctorName || "Not assigned")}</span>
          <span><strong>Total Students:</strong> ${report.studentCount}</span>
          <span><strong>Generated On:</strong> ${escapeHtml(generatedLabel)}</span>
        </div>
      </div>

      <div class="mapping-label">Subject-wise Faculty Mapping</div>
      <table class="mapping">
        <thead>
          <tr>
            <th>Sl. No.</th>
            <th>Course Code</th>
            <th>Course Name</th>
            <th>Faculty</th>
            <th>Total Classes</th>
          </tr>
        </thead>
        <tbody>${mappingRows}</tbody>
      </table>

      <table class="report">
        <thead>
          <tr>
            <th rowspan="2">SN</th>
            <th rowspan="2">SRN</th>
            <th rowspan="2">Name</th>
            ${subjectHeaders}
            <th rowspan="2">Average</th>
          </tr>
          <tr>
            ${(report.subjects || []).map(() => "<th>Attended</th><th>%</th>").join("")}
          </tr>
        </thead>
        <tbody>${studentRows}</tbody>
      </table>

      <div class="footer-note">Low attendance below 75% is highlighted.</div>
    </div>
  </body>
</html>`;
}

function renderAdminOverview(sections) {
  adminSections = Array.isArray(sections) ? sections : [];

  const uniqueFaculty = new Set();
  let totalStudents = 0;

  for (const section of adminSections) {
    totalStudents += Number(section.studentCount || 0);
    for (const faculty of section.facultyDetails || []) {
      if (faculty.teacherId) {
        uniqueFaculty.add(faculty.teacherId);
      }
    }
  }

  appState.adminName.textContent = currentAdmin?.name || "Administrator";
  appState.adminMeta.textContent = `${currentAdmin?.adminId || ""} | ${currentAdmin?.role || "admin"}`;
  appState.adminSectionCount.textContent = String(adminSections.length);
  appState.adminFacultyCount.textContent = String(uniqueFaculty.size);
  appState.adminStudentCount.textContent = String(totalStudents);
  appState.adminOverviewPill.textContent = `${adminSections.length} section${adminSections.length === 1 ? "" : "s"} loaded`;
  appState.adminSidebarHeading.textContent = `${adminSections.length} active sections`;
  appState.adminSidebarCopy.textContent = uniqueFaculty.size
    ? `${uniqueFaculty.size} faculty mappings are available across the current semester sections.`
    : "Faculty mappings will appear here after section assignments are loaded.";

  if (!adminSections.length) {
    appState.adminSectionGrid.innerHTML = `
      <div class="admin-overview-empty">
        <h3>No sections available</h3>
        <p class="subtle">Add section, student, and teacher assignment data in PostgreSQL to populate the admin report.</p>
      </div>
    `;
    appState.adminSectionSelect.innerHTML = `<option value="">No section available</option>`;
    appState.adminEditSectionSelect.innerHTML = `<option value="">No section available</option>`;
    appState.adminTimetableSectionSelect.innerHTML = `<option value="">No section available</option>`;
    return;
  }

  appState.adminSectionGrid.innerHTML = `
    <table class="attendance-table admin-overview-table">
      <thead>
        <tr>
          <th>Section</th>
          <th>Proctor</th>
          <th>Students</th>
          <th>Faculty Count</th>
          <th>Faculty Mapping</th>
        </tr>
      </thead>
      <tbody>
        ${adminSections
          .map((section) => {
            const facultyMarkup = (section.facultyDetails || [])
              .map((faculty) => {
                const subjectLabel = faculty.displayShortCode || faculty.shortCode || faculty.subjectCode || faculty.courseName || "Subject";
                return `
                  <span class="admin-chip">
                    <strong>${escapeHtml(subjectLabel)}</strong>
                    ${escapeHtml(faculty.teacherName || "Faculty")}
                  </span>
                `;
              })
              .join("");

            return `
              <tr>
                <td><strong>${escapeHtml(section.sectionCode)}</strong></td>
                <td>${escapeHtml(section.proctorName || "Not assigned")}</td>
                <td>${section.studentCount}</td>
                <td>${section.facultyCount}</td>
                <td>
                  <div class="admin-chip-list compact">${facultyMarkup || '<span class="admin-chip">No faculty mapping yet</span>'}</div>
                </td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;

  const currentValue = appState.adminSectionSelect.value;
  const nextValue = adminSections.some((section) => section.sectionCode === currentValue)
    ? currentValue
    : adminSections[0].sectionCode;
  appState.adminSectionSelect.innerHTML = buildSectionOptions(nextValue);
  appState.adminEditSectionSelect.innerHTML = buildSectionOptions(
    adminEditDataset?.sectionCode && adminSections.some((section) => section.sectionCode === adminEditDataset.sectionCode)
      ? adminEditDataset.sectionCode
      : nextValue
  );
  appState.adminTimetableSectionSelect.innerHTML = buildSectionOptions(
    adminTimetableState?.sectionCode && adminSections.some((section) => section.sectionCode === adminTimetableState.sectionCode)
      ? adminTimetableState.sectionCode
      : nextValue
  );
}

function renderAdminSectionReport(report) {
  adminSectionReport = report;

  if (!report) {
    appState.adminReportTitle.textContent = "Section attendance matrix";
    appState.adminReportPill.textContent = "No section selected";
    appState.adminReportSummary.textContent = "Choose a section to load the timetable-style report.";
    appState.adminFacultyList.innerHTML = "";
    appState.adminMappingHead.innerHTML = "";
    appState.adminMappingBody.innerHTML = `
      <tr>
        <td colspan="5" class="attendance-empty">Subject-wise faculty mapping will appear here.</td>
      </tr>
    `;
    appState.adminReportHead.innerHTML = "";
    appState.adminReportBody.innerHTML = `
      <tr>
        <td colspan="4" class="attendance-empty">No admin report loaded yet.</td>
      </tr>
    `;
    return;
  }

  appState.adminReportTitle.textContent = `${report.sectionCode} attendance matrix`;
  appState.adminReportPill.textContent = `${report.studentCount} students | ${report.subjects.length} subjects`;
  appState.adminReportSummary.textContent = `Class Advisor / Proctor: ${report.proctorName || "Not assigned"} | Generated ${formatIsoDateToLabel(report.generatedAt.slice(0, 10))} | Coordinator report`;

  appState.adminFacultyList.innerHTML = (report.subjects || [])
    .map(
      (subject) => `
        <span class="admin-chip">
          <strong>${escapeHtml(subject.displayShortCode || subject.shortCode || subject.subjectKey)}</strong>
          ${escapeHtml(subject.facultyNames.join(" / ") || "Faculty not mapped")}
        </span>
      `
    )
    .join("");

  appState.adminMappingHead.innerHTML = `
    <tr>
      <th>Sl. No.</th>
      <th>Course Code</th>
      <th>Course Name</th>
      <th>Subject-wise Faculty Mapping</th>
      <th>Total Classes</th>
    </tr>
  `;

  appState.adminMappingBody.innerHTML = (report.subjects || [])
    .map(
      (subject, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(subject.subjectCode || subject.subjectKey)}</td>
          <td>${escapeHtml(subject.courseName || "-")}</td>
          <td>${escapeHtml(subject.facultyNames.join(" / ") || "Not mapped")}</td>
          <td>${subject.totalClasses}</td>
        </tr>
      `
    )
    .join("");

  appState.adminReportHead.innerHTML = `
    <tr>
      <th rowspan="2" class="admin-sticky-col-sn">SN</th>
      <th rowspan="2" class="admin-sticky-col-srn">SRN</th>
      <th rowspan="2" class="admin-sticky-col-name">Name</th>
      ${(report.subjects || [])
        .map(
          (subject) => `
            <th colspan="2" class="date-header">
              <div class="date-header__content">
                <strong>${escapeHtml(subject.displayShortCode || subject.shortCode || subject.subjectKey)}</strong>
                <span>${escapeHtml(subject.courseName || "")}</span>
              </div>
            </th>
          `
        )
        .join("")}
      <th rowspan="2">Average</th>
    </tr>
    <tr>
      ${(report.subjects || [])
        .map(
          () => `
            <th class="date-header"><div class="date-header__content"><strong>Attended</strong></div></th>
            <th class="date-header"><div class="date-header__content"><strong>%</strong></div></th>
          `
        )
        .join("")}
    </tr>
  `;

  appState.adminReportBody.innerHTML = (report.students || [])
    .map(
      (student) => `
        <tr>
          <td class="admin-sticky-col-sn">${student.serialNo}</td>
          <td class="admin-sticky-col-srn">${escapeHtml(student.srn)}</td>
          <td class="admin-sticky-col-name">${escapeHtml(student.name)}</td>
          ${student.metrics
            .map(
              (metric) => `
                <td>${metric.attended}</td>
                <td class="${metric.percentage !== null && metric.percentage < 75 ? "low-attendance-cell" : ""}">${formatAdminPercentage(metric.percentage)}</td>
              `
            )
            .join("")}
          <td class="${student.averagePercentage !== null && student.averagePercentage < 75 ? "low-attendance-cell" : ""}"><strong>${formatAdminPercentage(student.averagePercentage)}</strong></td>
        </tr>
      `
    )
    .join("");
}

async function loadAdminOverview() {
  const response = await window.adminApp.getAdminOverview();
  if (!response.ok) {
    throw new Error(response.message || "Could not load admin overview.");
  }

  renderAdminOverview(response.sections || []);
}

async function loadAdminSectionReport(sectionCode) {
  if (!sectionCode) {
    renderAdminSectionReport(null);
    return;
  }

  const response = await window.adminApp.getAdminSectionReport({ sectionCode });
  if (!response.ok) {
    throw new Error(response.message || "Could not load admin section report.");
  }

  renderAdminSectionReport(response.report || null);
}

function renderAdminEditDataset(dataset) {
  adminEditDataset = dataset;

  if (!dataset) {
    appState.adminEditPill.textContent = "Choose a section";
    appState.adminEditSectionTitle.textContent = "Section editor";
    appState.adminEditSectionCopy.textContent =
      "Update student section mapping and faculty-course allocation here. Time slots stay unchanged.";
    appState.adminEditProctorInput.value = "";
    appState.adminEditReferenceHead.innerHTML = "";
    appState.adminEditReferenceBody.innerHTML = `
      <tr>
        <td colspan="5" class="attendance-empty">Timetable reference will appear here after you load a section.</td>
      </tr>
    `;
    appState.adminEditStudentsHead.innerHTML = "";
    appState.adminEditStudentsBody.innerHTML = `
      <tr>
        <td colspan="6" class="attendance-empty">No student data loaded yet.</td>
      </tr>
    `;
    appState.adminEditAssignmentsHead.innerHTML = "";
    appState.adminEditAssignmentsBody.innerHTML = `
      <tr>
        <td colspan="8" class="attendance-empty">No faculty allocation loaded yet.</td>
      </tr>
    `;
    return;
  }

  appState.adminEditSectionSelect.innerHTML = buildSectionOptions(dataset.sectionCode);
  appState.adminEditPill.textContent = `${dataset.sectionCode} | ${dataset.studentCount} students`;
  appState.adminEditSectionTitle.textContent = `${dataset.sectionCode} super admin editor`;
  appState.adminEditSectionCopy.textContent =
    "Edit student placement, course details, and faculty mapping for this section. Faculty-side views will reflect the shared database values.";
  appState.adminEditProctorInput.value = dataset.proctorName || "";

  appState.adminEditReferenceHead.innerHTML = `
    <tr>
      <th>Sl. No.</th>
      <th>Course Code</th>
      <th>Course Name</th>
      <th>Short Code</th>
      <th>Faculty</th>
    </tr>
  `;
  appState.adminEditReferenceBody.innerHTML = (dataset.referenceSubjects || []).length
    ? dataset.referenceSubjects
      .map(
        (subject) => `
          <tr>
            <td>${subject.slNo || ""}</td>
            <td>${escapeHtml(subject.courseCode || "")}</td>
            <td>${escapeHtml(subject.courseName || "")}</td>
            <td>${escapeHtml(subject.shortCode || "")}</td>
            <td>${escapeHtml(subject.faculty || "")}</td>
          </tr>
        `
      )
      .join("")
    : `
      <tr>
        <td colspan="5" class="attendance-empty">No timetable reference found for this section.</td>
      </tr>
    `;

  appState.adminEditStudentsHead.innerHTML = `
    <tr>
      <th>SRN</th>
      <th>Name</th>
      <th>Parent Phone</th>
      <th>Gender</th>
      <th>Batch</th>
      <th>Section</th>
    </tr>
  `;
  appState.adminEditStudentsBody.innerHTML = (dataset.students || []).length
    ? dataset.students
      .map(
        (student) => `
          <tr data-srn="${escapeHtml(student.srn)}">
            <td>
              <input class="table-input" data-field="srn" value="${escapeHtml(student.srn)}" readonly />
            </td>
            <td>
              <input class="table-input" data-field="studentName" value="${escapeHtml(student.studentName || "")}" />
            </td>
            <td>
              <input class="table-input" data-field="parentPhoneNo" value="${escapeHtml(student.parentPhoneNo || "")}" />
            </td>
            <td>
              <select class="table-input table-select" data-field="gender">
                ${buildSelectOptions([
                  { value: "", label: "NULL" },
                  { value: "Male", label: "Male" },
                  { value: "Female", label: "Female" },
                  { value: "Other", label: "Other" }
                ], student.gender || "")}
              </select>
            </td>
            <td>
              <select class="table-input table-select" data-field="batchLabel">
                ${buildSelectOptions([
                  { value: "", label: "NULL" },
                  { value: "B1", label: "B1" },
                  { value: "B2", label: "B2" }
                ], student.batchLabel || "")}
              </select>
            </td>
            <td>
              <select class="table-input table-select" data-field="sectionCode">
                ${buildSectionOptions(student.sectionCode)}
              </select>
            </td>
          </tr>
        `
      )
      .join("")
    : `
      <tr>
        <td colspan="6" class="attendance-empty">No students found for this section.</td>
      </tr>
    `;

  appState.adminEditAssignmentsHead.innerHTML = `
    <tr>
      <th>Faculty ID</th>
      <th>Faculty Name</th>
      <th>Subject Code</th>
      <th>Course Name</th>
      <th>Short Code</th>
      <th>Batch</th>
      <th>Section</th>
      <th>Action</th>
    </tr>
  `;
  appState.adminEditAssignmentsBody.innerHTML = (dataset.assignments || []).length
    ? dataset.assignments
      .map((assignment) => buildAssignmentRowMarkup(assignment))
      .join("")
    : buildAssignmentRowMarkup({
      teacherId: "",
      teacherName: "",
      subjectCode: "",
      courseName: "",
      shortCode: "",
      batchLabel: "ALL",
      sectionCode: dataset.sectionCode
    });
}

function buildAssignmentRowMarkup(assignment) {
  return `
    <tr class="admin-assignment-row">
      <td><input class="table-input" data-field="teacherId" value="${escapeHtml(assignment.teacherId || "")}" placeholder="Faculty ID" /></td>
      <td><input class="table-input" data-field="teacherName" value="${escapeHtml(assignment.teacherName || "")}" placeholder="Faculty name" /></td>
      <td><input class="table-input" data-field="subjectCode" value="${escapeHtml(assignment.subjectCode || "")}" placeholder="24BECSE401" /></td>
      <td><input class="table-input" data-field="courseName" value="${escapeHtml(assignment.courseName || "")}" placeholder="Course name" /></td>
      <td><input class="table-input" data-field="shortCode" value="${escapeHtml(assignment.shortCode || "")}" placeholder="DMS" /></td>
      <td>
        <select class="table-input table-select" data-field="batchLabel">
          ${buildSelectOptions([
            { value: "ALL", label: "ALL" },
            { value: "B1", label: "B1" },
            { value: "B2", label: "B2" }
          ], assignment.batchLabel || "ALL")}
        </select>
      </td>
      <td>
        <select class="table-input table-select" data-field="sectionCode">
          ${buildSectionOptions(assignment.sectionCode || adminEditDataset?.sectionCode || "")}
        </select>
      </td>
      <td><button class="icon-btn danger" type="button" data-action="delete-assignment-row">Remove</button></td>
    </tr>
  `;
}

async function loadAdminEditDataset(sectionCode) {
  const response = await window.adminApp.getAdminEditDataset({ sectionCode });
  if (!response.ok) {
    throw new Error(response.message || "Could not load admin edit data.");
  }

  renderAdminEditDataset(response.dataset || null);
}

function buildTimetableGridEditorMarkup(grid) {
  return `
    <table class="admin-timetable-grid">
      <thead>
        <tr>
          <th>PERIOD</th>
          <th>1</th>
          <th>2</th>
          <th class="break-col"></th>
          <th>3</th>
          <th>4</th>
          <th>5</th>
          <th class="break-col"></th>
          <th>6</th>
          <th>7</th>
          <th>8</th>
          <th class="allocation-col">Allocation</th>
        </tr>
        <tr>
          <th>Day/Time</th>
          <th>9:00 to 10:00</th>
          <th>10:00 to 11:00</th>
          <th class="break-col">11.00 - 11.15</th>
          <th>11.15 to 12.15</th>
          <th>12:15 to 1:15</th>
          <th>1:15 to 02:15</th>
          <th class="break-col"></th>
          <th>2:15 to 03:10</th>
          <th>3:10 to 04:05</th>
          <th>4:05 to 05:00</th>
          <th class="allocation-col">Allocation</th>
        </tr>
      </thead>
      <tbody>
        ${grid.map((row, index) => `
          <tr data-day-index="${index}">
            <th>${escapeHtml(row.day)}</th>
            <td><input class="table-input timetable-input" data-field="p1" value="${escapeHtml(row.p1)}" /></td>
            <td><input class="table-input timetable-input" data-field="p2" value="${escapeHtml(row.p2)}" /></td>
            ${index === 0 ? '<td class="break-cell" rowspan="5">Tea Break</td>' : ""}
            <td><input class="table-input timetable-input" data-field="p3" value="${escapeHtml(row.p3)}" /></td>
            <td><input class="table-input timetable-input" data-field="p4" value="${escapeHtml(row.p4)}" /></td>
            <td><input class="table-input timetable-input" data-field="p5" value="${escapeHtml(row.p5)}" /></td>
            ${index === 0 ? '<td class="break-cell" rowspan="5">Lunch Break</td>' : ""}
            <td><input class="table-input timetable-input" data-field="p6" value="${escapeHtml(row.p6)}" /></td>
            <td><input class="table-input timetable-input" data-field="p7" value="${escapeHtml(row.p7)}" /></td>
            <td><input class="table-input timetable-input" data-field="p8" value="${escapeHtml(row.p8)}" /></td>
            <td><input class="table-input timetable-input" data-field="allocation" value="${escapeHtml(row.allocation)}" /></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function buildTimetableCourseAllocationEditorMarkup(rows) {
  return `
    <table class="admin-timetable-course-table">
      <thead>
        <tr>
          <th>Sl. No.</th>
          <th>Course Code</th>
          <th>Course Name</th>
          <th>Short Code</th>
          <th>Course Faculty</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row, index) => `
          <tr class="admin-timetable-course-row" data-course-index="${index}">
            <td><input class="table-input timetable-mini-input" data-field="slNo" value="${escapeHtml(row.slNo)}" /></td>
            <td><input class="table-input" data-field="courseCode" value="${escapeHtml(row.courseCode)}" /></td>
            <td><input class="table-input" data-field="courseName" value="${escapeHtml(row.courseName)}" /></td>
            <td><input class="table-input timetable-mini-input" data-field="shortCode" value="${escapeHtml(row.shortCode)}" /></td>
            <td><input class="table-input" data-field="faculty" value="${escapeHtml(row.faculty)}" /></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderAdminTimetableState(state) {
  adminTimetableState = state;

  if (!state) {
    appState.adminTimetablePill.textContent = "Choose a section";
    appState.adminTimetableSummary.textContent =
      "Use this workspace to build a fresh timetable PDF with the same one-page layout as the reference format.";
    appState.adminTimetableSheet.innerHTML = `
      <div class="admin-overview-empty">
        <h3>No timetable loaded</h3>
        <p class="subtle">Select a section and load the timetable workspace.</p>
      </div>
    `;
    return;
  }

  appState.adminTimetableSectionSelect.innerHTML = buildSectionOptions(state.sectionCode);
  appState.adminTimetablePill.textContent = `${state.sectionCode} | editable timetable`;
  appState.adminTimetableSummary.textContent =
    "Update academic details, day-wise subject timing, and course allocation here. This page generates a fresh one-page timetable PDF.";

  appState.adminTimetableSheet.innerHTML = `
    <div class="admin-timetable-header">
      <img src="snpsu_logo.png" alt="SNPSU Logo" class="admin-timetable-logo" />
      <div class="admin-timetable-title">
        <h2>School of Engineering and Technology</h2>
        <h3>Department of Computer Science and Engineering</h3>
        <p>Time Table w.e.f <input class="table-input timetable-inline-input" id="tt-effective-date" value="${escapeHtml(state.effectiveDate)}" /></p>
      </div>
    </div>

    <div class="admin-timetable-meta-grid">
      <label class="field"><span>Academic Year</span><input class="table-input" id="tt-academic-year" value="${escapeHtml(state.academicYear)}" /></label>
      <label class="field"><span>Semester</span><input class="table-input" id="tt-semester" value="${escapeHtml(state.semester)}" /></label>
      <label class="field"><span>Semester Commences</span><input class="table-input" id="tt-semester-commences" value="${escapeHtml(state.semesterCommences)}" /></label>
      <label class="field"><span>Semester Ends</span><input class="table-input" id="tt-semester-ends" value="${escapeHtml(state.semesterEnds)}" /></label>
      <label class="field"><span>Class Advisor / Proctor</span><input class="table-input" id="tt-class-advisor" value="${escapeHtml(state.classAdvisor)}" /></label>
      <label class="field"><span>Section</span><input class="table-input" id="tt-section-code" value="${escapeHtml(state.sectionCode)}" /></label>
    </div>

    <div class="table-wrap">${buildTimetableGridEditorMarkup(state.grid)}</div>

    <div class="admin-timetable-course-wrap">
      <div class="admin-timetable-course-title">Course Allocation</div>
      <div class="table-wrap">${buildTimetableCourseAllocationEditorMarkup(state.courseAllocation)}</div>
    </div>

    <div class="admin-timetable-signatures">
      <span>Time Table Coordinator</span>
      <span>Director CSE</span>
      <span>Dean, SoET</span>
    </div>
  `;
}

function collectTimetableStateFromForm() {
  if (!adminTimetableState) {
    return null;
  }

  const nextGrid = [...appState.adminTimetableSheet.querySelectorAll("tr[data-day-index]")]
    .map((row, index) => ({
      day: TIMETABLE_DAYS[index],
      p1: row.querySelector('[data-field="p1"]')?.value || "",
      p2: row.querySelector('[data-field="p2"]')?.value || "",
      p3: row.querySelector('[data-field="p3"]')?.value || "",
      p4: row.querySelector('[data-field="p4"]')?.value || "",
      p5: row.querySelector('[data-field="p5"]')?.value || "",
      p6: row.querySelector('[data-field="p6"]')?.value || "",
      p7: row.querySelector('[data-field="p7"]')?.value || "",
      p8: row.querySelector('[data-field="p8"]')?.value || "",
      allocation: row.querySelector('[data-field="allocation"]')?.value || ""
    }));

  const nextCourseAllocation = [...appState.adminTimetableSheet.querySelectorAll(".admin-timetable-course-row")]
    .map((row) => ({
      slNo: row.querySelector('[data-field="slNo"]')?.value || "",
      courseCode: row.querySelector('[data-field="courseCode"]')?.value || "",
      courseName: row.querySelector('[data-field="courseName"]')?.value || "",
      shortCode: row.querySelector('[data-field="shortCode"]')?.value || "",
      faculty: row.querySelector('[data-field="faculty"]')?.value || ""
    }));

  return {
    sectionCode: appState.adminTimetableSheet.querySelector("#tt-section-code")?.value || adminTimetableState.sectionCode,
    academicYear: appState.adminTimetableSheet.querySelector("#tt-academic-year")?.value || "",
    semester: appState.adminTimetableSheet.querySelector("#tt-semester")?.value || "",
    effectiveDate: appState.adminTimetableSheet.querySelector("#tt-effective-date")?.value || "",
    semesterCommences: appState.adminTimetableSheet.querySelector("#tt-semester-commences")?.value || "",
    semesterEnds: appState.adminTimetableSheet.querySelector("#tt-semester-ends")?.value || "",
    classAdvisor: appState.adminTimetableSheet.querySelector("#tt-class-advisor")?.value || "",
    classroom: adminTimetableState.classroom || "Class Room",
    grid: nextGrid,
    courseAllocation: nextCourseAllocation
  };
}

function buildTimetablePdfHtml(state) {
  const courseRows = state.courseAllocation
    .map((row) => `
      <tr>
        <td>${escapeHtml(row.slNo)}</td>
        <td>${escapeHtml(row.courseCode)}</td>
        <td class="left">${escapeHtml(row.courseName)}</td>
        <td>${escapeHtml(row.shortCode)}</td>
        <td class="left">${escapeHtml(row.faculty)}</td>
      </tr>
    `)
    .join("");

  const dayRows = state.grid
    .map((row, index) => `
      <tr>
        <td class="day-col">${escapeHtml(row.day)}</td>
        <td>${escapeHtml(row.p1)}</td>
        <td>${escapeHtml(row.p2)}</td>
        ${
          index === 0
            ? `<td rowspan="5" class="break-cell tea-break">
                Tea Break
              </td>`
            : ""
        }
        <td>${escapeHtml(row.p3)}</td>
        <td>${escapeHtml(row.p4)}</td>
        <td>${escapeHtml(row.p5)}</td>
        ${
          index === 0
            ? `<td rowspan="5" class="break-cell lunch-break">
                Lunch Break
              </td>`
            : ""
        }
        <td>${escapeHtml(row.p6)}</td>
        <td>${escapeHtml(row.p7)}</td>
        <td>${escapeHtml(row.p8)}</td>
        <td class="allocation-col">${escapeHtml(row.allocation)}</td>
      </tr>
    `)
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(state.sectionCode)} Time Table</title>
    <style>
      @page {
        size: A4 landscape;
        margin: 8mm;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        padding: 0;
        font-family: "Times New Roman", serif;
        color: #111;
        background: white;
      }

      .page {
        width: 100%;
      }

      .header {
        display: grid;
        grid-template-columns: 230px 1fr;
        align-items: center;
        gap: 14px;
        margin-bottom: 6px;
      }

      .header img {
        width: 220px;
        object-fit: contain;
      }

      .title {
        text-align: center;
        line-height: 1.2;
      }

      .title h1,
      .title h2,
      .title p {
        allign-items: center;
        margin: 0;
      }

      .title h1 {
        font-size: 20px;
        font-weight: 700;
      }

      .title h2 {
        font-size: 17px;
        margin-top: 3px;
        font-weight: 700;
      }

      .title p {
        margin-top: 5px;
        font-size: 14px;
        font-weight: 700;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th,
      td {
        border: 1px solid #111;
        padding: 4px 5px;
        font-size: 11px;
        text-align: center;
        vertical-align: middle;
      }

      th {
        font-weight: 700;
      }

      .left {
        text-align: left;
      }

      .meta td {
        font-size: 11px;
      }

      .meta .label {
        width: 16%;
        font-weight: 700;
        text-align: left;
        background: #f7f7f7;
      }

      .meta .value {
        width: 18%;
        text-align: left;
      }

      .meta .section-value {
        font-weight: 700;
      }

      .classroom {
        width: 10%;
        background: #efe3bb;
        font-size: 18px;
        font-weight: 500;
      }

      .grid th,
      .grid td {
        font-size: 10.5px;
      }

      .grid .period-head {
        font-size: 14px;
        font-weight: 700;
      }

      .grid .time-head {
        font-size: 11px;
      }

      .day-col {
        font-weight: 700;
        font-size: 12px;
        width: 58px;
      }

      .allocation-col {
        background: #efe3bb;
        width: 80px;
      }

      .break-cell {
        color: #d10000;
        font-weight: 700;
        background: #fff;
        width: 44px;
        min-width: 44px;
        max-width: 44px;
        writing-mode: vertical-rl;
        transform: rotate(180deg);
        text-align: center;
        letter-spacing: 1px;
        font-size: 13px;
      }

      .course-title {
        margin-top: 8px;
        border: 1px solid #111;
        border-bottom: none;
        text-align: center;
        font-size: 12px;
        font-weight: 700;
        padding: 4px;
      }

      .course th,
      .course td {
        font-size: 10.5px;
      }

      .signatures {
        margin-top: 45px;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        text-align: center;
        font-size: 13px;
        font-weight: 700;
      }

      @media print {
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="header">
        <img src="https://www.unigauge.com/wp-content/uploads/2024/03/SNPSU-logo-1.png" alt="SNPSU Logo" />
        <div class="title">
          <h1>School of Engineering and Technology</h1>
          <h2>Department of Computer Science and Engineering</h2>
          <p>Time Table w.e.f ${escapeHtml(state.effectiveDate)}</p>
        </div>
      </div>

      <table class="meta">
        <tr>
          <td class="label">Academic Year</td><td class="value">${escapeHtml(state.academicYear)}</td>
          <td class="label">Semester : ${escapeHtml(state.semester)}</td><td class="value section-value">Section : ${escapeHtml(state.sectionCode)}</td>
          <td class="classroom" rowspan="4">Class Room</td>
        </tr>
        <tr>
          <td class="label">Class Advisor:</td><td class="value">${escapeHtml(state.classAdvisor)}</td>
          <td class="label"></td><td class="value"></td>
        </tr>
        <tr>
          <td class="label">Semester Commences:</td><td class="value">${escapeHtml(state.semesterCommences)}</td>
          <td class="label">Semester Ends:</td><td class="value">${escapeHtml(state.semesterEnds)}</td>
        </tr>
      </table>

      <table class="grid">
        <thead>
          <tr>
            <th class="period-head">PERIOD</th>
            <th>1</th>
            <th>2</th>
            <th></th>
            <th>3</th>
            <th>4</th>
            <th>5</th>
            <th></th>
            <th>6</th>
            <th>7</th>
            <th>8</th>
            <th class="allocation-col"></th>
          </tr>
          <tr>
            <th>Day/Time</th>
            <th class="time-head">9:00 to 10:00</th>
            <th class="time-head">10:00 to 11:00</th>
            <th class="time-head">11.00 - 11.15</th>
            <th class="time-head">11.15 to 12.15</th>
            <th class="time-head">12:15 to 1:15</th>
            <th class="time-head">1:15 to 02:15</th>
            <th></th>
            <th class="time-head">2:15 to 03:10</th>
            <th class="time-head">3:10 to 04:05</th>
            <th class="time-head">4:05 to 05:00</th>
            <th class="allocation-col">Allocation</th>
          </tr>
        </thead>
        <tbody>${dayRows}</tbody>
      </table>

      <div class="course-title">Course Allocation</div>
      <table class="course">
        <thead>
          <tr>
            <th>Sl. No.</th>
            <th>Course Code</th>
            <th>Course Name</th>
            <th>Short Code</th>
            <th>Course Faculty</th>
          </tr>
        </thead>
        <tbody>${courseRows}</tbody>
      </table>

      <div class="signatures">
        <span>Time Table Coordinator</span>
        <span>Director CSE</span>
        <span>Dean, SoET</span>
      </div>
    </div>
  </body>
</html>`;
}

async function loadAdminTimetableWorkspace(sectionCode) {
  const effectiveSectionCode = sectionCode || appState.adminTimetableSectionSelect.value || appState.adminSectionSelect.value;
  if (!effectiveSectionCode) {
    renderAdminTimetableState(null);
    return;
  }

  if (!adminEditDataset || adminEditDataset.sectionCode !== effectiveSectionCode) {
    await loadAdminEditDataset(effectiveSectionCode);
  }

  renderAdminTimetableState(getTimetableStateForSection(adminEditDataset));
}

function saveAdminTimetableDraft() {
  const state = collectTimetableStateFromForm();
  if (!state?.sectionCode) {
    throw new Error("Load a timetable before saving the draft.");
  }

  writeTimetableDraft(state.sectionCode, state);
  adminTimetableState = state;
  appState.adminTimetablePill.textContent = `${state.sectionCode} | draft saved`;
  appState.adminTimetableSummary.textContent = `Saved timetable draft for ${state.sectionCode}.`;
}

async function downloadGeneratedTimetablePdf() {
  const state = collectTimetableStateFromForm();
  if (!state?.sectionCode) {
    throw new Error("Load a timetable before downloading the PDF.");
  }

  writeTimetableDraft(state.sectionCode, state);
  adminTimetableState = state;

  const html = buildTimetablePdfHtml(state);
  const response = await window.adminApp.exportAdminReportPdf({
    html,
    defaultFileName: `${state.sectionCode}_timetable.pdf`
  });

  if (!response.ok) {
    throw new Error(response.message || "Could not export the timetable PDF.");
  }

  appState.adminTimetableSummary.textContent = `Timetable PDF saved for ${state.sectionCode} at ${response.filePath}.`;
}

function collectStudentRows() {
  return [...appState.adminEditStudentsBody.querySelectorAll("tr[data-srn]")]
    .map((row) => ({
      srn: row.querySelector('[data-field="srn"]')?.value || "",
      studentName: row.querySelector('[data-field="studentName"]')?.value || "",
      parentPhoneNo: row.querySelector('[data-field="parentPhoneNo"]')?.value || "",
      gender: row.querySelector('[data-field="gender"]')?.value || "",
      batchLabel: row.querySelector('[data-field="batchLabel"]')?.value || "",
      sectionCode: row.querySelector('[data-field="sectionCode"]')?.value || ""
    }));
}

function collectAssignmentRows() {
  return [...appState.adminEditAssignmentsBody.querySelectorAll(".admin-assignment-row")]
    .map((row) => ({
      teacherId: row.querySelector('[data-field="teacherId"]')?.value || "",
      teacherName: row.querySelector('[data-field="teacherName"]')?.value || "",
      subjectCode: row.querySelector('[data-field="subjectCode"]')?.value || "",
      courseName: row.querySelector('[data-field="courseName"]')?.value || "",
      shortCode: row.querySelector('[data-field="shortCode"]')?.value || "",
      batchLabel: row.querySelector('[data-field="batchLabel"]')?.value || "",
      sectionCode: row.querySelector('[data-field="sectionCode"]')?.value || ""
    }))
    .filter((row) => {
      return [row.teacherId, row.teacherName, row.subjectCode, row.courseName, row.shortCode]
        .some((value) => String(value || "").trim());
    });
}

async function saveAdminSectionMeta() {
  if (!adminEditDataset?.sectionCode) {
    throw new Error("Load a section before saving the proctor.");
  }

  const response = await window.adminApp.saveAdminSectionMeta({
    sectionCode: adminEditDataset.sectionCode,
    proctorName: appState.adminEditProctorInput.value
  });

  if (!response.ok) {
    throw new Error(response.message || "Could not save section settings.");
  }

  await loadAdminOverview();
  await loadAdminEditDataset(adminEditDataset.sectionCode);
  appState.adminEditSectionCopy.textContent = `Saved proctor for ${adminEditDataset.sectionCode}.`;
}

async function saveAdminStudents() {
  if (!adminEditDataset?.sectionCode) {
    throw new Error("Load a section before saving students.");
  }

  const response = await window.adminApp.saveAdminStudents({
    students: collectStudentRows()
  });

  if (!response.ok) {
    throw new Error(response.message || "Could not save students.");
  }

  await loadAdminOverview();
  await loadAdminSectionReport(appState.adminSectionSelect.value);
  await loadAdminEditDataset(adminEditDataset.sectionCode);
  appState.adminEditPill.textContent = `${adminEditDataset.sectionCode} | ${response.updatedCount} student rows saved`;
}

async function saveAdminAssignments() {
  if (!adminEditDataset?.sectionCode) {
    throw new Error("Load a section before saving faculty allocation.");
  }

  const rows = collectAssignmentRows();
  const invalidRow = rows.find((row) => row.sectionCode && row.sectionCode !== adminEditDataset.sectionCode);
  if (invalidRow) {
    throw new Error("Faculty allocation rows on this screen must stay under the currently selected section.");
  }

  const response = await window.adminApp.saveAdminAssignments({
    sectionCode: adminEditDataset.sectionCode,
    proctorName: appState.adminEditProctorInput.value,
    assignments: rows
  });

  if (!response.ok) {
    throw new Error(response.message || "Could not save faculty allocation.");
  }

  await loadAdminOverview();
  await loadAdminSectionReport(adminEditDataset.sectionCode);
  await loadAdminEditDataset(adminEditDataset.sectionCode);
  appState.adminEditPill.textContent = `${adminEditDataset.sectionCode} | ${response.updatedCount} allocation row${response.updatedCount === 1 ? "" : "s"} saved`;
}

async function openAdminDashboard() {
  showScreen("adminScreen");
  setAdminPage("overview");
  appState.adminSectionGrid.innerHTML = `
    <article class="panel">
      <p class="subtle">Loading admin overview from PostgreSQL...</p>
    </article>
  `;
  renderAdminSectionReport(null);
  renderAdminEditDataset(null);
  renderAdminTimetableState(null);
  await loadAdminOverview();
  if (appState.adminSectionSelect.value) {
    await loadAdminSectionReport(appState.adminSectionSelect.value);
  }
}

async function downloadAdminReport() {
  if (!adminSectionReport) {
    throw new Error("Load a section report before downloading the PDF.");
  }

  const html = buildAdminReportDocumentHtml(adminSectionReport);
  const response = await window.adminApp.exportAdminReportPdf({
    html,
    defaultFileName: `${adminSectionReport.sectionCode}_attendance_report.pdf`
  });

  if (!response.ok) {
    throw new Error(response.message || "Could not export the admin report PDF.");
  }

  appState.adminReportSummary.textContent = `PDF report saved for ${adminSectionReport.sectionCode} at ${response.filePath}.`;
}

async function handleLogin(event) {
  event.preventDefault();
  appState.loginMessage.textContent = "";
  appState.loginMessage.classList.remove("success");

  try {
    await window.adminApp.ensureDatabaseSchema();
    const formData = new FormData(appState.loginForm);
    const adminName = String(formData.get("adminName") || "").trim();
    const password = String(formData.get("password") || "").trim();

    if (!adminName || !password) {
      appState.loginMessage.textContent = "Enter both admin/coordinator name and password.";
      return;
    }

    const response = await window.adminApp.loginAdmin({ adminName, password });
    if (!response.ok || !response.admin) {
      appState.loginMessage.textContent = response.message || "Invalid login.";
      return;
    }

    currentAdmin = response.admin;
    appState.loginMessage.textContent = "Login successful. Opening admin dashboard...";
    appState.loginMessage.classList.add("success");
    window.setTimeout(() => {
      void openAdminDashboard().catch((error) => {
        appState.loginMessage.textContent = `Admin login failed: ${error.message}`;
        showScreen("loginScreen");
      });
    }, 400);
  } catch (error) {
    appState.loginMessage.textContent = `Login failed: ${error.message}`;
  }
}

async function logoutAdmin() {
  if (window.adminApp?.logoutAdmin) {
    await window.adminApp.logoutAdmin();
  }

  currentAdmin = null;
  adminSections = [];
  adminSectionReport = null;
  adminEditDataset = null;
  adminTimetableState = null;
  appState.loginForm.reset();
  appState.loginMessage.textContent = "";
  appState.loginMessage.classList.remove("success");
  showScreen("loginScreen");
}

appState.loginForm.addEventListener("submit", (event) => {
  void handleLogin(event);
});

appState.adminRefreshBtn.addEventListener("click", () => {
  void loadAdminOverview()
    .then(() => loadAdminSectionReport(appState.adminSectionSelect.value))
    .catch((error) => {
      appState.adminReportSummary.textContent = `Could not refresh admin overview: ${error.message}`;
    });
});

appState.adminLogoutBtn.addEventListener("click", () => {
  void logoutAdmin();
});

appState.adminOverviewNavBtn.addEventListener("click", () => {
  setAdminPage("overview");
});

appState.adminRefreshNavBtn.addEventListener("click", () => {
  void loadAdminOverview()
    .then(() => loadAdminSectionReport(appState.adminSectionSelect.value))
    .catch((error) => {
      appState.adminReportSummary.textContent = `Could not refresh admin overview: ${error.message}`;
    });
});

appState.adminDownloadNavBtn.addEventListener("click", () => {
  setAdminPage("report");
});

appState.adminEditDataNavBtn.addEventListener("click", () => {
  setAdminPage("edit");
  const sectionCode = appState.adminEditSectionSelect.value || appState.adminSectionSelect.value;
  if (!adminEditDataset || adminEditDataset.sectionCode !== sectionCode) {
    void loadAdminEditDataset(sectionCode).catch((error) => {
      appState.adminEditSectionCopy.textContent = `Could not load edit data: ${error.message}`;
    });
  }
});

appState.adminLoadReportBtn.addEventListener("click", () => {
  void loadAdminSectionReport(appState.adminSectionSelect.value).catch((error) => {
    appState.adminReportSummary.textContent = `Could not load admin report: ${error.message}`;
  });
});

appState.adminTimetableNavBtn.addEventListener("click", () => {
  setAdminPage("timetable");
  const sectionCode = appState.adminTimetableSectionSelect.value || appState.adminSectionSelect.value;
  if (!adminTimetableState || adminTimetableState.sectionCode !== sectionCode) {
    void loadAdminTimetableWorkspace(sectionCode).catch((error) => {
      appState.adminTimetableSummary.textContent = `Could not load timetable workspace: ${error.message}`;
    });
  }
});

appState.adminDownloadReportBtn.addEventListener("click", () => {
  void downloadAdminReport().catch((error) => {
    appState.adminReportSummary.textContent = error.message;
  });
});

appState.adminLoadEditBtn.addEventListener("click", () => {
  void loadAdminEditDataset(appState.adminEditSectionSelect.value).catch((error) => {
    appState.adminEditSectionCopy.textContent = `Could not load edit data: ${error.message}`;
  });
});

appState.adminLoadTimetableBtn.addEventListener("click", () => {
  void loadAdminTimetableWorkspace(appState.adminTimetableSectionSelect.value).catch((error) => {
    appState.adminTimetableSummary.textContent = `Could not load timetable workspace: ${error.message}`;
  });
});

appState.adminSaveTimetableDraftBtn.addEventListener("click", () => {
  try {
    saveAdminTimetableDraft();
  } catch (error) {
    appState.adminTimetableSummary.textContent = error.message;
  }
});

appState.adminDownloadTimetableBtn.addEventListener("click", () => {
  void downloadGeneratedTimetablePdf().catch((error) => {
    appState.adminTimetableSummary.textContent = error.message;
  });
});

appState.adminSaveProctorBtn.addEventListener("click", () => {
  void saveAdminSectionMeta().catch((error) => {
    appState.adminEditSectionCopy.textContent = error.message;
  });
});

appState.adminSaveStudentsBtn.addEventListener("click", () => {
  void saveAdminStudents().catch((error) => {
    appState.adminEditSectionCopy.textContent = error.message;
  });
});

appState.adminAddAssignmentRowBtn.addEventListener("click", () => {
  if (!adminEditDataset?.sectionCode) {
    appState.adminEditSectionCopy.textContent = "Load a section before adding faculty allocation rows.";
    return;
  }

  if (appState.adminEditAssignmentsBody.querySelector(".attendance-empty")) {
    appState.adminEditAssignmentsBody.innerHTML = "";
  }

  appState.adminEditAssignmentsBody.insertAdjacentHTML(
    "beforeend",
    buildAssignmentRowMarkup({
      teacherId: "",
      teacherName: "",
      subjectCode: "",
      courseName: "",
      shortCode: "",
      batchLabel: "ALL",
      sectionCode: adminEditDataset.sectionCode
    })
  );
});

appState.adminEditAssignmentsBody.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target.dataset.action === "delete-assignment-row") {
    target.closest("tr")?.remove();
    if (!appState.adminEditAssignmentsBody.querySelector(".admin-assignment-row")) {
      appState.adminEditAssignmentsBody.innerHTML = `
        <tr>
          <td colspan="8" class="attendance-empty">No faculty allocation rows left. Add one to continue editing.</td>
        </tr>
      `;
    }
  }
});

appState.adminSaveAssignmentsBtn.addEventListener("click", () => {
  void saveAdminAssignments().catch((error) => {
    appState.adminEditSectionCopy.textContent = error.message;
  });
});

window.setTimeout(() => {
  showScreen("loginScreen");
}, 1200);
