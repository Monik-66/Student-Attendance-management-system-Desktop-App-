const crypto = require("crypto");
const path = require("path");
const express = require("express");
const dotenv = require("dotenv");
const db = require("./db");

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const port = Number(process.env.API_PORT || 4010);
const tokenSecret = process.env.API_TOKEN_SECRET || "snpsu-teacher-api-secret";

app.use(express.json());

function signSessionToken(teacher) {
  const payload = {
    teacherId: teacher.teacherId,
    name: teacher.name,
    subject: teacher.subject,
    subjectCode: teacher.subjectCode || teacher.subject,
    sections: teacher.sections,
    subjectAssignments: teacher.subjectAssignments || [],
    role: teacher.role || "teacher",
    exp: Date.now() + 12 * 60 * 60 * 1000
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", tokenSecret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function verifySessionToken(token) {
  if (!token || !token.includes(".")) {
    throw new Error("Missing or invalid session token.");
  }

  const [encodedPayload, signature] = token.split(".");
  const expectedSignature = crypto.createHmac("sha256", tokenSecret).update(encodedPayload).digest("base64url");

  if (signature !== expectedSignature) {
    throw new Error("Invalid session token.");
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));

  if (!payload.exp || payload.exp < Date.now()) {
    throw new Error("Session token expired.");
  }

  return payload;
}

function getBearerToken(request) {
  const header = request.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
}

function requireSession(request, response, next) {
  try {
    request.session = verifySessionToken(getBearerToken(request));
    next();
  } catch (error) {
    response.status(401).json({ ok: false, message: error.message });
  }
}

function requireAdmin(request, response, next) {
  try {
    request.session = verifySessionToken(getBearerToken(request));
    if (request.session.role !== "admin") {
      throw new Error("Admin access is required.");
    }
    next();
  } catch (error) {
    response.status(401).json({ ok: false, message: error.message });
  }
}

function ensureAllowedSection(sectionCode, session) {
  if (!session.sections.includes(sectionCode)) {
    throw new Error(`Teacher is not assigned to section ${sectionCode}.`);
  }
}

function ensureAllowedSections(sectionCodes, session) {
  for (const sectionCode of sectionCodes) {
    ensureAllowedSection(sectionCode, session);
  }
}

function normalizeSubjectCode(subjectCode) {
  return String(subjectCode || "").trim().toUpperCase();
}

function resolveRequestedSubject(session, requestedSubjectCode, sectionCode = "") {
  const availableAssignments = Array.isArray(session.subjectAssignments) ? session.subjectAssignments : [];
  const requestedCode = normalizeSubjectCode(requestedSubjectCode || session.subjectCode || session.subject);
  const matchedAssignment = availableAssignments.find((assignment) => {
    const assignmentCode = normalizeSubjectCode(assignment.courseShortCode || assignment.subjectCode);
    if (assignmentCode !== requestedCode) {
      return false;
    }

    if (!sectionCode) {
      return true;
    }

    return Array.isArray(assignment.sections) && assignment.sections.includes(sectionCode);
  });

  if (!matchedAssignment) {
    throw new Error(`Teacher is not assigned to subject ${requestedCode || "UNKNOWN"}${sectionCode ? ` for section ${sectionCode}` : ""}.`);
  }

  return {
    subjectCode: normalizeSubjectCode(matchedAssignment.courseShortCode || matchedAssignment.subjectCode),
    allowedBatches: sectionCode && matchedAssignment.sectionBatches
      ? matchedAssignment.sectionBatches[sectionCode] || []
      : []
  };
}

app.get("/health", async (_request, response) => {
  const status = await db.testConnection();
  response.status(status.ok ? 200 : 500).json({
    ...status,
    service: "teacher"
  });
});

app.post("/api/system/bootstrap", async (_request, response) => {
  if (!db.isConfigured()) {
    response.status(500).json({ ok: false, configured: false, message: "Database connection values are missing." });
    return;
  }

  try {
    await db.initializeDatabase();
    response.json({ ok: true, configured: true });
  } catch (error) {
    response.status(500).json({ ok: false, configured: true, message: error.message });
  }
});

app.post("/api/auth/login", async (request, response) => {
  if (!db.isConfigured()) {
    response.status(500).json({ ok: false, configured: false, message: "Database connection values are missing." });
    return;
  }

  try {
    const teacher = await db.authenticateTeacher(request.body.teacherName, request.body.teacherId);

    if (!teacher) {
      response.status(401).json({ ok: false, configured: true, message: "Invalid teacher name or teacher SRN." });
      return;
    }

    response.json({
      ok: true,
      configured: true,
      teacher,
      token: signSessionToken(teacher)
    });
  } catch (error) {
    response.status(500).json({ ok: false, configured: true, message: error.message });
  }
});

app.post("/api/admin/login", (_request, response) => {
  response.status(409).json({
    ok: false,
    configured: true,
    message: "This is the teacher backend. Use the SNPSU Admin desktop for admin or coordinator sign-in."
  });
});

app.get("/api/admin/overview", requireAdmin, async (_request, response) => {
  try {
    const sections = await db.getAdminSectionOverview();
    response.json({ ok: true, configured: true, sections });
  } catch (error) {
    response.status(500).json({ ok: false, configured: true, sections: [], message: error.message });
  }
});

app.get("/api/admin/section-report", requireAdmin, async (request, response) => {
  try {
    const sectionCode = String(request.query.sectionCode || "").trim();
    const report = await db.getAdminSectionReport(sectionCode);

    if (!report) {
      response.status(404).json({ ok: false, configured: true, message: `Section ${sectionCode} was not found.` });
      return;
    }

    response.json({ ok: true, configured: true, report });
  } catch (error) {
    response.status(500).json({ ok: false, configured: true, message: error.message });
  }
});

app.post("/api/attendance/summary", requireSession, async (request, response) => {
  try {
    const sectionCodes = Array.isArray(request.body.sectionCodes) ? request.body.sectionCodes : [];
    ensureAllowedSections(sectionCodes, request.session);
    const subject = resolveRequestedSubject(request.session, request.body.subjectCode, sectionCodes[0] || "");
    const sections = await db.getSectionSummary(sectionCodes, request.body.selectedIsoDate, subject.subjectCode, subject.allowedBatches);
    response.json({ ok: true, configured: true, sections });
  } catch (error) {
    response.status(500).json({ ok: false, configured: true, sections: [], message: error.message });
  }
});

app.post("/api/sections/analytics", requireSession, async (request, response) => {
  try {
    const sectionCodes = Array.isArray(request.body.sectionCodes) ? request.body.sectionCodes : [];
    ensureAllowedSections(sectionCodes, request.session);
    const subject = resolveRequestedSubject(request.session, request.body.subjectCode, sectionCodes[0] || "");
    const sections = await db.getSectionAnalytics(sectionCodes, subject.subjectCode, subject.allowedBatches);
    response.json({ ok: true, configured: true, sections });
  } catch (error) {
    response.status(500).json({ ok: false, configured: true, sections: [], message: error.message });
  }
});

app.get("/api/attendance/dates", requireSession, async (request, response) => {
  try {
    const sectionCode = String(request.query.sectionCode || "");
    ensureAllowedSection(sectionCode, request.session);
    const subject = resolveRequestedSubject(request.session, request.query.subjectCode, sectionCode);
    const dates = await db.getAvailableDates(sectionCode, subject.subjectCode, subject.allowedBatches);
    response.json({ ok: true, configured: true, dates });
  } catch (error) {
    response.status(500).json({ ok: false, configured: true, dates: [], message: error.message });
  }
});

app.get("/api/attendance/section", requireSession, async (request, response) => {
  try {
    const sectionCode = String(request.query.sectionCode || "");
    ensureAllowedSection(sectionCode, request.session);
    const subject = resolveRequestedSubject(request.session, request.query.subjectCode, sectionCode);
    const students = await db.loadSectionAttendance(sectionCode, subject.subjectCode, subject.allowedBatches);
    response.json({ ok: true, configured: true, students });
  } catch (error) {
    response.status(500).json({ ok: false, configured: true, students: [], message: error.message });
  }
});

app.post("/api/attendance/save", requireSession, async (request, response) => {
  try {
    ensureAllowedSection(request.body.sectionCode, request.session);
    const subject = resolveRequestedSubject(request.session, request.body.subjectCode, request.body.sectionCode);

    const result = await db.saveAttendanceForDate({
      sectionCode: request.body.sectionCode,
      attendanceDate: request.body.attendanceDate,
      subjectCode: subject.subjectCode,
      entries: request.body.entries || []
    });

    response.json({
      ok: true,
      configured: true,
      absentees: result?.absentees || []
    });
  } catch (error) {
    response.status(500).json({ ok: false, configured: true, message: error.message });
  }
});

app.post("/api/attendance/reset", requireSession, async (request, response) => {
  try {
    ensureAllowedSection(request.body.sectionCode, request.session);
    const subject = resolveRequestedSubject(request.session, request.body.subjectCode, request.body.sectionCode);

    await db.resetAttendanceDate({
      sectionCode: request.body.sectionCode,
      attendanceDate: request.body.attendanceDate,
      subjectCode: subject.subjectCode
    });

    response.json({ ok: true, configured: true });
  } catch (error) {
    response.status(500).json({ ok: false, configured: true, message: error.message });
  }
});

app.listen(port, async () => {
  try {
    await db.initializeDatabase();
    process.stdout.write(`SNPSU Teacher API listening on port ${port}\n`);
  } catch (error) {
    process.stderr.write(`API initialization failed: ${error.message}\n`);
  }
});
