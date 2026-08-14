const path = require("path");
const dotenv = require("dotenv");
const { Pool } = require("pg");
const timetableReference = require("./timetable_reference.json");

dotenv.config({ path: path.join(__dirname, ".env") });

let pool = null;
let initializationPromise = null;

function getTimetableSectionReference(sectionCode) {
  return timetableReference?.sections?.[sectionCode] || null;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function isReportableSubject({ shortCode, subjectCode, courseName }) {
  const shortCodeValue = normalizeText(shortCode).toUpperCase();
  const subjectCodeValue = normalizeText(subjectCode).toUpperCase();
  const courseNameValue = normalizeText(courseName).toUpperCase();

  if (!shortCodeValue && !subjectCodeValue && !courseNameValue) {
    return false;
  }

  return !(
    shortCodeValue === "PWM" ||
    subjectCodeValue === "PROCTOR" ||
    courseNameValue === "WARD MEETING"
  );
}

function isElectiveSubjectCode(subjectCode) {
  const code = getCanonicalAttendanceSubjectCode(subjectCode);
  return code === "DC" || code === "MC";
}

function normalizeSubjectCode(subjectCode) {
  return normalizeText(subjectCode).toUpperCase();
}

function getCanonicalAttendanceSubjectCode(subjectCode) {
  return normalizeSubjectCode(subjectCode);
}

function getAttendanceSubjectAliases(subjectCode) {
  const normalized = getCanonicalAttendanceSubjectCode(subjectCode);
  return normalized ? [normalized] : [];
}

function getAdminReportSubjectKey(subjectCode) {
  const normalized = normalizeSubjectCode(subjectCode);
  const mergedMap = {
    DAVL: "DAV",
    DBMSL: "DBMS",
    USPL: "USP"
  };

  return mergedMap[normalized] || normalized;
}

function getAdminReportSubjectAliases(subjectCode) {
  const subjectKey = getAdminReportSubjectKey(subjectCode);
  const aliasMap = {
    DAV: ["DAV", "DAVL"],
    DBMS: ["DBMS", "DBMSL"],
    USP: ["USP", "USPL"]
  };

  return aliasMap[subjectKey] || (subjectKey ? [subjectKey] : []);
}

function getAdminReportDisplayShortCode(subjectCode) {
  const subjectKey = getAdminReportSubjectKey(subjectCode);
  const displayMap = {
    DAV: "DAV + DAVL",
    DBMS: "DBMS + DBMSL",
    USP: "USP + USPL"
  };

  return displayMap[subjectKey] || subjectKey;
}

function normalizeStudentBatchLabel(batchLabel) {
  const normalized = normalizeBatchLabel(batchLabel);
  return normalized === "ALL" ? "" : normalized;
}

function getBatchFilter(allowedBatches) {
  const normalizedBatches = dedupeValues(
    (allowedBatches || [])
      .map(normalizeBatchLabel)
      .filter((label) => label && label !== "ALL")
  );

  return {
    restricted: normalizedBatches.length > 0,
    values: normalizedBatches
  };
}

function normalizeTeacherLookupName(value) {
  return normalizeText(value)
    .toUpperCase()
    .replace(/^DR\.?\s+/i, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAdminRole(role) {
  const normalized = normalizeText(role).toLowerCase();
  return normalized === "admin" || normalized === "course_coordinator" || normalized === "director"
    ? normalized
    : null;
}

function normalizeBatchLabel(batchLabel) {
  const normalized = normalizeText(batchLabel)
    .toUpperCase()
    .replace(/&/g, "AND")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized || normalized === "ALL") {
    return "ALL";
  }

  if (normalized.includes("B1") && normalized.includes("B2")) {
    return "ALL";
  }

  if (normalized === "B1") {
    return "B1";
  }

  if (normalized === "B2") {
    return "B2";
  }

  return normalized;
}

function parseFacultyAssignments(facultyText) {
  return String(facultyText || "")
    .split("/")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const batchMatch = entry.match(/\(([^)]*)\)/);
      const teacherName = normalizeText(entry.replace(/\([^)]*\)/g, ""));

      return {
        teacherName,
        batchLabel: normalizeBatchLabel(batchMatch?.[1] || "")
      };
    })
    .filter((entry) => entry.teacherName);
}

function dedupeValues(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function getConfig() {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString) {
    return {
      connectionString,
      ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false
    };
  }

  if (!process.env.PGHOST || !process.env.PGDATABASE || !process.env.PGUSER) {
    return null;
  }

  return {
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD || "",
    ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false
  };
}

function isConfigured() {
  return Boolean(getConfig());
}

function getPool() {
  if (!pool) {
    const config = getConfig();

    if (!config) {
      throw new Error("PostgreSQL is not configured. Add connection values to the .env file.");
    }

    pool = new Pool(config);
    pool.on("error", (error) => {
      console.error("Unexpected PostgreSQL pool error", error);
    });
  }

  return pool;
}

async function query(text, params = []) {
  return getPool().query(text, params);
}

function getReferenceSectionFacultyMappings(sectionCode) {
  const reference = getTimetableSectionReference(sectionCode);
  if (!reference?.subjects?.length) {
    return [];
  }

  const rows = [];

  for (const subject of reference.subjects) {
    if (!isReportableSubject({
      shortCode: subject.shortCode,
      subjectCode: subject.courseCode,
      courseName: subject.courseName
    })) {
      continue;
    }

    const facultyAssignments = parseFacultyAssignments(subject.faculty);
    for (const faculty of facultyAssignments) {
      rows.push({
        teach_srn: "",
        subject_code: normalizeText(subject.courseCode || subject.shortCode),
        course_name: normalizeText(subject.courseName || subject.shortCode),
        short_code: normalizeText(subject.shortCode),
        batch_label: faculty.batchLabel || "ALL",
        teacher_name: faculty.teacherName
      });
    }
  }

  return rows;
}

async function getSectionFacultyMappings(sectionCode) {
  const result = await query(
    `
      SELECT DISTINCT
        tsa.teach_srn,
        COALESCE(tsa.subject_code, t.subject_code, t.course_short_code, '') AS subject_code,
        COALESCE(tsa.course_name, t.course_name, t.course_short_code, t.subject_code, '') AS course_name,
        COALESCE(tsa.course_short_code, t.course_short_code, t.subject_code, '') AS short_code,
        COALESCE(tsa.batch_label, 'ALL') AS batch_label,
        t.teacher_name
      FROM teacher_subject_assignments tsa
      INNER JOIN teachers t ON t.teach_srn = tsa.teach_srn
      WHERE tsa.section_code = $1
      ORDER BY short_code, subject_code, batch_label, teacher_name
    `,
    [sectionCode]
  );

  const rows = result.rows || [];
  return rows.length ? rows : getReferenceSectionFacultyMappings(sectionCode);
}

async function testConnection() {
  if (!isConfigured()) {
    return { ok: false, configured: false, message: "Database connection values are missing." };
  }

  try {
    await query("SELECT 1");
    return { ok: true, configured: true, message: "Connected to PostgreSQL." };
  } catch (error) {
    return { ok: false, configured: true, message: error.message };
  }
}

async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS sections (
      section_code TEXT PRIMARY KEY,
      proctor_name TEXT
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS students (
      srn TEXT PRIMARY KEY,
      student_name TEXT NOT NULL,
      parent_phone_no TEXT,
      gender TEXT,
      section_code TEXT NOT NULL REFERENCES sections (section_code) ON DELETE RESTRICT
    )
  `);

  await query(`
    ALTER TABLE students
    ADD COLUMN IF NOT EXISTS parent_phone_no TEXT
  `);

  await query(`
    ALTER TABLE students
    ADD COLUMN IF NOT EXISTS gender TEXT
  `);

  await query(`
    ALTER TABLE students
    ADD COLUMN IF NOT EXISTS batch_label TEXT
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS student_electives (
      srn TEXT NOT NULL REFERENCES students (srn) ON DELETE CASCADE,
      elective_code TEXT NOT NULL,
      PRIMARY KEY (srn, elective_code)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS teachers (
      teach_srn TEXT PRIMARY KEY,
      teacher_name TEXT NOT NULL,
      subject_code TEXT NOT NULL,
      course_name TEXT
    )
  `);

  await query(`
    ALTER TABLE teachers
    ADD COLUMN IF NOT EXISTS course_name TEXT
  `);

  await query(`
    ALTER TABLE teachers
    ADD COLUMN IF NOT EXISTS course_short_code TEXT
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS teacher_sections (
      teach_srn TEXT NOT NULL REFERENCES teachers (teach_srn) ON DELETE CASCADE,
      section_code TEXT NOT NULL REFERENCES sections (section_code) ON DELETE CASCADE,
      PRIMARY KEY (teach_srn, section_code)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS teacher_subject_assignments (
      teach_srn TEXT NOT NULL REFERENCES teachers (teach_srn) ON DELETE CASCADE,
      section_code TEXT NOT NULL REFERENCES sections (section_code) ON DELETE CASCADE,
      subject_code TEXT NOT NULL,
      course_name TEXT,
      course_short_code TEXT NOT NULL,
      batch_label TEXT NOT NULL DEFAULT 'ALL',
      PRIMARY KEY (teach_srn, section_code, course_short_code, batch_label)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS admins (
      admin_id TEXT PRIMARY KEY,
      admin_name TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'course_coordinator'))
    )
  `);

  await query(`
    ALTER TABLE admins
    ADD COLUMN IF NOT EXISTS admin_name TEXT
  `);

  await query(`
    ALTER TABLE admins
    ADD COLUMN IF NOT EXISTS password TEXT
  `);

  await query(`
    ALTER TABLE admins
    ADD COLUMN IF NOT EXISTS role TEXT
  `);

  await query(`
    UPDATE admins
    SET admin_name = COALESCE(NULLIF(TRIM(admin_name), ''), NULLIF(TRIM(admin_id), ''))
    WHERE COALESCE(TRIM(admin_name), '') = ''
  `);

  await query(`
    UPDATE admins
    SET role = CASE
      WHEN LOWER(TRIM(COALESCE(role, ''))) IN ('admin', 'course_coordinator', 'director') THEN LOWER(TRIM(role))
      ELSE 'course_coordinator'
    END
    WHERE COALESCE(TRIM(role), '') = ''
       OR LOWER(TRIM(role)) NOT IN ('admin', 'course_coordinator', 'director')
  `);

  await query(`
    ALTER TABLE admins
    ALTER COLUMN admin_name SET NOT NULL
  `);

  await query(`
    ALTER TABLE admins
    ALTER COLUMN password SET NOT NULL
  `);

  await query(`
    ALTER TABLE admins
    ALTER COLUMN role SET NOT NULL
  `);

  await query(`
    ALTER TABLE admins
    DROP CONSTRAINT IF EXISTS admins_role_check
  `);

  await query(`
    ALTER TABLE admins
    ADD CONSTRAINT admins_role_check
    CHECK (role IN ('admin', 'course_coordinator', 'director'))
  `);

  await query(`
    ALTER TABLE admins
    DROP COLUMN IF EXISTS login_name
  `);

  await query(`
    ALTER TABLE admins
    DROP COLUMN IF EXISTS is_active
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS attendance (
      srn TEXT NOT NULL REFERENCES students (srn) ON DELETE CASCADE,
      attendance_date DATE NOT NULL,
      subject_code TEXT NOT NULL,
      status CHAR(1) NOT NULL CHECK (status IN ('P', 'A')),
      PRIMARY KEY (srn, attendance_date, subject_code)
    )
  `);

  await query(`
    ALTER TABLE attendance
    ADD COLUMN IF NOT EXISTS subject_code TEXT
  `);

  await query(`
    UPDATE attendance
    SET subject_code = 'DBMS'
    WHERE subject_code IS NULL
  `);

  await query(`
    ALTER TABLE attendance
    DROP CONSTRAINT IF EXISTS attendance_pkey
  `);

  await query(`
    ALTER TABLE attendance
    ADD PRIMARY KEY (srn, attendance_date, subject_code)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS students_section_idx
    ON students (section_code)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS student_electives_code_idx
    ON student_electives (elective_code)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS attendance_date_idx
    ON attendance (attendance_date)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS attendance_subject_date_idx
    ON attendance (subject_code, attendance_date)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS teacher_sections_teacher_idx
    ON teacher_sections (teach_srn)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS teacher_sections_section_idx
    ON teacher_sections (section_code)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS teacher_subject_assignments_teacher_idx
    ON teacher_subject_assignments (teach_srn)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS teacher_subject_assignments_section_idx
    ON teacher_subject_assignments (section_code)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS teacher_subject_assignments_subject_idx
    ON teacher_subject_assignments (course_short_code)
  `);

  await query(`
    DROP VIEW IF EXISTS student_total_present
  `);

  await query(`
    CREATE VIEW student_total_present AS
    SELECT
      srn,
      CASE
        WHEN UPPER(subject_code) = 'DAVL' THEN 'DAV'
        WHEN UPPER(subject_code) = 'DBMSL' THEN 'DBMS'
        WHEN UPPER(subject_code) = 'USPL' THEN 'USP'
        ELSE UPPER(subject_code)
      END AS subject_code,
      COUNT(*) FILTER (WHERE status = 'P')::int AS total_present
    FROM attendance
    GROUP BY
      srn,
      CASE
        WHEN UPPER(subject_code) = 'DAVL' THEN 'DAV'
        WHEN UPPER(subject_code) = 'DBMSL' THEN 'DBMS'
        WHEN UPPER(subject_code) = 'USPL' THEN 'USP'
        ELSE UPPER(subject_code)
      END
  `);

  await syncTimetableTeacherAssignments();
}

async function seedDefaults() {
  for (const [sectionCode, reference] of Object.entries(timetableReference?.sections || {})) {
    const normalizedSectionCode = normalizeText(sectionCode);
    if (!normalizedSectionCode) {
      continue;
    }

    await query(
      `
        INSERT INTO sections (section_code, proctor_name)
        VALUES ($1, $2)
        ON CONFLICT (section_code)
        DO UPDATE SET proctor_name = EXCLUDED.proctor_name
      `,
      [normalizedSectionCode, normalizeText(reference?.proctorName)]
    );
  }
}

async function syncTimetableTeacherAssignments() {
  const teacherResult = await query(`
    SELECT teach_srn, teacher_name
    FROM teachers
  `);

  const teacherLookup = new Map();

  for (const row of teacherResult.rows || []) {
    const normalizedName = normalizeTeacherLookupName(row.teacher_name);
    if (!normalizedName) {
      continue;
    }

    if (!teacherLookup.has(normalizedName)) {
      teacherLookup.set(normalizedName, []);
    }

    teacherLookup.get(normalizedName).push(row.teach_srn);
  }

  const assignmentRows = [];
  const sectionTeacherRows = [];
  const seenAssignments = new Set();
  const seenSections = new Set();

  for (const [sectionCode, reference] of Object.entries(timetableReference?.sections || {})) {
    for (const subject of reference?.subjects || []) {
      if (!isReportableSubject({
        shortCode: subject.shortCode,
        subjectCode: subject.courseCode,
        courseName: subject.courseName
      })) {
        continue;
      }

      const parsedFaculty = parseFacultyAssignments(subject.faculty);
      for (const faculty of parsedFaculty) {
        const candidates = teacherLookup.get(normalizeTeacherLookupName(faculty.teacherName)) || [];
        const teachSrn = candidates[0];
        const courseShortCode = normalizeSubjectCode(subject.shortCode);

        if (!teachSrn || !courseShortCode) {
          continue;
        }

        const batchLabel = normalizeBatchLabel(faculty.batchLabel);
        const assignmentKey = [teachSrn, sectionCode, courseShortCode, batchLabel].join("|");
        const sectionKey = [teachSrn, sectionCode].join("|");

        if (!seenAssignments.has(assignmentKey)) {
          seenAssignments.add(assignmentKey);
          assignmentRows.push({
            teachSrn,
            sectionCode,
            subjectCode: normalizeText(subject.courseCode || courseShortCode),
            courseName: normalizeText(subject.courseName || courseShortCode),
            courseShortCode,
            batchLabel
          });
        }

        if (!seenSections.has(sectionKey)) {
          seenSections.add(sectionKey);
          sectionTeacherRows.push({ teachSrn, sectionCode });
        }
      }
    }
  }

  for (const row of sectionTeacherRows) {
    await query(
      `
        INSERT INTO teacher_sections (teach_srn, section_code)
        VALUES ($1, $2)
        ON CONFLICT (teach_srn, section_code) DO NOTHING
      `,
      [row.teachSrn, row.sectionCode]
    );
  }

  for (const row of assignmentRows) {
    await query(
      `
        INSERT INTO teacher_subject_assignments (
          teach_srn,
          section_code,
          subject_code,
          course_name,
          course_short_code,
          batch_label
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (teach_srn, section_code, course_short_code, batch_label)
        DO UPDATE SET
          subject_code = EXCLUDED.subject_code,
          course_name = EXCLUDED.course_name
      `,
      [row.teachSrn, row.sectionCode, row.subjectCode, row.courseName, row.courseShortCode, row.batchLabel]
    );
  }
}

async function initializeDatabase() {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      await ensureSchema();
      await seedDefaults();
    })().catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }

  return initializationPromise;
}

function formatDateForPostgres(isoDate) {
  return isoDate;
}

function formatDateFromPostgres(isoDate) {
  const [year, month, day] = isoDate.split("-");
  const monthMap = {
    "01": "Jan",
    "02": "Feb",
    "03": "Mar",
    "04": "Apr",
    "05": "May",
    "06": "Jun",
    "07": "Jul",
    "08": "Aug",
    "09": "Sep",
    "10": "Oct",
    "11": "Nov",
    "12": "Dec"
  };

  return `${day} ${monthMap[month]} ${year}`;
}

async function authenticateTeacher(teacherName, teacherSrn) {
  await initializeDatabase();

  const teacherResult = await query(
    `
      SELECT
        t.teach_srn,
        t.teacher_name,
        t.subject_code,
        t.course_name,
        t.course_short_code
      FROM teachers t
      WHERE UPPER(t.teacher_name) = UPPER($1)
        AND UPPER(t.teach_srn) = UPPER($2)
    `,
    [teacherName.trim(), teacherSrn.trim().toUpperCase()]
  );

  if (teacherResult.rowCount === 0) {
    return null;
  }

  const teacher = teacherResult.rows[0];
  const sectionAccessResult = await query(
    `
      SELECT section_code
      FROM teacher_sections
      WHERE teach_srn = $1
      ORDER BY section_code
    `,
    [teacher.teach_srn]
  );

  const accessibleSections = dedupeValues(
    (sectionAccessResult.rows || [])
      .map((row) => normalizeText(row.section_code))
      .filter(Boolean)
  ).sort();

  const assignmentsResult = await query(
    `
      SELECT
        section_code,
        subject_code,
        course_name,
        course_short_code,
        batch_label
      FROM teacher_subject_assignments
      WHERE teach_srn = $1
      ORDER BY course_short_code, section_code, batch_label
    `,
    [teacher.teach_srn]
  );

  const assignmentGroups = new Map();

  for (const row of assignmentsResult.rows || []) {
    const courseShortCode = getCanonicalAttendanceSubjectCode(row.course_short_code || row.subject_code);
    if (!courseShortCode) {
      continue;
    }

    const existing = assignmentGroups.get(courseShortCode) || {
      subjectCode: courseShortCode,
      courseCode: normalizeText(row.subject_code || courseShortCode),
      courseName: normalizeText(row.course_name || courseShortCode),
      courseShortCode,
      sections: new Set(),
      batchLabels: new Set(),
      sectionBatches: new Map()
    };

    if (accessibleSections.includes(row.section_code)) {
      existing.sections.add(row.section_code);
    }
    const batchLabel = normalizeBatchLabel(row.batch_label);
    existing.batchLabels.add(batchLabel);
    if (accessibleSections.includes(row.section_code)) {
      if (!existing.sectionBatches.has(row.section_code)) {
        existing.sectionBatches.set(row.section_code, new Set());
      }
      existing.sectionBatches.get(row.section_code).add(batchLabel);
    }
    assignmentGroups.set(courseShortCode, existing);
  }

  const subjectAssignments = [...assignmentGroups.values()]
    .map((assignment) => ({
      subjectCode: assignment.subjectCode,
      courseCode: assignment.courseCode,
      courseName: assignment.courseName,
      courseShortCode: assignment.courseShortCode,
      sections: [...assignment.sections].sort(),
      sectionBatches: Object.fromEntries(
        [...assignment.sectionBatches.entries()].map(([sectionCode, batchLabels]) => [
          sectionCode,
          dedupeValues([...batchLabels].filter((label) => label !== "ALL").sort())
        ])
      ),
      batchLabels: dedupeValues(
        [...assignment.batchLabels]
          .filter((label) => label !== "ALL")
          .sort()
      )
    }))
    .sort((left, right) => left.courseShortCode.localeCompare(right.courseShortCode));

  const primaryAssignment = subjectAssignments[0] || {
    subjectCode: getCanonicalAttendanceSubjectCode(teacher.course_short_code || teacher.subject_code),
    courseCode: normalizeText(teacher.subject_code || teacher.course_short_code),
    courseName: teacher.course_name || teacher.course_short_code || teacher.subject_code,
    courseShortCode: getCanonicalAttendanceSubjectCode(teacher.course_short_code || teacher.subject_code),
    sections: [],
    sectionBatches: {},
    batchLabels: []
  };

  return {
    teacherId: teacher.teach_srn,
    name: teacher.teacher_name,
    subject: primaryAssignment.courseShortCode,
    subjectCode: primaryAssignment.subjectCode,
    courseName: primaryAssignment.courseName,
    courseShortCode: primaryAssignment.courseShortCode,
    sections: accessibleSections,
    subjectAssignments,
    department: "Department of Computer Science",
    designation: "Associate Professor",
    semester: "Semester 4"
  };
}

async function authenticateAdmin(adminName, password) {
  await initializeDatabase();

  const normalizedAdminName = normalizeText(adminName);
  if (!normalizedAdminName || !password) {
    return null;
  }

  const adminResult = await query(
    `
      SELECT
        admin_id,
        admin_name,
        role
      FROM admins
      WHERE UPPER(admin_name) = UPPER($1)
        AND password = $2
    `,
    [normalizedAdminName, password]
  );

  if (adminResult.rowCount === 0) {
    return null;
  }

  const admin = adminResult.rows[0];
  const role = normalizeAdminRole(admin.role);
  if (!role) {
    return null;
  }

  return {
    adminId: admin.admin_id,
    name: admin.admin_name,
    role
  };
}

async function getSectionSummary(sectionCodes, selectedIsoDate, subjectCode, allowedBatches = []) {
  await initializeDatabase();
  const electiveOnly = isElectiveSubjectCode(subjectCode);
  const subjectAliases = getAttendanceSubjectAliases(subjectCode);
  const batchFilter = getBatchFilter(allowedBatches);

  const result = await query(
    `
      WITH scoped_students AS (
        SELECT
          s.section_code,
          st.srn
        FROM sections s
        LEFT JOIN students st ON st.section_code = s.section_code
        WHERE s.section_code = ANY($1)
          AND (
            st.srn IS NULL
            OR $4 = FALSE
            OR EXISTS (
              SELECT 1
              FROM student_electives se
              WHERE se.srn = st.srn
                AND UPPER(se.elective_code) = UPPER($5)
            )
          )
          AND (
            st.srn IS NULL
            OR $6 = FALSE
            OR UPPER(COALESCE(st.batch_label, '')) = ANY($7::text[])
          )
      ),
      student_day_status AS (
        SELECT
          ss.section_code,
          ss.srn,
          CASE
            WHEN BOOL_OR(a.status = 'P') THEN 'P'
            WHEN COUNT(a.srn) > 0 THEN 'A'
            ELSE NULL
          END AS merged_status
        FROM scoped_students ss
        LEFT JOIN attendance a
          ON a.srn = ss.srn
         AND a.attendance_date = $2::date
         AND a.subject_code = ANY($3)
        GROUP BY ss.section_code, ss.srn
      )
      SELECT
        s.section_code,
        COUNT(sds.srn)::int AS student_count,
        COALESCE(SUM(CASE WHEN sds.merged_status = 'P' THEN 1 ELSE 0 END), 0)::int AS present_count,
        COALESCE(SUM(CASE WHEN sds.merged_status = 'A' THEN 1 ELSE 0 END), 0)::int AS absent_count
      FROM sections s
      LEFT JOIN student_day_status sds ON sds.section_code = s.section_code
      WHERE s.section_code = ANY($1)
      GROUP BY s.section_code
      ORDER BY s.section_code
    `,
    [sectionCodes, selectedIsoDate, subjectAliases, electiveOnly, subjectCode, batchFilter.restricted, batchFilter.values]
  );

  return result.rows;
}

async function getSectionAnalytics(sectionCodes, subjectCode, allowedBatches = []) {
  await initializeDatabase();
  const electiveOnly = isElectiveSubjectCode(subjectCode);
  const subjectAliases = getAttendanceSubjectAliases(subjectCode);
  const batchFilter = getBatchFilter(allowedBatches);

  const result = await query(
    `
      WITH section_dates AS (
        SELECT
          st.section_code,
          COUNT(DISTINCT CONCAT(a.subject_code, '|', a.attendance_date::text))::int AS total_classes
        FROM students st
        LEFT JOIN attendance a
          ON a.srn = st.srn
         AND a.subject_code = ANY($2)
        WHERE st.section_code = ANY($1)
          AND (
            $3 = FALSE
            OR EXISTS (
              SELECT 1
              FROM student_electives se
              WHERE se.srn = st.srn
                AND UPPER(se.elective_code) = UPPER($4)
            )
          )
          AND (
            $5 = FALSE
            OR UPPER(COALESCE(st.batch_label, '')) = ANY($6::text[])
          )
        GROUP BY st.section_code
      ),
      student_stats AS (
        SELECT
          st.section_code,
          st.srn,
          st.student_name,
          COALESCE(SUM(CASE WHEN a.status = 'P' THEN 1 ELSE 0 END), 0)::int AS present_count,
          COALESCE(SUM(CASE WHEN a.status = 'A' THEN 1 ELSE 0 END), 0)::int AS absent_count
        FROM students st
        LEFT JOIN attendance a
          ON a.srn = st.srn
         AND a.subject_code = ANY($2)
        WHERE st.section_code = ANY($1)
          AND (
            $3 = FALSE
            OR EXISTS (
              SELECT 1
              FROM student_electives se
              WHERE se.srn = st.srn
                AND UPPER(se.elective_code) = UPPER($4)
            )
          )
          AND (
            $5 = FALSE
            OR UPPER(COALESCE(st.batch_label, '')) = ANY($6::text[])
          )
        GROUP BY st.section_code, st.srn, st.student_name
      )
      SELECT
        ss.section_code,
        ss.srn,
        ss.student_name,
        ss.present_count,
        ss.absent_count,
        COALESCE(sd.total_classes, 0)::int AS total_classes,
        CASE
          WHEN COALESCE(sd.total_classes, 0) = 0 THEN NULL
          ELSE ROUND((ss.present_count::numeric / sd.total_classes::numeric) * 100, 2)
        END AS attendance_percentage
      FROM student_stats ss
      LEFT JOIN section_dates sd ON sd.section_code = ss.section_code
      ORDER BY ss.section_code, attendance_percentage NULLS FIRST, ss.srn
    `,
    [sectionCodes, subjectAliases, electiveOnly, subjectCode, batchFilter.restricted, batchFilter.values]
  );

  const sectionMap = new Map();

  for (const sectionCode of sectionCodes || []) {
    sectionMap.set(sectionCode, {
      section_code: sectionCode,
      student_count: 0,
      total_classes: 0,
      average_percentage: null,
      low_attendance_count: 0,
      low_attendance_students: []
    });
  }

  for (const row of result.rows) {
    const section = sectionMap.get(row.section_code) || {
      section_code: row.section_code,
      student_count: 0,
      total_classes: Number(row.total_classes || 0),
      average_percentage: null,
      low_attendance_count: 0,
      low_attendance_students: []
    };

    const percentage = row.attendance_percentage === null ? null : Number(row.attendance_percentage);
    section.student_count += 1;
    section.total_classes = Math.max(section.total_classes, Number(row.total_classes || 0));

    if (percentage !== null) {
      section.average_percentage = Number(
        (((section.average_percentage || 0) * (section.student_count - 1) + percentage) / section.student_count).toFixed(2)
      );
    }

    if (percentage !== null && percentage < 75) {
      section.low_attendance_students.push({
        srn: row.srn,
        name: row.student_name,
        presentCount: Number(row.present_count || 0),
        absentCount: Number(row.absent_count || 0),
        totalClasses: Number(row.total_classes || 0),
        attendancePercentage: percentage
      });
    }

    section.low_attendance_count = section.low_attendance_students.length;
    sectionMap.set(row.section_code, section);
  }

  return [...sectionMap.values()].sort((left, right) => left.section_code.localeCompare(right.section_code));
}

async function getAvailableDates(sectionCode, subjectCode, allowedBatches = []) {
  await initializeDatabase();
  const electiveOnly = isElectiveSubjectCode(subjectCode);
  const subjectAliases = getAttendanceSubjectAliases(subjectCode);
  const batchFilter = getBatchFilter(allowedBatches);

  const result = await query(
    `
      SELECT DISTINCT a.attendance_date::text AS attendance_date
      FROM attendance a
      INNER JOIN students s ON s.srn = a.srn
      WHERE s.section_code = $1
        AND a.subject_code = ANY($2)
        AND (
          $3 = FALSE
          OR EXISTS (
            SELECT 1
            FROM student_electives se
            WHERE se.srn = s.srn
              AND UPPER(se.elective_code) = UPPER($4)
          )
        )
        AND (
          $5 = FALSE
          OR UPPER(COALESCE(s.batch_label, '')) = ANY($6::text[])
        )
      ORDER BY attendance_date
    `,
    [sectionCode, subjectAliases, electiveOnly, subjectCode, batchFilter.restricted, batchFilter.values]
  );

  return result.rows.map((row) => ({
    isoDate: row.attendance_date,
    label: formatDateFromPostgres(row.attendance_date)
  }));
}

async function loadSectionAttendance(sectionCode, subjectCode, allowedBatches = []) {
  await initializeDatabase();
  const electiveOnly = isElectiveSubjectCode(subjectCode);
  const subjectAliases = getAttendanceSubjectAliases(subjectCode);
  const batchFilter = getBatchFilter(allowedBatches);

  const studentsResult = await query(
    `
      SELECT
        s.srn,
        s.student_name,
        s.parent_phone_no,
        s.gender,
        COALESCE(s.batch_label, '') AS batch_label,
        COALESCE(
          (
            SELECT JSONB_OBJECT_AGG(history.attendance_date, history.status)
            FROM (
              SELECT
                a2.attendance_date::text AS attendance_date,
                CASE
                  WHEN BOOL_OR(a2.status = 'P') THEN 'P'
                  ELSE 'A'
                END AS status
              FROM attendance a2
              WHERE a2.srn = s.srn
                AND a2.subject_code = ANY($2)
              GROUP BY a2.attendance_date
            ) history
          ),
          '{}'::jsonb
        ) AS attendance_history,
        COALESCE((
          SELECT COUNT(*)::int
          FROM attendance a3
          WHERE a3.srn = s.srn
            AND a3.subject_code = ANY($2)
            AND a3.status = 'P'
        ), 0) AS total_present
      FROM students s
      WHERE s.section_code = $1
        AND (
          $3 = FALSE
          OR EXISTS (
            SELECT 1
            FROM student_electives se
            WHERE se.srn = s.srn
              AND UPPER(se.elective_code) = UPPER($4)
          )
        )
        AND (
          $5 = FALSE
          OR UPPER(COALESCE(s.batch_label, '')) = ANY($6::text[])
        )
      GROUP BY s.srn, s.student_name, s.parent_phone_no, s.gender, s.batch_label
      ORDER BY s.srn
    `,
    [sectionCode, subjectAliases, electiveOnly, subjectCode, batchFilter.restricted, batchFilter.values]
  );

  return studentsResult.rows.map((row) => ({
    srn: row.srn,
    name: row.student_name,
    parentPhoneNo: row.parent_phone_no || "",
    gender: row.gender || "",
    batchLabel: row.batch_label || "",
    attendanceHistory: row.attendance_history || {},
    totalPresent: row.total_present
  }));
}

async function getAbsenteesForDate({ sectionCode, attendanceDate, subjectCode, allowedBatches = [] }) {
  await initializeDatabase();
  const electiveOnly = isElectiveSubjectCode(subjectCode);
  const subjectAliases = getAttendanceSubjectAliases(subjectCode);
  const batchFilter = getBatchFilter(allowedBatches);

  const result = await query(
    `
      SELECT
        s.srn,
        s.student_name,
        s.parent_phone_no,
        s.gender,
        COALESCE(s.batch_label, '') AS batch_label,
        $2::date::text AS attendance_date
      FROM students s
      LEFT JOIN attendance a
        ON a.srn = s.srn
       AND a.attendance_date = $2::date
       AND a.subject_code = ANY($3)
      WHERE s.section_code = $1
        AND (
          $4 = FALSE
          OR EXISTS (
            SELECT 1
            FROM student_electives se
            WHERE se.srn = s.srn
              AND UPPER(se.elective_code) = UPPER($5)
          )
        )
        AND (
          $6 = FALSE
          OR UPPER(COALESCE(s.batch_label, '')) = ANY($7::text[])
        )
      GROUP BY s.srn, s.student_name, s.parent_phone_no, s.gender, s.batch_label
      HAVING COUNT(a.srn) > 0
         AND BOOL_OR(a.status = 'P') = FALSE
      ORDER BY s.srn
    `,
    [sectionCode, formatDateForPostgres(attendanceDate), subjectAliases, electiveOnly, subjectCode, batchFilter.restricted, batchFilter.values]
  );

  return result.rows.map((row, index) => ({
    serialNo: index + 1,
    srn: row.srn,
    name: row.student_name,
    parentPhoneNo: row.parent_phone_no || "",
    gender: row.gender || "",
    batchLabel: row.batch_label || "",
    attendanceDate: row.attendance_date
  }));
}

async function getAdminSectionOverview() {
  await initializeDatabase();

  const result = await query(
    `
      SELECT
        s.section_code,
        s.proctor_name,
        COUNT(DISTINCT st.srn)::int AS student_count
      FROM sections s
      LEFT JOIN students st ON st.section_code = s.section_code
      GROUP BY s.section_code, s.proctor_name
      ORDER BY s.section_code
    `
  );

  return Promise.all(result.rows.map(async (row) => {
    const reference = getTimetableSectionReference(row.section_code);
    const facultyDetails = (await getSectionFacultyMappings(row.section_code))
      .filter((faculty) =>
        isReportableSubject({
          shortCode: faculty.short_code,
          subjectCode: faculty.subject_code,
          courseName: faculty.course_name
        })
      )
      .map((faculty) => ({
        teacherId: faculty.teach_srn || "",
        teacherName: faculty.teacher_name || "",
        subjectCode: faculty.subject_code || "",
        courseName: faculty.course_name || "",
        shortCode: faculty.short_code || "",
        displayShortCode: getAdminReportDisplayShortCode(faculty.short_code || faculty.subject_code || ""),
        batchLabel: faculty.batch_label || "ALL"
      }));

    return {
      sectionCode: row.section_code,
      proctorName: row.proctor_name || reference?.proctorName || "",
      studentCount: Number(row.student_count || 0),
      facultyCount: new Set(
        facultyDetails.map((faculty) => faculty.teacherName).filter(Boolean)
      ).size,
      facultyDetails
    };
  }));
}

async function getAdminSectionReport(sectionCode) {
  await initializeDatabase();

  const sectionResult = await query(
    `
      SELECT
        s.section_code,
        s.proctor_name,
        COUNT(DISTINCT st.srn)::int AS student_count
      FROM sections s
      LEFT JOIN students st ON st.section_code = s.section_code
      WHERE s.section_code = $1
      GROUP BY s.section_code, s.proctor_name
    `,
    [sectionCode]
  );

  if (sectionResult.rowCount === 0) {
    return null;
  }

  const [assignmentsResult, studentsResult, attendanceResult] = await Promise.all([
    getSectionFacultyMappings(sectionCode),
    query(
      `
        SELECT
          srn,
          student_name,
          COALESCE(batch_label, '') AS batch_label
        FROM students
        WHERE section_code = $1
        ORDER BY srn
      `,
      [sectionCode]
    ),
    query(
      `
        SELECT
          a.srn,
          a.subject_code,
          a.attendance_date::text AS attendance_date,
          a.status
        FROM attendance a
        INNER JOIN students s ON s.srn = a.srn
        WHERE s.section_code = $1
        ORDER BY a.srn, a.subject_code, a.attendance_date
      `,
      [sectionCode]
    )
  ]);

  const section = sectionResult.rows[0];
  const assignments = assignmentsResult || [];
  const students = studentsResult.rows || [];
  const attendanceRows = attendanceResult.rows || [];
  const reference = getTimetableSectionReference(sectionCode);

  const subjectMap = new Map();

  for (const assignment of assignments) {
    if (!isReportableSubject({
      shortCode: assignment.short_code,
      subjectCode: assignment.subject_code,
      courseName: assignment.course_name
    })) {
      continue;
    }

    const subjectKey = getAdminReportSubjectKey(assignment.short_code || assignment.subject_code || assignment.course_name || "");
    if (!subjectKey) {
      continue;
    }

    const aliases = new Set([
      assignment.short_code,
      assignment.subject_code,
      assignment.course_name
    ]
      .map((value) => normalizeText(value).toUpperCase())
      .filter(Boolean));

    for (const alias of [...aliases]) {
      getAdminReportSubjectAliases(alias).forEach((expandedAlias) => aliases.add(expandedAlias));
    }

    const existing = subjectMap.get(subjectKey) || {
      subjectKey,
      subjectCode: getAdminReportSubjectKey(assignment.subject_code || subjectKey),
      shortCode: getAdminReportSubjectKey(assignment.short_code || subjectKey),
      courseName: assignment.course_name || assignment.short_code || assignment.subject_code || subjectKey,
      facultyNames: new Set(),
      batchLabels: new Set(),
      aliases: new Set(),
      attendanceDates: new Set()
    };

    aliases.forEach((alias) => existing.aliases.add(alias));
    if (assignment.teacher_name) {
      existing.facultyNames.add(assignment.teacher_name);
    }
    if (assignment.batch_label) {
      existing.batchLabels.add(assignment.batch_label);
    }
    subjectMap.set(subjectKey, existing);
  }

  const attendanceByStudent = new Map();

  for (const row of attendanceRows) {
    if (!isReportableSubject({
      shortCode: row.subject_code,
      subjectCode: row.subject_code,
      courseName: row.subject_code
    })) {
      continue;
    }

    const studentKey = String(row.srn || "").trim();
    if (!attendanceByStudent.has(studentKey)) {
      attendanceByStudent.set(studentKey, []);
    }

    attendanceByStudent.get(studentKey).push({
      subjectCode: String(row.subject_code || "").trim(),
      attendanceDate: row.attendance_date,
      status: row.status
    });

    const normalizedSubjectCode = normalizeText(row.subject_code).toUpperCase();
    const canonicalSubjectCode = getAdminReportSubjectKey(normalizedSubjectCode);
    let matchedSubject = null;

    for (const subject of subjectMap.values()) {
      if (subject.aliases.has(normalizedSubjectCode) || subject.subjectKey === canonicalSubjectCode) {
        subject.attendanceDates.add(row.attendance_date);
        matchedSubject = subject;
      }
    }

    if (!matchedSubject && normalizedSubjectCode) {
      subjectMap.set(canonicalSubjectCode, {
        subjectKey: canonicalSubjectCode,
        subjectCode: canonicalSubjectCode,
        shortCode: canonicalSubjectCode,
        courseName: canonicalSubjectCode,
        facultyNames: new Set(),
        batchLabels: new Set(["ALL"]),
        aliases: new Set(getAdminReportSubjectAliases(canonicalSubjectCode)),
        attendanceDates: new Set([row.attendance_date])
      });
    }
  }

  const subjects = [...subjectMap.values()].map((subject) => ({
    subjectKey: subject.subjectKey,
    subjectCode: subject.subjectCode,
    shortCode: subject.shortCode,
    displayShortCode: getAdminReportDisplayShortCode(subject.shortCode || subject.subjectKey),
    courseName: subject.courseName,
    facultyNames: [...subject.facultyNames],
    batchLabels: [...subject.batchLabels],
    aliases: [...subject.aliases],
    totalClasses: subject.attendanceDates.size,
    latestAttendanceDate: [...subject.attendanceDates].sort().slice(-1)[0] || null
  }));

  subjects.sort((left, right) => {
    return left.shortCode.localeCompare(right.shortCode) || left.subjectCode.localeCompare(right.subjectCode);
  });

  const studentRows = students.map((student, index) => {
    const records = attendanceByStudent.get(student.srn) || [];
    const metrics = subjects.map((subject) => {
      const matchingRecords = records.filter((record) => subject.aliases.includes(record.subjectCode));
      const presentCount = matchingRecords.filter((record) => record.status === "P").length;
      const absentCount = matchingRecords.filter((record) => record.status === "A").length;
      const totalClasses = subject.totalClasses;
      const percentage = totalClasses === 0 ? null : Number(((presentCount / totalClasses) * 100).toFixed(2));

      return {
        subjectKey: subject.subjectKey,
        shortCode: subject.shortCode,
        displayShortCode: subject.displayShortCode,
        attended: presentCount,
        absent: absentCount,
        totalClasses,
        percentage
      };
    });

    const percentageValues = metrics
      .map((metric) => metric.percentage)
      .filter((value) => value !== null);
    const averagePercentage = percentageValues.length
      ? Number((percentageValues.reduce((sum, value) => sum + value, 0) / percentageValues.length).toFixed(2))
      : null;

    return {
      serialNo: index + 1,
      srn: student.srn,
      name: student.student_name,
      batchLabel: student.batch_label || "",
      metrics,
      averagePercentage
    };
  });

  return {
    sectionCode: section.section_code,
    proctorName: section.proctor_name || reference?.proctorName || "",
    studentCount: Number(section.student_count || 0),
    generatedAt: new Date().toISOString(),
    subjects: subjects.map((subject) => ({
      ...subject,
      subjectDateLabel: subject.latestAttendanceDate ? formatDateFromPostgres(subject.latestAttendanceDate) : "No classes yet"
    })),
    students: studentRows
  };
}

async function getAdminEditDataset(sectionCode) {
  await initializeDatabase();

  const sectionsResult = await query(
    `
      SELECT section_code
      FROM sections
      ORDER BY section_code
    `
  );

  const allSections = (sectionsResult.rows || []).map((row) => row.section_code).filter(Boolean);
  const selectedSectionCode = normalizeText(sectionCode) || allSections[0] || "";

  if (!selectedSectionCode) {
    return {
      sectionCode: "",
      allSections: [],
      proctorName: "",
      studentCount: 0,
      students: [],
      assignments: [],
      referenceSubjects: []
    };
  }

  const [sectionResult, studentsResult, assignmentsResult] = await Promise.all([
    query(
      `
        SELECT
          s.section_code,
          s.proctor_name,
          COUNT(DISTINCT st.srn)::int AS student_count
        FROM sections s
        LEFT JOIN students st ON st.section_code = s.section_code
        WHERE s.section_code = $1
        GROUP BY s.section_code, s.proctor_name
      `,
      [selectedSectionCode]
    ),
    query(
      `
        SELECT
          srn,
          student_name,
          COALESCE(parent_phone_no, '') AS parent_phone_no,
          COALESCE(gender, '') AS gender,
          COALESCE(batch_label, '') AS batch_label,
          section_code
        FROM students
        WHERE section_code = $1
        ORDER BY srn
      `,
      [selectedSectionCode]
    ),
    query(
      `
        SELECT
          tsa.teach_srn,
          t.teacher_name,
          COALESCE(tsa.subject_code, t.subject_code, '') AS subject_code,
          COALESCE(tsa.course_name, t.course_name, '') AS course_name,
          COALESCE(tsa.course_short_code, t.course_short_code, t.subject_code, '') AS short_code,
          COALESCE(tsa.batch_label, 'ALL') AS batch_label
        FROM teacher_subject_assignments tsa
        INNER JOIN teachers t ON t.teach_srn = tsa.teach_srn
        WHERE tsa.section_code = $1
        ORDER BY COALESCE(tsa.course_short_code, t.course_short_code, t.subject_code, ''), t.teacher_name, tsa.batch_label
      `,
      [selectedSectionCode]
    )
  ]);

  if (sectionResult.rowCount === 0) {
    return null;
  }

  const section = sectionResult.rows[0];
  const reference = getTimetableSectionReference(selectedSectionCode);
  const assignments = assignmentsResult.rows.length
    ? assignmentsResult.rows.map((row, index) => ({
      rowId: `${row.teach_srn || "faculty"}-${row.short_code || row.subject_code || index}-${row.batch_label || "ALL"}-${index}`,
      teacherId: row.teach_srn || "",
      teacherName: row.teacher_name || "",
      subjectCode: row.subject_code || "",
      courseName: row.course_name || "",
      shortCode: row.short_code || "",
      batchLabel: normalizeBatchLabel(row.batch_label || "ALL"),
      sectionCode: selectedSectionCode
    }))
    : getReferenceSectionFacultyMappings(selectedSectionCode).map((row, index) => ({
      rowId: `reference-${index}`,
      teacherId: row.teach_srn || "",
      teacherName: row.teacher_name || "",
      subjectCode: row.subject_code || "",
      courseName: row.course_name || "",
      shortCode: row.short_code || "",
      batchLabel: normalizeBatchLabel(row.batch_label || "ALL"),
      sectionCode: selectedSectionCode
    }));

  return {
    sectionCode: selectedSectionCode,
    allSections,
    proctorName: section.proctor_name || reference?.proctorName || "",
    studentCount: Number(section.student_count || 0),
    students: (studentsResult.rows || []).map((row) => ({
      srn: row.srn,
      studentName: row.student_name,
      parentPhoneNo: row.parent_phone_no || "",
      gender: row.gender || "",
      batchLabel: row.batch_label || "",
      sectionCode: row.section_code
    })),
    assignments,
    referenceSubjects: (reference?.subjects || []).map((subject) => ({
      slNo: Number(subject.slNo || 0),
      courseCode: normalizeText(subject.courseCode),
      courseName: normalizeText(subject.courseName),
      shortCode: normalizeText(subject.shortCode),
      faculty: normalizeText(subject.faculty)
    }))
  };
}

async function updateAdminSectionMeta({ sectionCode, proctorName }) {
  await initializeDatabase();

  const normalizedSectionCode = normalizeText(sectionCode);
  if (!normalizedSectionCode) {
    throw new Error("Section code is required.");
  }

  await query(
    `
      UPDATE sections
      SET proctor_name = $2
      WHERE section_code = $1
    `,
    [normalizedSectionCode, normalizeText(proctorName)]
  );

  return {
    sectionCode: normalizedSectionCode,
    proctorName: normalizeText(proctorName)
  };
}

async function updateAdminStudents({ students }) {
  await initializeDatabase();

  if (!Array.isArray(students) || !students.length) {
    throw new Error("No student rows were provided.");
  }

  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    for (const student of students) {
      const srn = normalizeText(student.srn);
      const studentName = normalizeText(student.studentName);
      const sectionCode = normalizeText(student.sectionCode);

      if (!srn || !studentName || !sectionCode) {
        throw new Error("Each student row must include SRN, student name, and section code.");
      }

      await client.query(
        `
          UPDATE students
          SET
            student_name = $2,
            parent_phone_no = $3,
            gender = $4,
            batch_label = $5,
            section_code = $6
          WHERE srn = $1
        `,
        [
          srn,
          studentName,
          normalizeText(student.parentPhoneNo),
          normalizeText(student.gender),
          normalizeStudentBatchLabel(student.batchLabel),
          sectionCode
        ]
      );
    }

    await client.query("COMMIT");
    return { updatedCount: students.length };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function replaceAdminSectionAssignments({ sectionCode, assignments, proctorName }) {
  await initializeDatabase();

  const normalizedSectionCode = normalizeText(sectionCode);
  if (!normalizedSectionCode) {
    throw new Error("Section code is required.");
  }

  if (!Array.isArray(assignments)) {
    throw new Error("Assignments payload is invalid.");
  }

  const normalizedAssignments = assignments.map((assignment) => {
    const teacherId = normalizeText(assignment.teacherId);
    const teacherName = normalizeText(assignment.teacherName);
    const subjectCode = normalizeText(assignment.subjectCode || assignment.shortCode).toUpperCase();
    const shortCode = normalizeText(assignment.shortCode || assignment.subjectCode).toUpperCase();
    const courseName = normalizeText(assignment.courseName || shortCode || subjectCode);
    const batchLabel = normalizeBatchLabel(assignment.batchLabel || "ALL");

    if (!teacherId || !teacherName || !shortCode) {
      throw new Error("Each faculty row must include faculty ID, faculty name, and short code.");
    }

    return {
      teacherId,
      teacherName,
      subjectCode: subjectCode || shortCode,
      courseName,
      shortCode,
      batchLabel
    };
  });

  const primaryAssignments = new Map();
  for (const assignment of normalizedAssignments) {
    if (!primaryAssignments.has(assignment.teacherId)) {
      primaryAssignments.set(assignment.teacherId, assignment);
    }
  }

  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    if (proctorName !== undefined) {
      await client.query(
        `
          UPDATE sections
          SET proctor_name = $2
          WHERE section_code = $1
        `,
        [normalizedSectionCode, normalizeText(proctorName)]
      );
    }

    await client.query(
      `
        DELETE FROM teacher_subject_assignments
        WHERE section_code = $1
      `,
      [normalizedSectionCode]
    );

    await client.query(
      `
        DELETE FROM teacher_sections
        WHERE section_code = $1
      `,
      [normalizedSectionCode]
    );

    for (const assignment of primaryAssignments.values()) {
      await client.query(
        `
          INSERT INTO teachers (teach_srn, teacher_name, subject_code, course_name, course_short_code)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (teach_srn)
          DO UPDATE SET
            teacher_name = EXCLUDED.teacher_name,
            subject_code = EXCLUDED.subject_code,
            course_name = EXCLUDED.course_name,
            course_short_code = EXCLUDED.course_short_code
        `,
        [
          assignment.teacherId,
          assignment.teacherName,
          assignment.subjectCode,
          assignment.courseName,
          assignment.shortCode
        ]
      );

      await client.query(
        `
          INSERT INTO teacher_sections (teach_srn, section_code)
          VALUES ($1, $2)
          ON CONFLICT (teach_srn, section_code) DO NOTHING
        `,
        [assignment.teacherId, normalizedSectionCode]
      );
    }

    for (const assignment of normalizedAssignments) {
      await client.query(
        `
          INSERT INTO teacher_subject_assignments (
            teach_srn,
            section_code,
            subject_code,
            course_name,
            course_short_code,
            batch_label
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (teach_srn, section_code, course_short_code, batch_label)
          DO UPDATE SET
            subject_code = EXCLUDED.subject_code,
            course_name = EXCLUDED.course_name
        `,
        [
          assignment.teacherId,
          normalizedSectionCode,
          assignment.subjectCode,
          assignment.courseName,
          assignment.shortCode,
          assignment.batchLabel
        ]
      );
    }

    await client.query("COMMIT");
    return { updatedCount: normalizedAssignments.length };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function saveAttendanceForDate({ sectionCode, attendanceDate, subjectCode, entries }) {
  await initializeDatabase();
  const canonicalSubjectCode = getCanonicalAttendanceSubjectCode(subjectCode);

  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    for (const entry of entries) {
      await client.query(
        `
          INSERT INTO attendance (srn, attendance_date, subject_code, status)
          VALUES ($1, $2::date, $3, $4)
          ON CONFLICT (srn, attendance_date, subject_code)
          DO UPDATE SET status = EXCLUDED.status
        `,
        [entry.srn, formatDateForPostgres(attendanceDate), canonicalSubjectCode, entry.status]
      );
    }

    await client.query("COMMIT");
    return {
      absentees: await getAbsenteesForDate({ sectionCode, attendanceDate, subjectCode: canonicalSubjectCode })
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function resetAttendanceDate({ sectionCode, attendanceDate, subjectCode }) {
  await initializeDatabase();
  const subjectAliases = getAttendanceSubjectAliases(subjectCode);
  await query(
    `
      DELETE FROM attendance a
      USING students s
      WHERE a.srn = s.srn
        AND s.section_code = $1
        AND a.attendance_date = $2::date
        AND a.subject_code = ANY($3)
    `,
    [sectionCode, formatDateForPostgres(attendanceDate), subjectAliases]
  );
}

module.exports = {
  isConfigured,
  testConnection,
  ensureSchema,
  seedDefaults,
  initializeDatabase,
  authenticateTeacher,
  authenticateAdmin,
  getSectionSummary,
  getSectionAnalytics,
  getAvailableDates,
  loadSectionAttendance,
  getAbsenteesForDate,
  getAdminSectionOverview,
  getAdminSectionReport,
  getAdminEditDataset,
  updateAdminSectionMeta,
  updateAdminStudents,
  replaceAdminSectionAssignments,
  saveAttendanceForDate,
  resetAttendanceDate
};
