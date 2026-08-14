const fs = require("fs");
const path = require("path");

const CACHE_SCHEMA_VERSION = 4;

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createOfflineStore(filePath) {
  function createEmptyState() {
    return {
      schemaVersion: CACHE_SCHEMA_VERSION,
      teachers: {},
      queuedAttendance: []
    };
  }

  function ensureDirectory() {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  function loadState() {
    ensureDirectory();

    if (!fs.existsSync(filePath)) {
      const initialState = createEmptyState();
      fs.writeFileSync(filePath, JSON.stringify(initialState, null, 2), "utf8");
      return initialState;
    }

    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = raw ? JSON.parse(raw) : createEmptyState();
      if (parsed?.schemaVersion !== CACHE_SCHEMA_VERSION) {
        const resetState = createEmptyState();
        fs.writeFileSync(filePath, JSON.stringify(resetState, null, 2), "utf8");
        return resetState;
      }
      return parsed;
    } catch {
      return createEmptyState();
    }
  }

  let state = loadState();

  function saveState() {
    ensureDirectory();
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf8");
  }

  function teacherKey(teacherId) {
    return String(teacherId || "").trim().toUpperCase();
  }

  function countPresent(attendanceHistory) {
    return Object.values(attendanceHistory || {}).filter((status) => status === "P").length;
  }

  function normalizeDates(entries) {
    const unique = new Set(
      (entries || [])
        .map((entry) => (typeof entry === "string" ? entry : entry?.isoDate))
        .filter(Boolean)
    );

    return [...unique]
      .sort((left, right) => left.localeCompare(right))
      .map((isoDate) => ({ isoDate }));
  }

  function normalizeStudent(student) {
    const attendanceHistory = { ...(student?.attendanceHistory || {}) };

    return {
      srn: String(student?.srn || "").trim(),
      name: String(student?.name || student?.student_name || "").trim(),
      parentPhoneNo: String(student?.parentPhoneNo || student?.parent_phone_no || "").trim(),
      gender: String(student?.gender || "").trim(),
      batchLabel: String(student?.batchLabel || student?.batch_label || "").trim(),
      attendanceHistory,
      totalPresent: countPresent(attendanceHistory)
    };
  }

  function normalizeSection(section) {
    const normalizedSubjects = { ...(section?.subjects || {}) };
    const legacySubjectCode = String(section?.subjectCode || "").trim();

    if (legacySubjectCode && !normalizedSubjects[legacySubjectCode]) {
      normalizedSubjects[legacySubjectCode] = {
        students: section?.students || [],
        availableDates: section?.availableDates || [],
        summary: section?.summary || null
      };
    }

    const subjects = Object.fromEntries(
      Object.entries(normalizedSubjects).map(([subjectCode, subjectData]) => [
        String(subjectCode || "").trim(),
        {
          students: (subjectData?.students || []).map(normalizeStudent),
          availableDates: normalizeDates(subjectData?.availableDates),
          summary: subjectData?.summary || null
        }
      ])
    );

    return {
      code: String(section?.code || section?.sectionCode || "").trim(),
      subjects
    };
  }

  function normalizeTeacher(teacher, existingTeacher = null, options = {}) {
    const preserveSectionData = Boolean(options.preserveSectionData);
    const existingSections = new Map((existingTeacher?.sections || []).map((section) => [section.code, normalizeSection(section)]));
    const requestedSections = (teacher?.sections || [])
      .filter(Boolean)
      .map((section) => (typeof section === "string" ? { code: section } : section))
      .filter((section) => section?.code || section?.sectionCode);

    const sections = requestedSections.map((section) => {
      const normalized = normalizeSection(section);
      const existing = existingSections.get(normalized.code);

      if (!existing) {
        return normalized;
      }

      if (!preserveSectionData) {
        return normalized;
      }

      return {
        code: normalized.code,
        subjects: Object.keys(normalized.subjects).length ? normalized.subjects : existing.subjects
      };
    });

    return {
      teacherId: teacherKey(teacher?.teacherId || existingTeacher?.teacherId),
      name: String(teacher?.name || existingTeacher?.name || "").trim(),
      subject: String(teacher?.subject || existingTeacher?.subject || "").trim(),
      subjectCode: String(teacher?.subjectCode || teacher?.subject || existingTeacher?.subjectCode || existingTeacher?.subject || "").trim(),
      courseName: String(teacher?.courseName || existingTeacher?.courseName || teacher?.subject || existingTeacher?.subject || "").trim(),
      subjectAssignments: Array.isArray(teacher?.subjectAssignments)
        ? teacher.subjectAssignments
        : Array.isArray(existingTeacher?.subjectAssignments)
          ? existingTeacher.subjectAssignments
          : [],
      department: String(teacher?.department || existingTeacher?.department || "").trim(),
      designation: String(teacher?.designation || existingTeacher?.designation || "").trim(),
      semester: String(teacher?.semester || existingTeacher?.semester || "").trim(),
      sections
    };
  }

  function cacheTeacher(teacher, options = {}) {
    const key = teacherKey(teacher?.teacherId);
    if (!key) {
      return null;
    }

    const existingTeacher = state.teachers[key] || null;
    const normalizedTeacher = normalizeTeacher(teacher, existingTeacher, options);
    state.teachers[key] = normalizedTeacher;
    saveState();
    return deepClone(normalizedTeacher);
  }

  function getTeacher(teacherId) {
    const key = teacherKey(teacherId);
    const teacher = state.teachers[key];
    return teacher ? deepClone(teacher) : null;
  }

  function getCachedTeacher(teacherName, teacherId) {
    const teacher = state.teachers[teacherKey(teacherId)];
    if (!teacher) {
      return null;
    }

    if (teacher.name.toLowerCase() !== String(teacherName || "").trim().toLowerCase()) {
      return null;
    }

    return deepClone(teacher);
  }

  function getSubjectState(section, subjectCode) {
    return section?.subjects?.[String(subjectCode || "").trim()] || {
      students: [],
      availableDates: [],
      summary: null
    };
  }

  function updateSection(teacherId, sectionCode, subjectCode, updates) {
    const key = teacherKey(teacherId);
    const teacher = state.teachers[key];
    if (!teacher) {
      return null;
    }

    const normalizedCode = String(sectionCode || "").trim();
    const normalizedSubjectCode = String(subjectCode || "").trim();
    const sections = teacher.sections || [];
    const currentSection = sections.find((section) => section.code === normalizedCode) || {
      code: normalizedCode,
      subjects: {}
    };
    const currentSubjectState = getSubjectState(currentSection, normalizedSubjectCode);

    const nextSection = {
      ...currentSection,
      subjects: {
        ...(currentSection.subjects || {}),
        [normalizedSubjectCode]: {
          ...currentSubjectState,
          ...(updates || {})
        }
      }
    };

    if (updates?.students) {
      nextSection.subjects[normalizedSubjectCode].students = updates.students.map(normalizeStudent);
    }

    if (updates?.availableDates) {
      nextSection.subjects[normalizedSubjectCode].availableDates = normalizeDates(updates.availableDates);
    }

    teacher.sections = sections.some((section) => section.code === normalizedCode)
      ? sections.map((section) => (section.code === normalizedCode ? nextSection : section))
      : [...sections, nextSection];

    saveState();
    return deepClone(nextSection.subjects[normalizedSubjectCode]);
  }

  function getSection(teacherId, sectionCode, subjectCode) {
    const teacher = state.teachers[teacherKey(teacherId)];
    if (!teacher) {
      return null;
    }

    const section = (teacher.sections || []).find((entry) => entry.code === String(sectionCode || "").trim());
    return section ? deepClone(getSubjectState(section, subjectCode)) : null;
  }

  function applyAttendanceEntries(teacherId, sectionCode, subjectCode, attendanceDate, entries) {
    const section = getSection(teacherId, sectionCode, subjectCode);
    if (!section) {
      return null;
    }

    const entryMap = new Map((entries || []).map((entry) => [String(entry.srn || "").trim(), entry.status || "A"]));
    const students = section.students.map((student) => {
      const nextHistory = { ...(student.attendanceHistory || {}) };
      nextHistory[attendanceDate] = entryMap.get(student.srn) || "A";

      return {
        ...student,
        attendanceHistory: nextHistory,
        totalPresent: countPresent(nextHistory)
      };
    });

    const availableDates = normalizeDates([...(section.availableDates || []), attendanceDate]);
    return updateSection(teacherId, sectionCode, subjectCode, { students, availableDates });
  }

  function clearAttendanceDate(teacherId, sectionCode, subjectCode, attendanceDate) {
    const section = getSection(teacherId, sectionCode, subjectCode);
    if (!section) {
      return null;
    }

    const students = section.students.map((student) => {
      const nextHistory = { ...(student.attendanceHistory || {}) };
      delete nextHistory[attendanceDate];

      return {
        ...student,
        attendanceHistory: nextHistory,
        totalPresent: countPresent(nextHistory)
      };
    });

    const hasRemainingDate = students.some((student) => student.attendanceHistory?.[attendanceDate]);
    const availableDates = hasRemainingDate
      ? normalizeDates(section.availableDates)
      : normalizeDates((section.availableDates || []).filter((entry) => entry.isoDate !== attendanceDate));

    return updateSection(teacherId, sectionCode, subjectCode, { students, availableDates });
  }

  function queueAttendance(teacherId, teacherName, payload) {
    const normalizedTeacherId = teacherKey(teacherId);
    const record = {
      teacherId: normalizedTeacherId,
      teacherName: String(teacherName || "").trim(),
      sectionCode: String(payload.sectionCode || "").trim(),
      attendanceDate: String(payload.attendanceDate || "").trim(),
      subjectCode: String(payload.subjectCode || "").trim(),
      entries: (payload.entries || []).map((entry) => ({
        srn: String(entry.srn || "").trim(),
        status: entry.status === "P" ? "P" : "A"
      })),
      queuedAt: new Date().toISOString()
    };

    state.queuedAttendance = (state.queuedAttendance || []).filter(
      (entry) =>
        !(
          entry.teacherId === record.teacherId &&
          entry.sectionCode === record.sectionCode &&
          entry.attendanceDate === record.attendanceDate &&
          entry.subjectCode === record.subjectCode
        )
    );

    state.queuedAttendance.push(record);
    applyAttendanceEntries(record.teacherId, record.sectionCode, record.subjectCode, record.attendanceDate, record.entries);
    saveState();
    return deepClone(record);
  }

  function removeQueuedAttendance(teacherId, sectionCode, attendanceDate, subjectCode) {
    const normalizedTeacherId = teacherKey(teacherId);
    state.queuedAttendance = (state.queuedAttendance || []).filter(
      (entry) =>
        !(
          entry.teacherId === normalizedTeacherId &&
          entry.sectionCode === String(sectionCode || "").trim() &&
          entry.attendanceDate === String(attendanceDate || "").trim() &&
          entry.subjectCode === String(subjectCode || "").trim()
        )
    );
    saveState();
  }

  function getQueuedAttendance(teacherId) {
    const normalizedTeacherId = teacherKey(teacherId);
    return deepClone((state.queuedAttendance || []).filter((entry) => entry.teacherId === normalizedTeacherId));
  }

  function getQueuedCount(teacherId) {
    return getQueuedAttendance(teacherId).length;
  }

  function buildSectionSummary(teacherId, sectionCodes, subjectCode, selectedIsoDate) {
    return (sectionCodes || []).map((sectionCode) => {
      const section = getSection(teacherId, sectionCode, subjectCode) || { students: [] };
      const presentCount = section.students.filter((student) => student.attendanceHistory?.[selectedIsoDate] === "P").length;
      const absentCount = section.students.filter((student) => student.attendanceHistory?.[selectedIsoDate] === "A").length;

      return {
        section_code: sectionCode,
        student_count: section.students.length,
        present_count: presentCount,
        absent_count: absentCount
      };
    });
  }

  function buildSectionAnalytics(teacherId, sectionCodes, subjectCode) {
    return (sectionCodes || []).map((sectionCode) => {
      const section = getSection(teacherId, sectionCode, subjectCode) || { students: [], availableDates: [] };
      const dates = new Set(section.availableDates.map((entry) => entry.isoDate));

      for (const student of section.students || []) {
        Object.keys(student.attendanceHistory || {}).forEach((isoDate) => dates.add(isoDate));
      }

      const totalClasses = dates.size;
      const students = (section.students || []).map((student) => {
        const presentCount = Object.values(student.attendanceHistory || {}).filter((status) => status === "P").length;
        const absentCount = Object.values(student.attendanceHistory || {}).filter((status) => status === "A").length;
        const attendancePercentage = totalClasses === 0 ? null : Number(((presentCount / totalClasses) * 100).toFixed(2));

        return {
          srn: student.srn,
          name: student.name,
          presentCount,
          absentCount,
          totalClasses,
          attendancePercentage
        };
      });

      const percentageValues = students
        .map((student) => student.attendancePercentage)
        .filter((percentage) => percentage !== null);
      const averagePercentage = percentageValues.length
        ? Number((percentageValues.reduce((sum, percentage) => sum + percentage, 0) / percentageValues.length).toFixed(2))
        : null;
      const lowAttendanceStudents = students.filter(
        (student) => student.attendancePercentage !== null && student.attendancePercentage < 75
      );

      return {
        section_code: sectionCode,
        student_count: students.length,
        total_classes: totalClasses,
        average_percentage: averagePercentage,
        low_attendance_count: lowAttendanceStudents.length,
        low_attendance_students: lowAttendanceStudents
      };
    });
  }

  function buildAbsenteesForDate(teacherId, sectionCode, subjectCode, attendanceDate) {
    const section = getSection(teacherId, sectionCode, subjectCode) || { students: [] };

    return (section.students || [])
      .filter((student) => student.attendanceHistory?.[attendanceDate] === "A")
      .sort((left, right) => left.srn.localeCompare(right.srn))
      .map((student, index) => ({
        serialNo: index + 1,
        srn: student.srn,
        name: student.name,
        parentPhoneNo: student.parentPhoneNo || "",
        gender: student.gender || "",
        attendanceDate
      }));
  }

  async function syncQueuedAttendance({ teacherId, token, apiClient }) {
    const items = getQueuedAttendance(teacherId).sort((left, right) => left.queuedAt.localeCompare(right.queuedAt));
    const touchedSections = new Set();
    let syncedCount = 0;

    for (const item of items) {
      await apiClient.saveAttendanceDate(
        {
          sectionCode: item.sectionCode,
          attendanceDate: item.attendanceDate,
          subjectCode: item.subjectCode,
          entries: item.entries
        },
        token
      );

      removeQueuedAttendance(item.teacherId, item.sectionCode, item.attendanceDate, item.subjectCode);
      touchedSections.add(item.sectionCode);
      syncedCount += 1;
    }

    return {
      syncedCount,
      touchedSections: [...touchedSections]
    };
  }

  return {
    cacheTeacher,
    getTeacher,
    getCachedTeacher,
    updateSection,
    getSection,
    applyAttendanceEntries,
    clearAttendanceDate,
    queueAttendance,
    removeQueuedAttendance,
    getQueuedAttendance,
    getQueuedCount,
    buildSectionSummary,
    buildSectionAnalytics,
    buildAbsenteesForDate,
    syncQueuedAttendance
  };
}

module.exports = {
  createOfflineStore
};
