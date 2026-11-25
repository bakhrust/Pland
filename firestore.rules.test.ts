import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { clampText, isValidEntityId, safeExternalUrl } from './src/utils/urlSafety';

const rulesContent = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');

test('firestore.rules includes all Eight Pillars guards', () => {
  // Pillar 1 & 4: Default deny + verified email + owner gate
  assert.match(rulesContent, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/);
  assert.match(rulesContent, /request\.auth\.token\.email_verified == true/);
  assert.match(rulesContent, /request\.auth\.uid == userId/);

  // Pillar 2 & 3: Validation helpers + ID regex hardening
  assert.match(rulesContent, /function isValidId\(id\)/);
  assert.match(rulesContent, /function isValidUserProfile\(/);
  assert.match(rulesContent, /function isValidBoardDoc\(/);
  assert.match(rulesContent, /function isValidCardDoc\(/);
  assert.match(rulesContent, /function isValidHabitDoc\(/);
  assert.match(rulesContent, /match \/habits\/\{habitId\}/);

  // Pillar 5 & 8: Bounded arrays + non-blanket list rules
  assert.match(rulesContent, /allow list: if false;/);
  assert.match(rulesContent, /existing\(\)\.ownerUid == request\.auth\.uid/);
  assert.match(rulesContent, /data\.checklist\.size\(\) <= 50/);
  assert.match(rulesContent, /data\.completions\.size\(\) <= 730/);

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
