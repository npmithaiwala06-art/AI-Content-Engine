# Phase 2 — Client and Brand Management

Phase 2 is complete. It preserves the permanent product law by creating the client and Brand Profile memory that future ChatGPT prompts, platform versions, approvals, schedules, analytics and improvements will all reference.

No AI API, cloud backend or social-platform credential is used in this phase.

## What was built

- Searchable, filterable and sortable multi-client directory
- Active, paused and archived client states
- Add and edit workflow split into Business, Brand Profile and Platforms steps
- Local brand-logo upload with preview and replacement
- Archive, restore and confirmed permanent deletion
- Overview and Brand Profile client-workspace tabs
- Architecture-ready tabs for Social Accounts, Campaigns, Content, Calendar, Analytics and Reports
- SQLite statistics and activity logging
- Browser preview backed by local browser storage
- Native desktop mode backed by local SQLite and the macOS filesystem

## Important files

### Created

```text
src-tauri/migrations/002_clients_and_brand_profiles.sql
src-tauri/src/clients.rs
src/types/client.ts
src/services/clients.ts
src/features/clients/ClientFormModal.tsx
src/components/ConfirmDialog.tsx
src/pages/ClientsPage.tsx
src/pages/ClientDetailPage.tsx
src/pages/ClientsPage.test.tsx
docs/PHASE_2_CLIENTS.md
```

### Updated

```text
src-tauri/src/database.rs
src-tauri/src/error.rs
src-tauri/src/lib.rs
src-tauri/tauri.conf.json
src/App.tsx
src/components/AppLayout.tsx
src/components/Header.tsx
src/components/Sidebar.tsx
src/styles/global.css
README.md
docs/DATABASE.md
```

## Run the browser preview

Open Terminal and run exactly:

```bash
cd "/Users/neevmithaiwala/Documents/ChatGPT/AI-powered Marketing"
npm install
npm run dev
```

Open `http://localhost:1420/clients`.

Expected result: a professional client directory containing preview clients. Changes made here stay in that browser's `localStorage`; they do not modify the desktop database.

## Run the real local desktop app

```bash
cd "/Users/neevmithaiwala/Documents/ChatGPT/AI-powered Marketing"
source "$HOME/.cargo/env"
npm run desktop:dev
```

Expected result: the native SocialFlow OS window opens. Client and Brand Profile changes persist in:

```text
~/Library/Application Support/com.socialflow.localos/socialflow.sqlite
```

Client logos are stored below:

```text
~/Library/Application Support/com.socialflow.localos/media/clients/<client-id>/logos/
```

## Build the standalone macOS application

```bash
cd "/Users/neevmithaiwala/Documents/ChatGPT/AI-powered Marketing"
source "$HOME/.cargo/env"
npm run desktop:build
```

Expected result:

```text
src-tauri/target/release/bundle/macos/SocialFlow OS.app
```

Open it from Finder, or run:

```bash
open "/Users/neevmithaiwala/Documents/ChatGPT/AI-powered Marketing/src-tauri/target/release/bundle/macos/SocialFlow OS.app"
```

## Manual test checklist

1. Open Clients and click **Add Client**.
2. Enter Client name and Brand name; complete optional business fields.
3. Continue to Brand Profile and add a brand voice, CTA, personality, colours, fonts, keywords and avoided topics.
4. Optionally upload a PNG, JPG, WebP or GIF logo below 10 MB.
5. Select two or more planned platforms and save.
6. Search for the new client and open its workspace.
7. Confirm Overview and Brand Profile display the saved information.
8. Edit the client and confirm the updated information persists.
9. Archive it, switch the directory filter to Archived, and restore it.
10. Restart the desktop app and verify the client still exists.
11. Only for disposable test data, choose Delete permanently and verify the confirmation explains the cascade and media removal.

## Automated tests

Run:

```bash
cd "/Users/neevmithaiwala/Documents/ChatGPT/AI-powered Marketing"
npm test
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected result at Phase 2 completion:

```text
Frontend: 2 test files, 8 tests passed
Rust:     2 tests passed
TypeScript/Vite production build: passed
Rust formatter: passed
Rust Clippy with warnings denied: passed
```

The native client test covers create, read, edit, list, logo upload, archive, restore, permanent delete and local-logo cleanup.

## Common errors and fixes

- **Port 1420 is in use:** stop the older dev process with `Control-C`, then rerun `npm run dev` or `npm run desktop:dev`.
- **`cargo` is not found:** run `source "$HOME/.cargo/env"` and retry. Install Rust only if `rustc --version` also fails.
- **A browser client is missing in desktop mode:** preview and desktop storage are deliberately isolated. Recreate the client in the native app to save it in SQLite.
- **Logo upload is rejected:** use PNG, JPG/JPEG, WebP or GIF, and keep the file below 10 MB.
- **Client disappears after archive:** choose Archived in the Status filter. Archive is reversible and does not delete data.
- **Database cannot open:** verify `~/Library/Application Support/com.socialflow.localos` is writable. Back up the SQLite file before any manual troubleshooting.
- **Old fields are missing:** quit every older app process, restart the current desktop build and let migration 002 run. Do not manually alter the database.

## Honest remaining boundaries

Social-account connections, campaigns, content, calendar, analytics and reports are visible within the client workspace but remain explicitly labelled for later phases. No connection or publishing behavior is simulated in Phase 2. Phase 3 will build the no-API ChatGPT prompt and import workflow using the Brand Profile created here.
