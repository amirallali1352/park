# CI/CD

Every push to `main` and every pull request targeting `main` runs the GitHub Actions workflow in `.github/workflows/ci.yml`.

The quality gate:

1. Installs the exact versions from `package-lock.json`.
2. Runs a production dependency audit.
3. Validates `docker-compose.yml`.
4. Executes the complete Node.js test suite.

The workflow uses Node.js 22 and has read-only repository permissions. Pull requests must pass this workflow before they are merged.
