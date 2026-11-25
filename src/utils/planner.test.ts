import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeTimelineSpan,
  getMonthGridDays,
  getWeekDays,
  layoutDayTimeBlocks,
  parseFlexibleDate,
  toLocalDateKey,
} from './dateUtils';
import {
  addBoardToWorkspace,
  adjustCardDurationMinutes,
  buildGoogleEventPayload,
  deleteBoardFromWorkspace,
  filterCards,
  getCardsPendingGoogleSync,
  moveCardInBoard,
  renameBoardInWorkspace,
  scheduleCardAtSlot,
  shiftCardDatesByDays,
} from './boardLogic';
import { createInitialNoteFolders, createInitialNotes, createInitialWorkspaceData } from '../data/seedData';
import type { CardItem, HabitItem, NoteBlock } from '../types/planner';
import {
  adjustHabitDayCount,
  computeHabitStats,
  getHabitsSummaryForDay,
  isHabitDoneOnDay,
  toggleOrIncrementHabitDay,
} from './habitLogic';
import {
  buildNotesZipBlob,
  computeNumberedListIndices,
  createNoteBlock,
  createNotePage,
  detectMarkdownBlockShortcut,
  extractWikiLinks,
  filterNotesByQuery,
  getChecklistStats,
  getDescendantFolderIds,
  insertBlockAfter,
  moveBlockByOffset,
  noteToMarkdown,
  removeFolderAndPromoteChildren,
  resolveNoteLinks,
  sanitizeMarkdownFilename,
} from './notesLogic';

const makeCard = (overrides: Partial<CardItem> = {}): CardItem => ({
  id: 'c1',
  listId: 'l1',
  order: 0,
  title: 'Тестовая задача',
  description: '',
  labelIds: [],
  memberIds: [],
  checklist: [],
  startDate: null,
  endDate: null,
  dueDate: null,
  ...overrides,
});

test('getWeekDays returns 7 days starting on Monday', () => {
  // Wednesday 2026-11-25
  const wed = parseFlexibleDate('2026-11-25');
  const days = getWeekDays(wed);
  assert.equal(days.length, 7);
  assert.equal(toLocalDateKey(days[0]), '2026-11-23'); // Mon
  assert.equal(toLocalDateKey(days[6]), '2026-11-29'); // Sun
});

test('getMonthGridDays covers full Monday-Sunday weeks for November 2026', () => {
  const days = getMonthGridDays(parseFlexibleDate('2026-11-15'));
  assert.equal(days.length % 7, 0);
  assert.equal(days[0].getDay(), 1); // Monday
  assert.equal(days[days.length - 1].getDay(), 0); // Sunday
  assert.equal(toLocalDateKey(days[0]), '2026-10-26');
});

test('layoutDayTimeBlocks places overlapping blocks in separate columns', () => {
  const blocks = layoutDayTimeBlocks([
    { item: 'a', start: '2026-11-24T10:00', end: '2026-11-24T12:00' },
    { item: 'b', start: '2026-11-24T11:00', end: '2026-11-24T13:00' },
    { item: 'c', start: '2026-11-24T14:00', end: '2026-11-24T15:00' },
  ]);

  assert.equal(blocks.length, 3);
  const blockA = blocks.find((b) => b.item === 'a')!;
  const blockB = blocks.find((b) => b.item === 'b')!;
  const blockC = blocks.find((b) => b.item === 'c')!;

  assert.equal(blockA.totalColumns, 2);
  assert.equal(blockB.totalColumns, 2);
  assert.notEqual(blockA.column, blockB.column);
  assert.equal(blockC.totalColumns, 1);
  assert.equal(blockC.column, 0);
});

test('computeTimelineSpan calculates multi-day span and clipping correctly', () => {
  const days = getWeekDays(parseFlexibleDate('2026-11-24')); // Nov 23..Nov 29
  const span = computeTimelineSpan('2026-11-24', '2026-11-26', days);
  assert.deepEqual(span, {
    startIndex: 1, // Tue Nov 24
    spanDays: 3,   // 24, 25, 26
    clippedLeft: false,
    clippedRight: false,
  });

  const clipped = computeTimelineSpan('2026-11-20', '2026-11-25', days);
  assert.deepEqual(clipped, {
    startIndex: 0,
    spanDays: 3, // 23, 24, 25
    clippedLeft: true,
    clippedRight: false,
  });

  const outside = computeTimelineSpan('2026-12-05', '2026-12-06', days);
  assert.equal(outside, null);
});

test('moveCardInBoard moves across lists and reindexes order', () => {
  const cards: CardItem[] = [
    makeCard({ id: 'c1', listId: 'l1', order: 0 }),
    makeCard({ id: 'c2', listId: 'l1', order: 1 }),
    makeCard({ id: 'c3', listId: 'l2', order: 0 }),
  ];

  const updated = moveCardInBoard(cards, 'c1', 'l2', 0);
  const l1 = updated.filter((c) => c.listId === 'l1').sort((a, b) => a.order - b.order);
  const l2 = updated.filter((c) => c.listId === 'l2').sort((a, b) => a.order - b.order);

  assert.deepEqual(l1.map((c) => c.id), ['c2']);
  assert.equal(l1[0].order, 0);
  assert.deepEqual(l2.map((c) => c.id), ['c1', 'c3']);
  assert.equal(l2[0].order, 0);
  assert.equal(l2[1].order, 1);
});

test('scheduleCardAtSlot and shiftCardDatesByDays update ISO timestamps accurately', () => {
  const card = makeCard();
  const scheduled = scheduleCardAtSlot(card, '2026-11-24', 10, 90);
  assert.equal(scheduled.startDate, '2026-11-24T10:00');
  assert.equal(scheduled.endDate, '2026-11-24T11:30');
  assert.equal(scheduled.allDay, false);

  const shifted = shiftCardDatesByDays(scheduled, 2);
  assert.equal(shifted.startDate, '2026-11-26T10:00');
  assert.equal(shifted.endDate, '2026-11-26T11:30');
});

test('filterCards filters by search query and labelId', () => {
  const cards: CardItem[] = [
    makeCard({ id: 'c1', title: 'Дизайн доски', labelIds: ['lbl-design'] }),
    makeCard({ id: 'c2', title: 'Интеграция API', labelIds: ['lbl-dev'] }),
  ];

  assert.equal(filterCards(cards, { search: 'дизайн', labelId: 'all' }).length, 1);
  assert.equal(filterCards(cards, { search: '', labelId: 'lbl-dev' })[0].id, 'c2');
  assert.equal(filterCards(cards, { search: 'api', labelId: 'lbl-design' }).length, 0);
});

test('buildGoogleEventPayload builds timed and all-day Google Calendar payloads', () => {
  const timed = makeCard({
    title: 'Созвон по спринту',
    description: 'Обсудить релиз',
    startDate: '2026-11-24T14:00',
    endDate: '2026-11-24T15:00',
    allDay: false,
  });
  const timedPayload = buildGoogleEventPayload(timed, 'В работе');
  assert.equal(timedPayload.summary, 'Созвон по спринту');
  assert.ok('dateTime' in timedPayload.start);
  assert.ok(timedPayload.description.includes('Колонка доски: В работе'));

  const allDay = makeCard({
    title: 'Релиз v1.0',
    startDate: '2026-11-24',
    endDate: '2026-11-25',
    allDay: true,
  });
  const allDayPayload = buildGoogleEventPayload(allDay);
  assert.deepEqual(allDayPayload.start, { date: '2026-11-24' });
  assert.deepEqual(allDayPayload.end, { date: '2026-11-26' }); // exclusive end date
});

test('scheduleCardAtSlot preserves existing duration and adjustCardDurationMinutes clamps >= 30m', () => {
  const initial = scheduleCardAtSlot(makeCard(), '2026-11-24', 10, 90);
  const moved = scheduleCardAtSlot(initial, '2026-11-25', 14);
  assert.equal(moved.startDate, '2026-11-25T14:00');
  assert.equal(moved.endDate, '2026-11-25T15:30');
  assert.equal(moved.syncDirty, true);

  const extended = adjustCardDurationMinutes(moved, 30);
  assert.equal(extended.endDate, '2026-11-25T16:00');

  const shrunkMin = adjustCardDurationMinutes(scheduleCardAtSlot(makeCard(), '2026-11-24', 9, 30), -30);
  assert.equal(shrunkMin.endDate, '2026-11-24T09:30');
});

test('getCardsPendingGoogleSync returns scheduled cards without googleEventId or marked dirty', () => {
  const cards: CardItem[] = [
    makeCard({ id: 'unscheduled', startDate: null }),
    makeCard({ id: 'new-timed', startDate: '2026-11-24T10:00', endDate: '2026-11-24T11:00' }),
    makeCard({
      id: 'synced-clean',
      startDate: '2026-11-24T12:00',
      endDate: '2026-11-24T13:00',
      googleEventId: 'ev-1',
      syncDirty: false,
    }),
    makeCard({
      id: 'synced-dirty',
      startDate: '2026-11-24T15:00',
      endDate: '2026-11-24T16:00',
      googleEventId: 'ev-2',
      syncDirty: true,
    }),
  ];

  const pending = getCardsPendingGoogleSync(cards);
  assert.deepEqual(
    pending.map((c) => c.id),
    ['new-timed', 'synced-dirty']
  );
});

test('multi-board workspace supports creating, renaming, switching, and safe deletion', () => {
  const ws0 = createInitialWorkspaceData();
  assert.equal(ws0.boards.length, 2);
  assert.equal(ws0.activeBoardId, 'board-work');

  const ws1 = addBoardToWorkspace(ws0, 'Учёба', 'violet');
  assert.equal(ws1.boards.length, 3);
  const studyBoard = ws1.boards[2];
  assert.equal(studyBoard.title, 'Учёба');
  assert.equal(studyBoard.color, 'violet');
  assert.equal(ws1.activeBoardId, studyBoard.id);
  assert.equal(studyBoard.state.lists.length, 3);

  const ws2 = renameBoardInWorkspace(ws1, studyBoard.id, 'Курсы');
  assert.equal(ws2.boards[2].title, 'Курсы');

  const ws3 = deleteBoardFromWorkspace(ws2, studyBoard.id);
  assert.equal(ws3.boards.length, 2);
  assert.equal(ws3.activeBoardId, ws3.boards[0].id);

  // Deleting down to 1 board stops before removing the final board
  const ws4 = deleteBoardFromWorkspace(ws3, ws3.boards[1].id);
  assert.equal(ws4.boards.length, 1);
  const ws5 = deleteBoardFromWorkspace(ws4, ws4.boards[0].id);
  assert.equal(ws5.boards.length, 1);
});

test('habitLogic computes streaks, quantitative targets, and daily summary accurately', () => {
  const ref = parseFlexibleDate('2026-11-25'); // Wednesday (ISO weekday 3)
  let habit: HabitItem = {
    id: 'h1',
    title: 'Вода',
    color: 'blue',
    daysOfWeek: [1, 2, 3, 4, 5],
    targetCount: 3,
    unit: 'стак.',
    order: 0,
    completions: {
      '2026-11-23': 3, // Mon done
      '2026-11-24': 3, // Tue done
    },
  };

  // Before completing today (Wed), yesterday's active streak of 2 is preserved
  const beforeToday = computeHabitStats(habit, ref);
  assert.equal(beforeToday.currentStreak, 2);
  assert.equal(isHabitDoneOnDay(habit, '2026-11-25'), false);

  // Increment today up to targetCount=3
  habit = toggleOrIncrementHabitDay(habit, '2026-11-25');
  habit = adjustHabitDayCount(habit, '2026-11-25', 2);
  assert.equal(isHabitDoneOnDay(habit, '2026-11-25'), true);

  const afterToday = computeHabitStats(habit, ref);
  assert.equal(afterToday.currentStreak, 3);
  assert.equal(afterToday.bestStreak, 3);
  assert.equal(afterToday.last7Done, 3);

  const summary = getHabitsSummaryForDay([habit], '2026-11-25', ref);
  assert.equal(summary.scheduledToday, 1);
  assert.equal(summary.doneToday, 1);
  assert.equal(summary.todayPercent, 100);
  assert.equal(summary.topStreak, 3);
});

test('notesLogic computes numbered list indices, markdown shortcuts, and checklist stats', () => {
  const blocks: NoteBlock[] = [
    createNoteBlock('numbered', 'Первый', { id: 'b1' }),
    createNoteBlock('numbered', 'Второй', { id: 'b2' }),
    createNoteBlock('numbered', 'Подпункт', { id: 'b3', indent: 1 }),
    createNoteBlock('paragraph', 'Разделитель текста', { id: 'b4' }),
    createNoteBlock('numbered', 'Снова с единицы', { id: 'b5' }),
    createNoteBlock('todo', 'Задача 1', { id: 'b6', checked: true }),
    createNoteBlock('todo', 'Задача 2', { id: 'b7', checked: false }),
  ];

  const indices = computeNumberedListIndices(blocks);
  assert.equal(indices.get('b1'), 1);
  assert.equal(indices.get('b2'), 2);
  assert.equal(indices.get('b3'), 1);
  assert.equal(indices.get('b5'), 1);

  assert.deepEqual(detectMarkdownBlockShortcut('# Заголовок'), {
    type: 'heading1',
    content: 'Заголовок',
  });
  assert.deepEqual(detectMarkdownBlockShortcut('[] Купить кофе'), {
    type: 'todo',
    content: 'Купить кофе',
  });
  assert.deepEqual(detectMarkdownBlockShortcut('---'), {
    type: 'divider',
    content: '',
  });
  assert.equal(detectMarkdownBlockShortcut('Обычный текст'), null);

  assert.deepEqual(getChecklistStats(blocks), { total: 2, done: 1 });

  const afterInsert = insertBlockAfter(blocks, 'b1', createNoteBlock('bullet', 'Вставка', { id: 'b-ins' }));
  assert.equal(afterInsert[1].id, 'b-ins');

  const moved = moveBlockByOffset(afterInsert, 'b-ins', -1);
  assert.equal(moved[0].id, 'b-ins');
});

test('notesLogic filters notes across titles/folders/blocks and promotes children on folder deletion', () => {
  const folders = [
    ...createInitialNoteFolders(),
    { id: 'folder-sub', parentId: 'folder-projects', title: 'Спринты', color: 'blue' as const, order: 3 },
  ];
  const notes = createInitialNotes(1_700_000_000_000);

  assert.equal(folders.length, 4);
  assert.equal(notes.length, 3);

  const byBlockContent = filterNotesByQuery(notes, folders, 'фокуса');
  assert.equal(byBlockContent.length, 1);
  assert.equal(byBlockContent[0].id, 'note-reading');

  const byFolderName = filterNotesByQuery(notes, folders, 'Проекты');
  assert.equal(byFolderName.length, 1);
  assert.equal(byFolderName[0].id, 'note-roadmap');

  const descendants = getDescendantFolderIds(folders, 'folder-projects');
  assert.equal(descendants.has('folder-sub'), true);

  const promoted = removeFolderAndPromoteChildren(folders, notes, 'folder-projects');
  assert.equal(promoted.folders.some((f) => f.id === 'folder-projects'), false);
  assert.equal(promoted.folders.find((f) => f.id === 'folder-sub')?.parentId, null);
  assert.equal(promoted.notes.find((n) => n.id === 'note-roadmap')?.folderId, null);
});

test('notesLogic resolves wiki-links, deduplicates targets, and builds backlinks', () => {
  const n1 = createNotePage({
    title: 'Карта целей',
    blocks: [
      createNoteBlock('paragraph', 'Смотри [[План на неделю|План]] и [[карту целей]] (self).'),
      createNoteBlock('paragraph', 'Повторная ссылка [[План на неделю]] и [[Несуществующая]]'),
    ],
  });
  const n2 = createNotePage({
    title: 'План на неделю',
    blocks: [createNoteBlock('todo', 'Подвести итоги [[Карта целей]]', { checked: false })],
  });

  assert.deepEqual(extractWikiLinks(n1), ['План на неделю', 'карту целей', 'Несуществующая']);

  const { outgoingById, backlinksById, linkEdges } = resolveNoteLinks([n1, n2]);
  assert.deepEqual(outgoingById.get(n1.id)?.map((n) => n.id), [n2.id]);
  assert.deepEqual(backlinksById.get(n2.id)?.map((n) => n.id), [n1.id]);
  assert.deepEqual(backlinksById.get(n1.id)?.map((n) => n.id), [n2.id]);
  assert.equal(linkEdges.length, 2);
});

test('notesLogic exports Obsidian-compatible Markdown and valid ZIP archive', async () => {
  assert.equal(sanitizeMarkdownFilename('План: Q4 / 2026?*'), 'План Q4 2026.md');
  assert.equal(sanitizeMarkdownFilename('...'), 'note.md');

  const note = createNotePage({
    title: 'Конспект',
    pinned: true,
    blocks: [
      createNoteBlock('heading2', 'Идеи'),
      createNoteBlock('todo', 'Сделать экспорт', { checked: true }),
      createNoteBlock('todo', 'Проверить граф', { checked: false, indent: 1 }),
      createNoteBlock('callout', 'Важный фокус\nСтрока 2'),
      createNoteBlock('code', 'const x = 1;'),
      createNoteBlock('divider', ''),
      createNoteBlock('paragraph', 'Связь: [[Дорожная карта]]'),
    ],
  });

  const md = noteToMarkdown(note, 'Работа/Проекты');
  assert.ok(md.startsWith('---\ntitle: "Конспект"\nfolder: "Работа/Проекты"\npinned: true\n'));
  assert.ok(md.includes('## Идеи'));
  assert.ok(md.includes('- [x] Сделать экспорт'));
  assert.ok(md.includes('  - [ ] Проверить граф'));
  assert.ok(md.includes('> [!note]\n> Важный фокус\n> Строка 2'));
  assert.ok(md.includes('```\nconst x = 1;\n```'));
  assert.ok(md.includes('[[Дорожная карта]]'));

  const folders = createInitialNoteFolders();
  const seedNotes = createInitialNotes(1_700_000_000_000);
  // Duplicate title to verify disambiguation in ZIP
  const dupNote = createNotePage({
    title: seedNotes[0].title,
    folderId: seedNotes[0].folderId,
    blocks: [createNoteBlock('paragraph', 'Дубликат названия')],
  });

  const zipBlob = buildNotesZipBlob([...seedNotes, dupNote], folders);
  assert.ok(zipBlob.size > 200);
  const bytes = new Uint8Array(await zipBlob.arrayBuffer());
  // Local file header signature PK\x03\x04
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  assert.equal(bytes[2], 0x03);
  assert.equal(bytes[3], 0x04);
  // End of central directory signature PK\x05\x06 at bytes.length - 22
  const eocdOffset = bytes.length - 22;
  assert.equal(bytes[eocdOffset], 0x50);
  assert.equal(bytes[eocdOffset + 1], 0x4b);
  assert.equal(bytes[eocdOffset + 2], 0x05);
  assert.equal(bytes[eocdOffset + 3], 0x06);
});
