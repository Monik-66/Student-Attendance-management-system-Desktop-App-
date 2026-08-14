DROP VIEW IF EXISTS student_total_present;
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS admins;
DROP TABLE IF EXISTS teacher_subject_assignments;
DROP TABLE IF EXISTS teacher_sections;
DROP TABLE IF EXISTS student_electives;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS teachers;
DROP TABLE IF EXISTS sections;

CREATE TABLE sections (
  section_code TEXT PRIMARY KEY,
  proctor_name TEXT
);

CREATE TABLE students (
  srn TEXT PRIMARY KEY,
  student_name TEXT NOT NULL,
  parent_phone_no TEXT,
  gender TEXT,
  batch_label TEXT,
  section_code TEXT NOT NULL REFERENCES sections (section_code) ON DELETE RESTRICT
);

CREATE TABLE student_electives (
  srn TEXT NOT NULL REFERENCES students (srn) ON DELETE CASCADE,
  elective_code TEXT NOT NULL,
  PRIMARY KEY (srn, elective_code)
);

CREATE TABLE teachers (
  teach_srn TEXT PRIMARY KEY,
  teacher_name TEXT NOT NULL,
  subject_code TEXT NOT NULL,
  course_name TEXT,
  course_short_code TEXT
);

CREATE TABLE teacher_sections (
  teach_srn TEXT NOT NULL REFERENCES teachers (teach_srn) ON DELETE CASCADE,
  section_code TEXT NOT NULL REFERENCES sections (section_code) ON DELETE CASCADE,
  PRIMARY KEY (teach_srn, section_code)
);

CREATE TABLE teacher_subject_assignments (
  teach_srn TEXT NOT NULL REFERENCES teachers (teach_srn) ON DELETE CASCADE,
  section_code TEXT NOT NULL REFERENCES sections (section_code) ON DELETE CASCADE,
  subject_code TEXT NOT NULL,
  course_name TEXT,
  course_short_code TEXT NOT NULL,
  batch_label TEXT NOT NULL DEFAULT 'ALL',
  PRIMARY KEY (teach_srn, section_code, course_short_code, batch_label)
);

CREATE TABLE admins (
  admin_id TEXT PRIMARY KEY,
  admin_name TEXT NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'course_coordinator', 'director'))
);

CREATE TABLE attendance (
  srn TEXT NOT NULL REFERENCES students (srn) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  subject_code TEXT NOT NULL,
  status CHAR(1) NOT NULL CHECK (status IN ('P', 'A')),
  PRIMARY KEY (srn, attendance_date, subject_code)
);

CREATE INDEX students_section_idx
  ON students (section_code);

CREATE INDEX student_electives_code_idx
  ON student_electives (elective_code);

CREATE INDEX attendance_date_idx
  ON attendance (attendance_date);

CREATE INDEX attendance_subject_date_idx
  ON attendance (subject_code, attendance_date);

CREATE INDEX teacher_sections_teacher_idx
  ON teacher_sections (teach_srn);

CREATE INDEX teacher_sections_section_idx
  ON teacher_sections (section_code);

CREATE INDEX teacher_subject_assignments_teacher_idx
  ON teacher_subject_assignments (teach_srn);

CREATE INDEX teacher_subject_assignments_section_idx
  ON teacher_subject_assignments (section_code);

CREATE INDEX teacher_subject_assignments_subject_idx
  ON teacher_subject_assignments (course_short_code);

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
  END;
