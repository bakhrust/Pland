import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { clampText, isValidEntityId, safeExternalUrl } from './src/utils/urlSafety';
import { CostGuardError, createCostGuard, isCostGuardError } from './src/utils/costGuard';

const rulesContent = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');

test('firestore.rules includes all Eight Pillars and Denial-of-Wallet guards', () => {
  // Pillar 1 & 4: Default deny + verified email + owner allowlist + owner UID gate
  assert.match(rulesContent, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/);
  assert.match(rulesContent, /request\.auth\.token\.email_verified == true/);
  assert.match(rulesContent, /request\.auth\.token\.email == 'bakhrust@gmail\.com'/);
  assert.match(rulesContent, /request\.auth\.uid == userId/);

  // Pillar 2 & 3: Validation helpers + ID regex hardening + financeRates key allowlist
  assert.match(rulesContent, /function isValidId\(id\)/);
  assert.match(rulesContent, /data\.financeRates\.keys\(\)\.hasOnly\(/);
  assert.match(rulesContent, /function isValidUserProfile\(/);
  assert.match(rulesContent, /function isValidBoardDoc\(/);
  assert.match(rulesContent, /function isValidCardDoc\(/);
  assert.match(rulesContent, /function isValidHabitDoc\(/);
  assert.match(rulesContent, /match \/habits\/\{habitId\}/);
  assert.match(rulesContent, /function isValidNoteBlock\(/);
  assert.match(rulesContent, /function isValidNoteFolderDoc\(/);
  assert.match(rulesContent, /function isValidNoteDoc\(/);
  assert.match(rulesContent, /match \/noteFolders\/\{folderId\}/);
  assert.match(rulesContent, /match \/notes\/\{noteId\}/);
  assert.match(rulesContent, /function isValidFinanceAccountDoc\(/);
  assert.match(rulesContent, /function isValidFinanceCategoryDoc\(/);
  assert.match(rulesContent, /function isValidFinanceTransactionDoc\(/);
  assert.match(rulesContent, /function isValidFinanceGoalDoc\(/);
  assert.match(rulesContent, /match \/financeAccounts\/\{accountId\}/);
  assert.match(rulesContent, /match \/financeCategories\/\{categoryId\}/);
  assert.match(rulesContent, /match \/financeTransactions\/\{transactionId\}/);
  assert.match(rulesContent, /match \/financeGoals\/\{goalId\}/);
  assert.match(rulesContent, /function isValidFinanceCurrency\(/);
  assert.match(rulesContent, /affectedKeys\(\)\.hasOnly\(\['financeCurrency', 'updatedAt'\]\)/);
  assert.match(rulesContent, /affectedKeys\(\)\.hasOnly\(\['financeRates', 'updatedAt'\]\)/);
  assert.match(rulesContent, /isValidFinanceCurrency\(data\.currency\)/);
  assert.match(rulesContent, /'toAmount' in data/);

  // Pillar 5 & 8: Bounded arrays + non-blanket list rules
  assert.match(rulesContent, /allow list: if false;/);
  assert.match(rulesContent, /existing\(\)\.ownerUid == request\.auth\.uid/);
  assert.match(rulesContent, /data\.checklist\.size\(\) <= 50/);
  assert.match(rulesContent, /data\.completions\.size\(\) <= 730/);
  assert.match(rulesContent, /data\.blocks\.size\(\) <= 200/);
  assert.match(rulesContent, /data\.amount > 0 && data\.amount <= 1000000000/);

  // Master gate & temporal integrity
  assert.match(rulesContent, /exists\(\/databases\/\$\(database\)\/documents\/users\/\$\(userId\)\/boards\/\$\(boardId\)\)/);
  assert.match(rulesContent, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rulesContent, /incoming\(\)\.updatedAt == request\.time/);
  assert.match(rulesContent, /incoming\(\)\.ownerUid == existing\(\)\.ownerUid/);
});

test('safeExternalUrl rejects javascript:, data:, http:, and malformed URLs', () => {
  assert.equal(safeExternalUrl('https://meet.google.com/abc-defg-hij'), 'https://meet.google.com/abc-defg-hij');
  assert.equal(safeExternalUrl('https://www.google.com/calendar/event?eid=123'), 'https://www.google.com/calendar/event?eid=123');
  assert.equal(safeExternalUrl('javascript:alert(1)'), null);
  assert.equal(safeExternalUrl('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(safeExternalUrl('http://insecure.example.com'), null);
  assert.equal(safeExternalUrl(''), null);
  assert.equal(safeExternalUrl(null), null);
});

test('isValidEntityId and clampText enforce Firestore blueprint bounds', () => {
  assert.equal(isValidEntityId('board-work_1'), true);
  assert.equal(isValidEntityId('../escape'), false);
  assert.equal(isValidEntityId('a'.repeat(129)), false);
  assert.equal(clampText('abcde', 3), 'abc');
});

test('costGuard trips circuit breaker on burst loops and recovers after cooldown', () => {
  let fakeNow = 100_000;
  const guard = createCostGuard(
    {
      'firestore:read': { rules: [{ windowMs: 10_000, maxRequests: 3 }], cooldownMs: 5_000 },
      'firestore:write': { rules: [{ windowMs: 10_000, maxRequests: 2 }], cooldownMs: 4_000 },
      'gcal:api': { rules: [{ windowMs: 10_000, maxRequests: 2 }], cooldownMs: 4_000 },
    },
    () => fakeNow
  );

  // Writes allowed up to maxRequests (2), third trips circuit breaker
  guard.consume('firestore:write');
  guard.consume('firestore:write');
  assert.throws(
    () => guard.consume('firestore:write'),
    (err: unknown) => err instanceof CostGuardError && isCostGuardError(err) && err.scope === 'firestore:write'
  );

  // Reads are isolated and still work
  guard.consume('firestore:read');

  // Cooldown blocks writes until cooldownMs passes
  fakeNow += 2_000;
  assert.throws(() => guard.consume('firestore:write'), CostGuardError);

  // After window + cooldown expire, writes work again
  fakeNow += 10_000;
  guard.consume('firestore:write');
});

