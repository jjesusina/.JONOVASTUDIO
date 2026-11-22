(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const STORE_KEY = "crestview-portal-demo-v1";
  const COOKIE_CHOICE_KEY = "crestview-cookie-choice";
  const THEME_KEY = "crestview-theme";
  const DEFAULT_TERM = "2026 · Term 1";
  const classes = ["Year 7", "Year 8", "Year 9", "Year 10", "Year 11", "Year 12"];
  const subjects = ["Mathematics", "English", "Biology", "History"];
  let state;
  let currentUser = null;
  let authMode = "login";
  let selectedRole = "student";
  let activePage = "overview";
  let noticeTimer;
  const identifierPattern = {
    student: /^CRV-STU-\d{3}$/,
    teacher: /^CRV-STAFF-\d{3}$/,
    admin: /^CRV-ADMIN-\d{3}$/
  };

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const sampleState = () => ({
    version: 2,
    term: DEFAULT_TERM,
    users: [
      { id: "u-stu-1", role: "student", name: "Amara Okafor", email: "amara.okafor@crestview.edu", password: "Student123!", identifier: "CRV-STU-001", className: "Year 10", approved: true },
      { id: "u-stu-2", role: "student", name: "Daniel Mensah", email: "daniel.mensah@crestview.edu", password: "Student123!", identifier: "CRV-STU-002", className: "Year 11", approved: true },
      { id: "u-stu-3", role: "student", name: "Sofia Bennett", email: "sofia.bennett@crestview.edu", password: "Student123!", identifier: "CRV-STU-003", className: "Year 10", approved: true },
      { id: "u-tea-1", role: "teacher", name: "James Cole", email: "james.cole@crestview.edu", password: "Teacher123!", identifier: "CRV-STAFF-001", className: "Year 10", subject: "Mathematics", approved: true },
      { id: "u-tea-2", role: "teacher", name: "Grace Williams", email: "grace.williams@crestview.edu", password: "Teacher123!", identifier: "CRV-STAFF-002", className: "Year 11", subject: "Biology", approved: true },
      { id: "u-admin-1", role: "admin", name: "School Administrator", email: "admin@crestview.edu", password: "Admin123!", identifier: "CRV-ADMIN-001", approved: true }
    ],
    results: [
      { id: "res-1", studentId: "u-stu-1", subject: "Mathematics", score: 88, grade: "A", term: "2026 · Term 1", status: "approved", teacherId: "u-tea-1" },
      { id: "res-2", studentId: "u-stu-1", subject: "English", score: 76, grade: "B", term: "2026 · Term 1", status: "approved", teacherId: "u-tea-1" },
      { id: "res-3", studentId: "u-stu-2", subject: "Biology", score: 91, grade: "A", term: "2026 · Term 1", status: "approved", teacherId: "u-tea-2" }
    ],
    notes: [
      { id: "note-1", title: "Algebra: Expressions & Equations", subject: "Mathematics", className: "Year 10", uploader: "James Cole", date: "2026-09-10", filename: "algebra-study-notes.txt", mime: "text/plain", text: "CRESTVIEW COLLEGE — MATHEMATICS\nAlgebra: Expressions & Equations\n\n1. Collect like terms before solving.\n2. Keep equations balanced: perform the same operation on both sides.\n3. Check your answer by substituting it back into the original equation.\n\nPractice: Solve 3x + 5 = 20. Answer: x = 5.\n\nBelieve, Inspire, Excel." },
      { id: "note-2", title: "Cell Biology Revision Guide", subject: "Biology", className: "Year 11", uploader: "Grace Williams", date: "2026-09-12", filename: "cell-biology-revision.txt", mime: "text/plain", text: "CRESTVIEW COLLEGE — BIOLOGY\nCell Biology Revision Guide\n\nKey topics: cell structure, specialised cells, diffusion, osmosis, and active transport.\n\nRemember to compare plant and animal cells and label each structure clearly.\n\nBelieve, Inspire, Excel." },
      { id: "note-3", title: "Essay Writing: A Student Guide", subject: "English", className: "Year 10", uploader: "James Cole", date: "2026-09-15", filename: "essay-writing-guide.txt", mime: "text/plain", text: "CRESTVIEW COLLEGE — ENGLISH\nEssay Writing: A Student Guide\n\n1. Plan your ideas before writing.\n2. Begin each paragraph with a clear topic sentence.\n3. Support your ideas with evidence and explanation.\n4. Proofread your work before submitting.\n\nBelieve, Inspire, Excel." }
    ],
    notices: [
      { id: "notice-1", title: "Welcome to the new school term", message: "We are delighted to welcome everyone back to Crestview College. Let’s make this a term to believe, inspire, and excel!", author: "School Administration", date: "2026-09-01", createdBy: "u-admin-1" },
      { id: "notice-2", title: "Library study hours extended", message: "The college library will remain open until 6:00 PM on weekdays this month. Bring your student ID when visiting after class.", author: "James Cole", date: "2026-09-12", createdBy: "u-tea-1" }
    ],
    activities: [
      { id: "act-1", message: "Portal demo data was loaded", date: "2026-09-01 08:00" },
      { id: "act-2", message: "School notice board opened for Term 1", date: "2026-09-01 08:05" }
    ],
    campus: {
      schools: ["Crestview College", "Crestview Junior School"],
      activeSchool: "Crestview College",
      library: [{ id: "book-1", title: "The Young Learner's Handbook", author: "Crestview Library" }],
      assignments: [{ id: "assignment-1", title: "Term reflection", due: "2026-12-15" }],
      submissions: [], discussions: [], events: [{ id: "event-1", title: "Science fair", date: "2026-12-10" }],
      chats: [], wellbeing: [], visitors: [], operations: [], preference: "In-app only"
    }
  });

  function loadState() {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (!saved) {
        state = sampleState();
        state.users.forEach((user) => { user.school = "Crestview College"; });
        state.notes.forEach((note) => { note.school = "Crestview College"; });
        ["library", "assignments", "submissions", "discussions", "events", "chats", "wellbeing", "visitors", "operations"].forEach((key) => {
          state.campus[key].forEach((item) => { if (!item.school) item.school = "Crestview College"; });
        });
        saveState();
        return;
      }
      const parsed = JSON.parse(saved);
      if (!parsed || ![1, 2].includes(parsed.version) || !Array.isArray(parsed.users) || !Array.isArray(parsed.results) ||
          !Array.isArray(parsed.notes) || !Array.isArray(parsed.notices) || !Array.isArray(parsed.activities)) {
        throw new Error("Saved portal data is not valid. Clear this site's browser storage to reload the demo.");
      }
      state = parsed;
      if (!state.campus) state.campus = sampleState().campus;
      const defaults = sampleState().campus;
      Object.keys(defaults).forEach((key) => {
        if (state.campus[key] === undefined) state.campus[key] = defaults[key];
      });
      state.users.forEach((user) => { if (!user.school) user.school = "Crestview College"; });
      state.notes.forEach((note) => {
        if (!note.school) note.school = state.users.find((user) => user.name === note.uploader)?.school || "Crestview College";
      });
      ["library", "assignments", "submissions", "discussions", "events", "chats", "wellbeing", "visitors", "operations"].forEach((key) => {
        state.campus[key].forEach((item) => { if (!item.school) item.school = "Crestview College"; });
      });
      state.version = 2;
      saveState();
    } catch (error) {
      $("#login-message").textContent = error.message || "Browser storage is unavailable. Enable local storage to use the portal.";
      $("#login-message").classList.add("visible");
      throw error;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (error) {
      notify("Could not save your changes. Browser storage may be full or disabled.", true);
      throw error;
    }
  }

  function logActivity(message) {
    state.activities.unshift({
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      message,
      date: new Date().toLocaleString()
    });
    state.activities = state.activities.slice(0, 100);
  }

  function notify(message, error = false) {
    const box = $("#portal-message");
    box.textContent = message;
    box.classList.toggle("error", error);
    box.hidden = false;
    window.clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => { box.hidden = true; }, 5000);
  }

  function userById(id) {
    return state.users.find((user) => user.id === id);
  }

  function studentResults() {
    if (currentUser.role === "student") return state.results.filter((item) => item.studentId === currentUser.id && item.status === "approved");
    if (currentUser.role === "teacher") return state.results.filter((item) => {
      const student = userById(item.studentId);
      return student && student.school === currentUser.school && student.className === currentUser.className;
    });
    return [...state.results];
  }

  function visibleNotes() {
    if (currentUser.role === "admin") return state.notes;
    return state.notes.filter((note) => note.school === currentUser.school &&
      (note.className === currentUser.className || note.className === "All classes"));
  }

  function showAuth(mode = "login", role = selectedRole) {
    authMode = mode;
    selectedRole = role;
    $("#auth-panel").hidden = false;
    $("#auth-panel").scrollIntoView({ behavior: "smooth", block: "start" });
    $("#auth-title").textContent = mode === "login" ? "Welcome back" : "Create your account";
    $("#auth-subtitle").textContent = mode === "login" ? "Log in to continue to your portal." : "Join the Crestview College community.";
    $("#auth-eyebrow").textContent = mode === "login" ? "YOUR CRESTVIEW ACCOUNT" : "YOUR NEXT CHAPTER STARTS HERE";
    $("#login-form").hidden = mode !== "login";
    $("#signup-form").hidden = mode !== "signup";
    document.querySelectorAll(".mode-tab").forEach((tab) => {
      const active = tab.dataset.mode === mode;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll(".role-tab").forEach((tab) => {
      const active = tab.dataset.role === role;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    const identity = $("#login-identity");
    identity.type = "email";
    identity.placeholder = `you@crestview.edu`;
    $("#identity-label").textContent = "Email address";
    $("#signup-class-field").hidden = role !== "student";
    $("#signup-class").required = role === "student";
    $("#signup-subject-field").hidden = role !== "teacher";
    $("#signup-subject").required = role === "teacher";
    $("#signup-password-field").hidden = false;
    $("#signup-password").required = true;
    $("#login-message").textContent = "";
    $("#login-message").classList.remove("visible", "success");
    $("#signup-message").textContent = "";
    $("#signup-message").classList.remove("visible", "success");
  }

  function showAuthMessage(id, message, success = false) {
    const element = $(id);
    element.textContent = message;
    element.classList.toggle("success", success);
    element.classList.add("visible");
  }

  function gradeFor(score) {
    if (score >= 80) return "A";
    if (score >= 70) return "B";
    if (score >= 60) return "C";
    if (score >= 50) return "D";
    return "F";
  }

  function formatDate(date) {
    const parsed = new Date(`${date}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? esc(date) : parsed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }

  function emptyState(message) {
    return `<div class="empty-state">${esc(message)}</div>`;
  }

  function resultTable(items, showStudent = false, admin = false) {
    if (!items.length) return emptyState("No results to display for this term yet.");
    const rows = items.map((item) => {
      const student = userById(item.studentId);
      const actions = admin
        ? `<td><span class="badge ${item.status === "pending" ? "pending" : ""}">${esc(item.status)}</span>${item.status === "pending" ? ` <button class="text-button" type="button" data-action="approve-result" data-id="${esc(item.id)}">Approve</button>` : ""}</td>`
        : currentUser.role === "teacher" && item.status === "pending"
          ? `<td><form class="inline-actions" data-action="update-result" data-id="${esc(item.id)}"><input type="number" name="score" min="0" max="100" step="0.1" value="${esc(item.score)}" aria-label="Update score" required><button type="submit">Update</button></form></td>`
          : `<td><span class="badge">${esc(item.status)}</span></td>`;
      return `<tr>${showStudent ? `<td>${esc(student?.name || "Unknown")}<small class="cell-subtitle">${esc(student?.className || "")}</small></td>` : ""}<td>${esc(item.subject)}</td><td>${esc(item.score)}%</td><td><span class="grade grade-${esc(item.grade)}">${esc(item.grade)}</span></td><td>${esc(item.term)}</td>${actions}</tr>`;
    }).join("");
    return `<div class="table-panel table-wrap"><table><thead><tr>${showStudent ? "<th>Student</th>" : ""}<th>Subject</th><th>Score</th><th>Grade</th><th>Term</th><th>${admin || currentUser.role === "teacher" ? "Status / action" : "Status"}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderNotices(items, compact = false) {
    if (!items.length) return emptyState("There are no notices yet.");
    return items.map((notice) => `<article class="announcement">
      <div class="announcement-head"><div><span class="notice-dot"></span><h3>${esc(notice.title)}</h3></div>${currentUser.role !== "student" && !compact ? `<button class="text-button" type="button" data-action="delete-notice" data-id="${esc(notice.id)}">Remove</button>` : ""}</div>
      <p>${esc(notice.message)}</p><small>${formatDate(notice.date)} · Posted by ${esc(notice.author || "Crestview College")}</small>
    </article>`).join("");
  }

  function renderNotes(items) {
    if (!items.length) return emptyState("No class notes or study materials are available yet.");
    return items.map((note) => `<article class="resource-card">
      <span class="file-icon" aria-hidden="true">${esc(note.filename.split(".").pop().slice(0, 5).toUpperCase())}</span>
      <div class="resource-info"><strong>${esc(note.title)}</strong><small>${esc(note.subject)} · ${esc(note.className)} · ${esc(note.uploader)} · ${formatDate(note.date)}</small></div>
      <button class="download-link" type="button" data-action="download-note" data-id="${esc(note.id)}">Download</button>
      ${currentUser.role !== "student" ? `<button class="text-button" type="button" data-action="delete-note" data-id="${esc(note.id)}">Remove</button>` : ""}
    </article>`).join("");
  }

  function renderUserTable(users) {
    if (!users.length) return emptyState("No accounts found.");
    return `<div class="table-panel table-wrap"><table><thead><tr><th>Name / email</th><th>Account</th><th>Class / subject</th><th>ID</th><th>Status</th>${currentUser.role === "admin" ? "<th>Actions</th>" : ""}</tr></thead><tbody>${users.map((user) => `<tr>
      <td><strong>${esc(user.name)}</strong><small class="cell-subtitle">${esc(user.email)}</small></td><td><span class="badge">${esc(user.role)}</span></td><td>${esc([user.className, user.subject].filter(Boolean).join(" · ") || "—")}</td><td>${esc(user.identifier)}</td><td><span class="badge ${user.approved ? "" : "pending"}">${user.approved ? "Approved" : "Pending"}</span></td>
      ${currentUser.role === "admin" ? `<td class="user-actions">${!user.approved ? `<button class="text-button" type="button" data-action="approve-user" data-id="${esc(user.id)}">Approve</button>` : ""}${user.id !== currentUser.id ? `<button class="text-button danger-text" type="button" data-action="delete-user" data-id="${esc(user.id)}">Remove</button>` : ""}</td>` : ""}
    </tr>`).join("")}</tbody></table></div>`;
  }

  function buildDashboard() {
    const user = currentUser;
    const ownResults = studentResults();
    const pendingResults = state.results.filter((item) => item.status === "pending");
    const approvedStudents = state.users.filter((item) => item.role === "student" && item.approved &&
      (user.role === "admin" || item.school === user.school));
    const teacherRoster = user.role === "teacher" ? approvedStudents.filter((student) => student.className === user.className) : approvedStudents;
    const visibleResults = user.role === "student" ? ownResults : user.role === "teacher" ? studentResults() : state.results;
    const notes = visibleNotes();
    const roleLabel = user.role === "admin" ? "Administrator" : user.role === "teacher" ? "Teacher" : "Student";
    $("#user-name").textContent = user.name;
    $("#user-role").textContent = roleLabel;
    $("#user-avatar").textContent = user.name.trim().charAt(0).toUpperCase();
    $("#top-name").textContent = user.name.split(" ")[0];
    $("#top-role").textContent = roleLabel;
    $("#top-avatar").textContent = user.name.trim().charAt(0).toUpperCase();
    $("#greeting").textContent = `${greeting()}, ${user.name.split(" ")[0]}`;
    $("#today-label").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase();
    $("#term-pill").textContent = state.term;

    document.querySelectorAll("[data-staff-only]").forEach((node) => { node.hidden = user.role === "student"; });
    document.querySelectorAll("[data-admin-only]").forEach((node) => { node.hidden = user.role !== "admin"; });

    const cards = user.role === "student"
      ? [["▤", "Published results", ownResults.length], ["⇩", "Study resources", notes.length], ["◉", "College notices", state.notices.length]]
      : user.role === "teacher"
        ? [["♙", "Your students", teacherRoster.length], ["▤", "Class results", visibleResults.length], ["⇩", "Study resources", notes.length]]
        : [["♙", "College accounts", state.users.length], ["◷", "Awaiting approval", state.users.filter((item) => !item.approved).length + pendingResults.length], ["◉", "Portal activities", state.activities.length]];
    $("#summary-cards").innerHTML = cards.map(([icon, label, value]) => `<article class="stat-card"><span class="stat-icon">${icon}</span><div><small>${esc(label)}</small><strong>${esc(value)}</strong></div></article>`).join("");
    $("#recent-announcements").innerHTML = renderNotices(state.notices.slice(0, 2), true);
    $("#announcement-content").innerHTML = renderNotices(state.notices);

    const termFilter = $("#term-filter");
    const terms = [...new Set(state.results.map((item) => item.term))];
    if (!terms.includes(state.term)) terms.unshift(state.term);
    const selectedTerm = termFilter.value;
    termFilter.innerHTML = terms.map((term) => `<option value="${esc(term)}">${esc(term)}</option>`).join("");
    termFilter.value = terms.includes(selectedTerm) ? selectedTerm : state.term;
    renderResultsForTerm();
    $("#note-content").innerHTML = renderNotes(notes);

    $("#students-content").innerHTML = renderUserTable(user.role === "teacher" ? teacherRoster : approvedStudents);
    $("#profile-content").innerHTML = `<article class="profile-card"><span class="profile-avatar">${esc(user.name.trim().charAt(0).toUpperCase())}</span><div><p class="eyebrow">${esc(roleLabel.toUpperCase())} PROFILE</p><h3>${esc(user.name)}</h3><p>${esc(user.email)}</p><dl><div><dt>Account ID</dt><dd>${esc(user.identifier)}</dd></div>${user.className ? `<div><dt>Class</dt><dd>${esc(user.className)}</dd></div>` : ""}${user.subject ? `<div><dt>Subject</dt><dd>${esc(user.subject)}</dd></div>` : ""}<div><dt>Account status</dt><dd>${user.approved ? "Approved" : "Awaiting approval"}</dd></div></dl><p class="storage-warning">Account details and portal records are stored in this browser. Do not reuse a real password.</p></div></article>`;

    $("#teacher-result-tools").hidden = user.role !== "teacher";
    $("#teacher-upload-tools").hidden = user.role !== "teacher" && user.role !== "admin";
    $("#notice-tools").hidden = user.role === "student";
    if (user.role === "teacher") {
      const studentOptions = teacherRoster.map((student) => `<option value="${esc(student.id)}">${esc(student.name)} · ${esc(student.className)}</option>`).join("");
      $("#teacher-result-tools").innerHTML = `<form class="data-form form-panel" data-action="create-result"><h3>Enter student result</h3><label for="result-student">Student</label><select id="result-student" name="studentId" required><option value="">Choose student</option>${studentOptions}</select><label for="result-subject">Subject</label><select id="result-subject" name="subject" required>${subjects.map((subject) => `<option ${subject === user.subject ? "selected" : ""}>${esc(subject)}</option>`).join("")}</select><label for="result-score">Score (0–100)</label><input id="result-score" name="score" type="number" min="0" max="100" step="0.1" required><label for="result-term">Academic term</label><input id="result-term" name="term" value="${esc(state.term)}" maxlength="60" required><button class="button button-primary" type="submit">Submit for approval</button><small>New results appear after an administrator approves them.</small></form>`;
      $("#teacher-upload-tools").innerHTML = `<form class="data-form form-panel upload-form" data-action="upload-note"><h3>Upload class material</h3><label for="note-title">Material title</label><input id="note-title" name="title" maxlength="120" required><label for="note-subject">Subject</label><select id="note-subject" name="subject">${subjects.map((subject) => `<option ${subject === user.subject ? "selected" : ""}>${esc(subject)}</option>`).join("")}</select><label for="note-class">Available to</label><select id="note-class" name="className"><option>${esc(user.className || "All classes")}</option><option>All classes</option></select><label for="note-file">File (PDF, Word, text, or image · max 1 MB)</label><input id="note-file" name="file" type="file" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" required><button class="button button-primary" type="submit">Upload material</button></form>`;
    } else if (user.role === "admin") {
      $("#teacher-upload-tools").innerHTML = `<form class="data-form form-panel upload-form" data-action="upload-note"><h3>Upload class material</h3><label for="note-title">Material title</label><input id="note-title" name="title" maxlength="120" required><label for="note-subject">Subject</label><select id="note-subject" name="subject">${subjects.map((subject) => `<option>${esc(subject)}</option>`).join("")}</select><label for="note-class">Available to</label><select id="note-class" name="className"><option>All classes</option>${classes.map((name) => `<option>${esc(name)}</option>`).join("")}</select><label for="note-file">File (PDF, Word, text, or image · max 1 MB)</label><input id="note-file" name="file" type="file" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" required><button class="button button-primary" type="submit">Upload material</button></form>`;
    }
    if (user.role !== "student") {
      $("#notice-tools").innerHTML = `<form class="data-form form-panel" data-action="create-notice"><h3>Post a public notice</h3><label for="notice-title">Notice title</label><input id="notice-title" name="title" maxlength="120" required><label for="notice-message">Message</label><textarea id="notice-message" name="message" rows="4" maxlength="2000" required></textarea><button class="button button-primary" type="submit">Publish notice</button></form>`;
    }
    $("#management-content").innerHTML = user.role === "admin" ? renderAdminManagement() : "";
    $("#admin-overview").hidden = user.role !== "admin";
    if (user.role === "admin") {
      $("#admin-overview").innerHTML = `<div class="admin-shortcuts"><a href="#management" data-page-link="management"><strong>${state.users.filter((item) => !item.approved).length}</strong><span>Accounts awaiting approval</span><b>Review →</b></a><a href="#results" data-page-link="results"><strong>${pendingResults.length}</strong><span>Results awaiting approval</span><b>Review →</b></a><a href="#management" data-page-link="management"><strong>${state.activities.length}</strong><span>Recent portal activities</span><b>View log →</b></a></div>`;
    }
    renderCampus();
  }

  function campusQrSvg(value) {
    const bytes = Array.from(new TextEncoder().encode(value));
    if (bytes.length > 17) throw new Error("Student ID is too long to encode.");
    const multiply = (left, right) => {
      let product = 0;
      while (right) {
        if (right & 1) product ^= left;
        left <<= 1;
        if (left & 0x100) left ^= 0x11d;
        right >>>= 1;
      }
      return product;
    };
    const dataBits = [0, 1, 0, 0, ...bytes.flatMap((byte) => Array.from({ length: 8 }, (_, bit) => (byte >>> (7 - bit)) & 1))];
    dataBits.splice(4, 0, ...Array.from({ length: 8 }, (_, bit) => (bytes.length >>> (7 - bit)) & 1));
    dataBits.push(...Array(Math.min(4, 152 - dataBits.length)).fill(0));
    while (dataBits.length % 8) dataBits.push(0);
    const data = [];
    for (let i = 0; i < dataBits.length; i += 8) data.push(dataBits.slice(i, i + 8).reduce((byte, bit) => (byte << 1) | bit, 0));
    for (let pad = 0; data.length < 19; pad++) data.push(pad % 2 ? 0x11 : 0xec);
    let generator = [1];
    for (let exponent = 0; exponent < 7; exponent++) {
      const next = Array(generator.length + 1).fill(0);
      generator.forEach((coefficient, index) => {
        next[index] ^= coefficient;
        next[index + 1] ^= multiply(coefficient, 1 << exponent);
      });
      generator = next;
    }
    const work = [...data, ...Array(7).fill(0)];
    for (let i = 0; i < data.length; i++) {
      const factor = work[i];
      generator.forEach((coefficient, j) => { work[i + j] ^= multiply(coefficient, factor); });
    }
    const bits = [...data, ...work.slice(-7)].flatMap((byte) => Array.from({ length: 8 }, (_, bit) => (byte >>> (7 - bit)) & 1));
    const size = 21;
    const modules = Array.from({ length: size }, () => Array(size).fill(false));
    const reserved = Array.from({ length: size }, () => Array(size).fill(false));
    const set = (row, column, dark) => {
      if (row >= 0 && row < size && column >= 0 && column < size) {
        modules[row][column] = dark;
        reserved[row][column] = true;
      }
    };
    [[0, 0], [0, size - 7], [size - 7, 0]].forEach(([top, left]) => {
      for (let row = -1; row <= 7; row++) for (let column = -1; column <= 7; column++) {
        const edge = row === -1 || row === 7 || column === -1 || column === 7;
        const dark = !edge && (row === 0 || row === 6 || column === 0 || column === 6 || (row >= 2 && row <= 4 && column >= 2 && column <= 4));
        set(top + row, left + column, dark);
      }
    });
    for (let index = 8; index < size - 8; index++) {
      set(6, index, index % 2 === 0);
      set(index, 6, index % 2 === 0);
    }
    for (let i = 0; i <= 5; i++) reserved[i][8] = true;
    [[7, 8], [8, 8], [8, 7], [size - 8, 8]].forEach(([row, column]) => { reserved[row][column] = true; });
    for (let i = 9; i < 15; i++) reserved[8][14 - i] = true;
    for (let i = 0; i < 8; i++) reserved[8][size - 1 - i] = true;
    for (let i = 8; i < 15; i++) reserved[size - 15 + i][8] = true;
    let bitIndex = 0;
    let upward = true;
    for (let right = size - 1; right > 0; right -= 2) {
      if (right === 6) right--;
      for (let offset = 0; offset < size; offset++) {
        const row = upward ? size - 1 - offset : offset;
        for (let side = 0; side < 2; side++) {
          const column = right - side;
          if (!reserved[row][column]) {
            modules[row][column] = (bits[bitIndex++] || 0) === 1;
            if ((row + column) % 2 === 0) modules[row][column] = !modules[row][column];
          }
        }
      }
      upward = !upward;
    }
    const format = (((1 << 3) | 0) << 10);
    let remainder = format;
    for (let bit = 14; bit >= 10; bit--) if ((remainder >>> bit) & 1) remainder ^= 0x537 << (bit - 10);
    const formatBits = (((1 << 3) | 0) << 10 | remainder) ^ 0x5412;
    for (let i = 0; i <= 5; i++) set(i, 8, ((formatBits >>> i) & 1) === 1);
    set(7, 8, ((formatBits >>> 6) & 1) === 1);
    set(8, 8, ((formatBits >>> 7) & 1) === 1);
    set(8, 7, ((formatBits >>> 8) & 1) === 1);
    for (let i = 9; i < 15; i++) set(8, 14 - i, ((formatBits >>> i) & 1) === 1);
    for (let i = 0; i < 8; i++) set(8, size - 1 - i, ((formatBits >>> i) & 1) === 1);
    for (let i = 8; i < 15; i++) set(size - 15 + i, 8, ((formatBits >>> i) & 1) === 1);
    set(size - 8, 8, true);
    const path = [];
    modules.forEach((row, y) => row.forEach((dark, x) => { if (dark) path.push(`M${x + 4} ${y + 4}h1v1h-1z`); }));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29" role="img" aria-label="QR code for ${esc(value)}"><rect width="29" height="29" fill="white"/><path d="${path.join("")}" fill="#15131a"/></svg>`;
  }

  function renderCampus() {
    const campus = state.campus;
    if (currentUser.role !== "admin") campus.activeSchool = currentUser.school || "Crestview College";
    const schoolSelect = $("#school-switch");
    schoolSelect.innerHTML = campus.schools.map((school) => `<option value="${esc(school)}">${esc(school)}</option>`).join("");
    schoolSelect.value = campus.schools.includes(campus.activeSchool) ? campus.activeSchool : campus.schools[0];
    const schoolUsers = state.users.filter((user) => user.school === schoolSelect.value && user.approved);
    const schoolStudentIds = new Set(schoolUsers.filter((user) => user.role === "student").map((user) => user.id));
    const results = state.results.filter((item) => schoolStudentIds.has(item.studentId) && item.status === "approved" &&
      (currentUser.role !== "student" || item.studentId === currentUser.id));
    const scores = results.map((item) => Number(item.score)).filter(Number.isFinite);
    const average = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
    const projected = Math.min(100, Math.round((average + (scores.length ? 2 : 0)) * 10) / 10);
    const chart = subjects.map((subject) => {
      const subjectScores = results.filter((item) => item.subject === subject).map((item) => Number(item.score));
      const value = subjectScores.length ? subjectScores.reduce((sum, score) => sum + score, 0) / subjectScores.length : 0;
      return `<g><rect x="${subjects.indexOf(subject) * 145 + 24}" y="${170 - value * 1.35}" width="62" height="${value * 1.35}" rx="7" fill="#9d71c1"/><text x="${subjects.indexOf(subject) * 145 + 55}" y="${Math.max(18, 160 - value * 1.35)}" text-anchor="middle" fill="currentColor" font-size="12">${value ? Math.round(value) + "%" : "—"}</text><text x="${subjects.indexOf(subject) * 145 + 55}" y="190" text-anchor="middle" fill="currentColor" font-size="10">${esc(subject)}</text></g>`;
    }).join("");
    const leaders = schoolUsers.filter((user) => user.role === "student").map((student) => {
      const studentScores = state.results.filter((item) => item.studentId === student.id && item.status === "approved").map((item) => Number(item.score));
      return { student, score: studentScores.length ? studentScores.reduce((sum, value) => sum + value, 0) / studentScores.length : 0 };
    }).sort((a, b) => b.score - a.score).slice(0, 5);
    const profile = currentUser.role === "student" ? currentUser : schoolUsers.find((user) => user.role === "student");
    $("#campus-identity").innerHTML = profile ? `<article class="student-id-card"><div><p class="eyebrow">STUDENT ID · ${esc(schoolSelect.value.toUpperCase())}</p><h3>${esc(profile.name)}</h3><p>${esc(profile.identifier)} · ${esc(profile.className || "Student")}</p><small>QR encodes this demo ID only.</small></div><div class="qr-code">${campusQrSvg(profile.identifier)}</div></article>` : emptyState("Add an approved student account in this school to preview student ID cards.");
    $("#campus-analytics").innerHTML = `<article class="campus-panel analytics-panel"><div><p class="eyebrow">ACADEMIC INSIGHTS</p><h3>Performance analytics</h3><p class="metric-line">Current average <strong>${scores.length ? average.toFixed(1) + "%" : "—"}</strong><span>Estimated next-term average <strong>${scores.length ? projected + "%" : "—"}</strong></span></p><small>Trend estimate based on available approved marks; not an AI model or guaranteed outcome.</small></div><svg class="performance-chart" viewBox="0 0 600 205" role="img" aria-label="Average scores by subject">${chart}<line x1="15" y1="170" x2="590" y2="170" stroke="currentColor" opacity=".18"/></svg><div class="leaderboard"><h4>Top performers</h4>${leaders.length ? leaders.map(({ student, score }, index) => `<div><span>${index + 1}</span><strong>${esc(student.name)}</strong><small>${score ? score.toFixed(1) + "%" : "No results"}</small></div>`).join("") : emptyState("No ranked results yet.")}</div></article>`;
    const schoolRecords = (key) => campus[key].filter((item) => item.school === schoolSelect.value);
    $("#campus-library").innerHTML = `${renderNotes(visibleNotes().filter((note) => note.school === schoolSelect.value))}${schoolRecords("library").map((book) => `<div class="campus-record"><strong>${esc(book.title)}</strong><small>${esc(book.author || "School library")}</small></div>`).join("")}`;
    const assignments = schoolRecords("assignments");
    $("#campus-assignments").innerHTML = assignments.length ? assignments.map((item) => {
      const submissions = campus.submissions.filter((entry) => entry.assignmentId === item.id &&
        (currentUser.role !== "student" || entry.studentId === currentUser.id));
      return `<div class="campus-record"><strong>${esc(item.title)}</strong><small>Due ${formatDate(item.due)}${submissions.some((entry) => entry.studentId === currentUser.id) ? " · Submitted" : ""}</small>${submissions.map((entry) => `<p><strong>${esc(userById(entry.studentId)?.name || "Student")}:</strong> ${esc(entry.text)}</p>`).join("")}</div>`;
    }).join("") : emptyState("No assignments available.");
    $("#assignment-select").innerHTML = assignments.length ? assignments.map((item) => `<option value="${esc(item.id)}">${esc(item.title)}</option>`).join("") : '<option value="">No assignments available</option>';
    $("#campus-forum").innerHTML = schoolRecords("discussions").length ? schoolRecords("discussions").slice(-5).reverse().map((item) => `<div class="campus-record"><strong>${esc(item.author)}</strong><p>${esc(item.message)}</p><small>${esc(item.date)}</small></div>`).join("") : emptyState("Start a respectful class discussion.");
    $("#campus-events").innerHTML = schoolRecords("events").sort((a, b) => a.date.localeCompare(b.date)).map((item) => `<div class="campus-record"><strong>${esc(item.title)}</strong><small>${formatDate(item.date)}</small></div>`).join("") || emptyState("No upcoming events.");
    const chats = schoolRecords("chats").filter((item) => currentUser.role !== "student" || item.senderId === currentUser.id).slice(-5).reverse();
    $("#campus-chat").innerHTML = chats.length ? chats.map((item) => `<div class="campus-record"><strong>${esc(item.sender)}</strong><p>${esc(item.message)}</p><small>${esc(item.date)}</small></div>`).join("") : emptyState("No portal messages yet.");
    const wellbeing = schoolRecords("wellbeing").filter((item) => currentUser.role !== "student" || item.studentId === currentUser.id).slice(-5).reverse();
    $("#campus-wellbeing").innerHTML = wellbeing.length ? wellbeing.map((item) => `<div class="campus-record"><strong>${esc(item.kind)}</strong><p>${esc(item.note)}</p><small>${esc(userById(item.studentId)?.name || "Student")} · ${esc(item.date)}</small></div>`).join("") : emptyState("No wellbeing or attendance records.");
    const students = schoolUsers.filter((user) => user.role === "student");
    $("#wellbeing-student").innerHTML = students.map((user) => `<option value="${esc(user.id)}">${esc(user.name)}</option>`).join("") || '<option value="">No students in this school</option>';
    $("#campus-visitors").innerHTML = schoolRecords("visitors").slice(-4).reverse().map((item) => `<div class="campus-record"><strong>${esc(item.name)}</strong><small>${esc(item.purpose)} · ${esc(item.date)}</small></div>`).join("") || emptyState("No visitors registered.");
    $("#campus-operations").innerHTML = schoolRecords("operations").slice(-5).reverse().map((item) => `<div class="campus-record"><strong>${esc(item.kind)}</strong><small>${esc(item.details)} · ${esc(item.date)}</small></div>`).join("") || emptyState("No transport or hostel requests.");
    $("#notification-choice").value = campus.preference;
    const notifications = campus.notifications || [];
    $("#campus-notifications").innerHTML = `<p class="campus-footnote">Preference: ${esc(campus.preference)}. ${notifications.length ? `${notifications.length} in-app update(s) recorded.` : "No new in-app updates."}</p>`;
    $("#campus-audit").innerHTML = state.activities.slice(0, 12).map((item) => `<div class="campus-record"><strong>${esc(item.message)}</strong><small>${esc(item.date)}</small></div>`).join("") || emptyState("No audit activity.");
    document.querySelectorAll('.campus-panel form[data-action="create-event"]').forEach((form) => { form.hidden = currentUser.role === "student"; });
    document.querySelectorAll('.campus-panel form[data-action="create-assignment"]').forEach((form) => { form.hidden = currentUser.role === "student"; });
    document.querySelectorAll('.campus-panel form[data-action="record-wellbeing"]').forEach((form) => { form.hidden = currentUser.role === "student"; });
    document.querySelectorAll('.campus-panel form[data-action="register-visitor"], .campus-panel form[data-action="save-campus-operation"], .campus-panel form[data-action="add-book"]').forEach((form) => { form.hidden = currentUser.role === "student"; });
    document.querySelectorAll('[data-action="download-certificate"]').forEach((button) => { button.hidden = currentUser.role !== "student"; });
    schoolSelect.disabled = currentUser.role !== "admin";
  }

  function renderResultsForTerm() {
    const term = $("#term-filter").value;
    const all = studentResults().filter((item) => item.term === term);
    $("#result-content").innerHTML = resultTable(all, currentUser.role !== "student", currentUser.role === "admin");
  }

  function renderAdminManagement() {
    const pendingUsers = state.users.filter((user) => !user.approved);
    const pendingResults = state.results.filter((item) => item.status === "pending");
    const allRows = state.users.map((user) => `<tr><td><strong>${esc(user.name)}</strong><small class="cell-subtitle">${esc(user.email)}</small></td><td><span class="badge">${esc(user.role)}</span></td><td><form class="inline-actions edit-user-form" data-action="edit-user" data-id="${esc(user.id)}"><input name="name" value="${esc(user.name)}" aria-label="Edit ${esc(user.name)} name" required maxlength="100"><input name="className" value="${esc(user.className || "")}" aria-label="Edit class" maxlength="80"><input name="subject" value="${esc(user.subject || "")}" aria-label="Edit subject" maxlength="80"><button type="submit">Save</button></form></td><td>${esc(user.identifier)}</td><td><span class="badge ${user.approved ? "" : "pending"}">${user.approved ? "Approved" : "Pending"}</span></td><td class="user-actions">${!user.approved ? `<button class="text-button" type="button" data-action="approve-user" data-id="${esc(user.id)}">Approve</button>` : ""}${user.id !== currentUser.id ? `<button class="text-button danger-text" type="button" data-action="delete-user" data-id="${esc(user.id)}">Remove</button>` : ""}</td></tr>`).join("");
    const notices = state.notices.map((notice) => `<li><span><strong>${esc(notice.title)}</strong><small>${formatDate(notice.date)} · ${esc(notice.author)}</small></span><button class="text-button danger-text" type="button" data-action="delete-notice" data-id="${esc(notice.id)}">Remove</button></li>`).join("");
    const notes = state.notes.map((note) => `<li><span><strong>${esc(note.title)}</strong><small>${esc(note.subject)} · ${esc(note.className)}</small></span><button class="text-button danger-text" type="button" data-action="delete-note" data-id="${esc(note.id)}">Remove</button></li>`).join("");
    const activities = state.activities.slice(0, 20).map((activity) => `<li><span>${esc(activity.message)}</span><small>${esc(activity.date)}</small></li>`).join("");
    return `<div class="admin-stats"><article class="panel"><span class="stat-icon">♙</span><div><strong>${state.users.filter((user) => user.role === "student").length}</strong><small>Students</small></div></article><article class="panel"><span class="stat-icon">✦</span><div><strong>${state.users.filter((user) => user.role === "teacher").length}</strong><small>Teachers</small></div></article><article class="panel"><span class="stat-icon">▤</span><div><strong>${state.results.length}</strong><small>Results</small></div></article><article class="panel"><span class="stat-icon">⇩</span><div><strong>${state.notes.length}</strong><small>Learning materials</small></div></article></div>
      <form class="data-form form-panel" data-action="create-user"><h3>Add a school account</h3><div class="data-grid"><div class="stack-form"><label for="admin-new-name">Full name</label><input id="admin-new-name" name="name" maxlength="100" required><label for="admin-new-email">Email address</label><input id="admin-new-email" name="email" type="email" maxlength="160" required><label for="admin-new-password">Temporary password</label><input id="admin-new-password" name="password" type="password" minlength="8" required></div><div class="stack-form"><label for="admin-new-role">Role</label><select id="admin-new-role" name="role"><option value="student">Student</option><option value="teacher">Teacher</option><option value="admin">Administrator</option></select><label for="admin-new-school">School</label><select id="admin-new-school" name="school">${state.campus.schools.map((school) => `<option value="${esc(school)}" ${school === state.campus.activeSchool ? "selected" : ""}>${esc(school)}</option>`).join("")}</select><label for="admin-new-id">Accommodation / Staff / Admin ID</label><input id="admin-new-id" name="identifier" maxlength="40" placeholder="CRV-STU-007" required><label for="admin-new-class">Class</label><select id="admin-new-class" name="className"><option value="">Not assigned</option>${classes.map((name) => `<option>${esc(name)}</option>`).join("")}</select><label for="admin-new-subject">Subject (teachers)</label><select id="admin-new-subject" name="subject"><option value="">Not assigned</option>${subjects.map((name) => `<option>${esc(name)}</option>`).join("")}</select></div></div><button class="button button-primary" type="submit">Add approved account</button></form>
      <section><h3>Account approvals <span class="count-pill">${pendingUsers.length}</span></h3>${pendingUsers.length ? `<div class="approval-list">${pendingUsers.map((user) => `<article class="approval-row"><span class="avatar">${esc(user.name.charAt(0))}</span><div><strong>${esc(user.name)}</strong><small>${esc(user.role)} · ${esc(user.email)} · ${esc(user.identifier)}</small></div><button class="button button-primary" type="button" data-action="approve-user" data-id="${esc(user.id)}">Approve account</button></article>`).join("")}</div>` : emptyState("No accounts are waiting for approval.")}</section>
      <section><h3>All students & staff</h3><div class="table-panel table-wrap"><table><thead><tr><th>Name / email</th><th>Role</th><th>Edit name / class</th><th>ID</th><th>Status</th><th>Actions</th></tr></thead><tbody>${allRows}</tbody></table></div></section>
      <section><h3>Results awaiting approval <span class="count-pill">${pendingResults.length}</span></h3>${resultTable(pendingResults, true, true)}</section>
      <div class="management-columns"><section><h3>All learning materials</h3><ul class="management-list">${notes || "<li>No materials</li>"}</ul></section><section><h3>All public notices</h3><ul class="management-list">${notices || "<li>No notices</li>"}</ul></section></div>
      <section><h3>Recent portal activity</h3><ul class="activity-list">${activities || "<li>No activity yet.</li>"}</ul></section>
      <form class="data-form form-panel settings-form" data-action="update-term"><h3>Academic term</h3><label for="academic-term">Current term label</label><input id="academic-term" name="term" value="${esc(state.term)}" maxlength="60" required><button class="button button-primary" type="submit">Save term</button></form><section class="reset-demo"><div><h3>Restore sample data</h3><p>Replace this browser’s demo records and changes with the original Crestview sample data.</p></div><button class="button button-outline" type="button" data-action="reset-demo">Reset demo data</button></section>`;
  }

  function greeting() {
    const hour = new Date().getHours();
    return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  }

  function openPortal(user) {
    currentUser = user;
    $("#auth-screen").hidden = true;
    $("#portal-screen").hidden = false;
    activePage = location.hash.slice(1) || "overview";
    if (!$(`#page-${activePage}`) || (activePage === "management" && user.role !== "admin") ||
        (activePage === "students" && user.role === "student")) activePage = "overview";
    buildDashboard();
    showPage(activePage);
  }

  function showPage(page) {
    if (!$(`#page-${page}`)) return;
    if ((page === "management" && currentUser.role !== "admin") ||
        (page === "students" && currentUser.role === "student")) page = "overview";
    activePage = page;
    document.querySelectorAll(".page-content").forEach((section) => { section.hidden = section.id !== `page-${page}`; });
    document.querySelectorAll(".side-nav [data-page]").forEach((link) => link.classList.toggle("active", link.dataset.page === page));
    if (location.hash !== `#${page}`) history.replaceState(null, "", `#${page}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function signup(formData) {
    const role = selectedRole;
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    const className = role === "student" ? String(formData.get("className") || "") : "";
    const subject = role === "teacher" ? String(formData.get("subject") || "").trim() : "";
    if (!name) throw new Error("Enter your full name.");
    if (!email || !email.includes("@")) throw new Error("Enter a valid email address.");
    if (state.users.some((user) => user.email.toLowerCase() === email)) throw new Error("An account with this email already exists.");
    if (password.length < 8) throw new Error("Choose a password with at least 8 characters.");
    if (role === "student" && !classes.includes(className)) throw new Error("Choose a valid class.");
    if (role === "teacher" && !subject) throw new Error("Enter your subject.");
    const prefix = role === "student" ? "CRV-STU" : role === "teacher" ? "CRV-STAFF" : "CRV-ADMIN";
    const nextNumber = state.users
      .filter((user) => user.role === role)
      .reduce((highest, user) => {
        const match = String(user.identifier || "").match(/-(\d{3})$/);
        return match ? Math.max(highest, Number(match[1])) : highest;
      }, 0) + 1;
    const identifier = `${prefix}-${String(nextNumber).padStart(3, "0")}`;
    const created = {
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role, name, email, password, identifier, approved: true, school: state.campus.activeSchool,
      ...(className ? { className } : {}),
      ...(subject ? { subject } : {})
    };
    state.users.push(created);
    logActivity(`${role} account created by ${name}`);
    saveState();
    $("#signup-form").reset();
    showAuthMessage("#signup-message", "Account created. You can log in now.", true);
  }

  function login(formData) {
    const identity = String(formData.get("identity") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    const user = state.users.find((item) => item.role === selectedRole &&
      (item.email.toLowerCase() === identity || item.identifier.toLowerCase() === identity));
    if (!user || user.password !== password) throw new Error("The email, password, or account type is incorrect.");
    if (!user.approved) throw new Error("Your account is awaiting administrator approval.");
    currentUser = user;
    logActivity(`${user.role} ${user.name} signed in`);
    saveState();
    openPortal(user);
  }

  function showDownload(filename, mime, content) {
    const blob = new Blob([content], { type: mime || "application/octet-stream" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  function downloadCampusReport() {
    const records = state.results.filter((item) => item.status === "approved" &&
      (currentUser.role === "student" ? item.studentId === currentUser.id :
        userById(item.studentId)?.school === state.campus.activeSchool));
    if (!records.length) throw new Error("No approved results are available for this report.");
    const rows = [["Student", "Student ID", "Class", "Subject", "Score", "Grade", "Term"]];
    records.forEach((item) => {
      const student = userById(item.studentId);
      rows.push([student?.name || "", student?.identifier || "", student?.className || "", item.subject, `${item.score}%`, item.grade, item.term]);
    });
    const csv = rows.map((row) => row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    showDownload("crestview-report-card.csv", "text/csv;charset=utf-8", `\uFEFF${csv}`);
    logActivity(`${currentUser.name} downloaded a report card`);
    saveState();
  }

  function downloadStudentId() {
    const student = currentUser.role === "student" ? currentUser :
      state.users.find((user) => user.role === "student" && user.school === state.campus.activeSchool && user.approved);
    if (!student) throw new Error("No student account is available for this school.");
    const qr = campusQrSvg(student.identifier);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="300" viewBox="0 0 520 300"><rect width="520" height="300" rx="24" fill="#28232f"/><text x="30" y="46" fill="#c6a4e2" font-family="Arial" font-size="16" font-weight="700">CRESTVIEW COLLEGE · STUDENT ID</text><text x="30" y="112" fill="#fff" font-family="Arial" font-size="28" font-weight="700">${esc(student.name)}</text><text x="30" y="151" fill="#ddd" font-family="Arial" font-size="17">${esc(student.identifier)}</text><text x="30" y="181" fill="#ddd" font-family="Arial" font-size="15">${esc(student.className || "Student")}</text><svg x="365" y="72" width="124" height="124" viewBox="0 0 29 29">${qr.match(/<path d="([^"]+)"/)[1] ? `<rect width="29" height="29" fill="white"/><path d="${qr.match(/<path d="([^"]+)"/)[1]}" fill="#15131a"/>` : ""}</svg><text x="30" y="260" fill="#bbb" font-family="Arial" font-size="12">Demo ID · Not an official credential</text></svg>`;
    showDownload("crestview-student-id.svg", "image/svg+xml", svg);
    logActivity(`${currentUser.name} downloaded a student ID card`);
    saveState();
  }

  function downloadCertificate() {
    if (currentUser.role !== "student") throw new Error("Certificate generation is available to student accounts.");
    const certificate = `<!doctype html><html><meta charset="utf-8"><title>Crestview certificate</title><body style="font-family:Georgia,serif;text-align:center;padding:70px;border:12px double #8153a5;color:#33233f"><p>CRESTVIEW COLLEGE</p><h1>Certificate of Achievement</h1><p>This certificate is presented to</p><h2>${esc(currentUser.name)}</h2><p>In recognition of continued learning and participation.</p><p>${esc(state.term)}</p><small>Demo certificate · Not an official credential</small></body></html>`;
    showDownload("crestview-certificate.html", "text/html;charset=utf-8", certificate);
    logActivity(`${currentUser.name} generated a demo certificate`);
    saveState();
  }

  function downloadResults() {
    const rows = studentResults().filter((item) => item.term === $("#term-filter").value && (currentUser.role === "admin" || item.status === "approved"));
    if (!rows.length) {
      notify("There are no results to download for this term.", true);
      return;
    }
    const csvRows = [["Student", "Subject", "Score", "Grade", "Term", "Status"]];
    rows.forEach((item) => {
      const student = userById(item.studentId);
      csvRows.push([student?.name || currentUser.name, item.subject, `${item.score}%`, item.grade, item.term, item.status]);
    });
    const csv = csvRows.map((row) => row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    showDownload("crestview-results.csv", "text/csv;charset=utf-8", `\uFEFF${csv}`);
    logActivity(`${currentUser.name} downloaded results`);
    saveState();
  }

  async function handleSubmit(event) {
    const form = event.target.closest("form[data-action]");
    if (!form) return;
    event.preventDefault();
    const formData = new FormData(form);
    const fields = Object.fromEntries(formData);
    try {
      switch (form.dataset.action) {
        case "create-result": {
          const student = userById(fields.studentId);
          const score = Number(fields.score);
          if (!student || student.role !== "student" || (currentUser.role === "teacher" &&
              (student.className !== currentUser.className || student.school !== currentUser.school))) throw new Error("Choose a valid student in your class.");
          if (!Number.isFinite(score) || score < 0 || score > 100) throw new Error("Enter a score from 0 to 100.");
          state.results.unshift({ id: `res-${Date.now()}`, studentId: student.id, subject: fields.subject, score, grade: gradeFor(score), term: fields.term.trim(), status: "pending", teacherId: currentUser.id });
          logActivity(`${currentUser.name} submitted a ${fields.subject} result for ${student.name}`);
          break;
        }
        case "upload-note": {
          const file = formData.get("file");
          if (!(file instanceof File) || !file.name) throw new Error("Choose a file to upload.");
          if (file.size > 1024 * 1024) throw new Error("Files must be 1 MB or smaller for this browser demo.");
          const allowed = /\.(pdf|doc|docx|txt|png|jpe?g)$/i;
          if (!allowed.test(file.name)) throw new Error("Choose a PDF, Word, text, or image file.");
          const data = await file.arrayBuffer();
          const bytes = new Uint8Array(data);
          let binary = "";
          for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
          state.notes.unshift({
            id: `note-${Date.now()}`, title: fields.title.trim(), subject: fields.subject,
            className: fields.className, uploader: currentUser.name, date: new Date().toISOString().slice(0, 10),
            filename: file.name, mime: file.type || "application/octet-stream", data: btoa(binary),
            school: currentUser.role === "admin" ? state.campus.activeSchool : currentUser.school
          });
          logActivity(`${currentUser.name} uploaded ${fields.title.trim()}`);
          break;
        }
        case "create-notice":
          state.notices.unshift({ id: `notice-${Date.now()}`, title: fields.title.trim(), message: fields.message.trim(), author: currentUser.name, date: new Date().toISOString().slice(0, 10), createdBy: currentUser.id });
          logActivity(`${currentUser.name} posted a public notice`);
          break;
        case "update-result": {
          const result = state.results.find((item) => item.id === form.dataset.id);
          const score = Number(fields.score);
          const student = result && userById(result.studentId);
          if (!result || result.status !== "pending" || !Number.isFinite(score) || score < 0 || score > 100 ||
              (currentUser.role === "teacher" && (!student || student.school !== currentUser.school || student.className !== currentUser.className))) throw new Error("Enter a valid score for a pending result in your class.");
          result.score = score;
          result.grade = gradeFor(score);
          logActivity(`${currentUser.name} updated a pending result`);
          break;
        }
        case "edit-user": {
          if (currentUser.role !== "admin") throw new Error("Only administrators can edit accounts.");
          const user = userById(form.dataset.id);
          if (!user) throw new Error("Account not found.");
          user.name = fields.name.trim();
          user.className = fields.className.trim();
          user.subject = fields.subject.trim();
          logActivity(`${currentUser.name} edited the account for ${user.name}`);
          break;
        }
        case "create-user": {
          if (currentUser.role !== "admin") throw new Error("Only administrators can add accounts.");
          const role = fields.role;
          if (!state.campus.schools.includes(fields.school)) throw new Error("Choose a valid school.");
          const identifier = String(fields.identifier || "").trim().toUpperCase();
          const email = String(fields.email || "").trim().toLowerCase();
          if (!["student", "teacher", "admin"].includes(role) || !identifierPattern[role].test(identifier)) throw new Error("Invalid ID");
          if (state.users.some((user) => user.identifier.toLowerCase() === identifier.toLowerCase())) throw new Error("This ID is already registered.");
          if (state.users.some((user) => user.email.toLowerCase() === email)) throw new Error("An account with this email already exists.");
          if (String(fields.password || "").length < 8) throw new Error("Choose a password with at least 8 characters.");
          if (fields.className && !classes.includes(fields.className)) throw new Error("Choose a valid class.");
          if (fields.subject && !subjects.includes(fields.subject)) throw new Error("Choose a valid subject.");
          state.users.push({
            id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            role, name: String(fields.name).trim(), email, password: String(fields.password), school: fields.school,
            identifier, approved: true,
            ...(fields.className ? { className: fields.className } : {}),
            ...(fields.subject ? { subject: fields.subject } : {})
          });
          logActivity(`${currentUser.name} added an approved ${role} account`);
          break;
        }
        case "update-term":
          if (currentUser.role !== "admin" || !fields.term.trim()) throw new Error("Enter a valid academic term.");
          state.term = fields.term.trim();
          logActivity(`${currentUser.name} updated the academic term`);
          break;
        case "add-book":
          if (currentUser.role === "student") throw new Error("Only staff can add library items.");
          campusRecord("library", { title: fields.title.trim(), author: String(fields.author || "").trim() || "School library" });
          logActivity(`${currentUser.name} added a library item`);
          break;
        case "create-assignment":
          if (currentUser.role === "student" || !fields.title.trim() || !fields.due) throw new Error("Only staff can publish a valid assignment.");
          state.campus.assignments.push({ id: `assignment-${Date.now()}`, title: fields.title.trim(), due: fields.due, school: state.campus.activeSchool });
          logActivity(`${currentUser.name} published an assignment`);
          break;
        case "submit-assignment": {
          const assignment = state.campus.assignments.find((item) => item.id === fields.assignmentId && item.school === state.campus.activeSchool);
          if (currentUser.role !== "student" || !assignment) throw new Error("Choose an available assignment.");
          const existing = state.campus.submissions.find((item) => item.assignmentId === assignment.id && item.studentId === currentUser.id);
          if (existing) throw new Error("You have already submitted this assignment.");
          state.campus.submissions.push({ id: `submission-${Date.now()}`, assignmentId: assignment.id, studentId: currentUser.id, text: fields.submission.trim(), school: state.campus.activeSchool, date: new Date().toLocaleString() });
          logActivity(`${currentUser.name} submitted "${assignment.title}"`);
          break;
        }
        case "create-discussion":
          state.campus.discussions.push({ id: `discussion-${Date.now()}`, author: currentUser.name, message: fields.message.trim(), school: state.campus.activeSchool, date: new Date().toLocaleString() });
          logActivity(`${currentUser.name} posted in the discussion forum`);
          break;
        case "create-event":
          if (currentUser.role === "student" || !fields.date || !fields.title.trim()) throw new Error("Only staff can publish a valid event.");
          state.campus.events.push({ id: `event-${Date.now()}`, title: fields.title.trim(), date: fields.date, school: state.campus.activeSchool });
          logActivity(`${currentUser.name} added a campus event`);
          break;
        case "send-message":
          state.campus.chats.push({ id: `chat-${Date.now()}`, senderId: currentUser.id, sender: currentUser.name, message: fields.message.trim(), school: state.campus.activeSchool, date: new Date().toLocaleString() });
          state.campus.chats = state.campus.chats.slice(-100);
          (state.campus.notifications ||= []).unshift({ message: `New portal message from ${currentUser.name}`, date: new Date().toLocaleString() });
          logActivity(`${currentUser.name} sent a portal message`);
          break;
        case "record-wellbeing":
          if (currentUser.role === "student" || !userById(fields.studentId) || userById(fields.studentId).school !== state.campus.activeSchool || !fields.note.trim()) throw new Error("Only staff can record a student wellbeing or attendance update for this school.");
          state.campus.wellbeing.push({ id: `wellbeing-${Date.now()}`, studentId: fields.studentId, kind: fields.kind, note: fields.note.trim(), school: state.campus.activeSchool, date: new Date().toLocaleDateString() });
          logActivity(`${currentUser.name} recorded ${fields.kind.toLowerCase()}`);
          break;
        case "register-visitor":
          if (currentUser.role === "student" || !fields.name.trim() || !fields.purpose.trim()) throw new Error("Only staff can register a visitor.");
          campusRecord("visitors", { name: fields.name.trim(), purpose: fields.purpose.trim(), date: new Date().toLocaleString() });
          logActivity(`${currentUser.name} registered a campus visitor`);
          break;
        case "save-campus-operation":
          if (currentUser.role === "student" || !fields.details.trim()) throw new Error("Only staff can save transport or hostel requests.");
          campusRecord("operations", { kind: fields.kind, details: fields.details.trim(), date: new Date().toLocaleDateString() });
          logActivity(`${currentUser.name} saved a ${fields.kind.toLowerCase()} request`);
          break;
        case "save-notifications":
          state.campus.preference = fields.preference;
          logActivity(`${currentUser.name} updated notification preferences`);
          break;
        default: return;
      }
      saveState();
      buildDashboard();
      showPage(activePage);
      notify("Changes saved successfully.");
    } catch (error) {
      notify(error.message || "Could not save those changes.", true);
    }
  }

  async function handleAction(event) {
    const button = event.target.closest("[data-action]");
    if (!button || button.tagName !== "BUTTON") return;
    const { action, id } = button.dataset;
    try {
      if (action === "download-note") {
        const note = state.notes.find((item) => item.id === id);
        if (!note) throw new Error("That learning resource is no longer available.");
        const content = note.data ? Uint8Array.from(atob(note.data), (character) => character.charCodeAt(0)) : note.text;
        showDownload(note.filename, note.mime, content);
        logActivity(`${currentUser.name} downloaded ${note.title}`);
      } else if (action === "approve-user") {
        if (currentUser.role !== "admin") throw new Error("Only administrators can approve accounts.");
        const user = userById(id);
        if (!user) throw new Error("Account not found.");
        user.approved = true;
        logActivity(`${currentUser.name} approved ${user.role} account for ${user.name}`);
      } else if (action === "delete-user") {
        if (currentUser.role !== "admin" || id === currentUser.id) throw new Error("This account cannot be removed.");
        const user = userById(id);
        if (!user) throw new Error("Account not found.");
        if (!window.confirm(`Remove ${user.name}'s account and associated results?`)) return;
        state.users = state.users.filter((item) => item.id !== id);
        state.results = state.results.filter((item) => item.studentId !== id);
        logActivity(`${currentUser.name} removed the account for ${user.name}`);
      } else if (action === "approve-result") {
        if (currentUser.role !== "admin") throw new Error("Only administrators can approve results.");
        const result = state.results.find((item) => item.id === id);
        if (!result) throw new Error("Result not found.");
        result.status = "approved";
        logActivity(`${currentUser.name} approved a ${result.subject} result`);
      } else if (action === "delete-note") {
        if (currentUser.role === "student") throw new Error("You cannot remove this resource.");
        const note = state.notes.find((item) => item.id === id);
        if (!note) throw new Error("Resource not found.");
        state.notes = state.notes.filter((item) => item.id !== id);
        logActivity(`${currentUser.name} removed the learning resource "${note.title}"`);
      } else if (action === "delete-notice") {
        if (currentUser.role === "student") throw new Error("You cannot remove this notice.");
        const notice = state.notices.find((item) => item.id === id);
        if (!notice) throw new Error("Notice not found.");
        state.notices = state.notices.filter((item) => item.id !== id);
        logActivity(`${currentUser.name} removed the notice "${notice.title}"`);
      } else if (action === "reset-demo") {
        if (currentUser.role !== "admin") throw new Error("Only administrators can reset the demo.");
        if (!window.confirm("Reset this browser's portal data to the original sample data? Your changes will be removed.")) return;
        state = sampleState();
        state.users.forEach((user) => { user.school = "Crestview College"; });
        state.notes.forEach((note) => { note.school = "Crestview College"; });
        ["library", "assignments", "submissions", "discussions", "events", "chats", "wellbeing", "visitors", "operations"].forEach((key) => {
          state.campus[key].forEach((item) => { if (!item.school) item.school = "Crestview College"; });
        });
        currentUser = userById("u-admin-1");
        logActivity("The administrator restored the original sample data");
      } else if (action === "download-report") {
        downloadCampusReport();
        return;
      } else if (action === "download-id") {
        downloadStudentId();
        return;
      } else if (action === "download-certificate") {
        downloadCertificate();
        return;
      } else if (action === "toggle-theme") {
        toggleTheme();
        return;
      } else return;
      saveState();
      buildDashboard();
      showPage(activePage);
      if (action !== "download-note") notify("Changes saved successfully.");
    } catch (error) {
      notify(error.message || "Could not complete that action.", true);
    }
  }

  function campusRecord(collection, value) {
    state.campus[collection].unshift({ id: `${collection}-${Date.now()}`, ...value, school: state.campus.activeSchool });
  }

  function toggleTheme() {
    const theme = document.body.dataset.theme === "light" ? "dark" : "light";
    document.body.dataset.theme = theme;
    $("#theme-toggle").textContent = theme === "dark" ? "☀ Light mode" : "☾ Dark mode";
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      notify("Theme changed, but this browser could not save the preference.", true);
    }
  }

  function init() {
    initCookieNotice();
    try {
      loadState();
    } catch {
      return;
    }
    document.querySelectorAll("[data-auth-view]").forEach((button) => button.addEventListener("click", () => {
      const view = button.dataset.authView;
      if (view === "home") $("#auth-panel").hidden = true;
      else showAuth(view, selectedRole);
    }));
    document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => showAuth(button.dataset.mode)));
    document.querySelectorAll("[data-role]").forEach((button) => button.addEventListener("click", () => showAuth(authMode, button.dataset.role)));
    $("#login-form").addEventListener("submit", (event) => {
      event.preventDefault();
      try {
        login(new FormData(event.currentTarget));
      } catch (error) {
        showAuthMessage("#login-message", error.message);
      }
    });
    $("#signup-form").addEventListener("submit", (event) => {
      event.preventDefault();
      try {
        signup(new FormData(event.currentTarget));
      } catch (error) {
        showAuthMessage("#signup-message", error.message);
      }
    });
    $("#term-filter").addEventListener("change", renderResultsForTerm);
    $("#download-results").addEventListener("click", downloadResults);
    $("#school-switch").addEventListener("change", () => {
      state.campus.activeSchool = $("#school-switch").value;
      saveState();
      buildDashboard();
      showPage(activePage);
    });
    $("#theme-toggle").addEventListener("click", () => {
      try { toggleTheme(); } catch (error) { notify(error.message, true); }
    });
    try {
      const savedTheme = localStorage.getItem(THEME_KEY);
      if (savedTheme === "light" || savedTheme === "dark") document.body.dataset.theme = savedTheme;
      $("#theme-toggle").textContent = document.body.dataset.theme === "light" ? "☾ Dark mode" : "☀ Light mode";
    } catch (error) {
      console.error("Could not read the colour theme preference:", error);
    }
    $("#logout-button").addEventListener("click", () => {
      logActivity(`${currentUser.name} signed out`);
      saveState();
      currentUser = null;
      $("#portal-screen").hidden = true;
      $("#auth-screen").hidden = false;
      location.hash = "";
      window.scrollTo({ top: 0, behavior: "smooth" });
      notifyAuthSignout();
    });
    document.addEventListener("click", (event) => {
      const pageLink = event.target.closest("[data-page], [data-page-link]");
      if (pageLink && currentUser) {
        event.preventDefault();
        showPage(pageLink.dataset.page || pageLink.dataset.pageLink);
      }
    });
    document.addEventListener("submit", handleSubmit);
    document.addEventListener("click", handleAction);
  }

  function initCookieNotice() {
    const notice = $("#cookie-notice");
    try {
      if (!localStorage.getItem(COOKIE_CHOICE_KEY)) notice.hidden = false;
    } catch (error) {
      notice.hidden = false;
      console.error("Could not read the privacy preference:", error);
    }

    notice.querySelectorAll("[data-cookie-choice]").forEach((button) => {
      button.addEventListener("click", () => {
        try {
          localStorage.setItem(COOKIE_CHOICE_KEY, button.dataset.cookieChoice);
          notice.hidden = true;
        } catch (error) {
          notify("Could not save your privacy choice. Please enable browser storage and try again.", true);
          console.error("Could not save the privacy preference:", error);
        }
      });
    });
  }

  function notifyAuthSignout() {
    showAuth("login", "student");
  }

  init();
})();
