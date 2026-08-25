# ADR 0001 — UI locale selection

Date: 2026-08-24 (JST)

## Status

Accepted for the English-first catalog. Later locales add a catalog; they do not change this selection rule unless a later ADR replaces it.

## Context

The shipped UI was Japanese-only. `default_locale` / `_locales` had been added once and removed as YAGNI (`docs/evidence/t1-manifest.md`). Real installs are not Japan-only. There is no options page, onboarding flow, or context menu. User-visible strings live in the popup, injected page controls, toasts, error badges, and the manifest name / description.

## Decision

1. **Shipped catalogs**: `en` (default) and `ja`.
2. **Selection source**: Chrome UI language via `chrome.i18n.getUILanguage()` when the extension API exists; otherwise `navigator.language`.
3. **Matching**: `ja` and `ja-*` (including `ja_JP`) select Japanese. Any other tag, including empty or missing, selects English.
4. **Manifest**: `default_locale` is `en`. Name, description, and toolbar title use `__MSG_*__` so Chrome can show the matching catalog on `chrome://extensions` and the Web Store.
5. **Runtime**: `src/i18n.js` (`CB_I18N`) is the lookup used by popup and content scripts. This repo has no build step, so the full UI catalog lives in that file. `_locales/*/messages.json` holds the three manifest keys and must stay identical to `CB_I18N.MESSAGES`.
6. **Later locales**: add `_locales/<locale>/` and a `CB_I18N.MESSAGES` catalog. Until a catalog ships, unmatched languages stay on English.
7. **Out of scope**: no Featured / marquee / wide listing treatment; no install-count or user-number claims; no live Chrome Web Store scrape or submit from agents.

## Consequences

- Japanese UI remains for `ja*` browsers.
- English is the fallback and the manifest default.
- Tests pin `selectLocale` and require every Japanese key to have a non-empty English string.
- Popup `lang` follows the selected catalog. Dates in the popup use `ja-JP` or `en`.
