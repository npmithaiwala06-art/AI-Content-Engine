# Phase 5 — Content Creation Studio

## Built

- Local post library with search, client and status filters.
- New and imported draft editing.
- Independent Instagram, Facebook, Twitter and YouTube versions.
- Draft save, duplicate, preview, delete and human-review submission.
- Manual ChatGPT rewrite, hashtag and CTA prompts; no AI API is used.
- Published and actively publishing posts are protected from editing.

## Important files

- `src/pages/ContentStudioPage.tsx`
- `src/services/contentStudio.ts`
- `src/types/content.ts`
- `src-tauri/src/content_studio.rs`

## Run and test

```bash
npm run desktop:dev
npm test
cargo test --manifest-path src-tauri/Cargo.toml
```

Open **Create Content**, select a client, fill the title/topic and one platform version, then save. Duplicate it and send the original for approval. The submitted post must show **Needs Review** and cannot be deleted from the editor.
