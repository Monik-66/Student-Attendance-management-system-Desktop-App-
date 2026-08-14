# SNPSU Teacher Desktop PPT README

## Purpose
This file is a presentation-ready summary of the `SNPSU Teacher Desktop` project. You can use it to create a PowerPoint for project review, demo, college approval, or viva.

## Project Title
`SNPSU Teacher Desktop - Smart Attendance Management System`

## One-Line Description
A desktop attendance management application for faculty and admin that uses PostgreSQL for live data, supports section-wise attendance, absentee review, admin reporting, and elective-based student filtering.

## Suggested PPT Flow

### Slide 1 - Title
- Project name
- Your name
- Department
- College name

### Slide 2 - Problem Statement
- Manual attendance handling is slow and error-prone
- Faculty need section-wise subject-wise attendance
- Admin needs consolidated attendance reports
- Elective subjects like `DC` and `MC` require student-specific filtering

### Slide 3 - Objective
- Build a desktop app for faculty attendance
- Fetch students and teachers from PostgreSQL
- Allow date-wise attendance submission
- Show absentee list after submission
- Provide admin reporting and PDF export
- Support elective-based filtered student lists

### Slide 4 - Technologies Used
- `JavaScript`
- `HTML`
- `CSS`
- `Node.js`
- `Electron`
- `Express`
- `PostgreSQL`
- `dotenv`

### Slide 5 - System Architecture
- Frontend: `index.html`, `renderer.js`, `styles.css`
- Desktop container: `Electron`
- Backend API: `server.js`
- Database layer: `db.js`
- Database: `PostgreSQL`
- Offline cache: `offline-store.js`

### Slide 6 - Main Modules
- Teacher login
- Attendance dashboard
- Section-wise student register
- Date-wise attendance save/delete
- Absentee popup
- Admin dashboard
- Admin PDF report
- Elective-based filtering

### Slide 7 - Teacher Workflow
1. Teacher logs in
2. Assigned sections load from PostgreSQL
3. Faculty opens attendance page
4. Selects date
5. Marks `P` or `A`
6. Submits attendance
7. Absentee popup appears

### Slide 8 - Admin Workflow
1. Admin logs in
2. Views section summary
3. Opens report page
4. Loads section report
5. Reviews subject-wise faculty mapping
6. Downloads report as PDF

### Slide 9 - Database Tables
- `sections`
- `students`
- `teachers`
- `teacher_sections`
- `attendance`
- `student_electives`

### Slide 10 - Important Database Features
- `students.parent_phone_no`
- `students.gender`
- `teachers.course_short_code`
- `attendance` stored by `srn + attendance_date + subject_code`
- `student_electives` used for `DC` and `MC` filtering

### Slide 11 - Elective Filtering Logic
- Regular subjects show full section students
- `DC` teacher login shows only `DC` opted students
- `MC` teacher login shows only `MC` opted students
- Filtering is based on `student_electives`

### Slide 12 - Key Features Implemented
- PostgreSQL-based live data
- Teacher authentication
- Section mapping via `teacher_sections`
- Attendance save to PostgreSQL
- Delete attendance for selected date
- Absentee popup after submission
- Admin section summary
- Admin PDF report

### Slide 13 - Special Features
- Offline-ready structure
- Date-specific delete/reset logic
- Proctor/Class Advisor support
- Subject-wise faculty mapping
- Elective-based student differentiation

### Slide 14 - Challenges Solved
- Mapping faculty correctly from database
- Handling elective students separately
- Preventing changes to locked attendance dates
- Keeping admin dashboard compact
- Exporting printable reports

### Slide 15 - Future Scope
- SMS integration after approval
- AI call agent integration
- Better admin import tools
- Excel/CSV bulk elective upload
- Packaged `.exe` distribution

### Slide 16 - Conclusion
- The system reduces manual work
- Improves faculty attendance workflow
- Gives admin better reporting
- Supports real academic structure including electives

## Short ER Diagram Content For PPT
- `sections` -> one-to-many -> `students`
- `teachers` -> many-to-many -> `sections` through `teacher_sections`
- `students` -> one-to-many -> `attendance`
- `students` -> one-to-many -> `student_electives`

## Files You Can Mention In PPT
- [main.js](C:/Users/monik/OneDrive/Documents/snpsu_teacher/main.js)
- [renderer.js](C:/Users/monik/OneDrive/Documents/snpsu_teacher/renderer.js)
- [server.js](C:/Users/monik/OneDrive/Documents/snpsu_teacher/server.js)
- [db.js](C:/Users/monik/OneDrive/Documents/snpsu_teacher/db.js)
- [schema.sql](C:/Users/monik/OneDrive/Documents/snpsu_teacher/schema.sql)

## Demo Points
- Login as teacher
- Open section attendance
- Load date
- Submit attendance
- Show absentee popup
- Delete selected date
- Login as admin
- View section summary
- Download PDF report

## Suggested PPT Design
- Use blue and gold theme matching SNPSU branding
- Keep screenshots of:
  - login page
  - attendance page
  - absentee popup
  - admin summary
  - admin report

## Final Tip
If you want, this README can be converted into:
- a full `.pptx` outline
- speaker notes
- a 10-slide short version
- a 15-16 slide viva version
