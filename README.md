# Crestview College Portal

**Believe, Inspire, Excel.**

A responsive school-portal demonstration for students, teachers, and administrators. The demo runs without a database or account service; portal records and changes are stored in the browser's local storage.

The site includes a privacy notice explaining browser storage and offers controls to accept or reject optional cookies. It does not set analytics or advertising cookies.

## Run the demo

From this folder, run:

```powershell
npm start
```

Open `http://localhost:3000`. You can also open `index.html` directly in a modern browser. No package installation is required for the demo server; it uses Node.js built-ins.

## Publish a review copy

This is a static browser demo. To get a shareable review URL with Netlify Drop:

1. Create a new folder named `crestview-site`.
2. Copy only `index.html`, `app.js`, and `styles.css` from this project into it. Do not upload `server.js`, `demo-server.js`, or project files that are not needed by the browser.
3. Open [Netlify Drop](https://app.netlify.com/drop) and drag the `crestview-site` folder onto the page. Sign in or create a Netlify account if prompted.
4. Share the generated `https://…netlify.app` address with the school. You can rename the site in Netlify's site settings.

The site URL is created by Netlify after deployment; it cannot be known in advance. This review build stores data separately in each visitor's browser and does not synchronize changes between visitors.

## Demo sign-ins

| Role | Login ID | Password |
|---|---|---|
| Student | `amara.okafor@crestview.edu` | `Student123!` |
| Teacher | `james.cole@crestview.edu` | `Teacher123!` |
| Administrator | `admin@crestview.edu` | `Admin123!` |

Other seeded accounts:

- Student: `daniel.mensah@crestview.edu` or `sofia.bennett@crestview.edu` — password `Student123!`
- Teacher: `grace.williams@crestview.edu` — password `Teacher123!`

## Creating an account

Students, teachers, and administrators can use the Sign up tab to create an account with their own name, email address, and password.

- Student accounts require a class.
- Teacher accounts require a subject.
- New accounts are approved automatically in this browser demo.
- A generated internal account ID is assigned; users do not need an issued ID to sign up.

## Included demo workflows

- Role-specific dashboards, profiles, and access to results, notes, notices, and student rosters.
- Students can filter and download approved results and download materials assigned to their class.
- Teachers can submit results for approval, upload class materials, publish notices, and view their class roster.
- Administrators can add, approve, edit, or remove accounts; approve results; manage notices and materials; view portal activity; and set the current academic term.
- The portal starts with three sample students, two teachers, three results, three study materials, and two notices.
- The Campus hub adds a QR-encoded demo student ID, report-card and certificate downloads, a school-scoped workspace, performance charts and trend estimates, a leaderboard, library catalogue, assignment publishing/submission, discussions, events, portal messages, attendance/wellbeing records, visitor registration, and transport/hostel request logs.
- Light/dark theme preference and module changes persist in the current browser. Administrative activity history is available in both Administration and the Campus hub.
- Changes persist in the current browser. An administrator can restore the original sample data from the Administration page.

## Demo security note

This is a front-end demonstration, not a production authentication system. Passwords and school records are stored in browser local storage and are not protected or synchronized. Do not enter real personal information or reuse a real password. The `demo-server.js` serves only the public demo files; it does not provide API authentication or server-side data storage.

The Campus hub is likewise a local demonstration: its performance projection is a simple estimate from saved results, not an AI model; notification preferences do not send SMS or email; messages are not real-time; attendance is manual; and bus GPS, biometric devices, and live hostel inventory are not connected. School contexts share this browser demo's data store and are not security-isolated tenants. Configure trusted server-side services, access controls, and privacy protections before using any feature with real student data.
