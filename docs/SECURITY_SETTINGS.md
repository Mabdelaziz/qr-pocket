# QR Pocket — Repository security settings

Applied and read back from the GitHub API on 2026-10-21 for https://github.com/Mabdelaziz/qr-pocket (PUBLIC, GitHub Free). "Read back" means the API returned these values after they were set; it is not a penetration test.

## Enforced (verified by API read-back)
| Setting | Value |
|---|---|
| Actions default `GITHUB_TOKEN` permissions | `read`; Actions cannot approve pull requests |
| Allowed actions | `selected`: **GitHub-owned only** (`actions/*`); no verified-creator or third-party patterns |
| SHA pinning | `sha_pinning_required: true` (all workflow `uses:` are full commit SHAs) |
| Branch protection on `main` | required status check **`verify`** (strict: branch must be up to date); pull request required (0 approvals, stale approvals dismissed); conversation resolution required; **applies to admins**; force-push and deletion blocked |
| Dependabot alerts / security updates | enabled |
| Secret scanning + push protection | enabled |
| GitHub Pages | **disabled** (API returns 404) |
| Deployments / releases / tags / packages | none created |
| Workflow permissions in files | `contents: read`; the lockfile workflow only uploads an artifact; no `pull_request_target`; no secrets used |

## Configured in-repo
- `.github/dependabot.yml`: weekly npm and github-actions updates via pull requests, grouped minor/patch dev updates, TypeScript and `@types/node` majors ignored (ADR-015/011). Nothing auto-merges; every update must pass `verify`.

## GitHub Free limitations (not claimed as enforced)
- **Approvals:** required reviews are set to 0 because this is a single-maintainer repository; GitHub does not let the author approve their own PR, so requiring 1 approval would make merging impossible. The enforced controls are "PR required" + "`verify` must pass" + "applies to admins".
- **Review of workflow changes:** without an organisation, there is no CODEOWNERS enforcement beyond what reviewers do manually; changes to `.github/workflows/` rely on PR review.
- **Restricting who can push** and **merge queue** are organisation features and are not configured here.
- **Third-party GitHub Apps:** a "Sourcery review" check appeared on PR #1. It comes from an app installed on the account, not from this repository's workflows. Review installed apps at https://github.com/settings/installations; this project does not depend on it.
- **Rulesets:** classic branch protection was used; equivalent rulesets would not add enforcement beyond the above on GitHub Free.
- **Not covered:** Pages, environments, deployment protection rules (no deployment is authorised).

## Re-verify
```
gh api repos/Mabdelaziz/qr-pocket/actions/permissions
gh api repos/Mabdelaziz/qr-pocket/actions/permissions/selected-actions
gh api repos/Mabdelaziz/qr-pocket/actions/permissions/workflow
gh api repos/Mabdelaziz/qr-pocket/branches/main/protection
gh api repos/Mabdelaziz/qr-pocket --jq .security_and_analysis
gh api repos/Mabdelaziz/qr-pocket/pages     # expect 404
```
