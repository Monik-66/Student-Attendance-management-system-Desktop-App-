-- Sample seed data for local testing only.
-- Replace these records with your own academic data in a private local database.
-- Do not commit real student or teacher details to a public repository.

INSERT INTO students (srn, student_name, section_code) VALUES
  ('STU0001', 'Sample Student 1', 'SEC-A'),
  ('STU0002', 'Sample Student 2', 'SEC-A'),
  ('STU0003', 'Sample Student 3', 'SEC-A'),
  ('STU0004', 'Sample Student 4', 'SEC-A'),
  ('STU0005', 'Sample Student 5', 'SEC-A'),
  ('STU0006', 'Sample Student 6', 'SEC-B'),
  ('STU0007', 'Sample Student 7', 'SEC-B'),
  ('STU0008', 'Sample Student 8', 'SEC-B'),
  ('STU0009', 'Sample Student 9', 'SEC-B'),
  ('STU0010', 'Sample Student 10', 'SEC-B')
ON CONFLICT (srn) DO UPDATE SET
  student_name = EXCLUDED.student_name,
  section_code = EXCLUDED.section_code;

