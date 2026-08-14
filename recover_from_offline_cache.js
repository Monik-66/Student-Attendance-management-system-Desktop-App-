const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const dotenv = require("dotenv");
const db = require("./db");

dotenv.config({ path: path.join(__dirname, ".env") });

const OFFLINE_CACHE_PATH = path.join(
  process.env.APPDATA || "",
  "snpsu-teacher-desktop",
  "offline-attendance.json"
);

function getConfig() {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString) {
    return {
      connectionString,
      ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false
    };
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

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeRole(role) {
  const normalized = normalizeText(role).toLowerCase();
  return normalized;
}

function loadOfflineCache() {
  if (!fs.existsSync(OFFLINE_CACHE_PATH)) {
    throw new Error(`Offline cache not found at ${OFFLINE_CACHE_PATH}`);
  }

  return JSON.parse(fs.readFileSync(OFFLINE_CACHE_PATH, "utf8"));
}

function buildRecoveryState(cache) {
  const teachers = new Map();
  const teacherSections = new Set();
  const teacherAssignments = new Map();
  const students = new Map();
  const studentElectives = new Set();
  const attendance = new Map();

  for (const teacher of Object.values(cache.teachers || {})) {
    const teacherId = normalizeText(teacher.teacherId);
    if (!teacherId) {
      continue;
    }

    const subjectAssignments = Array.isArray(teacher.subjectAssignments) ? teacher.subjectAssignments : [];
    const primaryAssignment = subjectAssignments[0] || {};

    teachers.set(teacherId, {
      teach_srn: teacherId,
      teacher_name: normalizeText(teacher.name),
      subject_code: normalizeText(primaryAssignment.courseCode || teacher.subjectCode || teacher.subject),
      course_name: normalizeText(primaryAssignment.courseName || teacher.courseName || teacher.subject),
      course_short_code: normalizeText(primaryAssignment.courseShortCode || teacher.subjectCode || teacher.subject)
    });

    for (const assignment of subjectAssignments) {
      const courseShortCode = normalizeText(assignment.courseShortCode || assignment.subjectCode);
      const subjectCode = normalizeText(assignment.courseCode || assignment.subjectCode || courseShortCode);
      const courseName = normalizeText(assignment.courseName || courseShortCode);
      const batchLabels = Array.isArray(assignment.batchLabels) && assignment.batchLabels.length
        ? assignment.batchLabels
        : [""];

      for (const sectionCode of assignment.sections || []) {
        const normalizedSectionCode = normalizeText(sectionCode);
        if (!normalizedSectionCode || !courseShortCode) {
          continue;
        }

        teacherSections.add(`${teacherId}|${normalizedSectionCode}`);

        const sectionBatches = Array.isArray(assignment.sectionBatches?.[normalizedSectionCode])
          ? assignment.sectionBatches[normalizedSectionCode]
          : batchLabels;

        const resolvedBatches = sectionBatches.length ? sectionBatches : [""];
        for (const batchLabel of resolvedBatches) {
          const normalizedBatch = normalizeText(batchLabel).toUpperCase() || "ALL";
          teacherAssignments.set(
            `${teacherId}|${normalizedSectionCode}|${courseShortCode}|${normalizedBatch}`,
            {
              teach_srn: teacherId,
              section_code: normalizedSectionCode,
              subject_code: subjectCode,
              course_name: courseName,
              course_short_code: courseShortCode,
              batch_label: normalizedBatch
            }
          );
        }
      }
    }

    for (const section of teacher.sections || []) {
      const sectionCode = normalizeText(section.code);
      if (!sectionCode) {
        continue;
      }

      for (const [subjectCode, subjectState] of Object.entries(section.subjects || {})) {
        const normalizedSubjectCode = normalizeText(subjectCode).toUpperCase();
        const isElective = normalizedSubjectCode === "DC" || normalizedSubjectCode === "MC";

        for (const student of subjectState.students || []) {
          const srn = normalizeText(student.srn).toUpperCase();
          if (!srn) {
            continue;
          }

          const existingStudent = students.get(srn);
          students.set(srn, {
            srn,
            student_name: normalizeText(student.name || existingStudent?.student_name),
            parent_phone_no: normalizeText(student.parentPhoneNo || existingStudent?.parent_phone_no),
            gender: normalizeText(student.gender || existingStudent?.gender),
            batch_label: normalizeText(student.batchLabel || existingStudent?.batch_label).toUpperCase(),
            section_code: sectionCode
          });

          if (isElective) {
            studentElectives.add(`${srn}|${normalizedSubjectCode}`);
          }

          for (const [attendanceDate, status] of Object.entries(student.attendanceHistory || {})) {
            const normalizedStatus = String(status).toUpperCase() === "P" ? "P" : "A";
            attendance.set(
              `${srn}|${attendanceDate}|${normalizedSubjectCode}`,
              {
                srn,
                attendance_date: attendanceDate,
                subject_code: normalizedSubjectCode,
                status: normalizedStatus
              }
            );
          }
        }
      }
    }
  }

  return {
    teachers: [...teachers.values()],
    teacherSections: [...teacherSections].map((value) => {
      const [teach_srn, section_code] = value.split("|");
      return { teach_srn, section_code };
    }),
    teacherAssignments: [...teacherAssignments.values()],
    students: [...students.values()],
    studentElectives: [...studentElectives].map((value) => {
      const [srn, elective_code] = value.split("|");
      return { srn, elective_code };
    }),
    attendance: [...attendance.values()]
  };
}

async function restore() {
  await db.initializeDatabase();

  const cache = loadOfflineCache();
  const recovery = buildRecoveryState(cache);
  const client = new Client(getConfig());
  await client.connect();

  try {
    await client.query("BEGIN");

    for (const teacher of recovery.teachers) {
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
          teacher.teach_srn,
          teacher.teacher_name,
          teacher.subject_code,
          teacher.course_name,
          teacher.course_short_code
        ]
      );
    }

    for (const row of recovery.teacherSections) {
      await client.query(
        `
          INSERT INTO teacher_sections (teach_srn, section_code)
          VALUES ($1, $2)
          ON CONFLICT (teach_srn, section_code) DO NOTHING
        `,
        [row.teach_srn, row.section_code]
      );
    }

    for (const row of recovery.teacherAssignments) {
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
          row.teach_srn,
          row.section_code,
          row.subject_code,
          row.course_name,
          row.course_short_code,
          row.batch_label
        ]
      );
    }

    for (const student of recovery.students) {
      await client.query(
        `
          INSERT INTO students (srn, student_name, parent_phone_no, gender, batch_label, section_code)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (srn)
          DO UPDATE SET
            student_name = EXCLUDED.student_name,
            parent_phone_no = EXCLUDED.parent_phone_no,
            gender = EXCLUDED.gender,
            batch_label = EXCLUDED.batch_label,
            section_code = EXCLUDED.section_code
        `,
        [
          student.srn,
          student.student_name,
          student.parent_phone_no || null,
          student.gender || null,
          student.batch_label || null,
          student.section_code
        ]
      );
    }

    for (const row of recovery.studentElectives) {
      await client.query(
        `
          INSERT INTO student_electives (srn, elective_code)
          VALUES ($1, $2)
          ON CONFLICT (srn, elective_code) DO NOTHING
        `,
        [row.srn, row.elective_code]
      );
    }

    for (const row of recovery.attendance) {
      await client.query(
        `
          INSERT INTO attendance (srn, attendance_date, subject_code, status)
          VALUES ($1, $2::date, $3, $4)
          ON CONFLICT (srn, attendance_date, subject_code)
          DO UPDATE SET status = EXCLUDED.status
        `,
        [row.srn, row.attendance_date, row.subject_code, row.status]
      );
    }

    await client.query("COMMIT");

    const summary = {
      teachers: recovery.teachers.length,
      teacherSections: recovery.teacherSections.length,
      teacherAssignments: recovery.teacherAssignments.length,
      students: recovery.students.length,
      studentElectives: recovery.studentElectives.length,
      attendance: recovery.attendance.length
    };

    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

restore().catch((error) => {
  process.stderr.write(`Offline recovery failed: ${error.message}\n`);
  process.exitCode = 1;
});
