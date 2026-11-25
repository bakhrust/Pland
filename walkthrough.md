# Security Summary

**Reviewed Files**: 22
**Issues Resolved**: 4

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Preview Auth Bypass | `src/App.tsx` | 106 | The `?autostart=1` query parameter skipped the Google sign-in screen in any environment, including shared or production URLs. | High | Fixed | Restricted `?autostart=1` exclusively to local Vite development (`import.meta.env.DEV` on `localhost`/`127.0.0.1`); production and remote hosts always enforce sign-in. |
| Unscoped Local Storage | `src/App.tsx`, `src/services/firestoreWorkspace.ts` | 190 | Boards, tasks, and calendar preferences were stored in shared browser `localStorage` without user isolation or server-side access enforcement. | High | Fixed | Migrated workspace boards, cards, and user preferences to Firebase Firestore under `/users/{userId}` protected by verified-email, per-UID security rules (`firestore.rules`), and cleared legacy `localStorage` keys after migration/logout. |
| Unvalidated External Links | `src/components/EventDetailModal.tsx`, `src/utils/urlSafety.ts` | 77 | External Google Meet and Calendar event links (`hangoutLink`, `htmlLink`) were bound directly to `<a href>` without checking the URL scheme. | Medium | Fixed | Added `safeExternalUrl()` enforcing `https:` protocol validation before rendering any external link. |
| Browser Security Headers | `index.html` | 6 | Missing `X-Content-Type-Options` and `Referrer-Policy` meta directives for the HTML entry point. | Low | Fixed | Added `nosniff` and `strict-origin-when-cross-origin` meta directives. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| OAuth Token Storage | `src/services/firebaseAuth.ts` | Google Calendar OAuth access tokens remain strictly in-memory (`cachedAccessToken`) and are never written to `localStorage`, `sessionStorage`, or cookies; cleared on sign-out and `401` errors. |
| Firestore Access & Schema Validation | `firestore.rules`, `firebase-blueprint.json` | Global default-deny rule; requires verified Google sign-in (`email_verified == true`), strict `request.auth.uid == userId` ownership, parent-board existence checks (`exists()`), immutable `ownerUid`/`createdAt`, server `request.time` timestamps, bounded arrays/strings, and strict field allowlists (`hasOnly` / `affectedKeys().hasOnly`). |
| Calendar Mutation Confirmation | `src/App.tsx`, `src/components/ConfirmActionModal.tsx` | All Google Calendar create, update, delete, and batch-sync writes require explicit user confirmation in a modal dialog. |
| React Rendering & Error Isolation | `src/main.tsx`, `src/components/ErrorBoundary.tsx` | All text renders via safe React bindings (no `dangerouslySetInnerHTML`), and structured Firestore errors are caught cleanly by `ErrorBoundary`. |
| Dependency Audit | `package.json`, `bun.lock` | Ran `bun audit`: `firebase@13.4.0` is the latest release; the flagged `@grpc/grpc-js@1.9.16` transitive dependency belongs to Node.js gRPC transport and is not bundled into the browser Vite build. |

---

## PoC Verification

### 1. Remote Auth-Gate Bypass via `?autostart=1`

#### Summary
| Field | Value |
|---|---|
| Issue Type | Environment-Unbounded Auth Bypass |
| Impact | High |
| Affected File | `src/App.tsx:106-111` |
| Test Scenario | Opening the production/remote URL with `/?autostart=1` appended. |

#### How It Was Fixed
`isAutostart` now evaluates `import.meta.env.DEV` and verifies that `window.location.hostname` is `localhost` or `127.0.0.1` before honoring `autostart=1`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | User visits `https://ais-pre-...run.app/?autostart=1` | `isAutostart` runs at `src/App.tsx:106` |
| 2 | Hostname is not `localhost`/`127.0.0.1` (and in production `import.meta.env.DEV` is `false`) | `isAutostart` evaluates to `false` |
| 3 | Render check at `src/App.tsx:1003` checks `!googleUser && !isAutostart` | **`AuthGateScreen` blocks access** |

#### Conclusion
**Fix Verified** - Remote and production deployments cannot be bypassed via URL query parameters.

### 2. Cross-User Access & Schema Tampering in Firestore

#### Summary
| Field | Value |
|---|---|
| Issue Type | Missing Server-Side Data Isolation & Input Bounds |
| Impact | High |
| Affected File | `firestore.rules:42-255`, `src/services/firestoreWorkspace.ts:110-165` |
| Test Scenario | User B (`u2`) attempting to read/write `/users/u1/boards/b1` or inject an extra field `isAdmin: true` / oversized `title`. |

#### How It Was Fixed
Deployed hardened Firestore rules requiring `request.auth != null && request.auth.token.email_verified == true`, matching `request.auth.uid == userId`, strict field allowlists (`hasOnly`), bounded sizes, and server timestamps.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Unauthenticated or cross-user request reaches `/users/u1/boards/b1` | Evaluated by `isOwner(userId)` in `firestore.rules:16` |
| 2 | `request.auth.uid == userId` fails for `u2`, and `hasOnly` rejects ghost keys / oversized fields | Rule evaluates to `false` |
| 3 | Firestore rejects the read/write | **Denied (`PERMISSION_DENIED`)** |

#### Conclusion
**Fix Verified** - User boards and tasks are strictly isolated per verified Google account and validated server-side.

### 3. `javascript:` Link Injection in Calendar Event Modal

#### Summary
| Field | Value |
|---|---|
| Issue Type | Unsafe External URL Scheme |
| Impact | Medium |
| Affected File | `src/utils/urlSafety.ts:1-14`, `src/components/EventDetailModal.tsx:22-23` |
| Test Scenario | Event payload containing `hangoutLink: "javascript:alert(1)"` or `htmlLink: "data:text/html,<script>alert(1)</script>"`. |

#### How It Was Fixed
Added `safeExternalUrl()` which parses the URL and accepts only `https:` links before passing to `<a href>`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Untrusted `hangoutLink` enters `EventDetailModal` | Passed to `safeExternalUrl()` at `src/components/EventDetailModal.tsx:22` |
| 2 | `new URL(trimmed).protocol === 'https:'` returns `false` for `javascript:` / `data:` | `safeExternalUrl` returns `null` |
| 3 | Conditional render `{safeHangoutUrl && ...}` skips rendering | **Handled Safely (link omitted)** |

#### Conclusion
**Fix Verified** - Non-HTTPS and script-scheme URLs cannot be rendered in the UI.
