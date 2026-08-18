# Phase 8 — Content Calendar

Month, week and day views read persisted SQLite schedules. Only human-approved posts appear in the scheduling picker. Scheduling creates one local job per platform version, rescheduling updates every pending version, and unscheduling returns the post to Approved. Calendar cards support drag-to-day rescheduling and client/platform/status filters.

The scheduler creates a mock social account boundary for each platform so the complete local workflow can be tested before official platform authorization.
