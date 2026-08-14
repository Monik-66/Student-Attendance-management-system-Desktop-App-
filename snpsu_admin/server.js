const crypto = require("crypto");
const path = require("path");
const express = require("express");
const dotenv = require("dotenv");
const db = require("./db");

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const port = Number(process.env.API_PORT || 4011);
const tokenSecret = process.env.API_TOKEN_SECRET || "snpsu-admin-api-secret";

app.use(express.json());

function signSessionToken(admin) {
  const payload = {
    adminId: admin.adminId,
    name: admin.name,
    role: admin.role || "admin",
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

function requireAdmin(request, response, next) {
  try {
    request.session = verifySessionToken(getBearerToken(request));
    if (!request.session.role) {
      throw new Error("Admin access is required.");
    }
    next();
  } catch (error) {
    response.status(401).json({ ok: false, message: error.message });
  }
}

app.get("/health", async (_request, response) => {
  const status = await db.testConnection();
  response.status(status.ok ? 200 : 500).json({
    ...status,
    service: "admin"
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

app.post("/api/auth/login", (_request, response) => {
  response.status(409).json({
    ok: false,
    configured: true,
    message: "This is the admin backend. Use the SNPSU Teacher desktop for teacher sign-in."
  });
});

app.post("/api/admin/login", async (request, response) => {
  const adminName = String(request.body.adminName || "").trim();
  const password = String(request.body.password || "").trim();
  const user = await db.authenticateAdmin(adminName, password);

  if (!user) {
    response.status(401).json({ ok: false, configured: true, message: "Invalid admin/coordinator name or password." });
    return;
  }

  response.json({
    ok: true,
    configured: true,
    admin: {
      adminId: user.adminId,
      name: user.name,
      role: user.role || "admin"
    },
    token: signSessionToken(user)
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

app.get("/api/admin/edit-dataset", requireAdmin, async (request, response) => {
  try {
    const sectionCode = String(request.query.sectionCode || "").trim();
    const dataset = await db.getAdminEditDataset(sectionCode);

    if (!dataset) {
      response.status(404).json({ ok: false, configured: true, message: `Section ${sectionCode} was not found.` });
      return;
    }

    response.json({ ok: true, configured: true, dataset });
  } catch (error) {
    response.status(500).json({ ok: false, configured: true, message: error.message });
  }
});

app.post("/api/admin/edit-section-meta", requireAdmin, async (request, response) => {
  try {
    const section = await db.updateAdminSectionMeta(request.body || {});
    response.json({ ok: true, configured: true, section });
  } catch (error) {
    response.status(500).json({ ok: false, configured: true, message: error.message });
  }
});

app.post("/api/admin/edit-students", requireAdmin, async (request, response) => {
  try {
    const result = await db.updateAdminStudents(request.body || {});
    response.json({ ok: true, configured: true, ...result });
  } catch (error) {
    response.status(500).json({ ok: false, configured: true, message: error.message });
  }
});

app.post("/api/admin/edit-assignments", requireAdmin, async (request, response) => {
  try {
    const result = await db.replaceAdminSectionAssignments(request.body || {});
    response.json({ ok: true, configured: true, ...result });
  } catch (error) {
    response.status(500).json({ ok: false, configured: true, message: error.message });
  }
});

app.listen(port, () => {
  process.stdout.write(`SNPSU Admin API listening on port ${port}\n`);
});
