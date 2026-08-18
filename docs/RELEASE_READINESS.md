# Review and approve the four remaining phases

Open **Release Readiness** in SocialFlow OS 0.3.0. The screen runs its checks against the current desktop bundle and the real local SQLite database.

## Phase 12 — Official social connections

The phase becomes complete when Instagram, Facebook, LinkedIn and YouTube each have an officially connected account and their **Validate** action succeeds. Mock accounts do not count.

## Phase 35 — Live scheduler and publishing tests

For each platform:

1. Create or import platform-specific content.
2. Review the CTA and approved media.
3. Approve the post as a human.
4. Schedule it to the officially connected account.
5. Confirm a successful real external post ID in **Publishing Queue**.
6. Use **Fetch Connected Analytics**.

The audit also checks that no schedule has more than one successful publishing log.

## Phase 37 — Production macOS distribution

The local ad-hoc signature is sufficient for this Mac, but it does not complete Phase 37. Completion requires:

- an Apple **Developer ID Application** signature;
- successful Apple notarization;
- a stapled notarization ticket accepted by `spctl`.

The prepared command is `npm run desktop:notarize`. It will stop safely until the owner supplies `APPLE_SIGN_IDENTITY` and `APPLE_NOTARY_PROFILE`.

## Phase 40 — Final product audit

This phase requires SQLite integrity plus completion of the three external phases above. Use **Export JSON** to save the exact evidence locally and **Copy checklist** to share it for review.

The application never treats a Mock publish, ad-hoc signature or unverified account as external completion.
