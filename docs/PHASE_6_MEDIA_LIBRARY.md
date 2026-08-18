# Phase 6 — Local Media Library

Assets are uploaded into the macOS application-data directory and indexed in SQLite. The page supports preview, search, client/type filters, tags, platform tags, rename and safe delete. Attached media cannot be deleted. The Image Prompt Generator copies a structured prompt for ChatGPT; it does not use an image API.

Run `npm run desktop:dev`, open **Media Library**, upload an image, rename it, filter it and delete it. Restart the app to verify persistence.
