# Branch Protection Draft

Recommended settings for `main`:

- Require pull request reviews before merging.
- Require at least 1 approving review.
- Dismiss stale approvals when new commits are pushed.
- Require status checks to pass before merging.
- Required checks:
  - `Test`
  - `Lint Changed Files`
  - `Build`
- Require branches to be up to date before merging.
- Restrict who can push to matching branches.
- Allow repository admins to bypass only if you need emergency hotfix access.
- Do not allow direct pushes to `main`.

Notes:

- This repo currently has unrelated legacy lint issues, so the CI gate runs ESLint only on changed app files.
- When the legacy lint debt is cleaned up, replace this with a full-repo lint gate.
