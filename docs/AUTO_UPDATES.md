# Automatic desktop updates

SocialFlow OS checks the repository's latest GitHub Release shortly after launch and every six
hours. When a newer SemVer release exists, Tauri verifies its signature, downloads it, and installs
it quietly. The new version takes effect the next time the app opens, so active drafts are not
interrupted.

## Security boundary

- Update metadata is loaded only from this repository's HTTPS `latest.json` release asset.
- Tauri requires every updater artifact to match the public key embedded in `tauri.conf.json`.
- The matching private key is stored locally at `.tauri/socialflow-updater.key`, which is ignored by
  git. Back it up securely; losing it prevents future versions from updating existing installations.
- Never commit or paste the private key into source, issues, logs, or release notes.

## One-time GitHub setup

Add the complete contents of `.tauri/socialflow-updater.key` as an Actions repository secret named
`TAURI_SIGNING_PRIVATE_KEY`. The key has no password, so no password secret is required.

The workflow in `.github/workflows/release.yml` needs repository `contents: write` permission. It
uses the automatically provided `GITHUB_TOKEN` and does not need a personal access token.

## Publishing a release

1. Update the same SemVer value in `package.json`, `src-tauri/Cargo.toml`, and
   `src-tauri/tauri.conf.json`.
2. Commit and push the reviewed changes.
3. Run **Publish SocialFlow OS** from GitHub Actions, or push a matching tag such as `app-v0.3.5`.
4. Confirm the public release contains macOS updater archives, `.sig` files, and `latest.json`.

The updater ignores a release whose version is not newer than the installed version.
