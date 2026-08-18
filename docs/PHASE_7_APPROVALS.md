# Phase 7 — Human Approval

The Approval Queue reads only `needs_review` posts. Approval moves a post to `approved`; rejection requires a reason and returns it as `rejected`. Every decision is timestamped in `approvals` and mirrored to the local activity log. Regeneration creates a manual ChatGPT prompt and never calls an AI API. Unapproved content cannot enter scheduling.
