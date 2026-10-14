// Seeds the Review Board SANDBOX database (never anything else).
//
// Refuses to run unless the connection is loopback, on port 55440, to a database named rb_sandbox — the throwaway
// Postgres that sandbox.sh starts. Run via:  bash scripts/review-board-sandbox/sandbox.sh seed
//
// Creates two workspaces (one Pro, one Launch), four users with a known password, and a Pro repository seeded with
// deliberate duplicate / similar / unrelated test cases so every Review Board flow has something to show.
const path = require("path");
const crypto = require("crypto");
const { Client } = require(path.join(process.argv[2], "node_modules", "pg"));

const URL_ENV = process.env.SANDBOX_DATABASE_URL;
const PASSWORD = "Sandbox!2026";

function assertSandbox(raw) {
  const u = new URL(raw || "");
  if (!["127.0.0.1", "localhost"].includes(u.hostname) || u.port !== "55440" || u.pathname !== "/rb_sandbox") {
    throw new Error("Refusing to seed: not the sandbox database (127.0.0.1:55440/rb_sandbox).");
  }
}

// Same format as PasswordService.hashPassword in Tesbo-Backend-Nest/src/auth/password.service.ts
function hashPassword(password) {
  const iterations = 210000;
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
  return `pbkdf2_sha256$${iterations}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

const step = (action, expectedResult) => ({ action, expectedResult });
const LOGIN = [step("Open the login page", "The sign-in form is shown"), step("Enter a registered email and the correct password and submit", "The dashboard opens")];
const RESET = [step("Open the sign-in page and choose Forgot password", "The reset form is shown"), step("Submit a registered email", "A reset link is sent"), step("Follow the link and set a new password", "The new password works for sign-in")];
const CSV = [step("Open the Reports page", "The report list is shown"), step("Choose a report and click Export as CSV", "A CSV file downloads"), step("Open the file", "Rows match the on-screen report")];
const CART = [step("Open a product page", "The product details are shown"), step("Click Add to cart", "The cart badge increases by one"), step("Open the cart", "The product is listed with the right price")];
const SEARCH = [step("Open the search box", "The box is focused"), step("Type the search text and press Enter", "Matching results are listed")];
const PROFILE = [step("Open Account settings", "The profile form is shown"), step("Change the name and save", "A success message is shown"), step("Reload the page", "The new name is still shown")];
const PROJECT = [step("Click New project", "The project form opens"), step("Enter a name and key and save", "The project is created and opened")];

async function main() {
  assertSandbox(URL_ENV);
  const client = new Client({ connectionString: URL_ENV });
  await client.connect();
  const q = async (sql, params = []) => (await client.query(sql, params)).rows;
  const one = async (sql, params = []) => (await q(sql, params))[0];

  try {
    await client.query("BEGIN");
    if ((await one("SELECT count(*)::int AS n FROM organizations")).n > 0) throw new Error("The sandbox is already seeded. Use: sandbox.sh reset");
    const hash = hashPassword(PASSWORD);

    async function org(name, slug, plan) {
      return (await one("INSERT INTO organizations (name, slug, plan) VALUES ($1, $2, $3) RETURNING id", [name, slug, plan])).id;
    }
    async function user(email, first, last, orgId) {
      return (await one(
        `INSERT INTO users (email, name, first_name, last_name, mobile_number, profile_completed_at, password_hash, active_organization_id)
         VALUES ($1, $2, $3, $4, '+15555550100', now(), $5, $6) RETURNING id`,
        [email, `${first} ${last}`, first, last, hash, orgId]
      )).id;
    }

    const proOrg = await org("Sandbox Pro Workspace", "sandbox-pro-workspace", "pro");
    const launchOrg = await org("Sandbox Launch Workspace", "sandbox-launch-workspace", "launch");
    const owner = await user("owner.pro@sandbox.test", "Olivia", "Owner", proOrg);
    const manager = await user("manager.pro@sandbox.test", "Marcus", "Manager", proOrg);
    const qa = await user("qa.pro@sandbox.test", "Quinn", "QA", proOrg);
    const launchOwner = await user("owner.launch@sandbox.test", "Leo", "Launch", launchOrg);

    for (const [orgId, userId, role] of [[proOrg, owner, "owner"], [proOrg, manager, "member"], [proOrg, qa, "member"], [launchOrg, launchOwner, "owner"]]) {
      await client.query("INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, $3)", [orgId, userId, role]);
    }

    const proProject = (await one("INSERT INTO projects (organization_id, name, key) VALUES ($1, 'Sandbox Repository', 'SBX') RETURNING id", [proOrg])).id;
    const launchProject = (await one("INSERT INTO projects (organization_id, name, key) VALUES ($1, 'Launch Repository', 'LCH') RETURNING id", [launchOrg])).id;
    for (const [projectId, userId, role] of [[proProject, owner, "owner"], [proProject, manager, "manager"], [proProject, qa, "qa_engineer"], [launchProject, launchOwner, "owner"]]) {
      await client.query("INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)", [projectId, userId, role]);
    }

    const suiteAuth = (await one("INSERT INTO suites (project_id, name) VALUES ($1, 'Authentication') RETURNING id", [proProject])).id;
    const suiteReports = (await one("INSERT INTO suites (project_id, name) VALUES ($1, 'Reports') RETURNING id", [proProject])).id;
    const suiteShop = (await one("INSERT INTO suites (project_id, name) VALUES ($1, 'Shopping') RETURNING id", [proProject])).id;

    let n = 0;
    // shape: "array" stores a jsonb array; "string" stores the JSON-encoded string the app's own editor saves.
    async function tc(projectId, prefix, c) {
      n += 1;
      const steps = c.steps ?? [];
      const value = c.shape === "string" ? JSON.stringify(JSON.stringify(steps)) : JSON.stringify(steps);
      await client.query(
        `INSERT INTO testcases (project_id, suite_id, external_id, title, description, preconditions, test_data, steps, owner_id, status, priority, type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, 'Functional')`,
        [projectId, c.suite ?? null, `${prefix}-${n}`, c.title, c.description ?? null, c.pre ?? null, c.data ?? null, value, c.owner ?? null, c.status ?? "Active", c.priority ?? "P2"]
      );
    }

    // --- exact duplicates (wording differs only in case/spacing/punctuation); different suites/owners/statuses on purpose
    await tc(proProject, "SBX", { title: "Login with valid credentials", pre: "A registered user exists", data: "email=alice@example.test", steps: LOGIN, suite: suiteAuth, owner, priority: "P1" });
    await tc(proProject, "SBX", { title: "login with valid credentials!", pre: "A registered user exists", data: "email=alice@example.test", steps: LOGIN, shape: "string", priority: "P3" });
    await tc(proProject, "SBX", { title: "Reset password via email link", pre: "A registered user exists", steps: RESET, suite: suiteAuth });
    await tc(proProject, "SBX", { title: "Reset password via  email link", pre: "A registered user exists", steps: RESET, shape: "string", suite: suiteAuth, status: "Deprecated" });
    await tc(proProject, "SBX", { title: "Export report as CSV", pre: "At least one report exists", data: "format=csv", steps: CSV, suite: suiteReports, owner: manager });
    await tc(proProject, "SBX", { title: "Export report as CSV", pre: "At least one report exists", data: "format=csv", steps: CSV, suite: suiteReports });
    // --- a group of three identical cases -> three findings over the same three test cases
    for (const suffix of ["", " ", "."]) await tc(proProject, "SBX", { title: `Add item to cart${suffix}`, pre: "A product is in stock", data: "quantity=1", steps: CART, suite: suiteShop });
    // --- similar, with genuine differences
    await tc(proProject, "SBX", { title: "Search by keyword", pre: "Several items exist", data: "text=invoice", steps: SEARCH });
    await tc(proProject, "SBX", { title: "Search by keyword with special characters", pre: "Several items exist", data: "text=#&%?", steps: SEARCH });
    await tc(proProject, "SBX", { title: "Create a project", pre: "Signed in as an owner", steps: PROJECT });
    await tc(proProject, "SBX", { title: "Create a project", pre: "Signed in as a manager", steps: PROJECT });
    await tc(proProject, "SBX", { title: "Update profile name", pre: "Signed in", steps: PROFILE });
    await tc(proProject, "SBX", { title: "Update profile display name", pre: "Signed in", steps: [PROFILE[0], step("Change the display name and save", "A success message appears"), PROFILE[2]] });
    await tc(proProject, "SBX", { title: "Login with an invalid password", pre: "A registered user exists", data: "password=wrong", steps: [LOGIN[0], step("Enter a registered email and a wrong password and submit", "An error message is shown")] });
    await tc(proProject, "SBX", { title: "Login with a wrong password", pre: "A registered user exists", data: "password=wrong", steps: [LOGIN[0], step("Enter a registered email and a wrong password and submit", "The page stays on sign-in and a banner explains the failure")] });
    // --- identical titles but no steps: reported as similar, never as an exact duplicate
    await tc(proProject, "SBX", { title: "Smoke test checkout", steps: [] });
    await tc(proProject, "SBX", { title: "Smoke test checkout", steps: [] });
    // --- unrelated fillers
    const fillers = [
      ["Download invoice as PDF", "Open an invoice", "Click Download", "A PDF is saved"],
      ["Switch interface language to French", "Open Preferences", "Choose French", "Labels are shown in French"],
      ["Enable two-factor authentication", "Open Security settings", "Scan the QR code and enter the code", "Two-factor is shown as enabled"],
      ["Invite a teammate by email", "Open Members", "Send an invitation", "The invitation is listed as pending"],
      ["Archive a project", "Open project settings", "Choose Archive", "The project disappears from the list"],
      ["Upload a profile picture", "Open Account settings", "Select a PNG under 2 MB", "The new picture is shown"],
      ["Filter the test repository by priority", "Open the repository", "Choose priority P1", "Only P1 cases are listed"],
      ["Sort bugs by severity", "Open the Bugs page", "Click the Severity header", "Rows are ordered by severity"],
      ["Create a test run from a plan", "Open a test plan", "Click Start run", "A run is created with the plan's cases"],
      ["Link a Jira ticket to a test case", "Open a test case", "Paste a ticket key", "The ticket is linked"],
      ["Delete a comment", "Open a comment menu", "Choose Delete and confirm", "The comment is removed"],
      ["Change workspace name", "Open Workspace settings", "Edit the name and save", "The new name is shown in the header"],
      ["Copy a share link for a report", "Open a report", "Click Share", "A link is copied to the clipboard"],
      ["Resume an interrupted test run", "Open an in-progress run", "Click Resume", "Execution continues at the last case"],
      ["View audit history for a test case", "Open a test case", "Open the Activity tab", "Past edits are listed"],
      ["Bulk move test cases to another suite", "Select several cases", "Choose Move and pick a suite", "The cases appear in the new suite"],
      ["Import test cases from CSV", "Open Import", "Choose a valid CSV", "The cases are created"],
      ["Rename a suite", "Open a suite menu", "Choose Rename and save", "The suite shows the new name"],
    ];
    // each filler: [title, first action, second action, expected result of the second action]
    for (const [title, open, act, expected] of fillers) await tc(proProject, "SBX", { title, steps: [step(open, "The screen is displayed"), step(act, expected)] });

    // --- a few cases in the Launch repository (only visible to see the Pro prompt)
    await tc(launchProject, "LCH", { title: "Login with valid credentials", steps: LOGIN });
    await tc(launchProject, "LCH", { title: "Login with valid credentials", steps: LOGIN });

    await client.query("COMMIT");
    const total = (await one("SELECT count(*)::int AS n FROM testcases WHERE project_id = $1", [proProject])).n;
    console.log(`Seeded: 2 workspaces, 4 users, 1 Pro repository with ${total} test cases, 1 Launch repository with 2.`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(String(err && err.message ? err.message : err));
  process.exit(1);
});
