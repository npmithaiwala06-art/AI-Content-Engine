# Phase 3 — ChatGPT AI Workspace

Phase 3 is complete. The application turns locally stored client and Brand Profile data into a structured prompt that the user manually copies to ChatGPT. No AI SDK, AI API key, paid AI service or automatic outbound request is used.

## Workflow

```text
Select client and content brief
→ Load Brand Profile from local storage
→ Generate deterministic ChatGPT prompt
→ Save prompt history locally
→ Copy or export prompt
→ User sends prompt to ChatGPT
→ ChatGPT returns social_content_v1 JSON
→ Phase 4 importer will validate and preview the result
```

## What was built

- Client and optional campaign selection
- Goal, topic, content type, tone, post count and date range inputs
- Instagram, Facebook, LinkedIn and YouTube platform selection
- Single-post, 7-day, 15-day, 30-day and campaign templates
- Automatic Brand Profile memory loading
- Platform-specific requirements that prohibit identical cross-platform captions
- Versioned, import-ready JSON response structure
- Copy Prompt and Export `.txt`
- Native SQLite prompt history and copy tracking
- Browser-preview prompt history isolated in `localStorage`
- Loading, validation, empty, success and error states

## Important files

### Created

```text
src-tauri/migrations/003_ai_workspace.sql
src-tauri/src/ai_workspace.rs
src/types/aiWorkspace.ts
src/ai/base.ts
src/ai/manualProvider.ts
src/ai/promptBuilder.ts
src/ai/promptBuilder.test.ts
src/services/aiWorkspace.ts
src/pages/AiWorkspacePage.tsx
src/pages/AiWorkspacePage.test.tsx
docs/PHASE_3_AI_WORKSPACE.md
```

### Updated

```text
src-tauri/src/database.rs
src-tauri/src/clients.rs
src-tauri/src/lib.rs
src/App.tsx
src/styles/global.css
README.md
docs/ARCHITECTURE.md
docs/DATABASE.md
```

## Run the browser preview

```bash
cd "/Users/neevmithaiwala/Documents/ChatGPT/AI-powered Marketing"
npm install
npm run dev
```

Open:

```text
http://localhost:1420/ai-workspace
```

Preview clients and prompt history remain in browser storage. They never modify the native database.

## Run the native app

```bash
cd "/Users/neevmithaiwala/Documents/ChatGPT/AI-powered Marketing"
source "$HOME/.cargo/env"
npm run desktop:dev
```

Native prompt history persists in:

```text
~/Library/Application Support/com.socialflow.localos/socialflow.sqlite
```

## Manual test

1. Create a client and Brand Profile if the native Clients page is empty.
2. Open **AI Workspace**.
3. Select the client and confirm the Brand Profile summary appears.
4. Choose a prompt template.
5. Enter the goal and topic.
6. Select at least two platforms.
7. Confirm tone, post count and date range.
8. Click **Generate ChatGPT Prompt**.
9. Verify the preview includes the brand voice, audience, CTA, keywords and avoided topics.
10. Verify each selected platform has different requirements.
11. Click **Copy Prompt** and paste it into ChatGPT.
12. Ask ChatGPT to follow the prompt and return only the JSON object.
13. Restart the native app and confirm the prompt remains in Local History.

## Automated verification

```bash
cd "/Users/neevmithaiwala/Documents/ChatGPT/AI-powered Marketing"
npm test
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
npm run desktop:build
```

Phase 3 completion baseline:

```text
Frontend: 4 test files, 12 tests passed
Rust:     3 tests passed
TypeScript/Vite production build: passed
Rust formatter and strict Clippy: passed
Browser interaction and console QA: passed
macOS application build and signature: passed
```

## Common errors

- **No clients appear:** create an active client first. Archived and paused clients are not offered for new prompts.
- **No campaigns appear:** campaign management is a later phase; campaign selection is optional and already supports future campaign records.
- **Generate reports a missing field:** client, goal, topic, tone and at least one platform are required.
- **End date error:** choose an end date on or after the start date.
- **Clipboard access is unavailable:** click Export and use the generated local text file.
- **Prompt appears in the browser but not desktop history:** browser preview and native SQLite are intentionally isolated.
- **Migration 003 is missing:** quit older app processes and launch the current native build. Never manually modify the live database.

## Honest phase boundary

Phase 3 generates and stores prompts only. It does not pretend to send requests to ChatGPT. Parsing, validating, previewing and saving ChatGPT results as Draft posts belongs to Phase 4 and is not claimed as complete here.
