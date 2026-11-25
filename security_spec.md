# Security Specification (PLAND Firestore Rules TDD)

## 1. Data Invariants
1. Every document under `/users/{userId}` (including `/boards/{boardId}` and `/cards/{cardId}`) belongs exclusively to a single verified Google account (`request.auth.uid == userId && request.auth.token.email_verified == true`).
2. A `CardDoc` cannot exist without an existing parent `BoardDoc` at `/users/{userId}/boards/{boardId}` owned by the same `userId`.
3. Path IDs (`userId`, `boardId`, `cardId`) must match `^[a-zA-Z0-9_\-]+$` and be at most 128 characters.
4. `ownerUid`, `id`, `boardId`, and `createdAt` are immutable after document creation.
5. `createdAt` on create and `updatedAt` on create/update must equal `request.time`.
6. No client write may include arbitrary extra/ghost fields (`hasOnly` on create, `affectedKeys().hasOnly(...)` on update).
7. Unbounded arrays or oversized strings are rejected (`labels <= 30`, `lists <= 30`, `labelIds <= 20`, `checklist <= 50`, `title <= 200`, `description <= 5000`).

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated read/write**: `request.auth == null` reading `/users/u1/boards/b1`.
2. **Unverified email spoofing**: `request.auth.uid == 'u1'` with `email_verified == false`.
3. **Cross-user access (IDOR)**: `request.auth.uid == 'u2'` reading or writing `/users/u1/boards/b1`.
4. **Identity spoofing on create**: `ownerUid: 'u2'` when `request.auth.uid == 'u1'`.
5. **Ghost / shadow field injection**: `{ ...validBoard, isAdmin: true }` on create or update.
6. **ID poisoning**: Document path `/users/u1/boards/../../etc` or 200-char ID.
7. **Orphaned card create**: Creating `/users/u1/boards/nonexistent/cards/c1` where parent board does not exist.
8. **Immutable field tampering**: Updating `ownerUid` or `createdAt` on an existing `BoardDoc` or `CardDoc`.
9. **Client timestamp forgery**: Setting `createdAt` or `updatedAt` to a past/future client timestamp instead of `request.time`.
10. **Oversized string DoS (Denial of Wallet)**: Card `title` with 500 chars or `description` with 20,000 chars.
11. **Array overflow & type poisoning**: `checklist` with > 50 entries or `labelIds: [123]` (non-string element).
12. **Blanket collection enumeration**: Attempting `list` on `/users` or `/users/u2/boards` as `u1`.
