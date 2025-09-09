Here’s a drop-in README.md you can put at the root of your Playwright smoke project (PlaywrightSmoke or similar). It’s written for Windows first (PowerShell), but includes macOS/Linux commands where helpful.

⸻

Playwright Smoke Tests

Fast, reliable end-to-end smoke tests using Playwright.
This repo contains a minimal, known-good setup that runs a single cross-browser test against a public site (Wikipedia) and produces an HTML report, screenshots, videos, and traces on failure.

Use this project as a starting point to sanity-check your local environment or as a template for adding tests for your own site.

⸻

Table of Contents
	•	Prerequisites
	•	Project Structure
	•	Quick Start (Windows PowerShell)
	•	Running Tests
	•	Run on Microsoft Edge
	•	Run on bundled Chromium
	•	Headed vs Headless
	•	HTML Report & Trace Viewer
	•	Configuration
	•	Add Your Own Test
	•	Debugging & Tips
	•	Common Issues & Fixes
	•	CI Example (GitHub Actions)
	•	Clean Reset
	•	License

⸻

Prerequisites
	•	Node.js 18+
Check:

node -v


	•	Windows PowerShell (recommended on Windows for running commands)
Git Bash can work, but PowerShell avoids path/quoting issues on Windows.
	•	Internet access (tests hit Wikipedia by default)
	•	Optional: Microsoft Edge installed (for the Edge project)

⸻

Project Structure

.
├─ package.json                # Dev dependency on @playwright/test + scripts
├─ playwright.config.js        # Single-project config (Edge or Chromium)
└─ tests/
   └─ wikipedia.spec.ts        # Example smoke test

	•	Artifacts (on failures) are saved under test-results/ and the HTML report under playwright-report/.

⸻

Quick Start (Windows PowerShell)

# 1) Install dependencies
npm i

# 2) Install the browser runtime(s) you plan to use
#    Edge (uses installed MS Edge)
npx playwright install msedge

#    or the bundled Chromium (no system Chrome needed)
npx playwright install chromium

# 3) Run tests (choose one project)
#    Edge:
npx playwright test --project=edge --headed

#    or Chromium (if your config uses the Chromium project):
npx playwright test --project=chromium --headed

# 4) View the HTML report
npx playwright show-report

macOS/Linux: use bash/zsh and the same commands.

⸻

Running Tests

Run on Microsoft Edge

npx playwright install msedge
npx playwright test --project=edge --headed
npx playwright show-report

If Edge is managed by your organization and cannot be launched by Playwright, fall back to Chromium (below) for your demo.

Run on bundled Chromium

npx playwright install chromium
npx playwright test --project=chromium --headed
npx playwright show-report

Headed vs Headless
	•	Headed (opens a real browser window):
--headed
	•	Headless (faster, no window):
(default) omit --headed or pass --headless

Examples:

npx playwright test --project=edge --headed
npx playwright test --project=chromium --headless

HTML Report & Trace Viewer
	•	HTML report:

npx playwright show-report


	•	Open a trace (if a test failed and trace: "retain-on-failure" is enabled):

npx playwright show-trace test-results/<failed-test-dir>/trace.zip



⸻

Configuration

playwright.config.js (example):

const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  reporter: [["html", { open: "never" }]],
  use: {
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    // Use this for Microsoft Edge (system Edge install)
    {
      name: "edge",
      use: { ...devices["Desktop Edge"], channel: "msedge" },
    },

    // Or comment the Edge project above and use the bundled Chromium below:
    // {
    //   name: "chromium",
    //   use: { ...devices["Desktop Chrome"] },
    // },
  ],
});

Switching browsers
	•	Edge: keep the edge project and run --project=edge
	•	Chromium: enable the Chromium project and run --project=chromium

⸻

Add Your Own Test

Create a new test file under tests/.
Example: tests/homepage.spec.ts

import { test, expect } from "@playwright/test";

test("Home page renders and has a title", async ({ page }) => {
  await page.goto("https://example.com/");
  await page.waitForTimeout(2000); // simple pause to observe (not needed in real tests)
  await expect(page).toHaveTitle(/example/i);
});

Run it:

npx playwright test --project=edge --headed
# or
npx playwright test --project=chromium --headed


⸻

Debugging & Tips
	•	Run a single test file

npx playwright test tests/wikipedia.spec.ts --project=edge --headed


	•	Run a single test by title

npx playwright test -g "Playwright article" --project=edge --headed


	•	Live debugging (inspector)

$env:PWDEBUG="1"; npx playwright test --project=edge; Remove-Item Env:\PWDEBUG


	•	Slow motion

npx playwright test --project=edge --headed --timeout=60000 --retries=0 --workers=1 --ui
# or add in config: use: { launchOptions: { slowMo: 250 } }



⸻

Common Issues & Fixes

“Project(s) ‘edge’ not found”
	•	The config isn’t loading or doesn’t define edge.
Check what Playwright sees:

npx playwright test --list

If edge isn’t listed:
	•	Ensure playwright.config.js exists in project root.
	•	Ensure you’re running commands in the same folder as the config.
	•	Confirm Node can read the file (no syntax errors).

Edge won’t launch / managed by org
	•	Use the Chromium project as a fallback:

npx playwright install chromium
npx playwright test --project=chromium --headed



Old/incorrect report opens
	•	Remove old reports before rerunning:

Remove-Item -Recurse -Force .\playwright-report, .\test-results -ErrorAction SilentlyContinue
npx playwright test
npx playwright show-report



Git Bash vs PowerShell on Windows
	•	Prefer PowerShell. Git Bash can cause path & quoting issues with Playwright CLI.

Proxy / SSL issues on corp network
	•	Try Chromium first (Playwright downloads & controls it).
	•	If corp proxy blocks downloads, use a network that allows Playwright to fetch browsers:

npx playwright install



⸻

CI Example (GitHub Actions)

.github/workflows/playwright.yml:

name: Playwright Tests

on:
  push:
  pull_request:

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright (Chromium)
        run: npx playwright install --with-deps chromium

      - name: Run tests (Chromium)
        run: npx playwright test --project=chromium

      - name: Upload HTML report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report
          retention-days: 7

If you need Edge in CI, run on a Windows runner and install Edge there,
or use the Chromium project for portability.

⸻

Clean Reset

If things feel “stuck” (stale reports, etc.):

Remove-Item -Recurse -Force .\node_modules, .\playwright-report, .\test-results -ErrorAction SilentlyContinue
npm i
npx playwright install
npx playwright test
npx playwright show-report


⸻

License

MIT (or your chosen license)

⸻

Why this repo exists

This template intentionally avoids TypeScript build steps, complex transforms, and brittle selectors. It’s designed to prove your environment works and give you a clean base to add your own tests quickly. If the smoke test passes on Chromium but not on Edge, you still have a valid demo while you resolve local Edge policies.

Need help adapting this template to your site (e.g., login flows, carts, search, or custom waits)? Add another spec under tests/ following the example patterns and run it with the same commands.
