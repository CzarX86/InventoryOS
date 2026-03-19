# Release Pipeline

## What Exists

- `CI` runs tests and builds on pull requests to `main` and pushes to `main` / `codex/**`.
- `CI` also runs ESLint on changed app files so new lint regressions are caught without blocking on unrelated legacy issues.
- `Deploy Staging` runs automatically after a successful `CI` workflow and deploys to the staging Firebase project.
- `Deploy Production` is manual only and should be protected by the GitHub `production` environment approval rule.
- `CODEOWNERS` routes app, workflow, and docs reviews to `@CzarX86`.

## GitHub Environments

Create these environments in GitHub:

- `staging`
- `production`

Add these environment variables to both environments:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Add these secrets to both environments:

- `NEXT_PUBLIC_GEMINI_API_KEY`
- `FIREBASE_SERVICE_ACCOUNT`

`FIREBASE_SERVICE_ACCOUNT` should contain the full JSON credential for a service account that can deploy Hosting, Firestore, and Storage rules to that target Firebase project.

## Expected Flow

1. Open or update a PR to `main`.
2. Wait for `Test`, `Lint Changed Files`, and `Build` to pass.
3. Let `Deploy Staging` publish the same commit to the staging Firebase project.
4. Manually test the staging URL shown in the workflow summary.
5. Run `Deploy Production` from GitHub Actions and approve the `production` environment when prompted.

## Branch Protection

Once the repository is public, enable branch protection on `main` with:

- 1 required approving review
- stale review dismissal
- required checks `Test`, `Lint Changed Files`, and `Build`
- require branch to be up to date before merge
- block direct pushes to `main`

If the repository remains private, GitHub branch protection still requires the appropriate paid plan.
