"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const helmet = require("helmet");
const multer = require("multer");
const { rateLimit } = require("express-rate-limit");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(48).toString("hex");
const isProduction = process.env.NODE_ENV === "production";

if (isProduction && (!process.env.SESSION_SECRET || Buffer.byteLength(process.env.SESSION_SECRET, "utf8") < 32)) {
  throw new Error("Set a SESSION_SECRET of at least 32 bytes before starting the portal in production.");
}

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "portal.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
    class_name TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE
  );
  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE
  );
  CREATE TABLE IF NOT EXISTS portal_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    score REAL NOT NULL CHECK (score >= 0 AND score <= 100),
    grade TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    stored_name TEXT NOT NULL UNIQUE,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late')),
    recorded_by INTEGER NOT NULL REFERENCES users(id),
    UNIQUE (student_id, date)
  );
  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    expires INTEGER NOT NULL,
    data TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS results_student_idx ON results(student_id, status);
  CREATE INDEX IF NOT EXISTS notes_date_idx ON notes(created_at);
  CREATE INDEX IF NOT EXISTS attendance_student_idx ON attendance(student_id, date);
  CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires);
`);
const insertSetting = db.prepare("INSERT INTO portal_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING");
insertSetting.run("school_name", "Crestview College");
db.prepare("UPDATE portal_settings SET value = ? WHERE key = ? AND value = ?")
  .run("Crestview College", "school_name", "Crestview School");
insertSetting.run("academic_term", "");

class SQLiteSessionStore extends session.Store {
  constructor(database) {
    super();
    this.database = database;
    this.getStatement = database.prepare("SELECT data, expires FROM sessions WHERE sid = ?");
    this.setStatement = database.prepare("INSERT INTO sessions (sid, expires, data) VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET expires = excluded.expires, data = excluded.data");
    this.deleteStatement = database.prepare("DELETE FROM sessions WHERE sid = ?");
    this.cleanupStatement = database.prepare("DELETE FROM sessions WHERE expires <= ?");
  }

  get(sid, callback) {
    try {
      const row = this.getStatement.get(sid);
      if (!row) return callback(null, null);
      if (row.expires <= Date.now()) {
        this.deleteStatement.run(sid);
        return callback(null, null);
      }
      return callback(null, JSON.parse(row.data));
    } catch (error) {
      return callback(error);
    }
  }

  set(sid, value, callback = () => {}) {
    try {
      const expires = value.cookie && value.cookie.expires
        ? new Date(value.cookie.expires).getTime()
        : Date.now() + 8 * 60 * 60 * 1000;
      this.setStatement.run(sid, expires, JSON.stringify(value));
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  destroy(sid, callback = () => {}) {
    try {
      this.deleteStatement.run(sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  touch(sid, value, callback = () => {}) {
    this.set(sid, value, callback);
  }
}

const sessionStore = new SQLiteSessionStore(db);
setInterval(() => {
  try {
    sessionStore.cleanupStatement.run(Date.now());
  } catch (error) {
    console.error("Could not clean expired sessions:", error.message);
  }
}, 60 * 60 * 1000).unref();

function seedAdministrator() {
  if (db.prepare("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").get()) return;
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "School Administrator";
  if (!isValidText(username, 80) || !isValidPassword(password, 12) || !isValidText(name, 100)) {
    throw new Error("No administrator exists. Set ADMIN_USERNAME and an ADMIN_PASSWORD of 12 to 72 UTF-8 bytes for the first startup.");
  }
  const hash = bcrypt.hashSync(password, 12);
  db.prepare("INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, 'admin')")
    .run(name.trim(), username.trim(), hash);
  console.log(`Created the initial administrator account "${username.trim()}".`);
}

seedAdministrator();

const app = express();
if (isProduction) app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  }
}));
app.use(express.json({ limit: "50kb" }));
app.use(session({
  name: "crestview.sid",
  secret: SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 8 * 60 * 60 * 1000
  }
}));
app.get("/", (_req, res) => res.sendFile(path.join(ROOT, "index.html")));
app.get("/styles.css", (_req, res) => res.sendFile(path.join(ROOT, "styles.css")));
app.get("/app.js", (_req, res) => res.sendFile(path.join(ROOT, "app.js")));

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    className: user.class_name,
    subject: user.subject
  };
}

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Please sign in to continue." });
  next();
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.session.user || !roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: "You do not have permission to do that." });
    }
    next();
  };
}

function requireCsrf(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const supplied = req.get("X-CSRF-Token");
  const providedBuffer = Buffer.from(supplied || "");
  const expectedBuffer = Buffer.from(req.session.csrfToken || "");
  if (!supplied || !req.session.csrfToken || providedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return res.status(403).json({ error: "Your session expired. Refresh the page and try again." });
  }
  next();
}

function invalidateUserSessions(userId, exceptSessionId) {
  const sessions = db.prepare("SELECT sid, data FROM sessions").all();
  for (const item of sessions) {
    if (item.sid === exceptSessionId) continue;
    try {
      const sessionData = JSON.parse(item.data);
      if (sessionData.user && sessionData.user.id === userId) sessionStore.deleteStatement.run(item.sid);
    } catch (error) {
      console.error("Could not inspect a stored session:", error.message);
    }
  }
}

function isValidText(value, maxLength) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

function isValidPassword(value, minimumLength = 10) {
  return typeof value === "string" && value.length >= minimumLength && Buffer.byteLength(value, "utf8") <= 72;
}

function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function gradeFor(score) {
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

function validClass(className) {
  return !className || Boolean(db.prepare("SELECT 1 FROM classes WHERE name = ? COLLATE NOCASE").get(className));
}

function validSubject(subject) {
  return !subject || Boolean(db.prepare("SELECT 1 FROM subjects WHERE name = ? COLLATE NOCASE").get(subject));
}

app.use("/api", requireCsrf);

app.get("/api/session", (req, res) => {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  res.json({
    csrfToken: req.session.csrfToken,
    user: req.session.user || null
  });
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Please wait a while and try again." }
});

app.post("/api/login", loginLimiter, asyncRoute(async (req, res) => {
  const { username, password, role } = req.body || {};
  if (!isValidText(username, 80) || !["student", "teacher", "admin"].includes(role) ||
      (role !== "student" && (typeof password !== "string" || !password || Buffer.byteLength(password, "utf8") > 72))) {
    return res.status(400).json({ error: role === "student"
      ? "Enter your admission number."
      : "Enter a username, password, and account type." });
  }
  const user = db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE AND role = ?")
    .get(username.trim(), role);
  const matches = role === "student" ? Boolean(user) : user && await bcrypt.compare(password, user.password_hash);
  if (!matches) {
    return res.status(401).json({ error: role === "student"
      ? "That admission number could not be verified."
      : "The username, password, or account type is incorrect." });
  }
  await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
  req.session.user = publicUser(user);
  req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  res.json({ user: req.session.user, csrfToken: req.session.csrfToken });
}));

app.post("/api/logout", requireAuth, (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("crestview.sid", { httpOnly: true, secure: isProduction, sameSite: "lax" });
    res.json({ message: "Signed out." });
  });
});

function getPortalData(req) {
  const user = req.session.user;
  const isAdmin = user.role === "admin";
  const isTeacher = user.role === "teacher";
  const studentFilter = isTeacher ? "AND u.class_name = ?" : "";
  const students = isAdmin || isTeacher
    ? db.prepare(`SELECT id, name, class_name AS className FROM users u WHERE role = 'student' ${studentFilter} ORDER BY name`)
      .all(...(isTeacher ? [user.className] : []))
    : [];
  let results;
  if (user.role === "student") {
    results = db.prepare("SELECT id, subject, score, grade, status, created_at AS datePosted FROM results WHERE student_id = ? AND status = 'approved' ORDER BY created_at DESC")
      .all(user.id);
  } else if (isTeacher) {
    results = db.prepare(`SELECT r.id, r.subject, r.score, r.grade, r.status, r.created_at AS datePosted,
      u.name AS studentName, u.class_name AS className
      FROM results r JOIN users u ON u.id = r.student_id
      WHERE r.created_by = ? ORDER BY r.created_at DESC`).all(user.id);
  } else {
    results = db.prepare(`SELECT r.id, r.subject, r.score, r.grade, r.status, r.created_at AS datePosted,
      u.name AS studentName, u.class_name AS className
      FROM results r JOIN users u ON u.id = r.student_id ORDER BY r.created_at DESC`).all();
  }

  const notes = db.prepare(`SELECT n.id, n.title, n.subject, n.original_name,
    date(n.created_at) AS datePosted, u.name AS uploader, n.uploaded_by
    FROM notes n JOIN users u ON u.id = n.uploaded_by ORDER BY n.created_at DESC`).all()
    .map((note) => ({
      id: note.id,
      title: note.title,
      subject: note.subject,
      datePosted: note.datePosted,
      uploader: note.uploader,
      own: note.uploaded_by === user.id,
      extension: path.extname(note.original_name).slice(1).toLowerCase()
    }));

  const announcements = db.prepare(`SELECT a.id, a.title, a.message, date(a.created_at) AS datePosted,
    u.name AS author, a.created_by AS createdBy
    FROM announcements a JOIN users u ON u.id = a.created_by
    ORDER BY a.created_at DESC LIMIT 100`).all();
  const attendanceWhere = user.role === "student"
    ? "WHERE a.student_id = ?"
    : isTeacher ? "WHERE student.class_name = ?" : "";
  const attendanceParams = user.role === "student" ? [user.id] : isTeacher ? [user.className] : [];
  const attendance = db.prepare(`SELECT a.id, a.date, a.status, student.name AS studentName,
    student.class_name AS className
    FROM attendance a JOIN users student ON student.id = a.student_id
    ${attendanceWhere} ORDER BY a.date DESC LIMIT 200`).all(...attendanceParams);

  const data = {
    user,
    settings: Object.fromEntries(db.prepare("SELECT key, value FROM portal_settings").all().map((item) => [item.key, item.value])),
    results,
    notes,
    announcements,
    attendance,
    students,
    classes: [],
    subjects: []
  };
  if (isAdmin) {
    data.users = db.prepare("SELECT id, name, username, role, class_name AS className, subject FROM users ORDER BY role, name").all();
    data.pendingResults = db.prepare(`SELECT r.id, r.subject, r.score, r.grade, r.status,
      u.name AS studentName, u.class_name AS className
      FROM results r JOIN users u ON u.id = r.student_id WHERE r.status = 'pending'
      ORDER BY r.created_at`).all();
    data.classes = db.prepare("SELECT name FROM classes ORDER BY name").all();
    data.subjects = db.prepare("SELECT name FROM subjects ORDER BY name").all();
  } else if (isTeacher) {
    data.subjects = db.prepare("SELECT name FROM subjects ORDER BY name").all();
  }
  return data;
}

app.get("/api/data", requireAuth, (req, res) => {
  res.json(getPortalData(req));
});

app.post("/api/account/password", requireAuth, asyncRoute(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== "string" || Buffer.byteLength(currentPassword, "utf8") > 72 || !isValidPassword(newPassword)) {
    return res.status(400).json({ error: "Enter your current password and a new password of at least 10 characters and no more than 72 UTF-8 bytes." });
  }
  const user = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(req.session.user.id);
  if (!user || !await bcrypt.compare(currentPassword, user.password_hash)) {
    return res.status(400).json({ error: "Your current password is incorrect." });
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, req.session.user.id);
  invalidateUserSessions(req.session.user.id, req.sessionID);
  res.json({ message: "Password updated." });
}));

app.post("/api/users", requireAuth, allowRoles("admin"), asyncRoute(async (req, res) => {
  const { name, username, password, role, className = "", subject = "" } = req.body || {};
  if (!isValidText(name, 100) || !isValidText(username, 80) ||
      (role !== "student" && !isValidPassword(password)) ||
      !["student", "teacher", "admin"].includes(role)) {
    return res.status(400).json({ error: "Provide a name, username, and account type. Staff accounts also need a password of 10 or more characters (maximum 72 UTF-8 bytes)." });
  }
  if (typeof className !== "string" || typeof subject !== "string" ||
      !validClass(className) || !validSubject(subject)) {
    return res.status(400).json({ error: "Choose an existing class and subject, or leave them blank." });
  }
  try {
    const accountPassword = role === "student" ? crypto.randomBytes(32).toString("hex") : password;
    const hash = await bcrypt.hash(accountPassword, 12);
    db.prepare("INSERT INTO users (name, username, password_hash, role, class_name, subject) VALUES (?, ?, ?, ?, ?, ?)")
      .run(name.trim(), username.trim(), hash, role, className, subject);
    res.status(201).json({ message: "Account created." });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ error: "That username is already in use." });
    throw error;
  }
}));

app.patch("/api/users/:id/password", requireAuth, allowRoles("admin"), asyncRoute(async (req, res) => {
  const password = req.body && req.body.password;
  const userId = Number(req.params.id);
  if (!Number.isSafeInteger(userId) || !isValidPassword(password)) {
    return res.status(400).json({ error: "Enter a new password of 10 or more characters (maximum 72 UTF-8 bytes)." });
  }
  const hash = await bcrypt.hash(password, 12);
  const result = db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, userId);
  if (!result.changes) return res.status(404).json({ error: "Account not found." });
  invalidateUserSessions(userId, req.sessionID);
  res.json({ message: "Account password reset." });
}));

app.post("/api/classes", requireAuth, allowRoles("admin"), (req, res) => {
  const { type, name } = req.body || {};
  if (!isValidText(name, 80)) return res.status(400).json({ error: "Enter a name of up to 80 characters." });
  if (type !== "class") return res.status(400).json({ error: "Invalid class request." });
  try {
    db.prepare("INSERT INTO classes (name) VALUES (?)").run(name.trim());
    res.status(201).json({ message: "Class added." });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ error: "That class already exists." });
    throw error;
  }
});

app.post("/api/subjects", requireAuth, allowRoles("admin"), (req, res) => {
  const { name } = req.body || {};
  if (!isValidText(name, 80)) return res.status(400).json({ error: "Enter a subject name of up to 80 characters." });
  try {
    db.prepare("INSERT INTO subjects (name) VALUES (?)").run(name.trim());
    res.status(201).json({ message: "Subject added." });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ error: "That subject already exists." });
    throw error;
  }
});

app.put("/api/settings", requireAuth, allowRoles("admin"), (req, res) => {
  const { schoolName, academicTerm } = req.body || {};
  if (!isValidText(schoolName, 100) || typeof academicTerm !== "string" || academicTerm.trim().length > 80) {
    return res.status(400).json({ error: "Enter a school name up to 100 characters and a term up to 80 characters." });
  }
  const updateSetting = db.prepare("UPDATE portal_settings SET value = ? WHERE key = ?");
  const saveSettings = db.transaction(() => {
    updateSetting.run(schoolName.trim(), "school_name");
    updateSetting.run(academicTerm.trim(), "academic_term");
  });
  saveSettings();
  res.json({ message: "Portal settings updated." });
});

app.post("/api/results", requireAuth, allowRoles("teacher"), (req, res) => {
  const { studentId, subject, score: rawScore } = req.body || {};
  const id = Number(studentId);
  const score = typeof rawScore === "number" || (typeof rawScore === "string" && rawScore.trim())
    ? Number(rawScore)
    : Number.NaN;
  const student = db.prepare("SELECT id, class_name FROM users WHERE id = ? AND role = 'student'").get(id);
  if (!Number.isSafeInteger(id) || !student || student.class_name !== req.session.user.className) {
    return res.status(400).json({ error: "Choose a student from your assigned class." });
  }
  if (!isValidText(subject, 80) || !validSubject(subject) ||
      (req.session.user.subject && req.session.user.subject.toLowerCase() !== subject.trim().toLowerCase()) ||
      !Number.isFinite(score) || score < 0 || score > 100) {
    return res.status(400).json({ error: "Choose your assigned subject and enter a score from 0 to 100." });
  }
  db.prepare("INSERT INTO results (student_id, subject, score, grade, created_by) VALUES (?, ?, ?, ?, ?)")
    .run(id, subject.trim(), score, gradeFor(score), req.session.user.id);
  res.status(201).json({ message: "Result submitted for administrator approval." });
});

app.put("/api/results/:id", requireAuth, allowRoles("teacher"), (req, res) => {
  const resultId = Number(req.params.id);
  const rawScore = req.body && req.body.score;
  const score = typeof rawScore === "number" || (typeof rawScore === "string" && rawScore.trim())
    ? Number(rawScore)
    : Number.NaN;
  if (!Number.isSafeInteger(resultId) || !Number.isFinite(score) || score < 0 || score > 100) {
    return res.status(400).json({ error: "Enter a score from 0 to 100." });
  }
  const result = db.prepare(`SELECT r.id, r.status FROM results r
    JOIN users student ON student.id = r.student_id
    WHERE r.id = ? AND r.created_by = ? AND student.class_name = ?`)
    .get(resultId, req.session.user.id, req.session.user.className);
  if (!result || result.status !== "pending") return res.status(404).json({ error: "Pending result not found." });
  db.prepare("UPDATE results SET score = ?, grade = ?, updated_at = datetime('now') WHERE id = ?")
    .run(score, gradeFor(score), resultId);
  res.json({ message: "Pending result updated." });
});

app.post("/api/results/:id/approve", requireAuth, allowRoles("admin"), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id)) return res.status(400).json({ error: "Invalid result." });
  const result = db.prepare("UPDATE results SET status = 'approved', updated_at = datetime('now') WHERE id = ? AND status = 'pending'").run(id);
  if (!result.changes) return res.status(404).json({ error: "Pending result not found." });
  res.json({ message: "Result approved." });
});

const allowedFiles = new Map([
  [".pdf", "application/pdf"],
  [".doc", "application/msword"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".txt", "text/plain"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"]
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, UPLOAD_DIR),
    filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedFiles.has(extension) || file.mimetype !== allowedFiles.get(extension)) {
      return callback(new Error("Unsupported file. Upload a PDF, Word document, text file, PNG, or JPEG."));
    }
    callback(null, true);
  }
});

app.post("/api/notes", requireAuth, allowRoles("teacher", "admin"), upload.single("file"), (req, res, next) => {
  try {
    const { title, subject } = req.body || {};
    if (!req.file || !isValidText(title, 120) || !isValidText(subject, 80) ||
        !validSubject(subject) ||
        (req.session.user.role === "teacher" && req.session.user.subject &&
          req.session.user.subject.toLowerCase() !== subject.trim().toLowerCase())) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Provide a title, your assigned subject, and a supported file." });
    }
    db.prepare(`INSERT INTO notes (title, subject, stored_name, original_name, mime_type, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .run(title.trim(), subject.trim(), req.file.filename, path.basename(req.file.originalname), req.file.mimetype, req.session.user.id);
    res.status(201).json({ message: "Learning material uploaded." });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    next(error);
  }
});

app.delete("/api/notes/:id", requireAuth, allowRoles("teacher", "admin"), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id)) return res.status(400).json({ error: "Invalid learning material." });
  const note = db.prepare("SELECT stored_name, uploaded_by FROM notes WHERE id = ?").get(id);
  if (!note || (req.session.user.role === "teacher" && note.uploaded_by !== req.session.user.id)) {
    return res.status(404).json({ error: "Learning material not found or you do not own it." });
  }
  const filePath = path.join(UPLOAD_DIR, note.stored_name);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  db.prepare("DELETE FROM notes WHERE id = ?").run(id);
  res.json({ message: "Learning material deleted." });
});

app.get("/api/notes/:id/download", requireAuth, (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id)) return res.status(404).json({ error: "File not found." });
  const note = db.prepare("SELECT stored_name, original_name FROM notes WHERE id = ?").get(id);
  if (!note) return res.status(404).json({ error: "File not found." });
  const filePath = path.join(UPLOAD_DIR, note.stored_name);
  res.download(filePath, path.basename(note.original_name), (error) => {
    if (error && !res.headersSent) next(error);
  });
});

app.post("/api/announcements", requireAuth, allowRoles("teacher", "admin"), (req, res) => {
  const { title, message } = req.body || {};
  if (!isValidText(title, 120) || !isValidText(message, 2000)) {
    return res.status(400).json({ error: "Enter a title and message (up to 2,000 characters)." });
  }
  db.prepare("INSERT INTO announcements (title, message, created_by) VALUES (?, ?, ?)")
    .run(title.trim(), message.trim(), req.session.user.id);
  res.status(201).json({ message: "Announcement published." });
});

app.delete("/api/announcements/:id", requireAuth, allowRoles("teacher", "admin"), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id)) return res.status(400).json({ error: "Invalid announcement." });
  const isAdmin = req.session.user.role === "admin";
  const result = isAdmin
    ? db.prepare("DELETE FROM announcements WHERE id = ?").run(id)
    : db.prepare("DELETE FROM announcements WHERE id = ? AND created_by = ?").run(id, req.session.user.id);
  if (!result.changes) return res.status(404).json({ error: "Announcement not found or you do not own it." });
  res.json({ message: "Announcement deleted." });
});

app.post("/api/attendance", requireAuth, allowRoles("teacher"), (req, res) => {
  const { studentId, date, status } = req.body || {};
  const id = Number(studentId);
  const student = db.prepare("SELECT id, class_name FROM users WHERE id = ? AND role = 'student'").get(id);
  if (!Number.isSafeInteger(id) || !student || student.class_name !== req.session.user.className ||
      !validDate(date) || !["present", "absent", "late"].includes(status)) {
    return res.status(400).json({ error: "Choose a student in your class, a valid date, and an attendance status." });
  }
  try {
    db.prepare("INSERT INTO attendance (student_id, date, status, recorded_by) VALUES (?, ?, ?, ?)")
      .run(id, date, status, req.session.user.id);
    res.status(201).json({ message: "Attendance recorded." });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ error: "Attendance is already recorded for that student and date." });
    throw error;
  }
});

app.use("/api", (_req, res) => res.status(404).json({ error: "API endpoint not found." }));
app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "The selected file is larger than 10 MB."
      : "The selected file could not be uploaded.";
    return res.status(400).json({ error: message });
  }
  if (error.message && error.message.startsWith("Unsupported file.")) {
    return res.status(400).json({ error: error.message });
  }
  console.error("Portal request failed:", error);
  if (res.headersSent) return;
  res.status(500).json({ error: "The server could not complete that request. Please try again." });
});

app.listen(PORT, () => {
  console.log(`Crestview College Portal is running at http://localhost:${PORT}`);
  if (!isProduction) console.log("Development mode: use a local-only environment for testing.");
});
