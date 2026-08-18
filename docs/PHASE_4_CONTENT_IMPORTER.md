# Phase 4 — ChatGPT Content Importer

Phase 4 converts the structured result produced through the manual ChatGPT workflow into local Draft posts. It never calls an AI API and never approves or schedules imported content.

## Files

```text
src-tauri/migrations/004_content_importer.sql
src-tauri/src/content_importer.rs
src/types/contentImport.ts
src/ai/contentParser.ts
src/ai/contentParser.test.ts
src/services/contentImport.ts
src/pages/ContentImporterPage.tsx
src/pages/ContentImporterPage.test.tsx
```

## Run

```bash
cd "/Users/neevmithaiwala/Documents/ChatGPT/AI-powered Marketing"
source "$HOME/.cargo/env"
npm run desktop:dev
```

Open **AI Workspace → Import Result**, paste the ChatGPT JSON, parse it, review every platform tab and save selected Drafts.

## Expected result

- JSON fences or surrounding ChatGPT text are removed automatically.
- Invalid results show field-specific issues and save nothing.
- Platform versions remain independent.
- Existing matching posts show **Already imported** and cannot be selected.
- Saved content has Draft status and still requires human approval.

## Verify

```bash
npm test
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

## Common errors

- **No JSON object found:** use the Phase 3 prompt and request one JSON object without commentary.
- **Client does not match:** select the correct active local client before parsing.
- **Already imported:** edit the existing Draft rather than creating a duplicate.
- **No usable platform content:** ask ChatGPT to regenerate the missing platform version.

The next phase edits these Draft records through the Content Creation Studio.
