import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  createInitialHabits,
  createInitialNoteFolders,
  createInitialNotes,
  createInitialWorkspaceData,
} from '../data/seedData';
import type {
  BoardList,
  BoardRecord,
  BoardState,
  CardItem,
  ChecklistItem,
  HabitItem,
  LabelColor,
  LabelDef,
  NoteBlock,
  NoteBlockType,
  NoteFolder,
  NotePage,
  WorkspaceData,
} from '../types/planner';
import { NOTE_BLOCK_TYPES } from '../utils/notesLogic';
import { clampText, isValidEntityId } from '../utils/urlSafety';
import { auth, db } from './firebaseClient';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const VALID_COLORS = new Set<LabelColor>(['blue', 'emerald', 'violet', 'amber', 'rose']);

function sanitizeColor(color: unknown, fallback: LabelColor = 'blue'): LabelColor {
  return typeof color === 'string' && VALID_COLORS.has(color as LabelColor)
    ? (color as LabelColor)
    : fallback;
}

function sanitizeId(raw: unknown, prefix: string, idx: number): string {
  if (isValidEntityId(raw)) return raw;
  return `${prefix}-${Date.now()}-${idx}`;
}

function sanitizeLabels(labels: LabelDef[]): LabelDef[] {
  return (Array.isArray(labels) ? labels : []).slice(0, 30).map((lbl, idx) => ({
    id: sanitizeId(lbl?.id, 'lbl', idx),
    name: clampText(lbl?.name ?? 'Метка', 60),
    color: sanitizeColor(lbl?.color, 'blue'),
  }));
}

function sanitizeLists(lists: BoardList[]): BoardList[] {
  const cleaned = (Array.isArray(lists) ? lists : []).slice(0, 30).map((lst, idx) => ({
    id: sanitizeId(lst?.id, 'list', idx),
    title: clampText(lst?.title?.trim() || `Колонка ${idx + 1}`, 80),
    order: typeof lst?.order === 'number' && lst.order >= 0 ? Math.min(100, lst.order) : idx,
  }));
  if (cleaned.length === 0) {
    cleaned.push({ id: 'list-backlog', title: 'Бэклог', order: 0 });
  }
  return cleaned;
}

function sanitizeChecklist(checklist: ChecklistItem[]): ChecklistItem[] {
  return (Array.isArray(checklist) ? checklist : []).slice(0, 50).map((item, idx) => ({
    id: sanitizeId(item?.id, 'chk', idx),
    text: clampText(item?.text ?? '', 200),
    done: Boolean(item?.done),
  }));
}

function buildBoardFields(board: BoardRecord, ownerUid: string, order: number) {
  return {
    id: sanitizeId(board.id, 'board', order),
    ownerUid,
    title: clampText(board.title.trim() || 'Доска', 120),
    color: sanitizeColor(board.color, 'blue'),
    order: Math.max(0, Math.min(1000, order)),
    labels: sanitizeLabels(board.state.labels),
    lists: sanitizeLists(board.state.lists),
  };
}

function buildCardMutableFields(card: CardItem, fallbackListId: string) {
  return {
    listId: sanitizeId(card.listId || fallbackListId, 'list', 0),
    order: typeof card.order === 'number' && card.order >= 0 ? Math.min(10000, card.order) : 0,
    title: clampText(card.title.trim() || 'Задача', 200),
    description: clampText(card.description ?? '', 5000),
    labelIds: (Array.isArray(card.labelIds) ? card.labelIds : [])
      .filter(isValidEntityId)
      .slice(0, 20),
    checklist: sanitizeChecklist(card.checklist),
    startDate: card.startDate ? clampText(card.startDate, 64) : null,
    endDate: card.endDate ? clampText(card.endDate, 64) : null,
    allDay: card.allDay ?? null,
    dueDate: card.dueDate ? clampText(card.dueDate, 64) : null,
    googleEventId: card.googleEventId ? clampText(card.googleEventId, 256) : null,
    googleCalendarId: card.googleCalendarId ? clampText(card.googleCalendarId, 256) : null,
    lastSyncedAt: card.lastSyncedAt ? clampText(card.lastSyncedAt, 64) : null,
    syncDirty: card.syncDirty ?? null,
  };
}

function sanitizeDaysOfWeek(days: unknown): number[] {
  const cleaned = Array.from(
    new Set(
      (Array.isArray(days) ? days : [])
        .map((d) => Math.round(Number(d)))
        .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7)
    )
  ).sort((a, b) => a - b);
  return cleaned.length > 0 ? cleaned : [1, 2, 3, 4, 5, 6, 7];
}

function sanitizeCompletions(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {};
  const entries = Object.entries(raw as Record<string, unknown>)
    .filter(([key, val]) => /^\d{4}-\d{2}-\d{2}$/.test(key) && typeof val === 'number' && val > 0)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 730);
  const result: Record<string, number> = {};
  for (const [key, val] of entries) {
    result[key] = Math.max(1, Math.min(1000, Math.round(Number(val))));
  }
  return result;
}

function buildHabitMutableFields(habit: HabitItem, order: number) {
  return {
    title: clampText(habit.title.trim() || 'Новая привычка', 120),
    color: sanitizeColor(habit.color, 'emerald'),
    daysOfWeek: sanitizeDaysOfWeek(habit.daysOfWeek),
    targetCount: Math.max(1, Math.min(100, Math.round(Number(habit.targetCount) || 1))),
    unit: clampText(habit.unit.trim() || 'раз', 24),
    order: Math.max(0, Math.min(1000, Math.round(order))),
    completions: sanitizeCompletions(habit.completions),
  };
}

function buildHabitFields(habit: HabitItem, ownerUid: string, order: number) {
  return {
    id: sanitizeId(habit.id, 'habit', order),
    ownerUid,
    ...buildHabitMutableFields(habit, order),
  };
}

const VALID_NOTE_BLOCK_TYPES = new Set<NoteBlockType>(NOTE_BLOCK_TYPES);

function sanitizeNoteBlockType(raw: unknown): NoteBlockType {
  return typeof raw === 'string' && VALID_NOTE_BLOCK_TYPES.has(raw as NoteBlockType)
    ? (raw as NoteBlockType)
    : 'paragraph';
}

function sanitizeNoteBlocks(raw: unknown): NoteBlock[] {
  return (Array.isArray(raw) ? raw : []).slice(0, 200).map((b, idx) => {
    const rec = b && typeof b === 'object' ? (b as Record<string, unknown>) : {};
    const type = sanitizeNoteBlockType(rec.type);
    const indentNum = Math.round(Number(rec.indent) || 0);
    return {
      id: sanitizeId(rec.id, 'blk', idx),
      type,
      content: type === 'divider' ? '' : clampText(String(rec.content ?? ''), 4000),
      checked: type === 'todo' ? Boolean(rec.checked) : false,
      indent: Math.max(0, Math.min(3, indentNum)),
    };
  });
}

function buildNoteFolderMutableFields(folder: NoteFolder, order: number) {
  const folderId = isValidEntityId(folder.id) ? folder.id : '';
  const parentId =
    folder.parentId && isValidEntityId(folder.parentId) && folder.parentId !== folderId
      ? folder.parentId
      : null;
  return {
    parentId,
    title: clampText(folder.title.trim() || 'Папка', 100),
    color: sanitizeColor(folder.color, 'blue'),
    order: Math.max(0, Math.min(1000, Math.round(order))),
  };
}

function buildNoteFolderFields(folder: NoteFolder, ownerUid: string, order: number) {
  return {
    id: sanitizeId(folder.id, 'folder', order),
    ownerUid,
    ...buildNoteFolderMutableFields(folder, order),
  };
}

function buildNoteMutableFields(note: NotePage, order: number) {
  const folderId = note.folderId && isValidEntityId(note.folderId) ? note.folderId : null;
  return {
    folderId,
    title: clampText(note.title.trim() || 'Без названия', 200),
    icon: clampText(note.icon || '📝', 16),
    pinned: Boolean(note.pinned),
    order: Math.max(0, Math.min(10000, Math.round(order))),
    blocks: sanitizeNoteBlocks(note.blocks),
    updatedAtMs:
      typeof note.updatedAtMs === 'number' && Number.isFinite(note.updatedAtMs) && note.updatedAtMs >= 0
        ? Math.round(note.updatedAtMs)
        : Date.now(),
  };
}

function buildNoteFields(note: NotePage, ownerUid: string, order: number) {
  return {
    id: sanitizeId(note.id, 'note', order),
    ownerUid,
    ...buildNoteMutableFields(note, order),
  };
}

const LEGACY_WORKSPACE_KEY = 'pland_workspace_v1';
const LEGACY_BOARD_KEY = 'pland_board_v1';
const LEGACY_GCAL_PREFS_KEY = 'pland_gcal_prefs_v1';

function readAndClearLegacyLocalData(): {
  workspace: WorkspaceData | null;
  visibleCalendarIds: string[];
  targetCalendarId: string;
} {
  let workspace: WorkspaceData | null = null;
  let visibleCalendarIds: string[] = [];
  let targetCalendarId = 'primary';

  try {
    const rawWs = localStorage.getItem(LEGACY_WORKSPACE_KEY);
    if (rawWs) {
      const parsed = JSON.parse(rawWs) as WorkspaceData;
      if (Array.isArray(parsed.boards) && parsed.boards.length > 0) {
        workspace = parsed;
      }
    } else {
      const rawBoard = localStorage.getItem(LEGACY_BOARD_KEY);
      if (rawBoard) {
        const legacyBoard = JSON.parse(rawBoard) as BoardState;
        if (Array.isArray(legacyBoard.lists) && Array.isArray(legacyBoard.cards)) {
          const initial = createInitialWorkspaceData(new Date());
          workspace = {
            activeBoardId: initial.boards[0].id,
            boards: [{ ...initial.boards[0], state: legacyBoard }, ...initial.boards.slice(1)],
          };
        }
      }
    }

    const rawPrefs = localStorage.getItem(LEGACY_GCAL_PREFS_KEY);
    if (rawPrefs) {
      const parsedPrefs = JSON.parse(rawPrefs);
      if (Array.isArray(parsedPrefs.visibleCalendarIds)) {
        visibleCalendarIds = parsedPrefs.visibleCalendarIds
          .filter((x: unknown) => typeof x === 'string')
          .slice(0, 30);
      }
      if (typeof parsedPrefs.targetCalendarId === 'string' && parsedPrefs.targetCalendarId.trim()) {
        targetCalendarId = clampText(parsedPrefs.targetCalendarId, 254);
      }
    }
  } catch {
    // ignore corrupted legacy data
  } finally {
    try {
      localStorage.removeItem(LEGACY_WORKSPACE_KEY);
      localStorage.removeItem(LEGACY_BOARD_KEY);
      localStorage.removeItem(LEGACY_GCAL_PREFS_KEY);
    } catch {
      // ignore storage cleanup errors
    }
  }

  return { workspace, visibleCalendarIds, targetCalendarId };
}

export async function loadOrInitializeUserWorkspace(user: User): Promise<{
  workspace: WorkspaceData;
  habits: HabitItem[];
  noteFolders: NoteFolder[];
  notes: NotePage[];
  visibleCalendarIds: string[];
  targetCalendarId: string;
  theme: 'light' | 'dark';
}> {
  const uid = user.uid;
  const userPath = `users/${uid}`;
  const boardsPath = `users/${uid}/boards`;

  let userSnap;
  try {
    userSnap = await getDoc(doc(db, 'users', uid));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, userPath);
  }

  let boardSnaps;
  try {
    boardSnaps = await getDocs(
      query(collection(db, 'users', uid, 'boards'), where('ownerUid', '==', uid))
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, boardsPath);
  }

  if (boardSnaps.empty) {
    const legacy = readAndClearLegacyLocalData();
    const seed = legacy.workspace ?? createInitialWorkspaceData(new Date());

    // 1. Create user profile and parent boards first (so card exists() master-gate passes)
    try {
      const setupBatch = writeBatch(db);
      const activeId = seed.boards.some((b) => b.id === seed.activeBoardId)
        ? seed.activeBoardId
        : seed.boards[0].id;

      setupBatch.set(doc(db, 'users', uid), {
        ownerUid: uid,
        email: clampText(user.email ?? '', 254),
        displayName: clampText(user.displayName ?? '', 120),
        activeBoardId: activeId,
        visibleCalendarIds: legacy.visibleCalendarIds,
        targetCalendarId: legacy.targetCalendarId || 'primary',
        theme: 'light',
        notesSeeded: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      seed.boards.forEach((b, idx) => {
        const boardFields = buildBoardFields(b, uid, idx);
        setupBatch.set(doc(db, 'users', uid, 'boards', boardFields.id), {
          ...boardFields,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      await setupBatch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, boardsPath);
    }

    // 2. Create cards after parent boards exist
    try {
      const cardBatch = writeBatch(db);
      let hasCards = false;
      seed.boards.forEach((b, idx) => {
        const boardId = sanitizeId(b.id, 'board', idx);
        const fallbackListId = b.state.lists[0]?.id ?? 'list-backlog';
        b.state.cards.forEach((c, cIdx) => {
          const cardId = sanitizeId(c.id, 'card', cIdx);
          cardBatch.set(doc(db, 'users', uid, 'boards', boardId, 'cards', cardId), {
            id: cardId,
            boardId,
            ownerUid: uid,
            ...buildCardMutableFields(c, fallbackListId),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          hasCards = true;
        });
      });
      if (hasCards) {
        await cardBatch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `${boardsPath}/*/cards`);
    }

    // 3. Seed starter habits for new user workspace
    const seedHabits = createInitialHabits(new Date());
    const habitsPath = `users/${uid}/habits`;
    try {
      const habitBatch = writeBatch(db);
      seedHabits.forEach((habit, idx) => {
        const fields = buildHabitFields(habit, uid, idx);
        habitBatch.set(doc(db, 'users', uid, 'habits', fields.id), {
          ...fields,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      await habitBatch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, habitsPath);
    }

    // 4. Seed starter note folders & notes for new user workspace
    const seedNoteFolders = createInitialNoteFolders();
    const seedNotes = createInitialNotes(Date.now());
    const foldersPath = `users/${uid}/noteFolders`;
    const notesPath = `users/${uid}/notes`;
    try {
      const notesBatch = writeBatch(db);
      seedNoteFolders.forEach((folder, idx) => {
        const fields = buildNoteFolderFields(folder, uid, idx);
        notesBatch.set(doc(db, 'users', uid, 'noteFolders', fields.id), {
          ...fields,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      seedNotes.forEach((note, idx) => {
        const fields = buildNoteFields(note, uid, idx);
        notesBatch.set(doc(db, 'users', uid, 'notes', fields.id), {
          ...fields,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      await notesBatch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `${foldersPath}|${notesPath}`);
    }

    return {
      workspace: seed,
      habits: seedHabits,
      noteFolders: seedNoteFolders,
      notes: seedNotes,
      visibleCalendarIds: legacy.visibleCalendarIds,
      targetCalendarId: legacy.targetCalendarId || 'primary',
      theme: 'light',
    };
  }

  // Load existing boards & cards
  const boardDocs = boardSnaps.docs
    .map((d) => d.data())
    .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));

  const boards: BoardRecord[] = await Promise.all(
    boardDocs.map(async (bData) => {
      const boardId = String(bData.id);
      const cardsPath = `users/${uid}/boards/${boardId}/cards`;
      let cardSnaps;
      try {
        cardSnaps = await getDocs(
          query(
            collection(db, 'users', uid, 'boards', boardId, 'cards'),
            where('ownerUid', '==', uid),
            where('boardId', '==', boardId)
          )
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, cardsPath);
      }

      const cards: CardItem[] = cardSnaps.docs
        .map((cDoc) => {
          const d = cDoc.data();
          return {
            id: String(d.id),
            listId: String(d.listId),
            order: Number(d.order ?? 0),
            title: String(d.title ?? ''),
            description: String(d.description ?? ''),
            labelIds: Array.isArray(d.labelIds) ? (d.labelIds as string[]) : [],
            checklist: Array.isArray(d.checklist) ? (d.checklist as ChecklistItem[]) : [],
            startDate: d.startDate ? String(d.startDate) : null,
            endDate: d.endDate ? String(d.endDate) : null,
            allDay: typeof d.allDay === 'boolean' ? d.allDay : undefined,
            dueDate: d.dueDate ? String(d.dueDate) : null,
            googleEventId: d.googleEventId ? String(d.googleEventId) : null,
            googleCalendarId: d.googleCalendarId ? String(d.googleCalendarId) : null,
            lastSyncedAt: d.lastSyncedAt ? String(d.lastSyncedAt) : null,
            syncDirty: typeof d.syncDirty === 'boolean' ? d.syncDirty : undefined,
          };
        })
        .sort((a, b) => a.order - b.order);

      return {
        id: boardId,
        title: String(bData.title ?? 'Доска'),
        color: sanitizeColor(bData.color, 'blue'),
        state: {
          labels: Array.isArray(bData.labels) ? (bData.labels as LabelDef[]) : [],
          lists: Array.isArray(bData.lists) ? (bData.lists as BoardList[]) : [],
          cards,
        },
      };
    })
  );

  // Load habits for existing user
  const habitsPath = `users/${uid}/habits`;
  let habitSnaps;
  try {
    habitSnaps = await getDocs(
      query(collection(db, 'users', uid, 'habits'), where('ownerUid', '==', uid))
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, habitsPath);
  }

  const habits: HabitItem[] = habitSnaps.docs
    .map((hDoc) => {
      const d = hDoc.data();
      return {
        id: String(d.id),
        title: String(d.title ?? 'Привычка'),
        color: sanitizeColor(d.color, 'emerald'),
        daysOfWeek: sanitizeDaysOfWeek(d.daysOfWeek),
        targetCount: Math.max(1, Math.min(100, Math.round(Number(d.targetCount) || 1))),
        unit: typeof d.unit === 'string' && d.unit.trim() ? d.unit : 'раз',
        order: Number(d.order ?? 0),
        completions: sanitizeCompletions(d.completions),
      };
    })
    .sort((a, b) => a.order - b.order);

  // Load note folders and notes for existing user
  const noteFoldersPath = `users/${uid}/noteFolders`;
  const notesPath = `users/${uid}/notes`;
  let noteFolderSnaps;
  try {
    noteFolderSnaps = await getDocs(
      query(collection(db, 'users', uid, 'noteFolders'), where('ownerUid', '==', uid))
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, noteFoldersPath);
  }

  let noteSnaps;
  try {
    noteSnaps = await getDocs(
      query(collection(db, 'users', uid, 'notes'), where('ownerUid', '==', uid))
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, notesPath);
  }

  // Clean up any leftover legacy localStorage from before cloud sync
  readAndClearLegacyLocalData();

  const userData = userSnap.exists() ? userSnap.data() : {};
  let noteFolders: NoteFolder[] = noteFolderSnaps.docs
    .map((fDoc) => {
      const d = fDoc.data();
      return {
        id: String(d.id),
        parentId: typeof d.parentId === 'string' && d.parentId ? d.parentId : null,
        title: String(d.title ?? 'Папка'),
        color: sanitizeColor(d.color, 'blue'),
        order: Number(d.order ?? 0),
      };
    })
    .sort((a, b) => a.order - b.order);

  let notes: NotePage[] = noteSnaps.docs
    .map((nDoc) => {
      const d = nDoc.data();
      return {
        id: String(d.id),
        folderId: typeof d.folderId === 'string' && d.folderId ? d.folderId : null,
        title: String(d.title ?? 'Без названия'),
        icon: typeof d.icon === 'string' && d.icon ? d.icon : '📝',
        pinned: Boolean(d.pinned),
        order: Number(d.order ?? 0),
        blocks: sanitizeNoteBlocks(d.blocks),
        updatedAtMs: typeof d.updatedAtMs === 'number' ? d.updatedAtMs : Date.now(),
      };
    })
    .sort((a, b) => a.order - b.order);

  if (userSnap.exists() && !userData.notesSeeded && noteFolders.length === 0 && notes.length === 0) {
    const seedFolders = createInitialNoteFolders();
    const seedNotes = createInitialNotes(Date.now());
    try {
      const seedBatch = writeBatch(db);
      seedFolders.forEach((folder, idx) => {
        const fields = buildNoteFolderFields(folder, uid, idx);
        seedBatch.set(doc(db, 'users', uid, 'noteFolders', fields.id), {
          ...fields,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      seedNotes.forEach((note, idx) => {
        const fields = buildNoteFields(note, uid, idx);
        seedBatch.set(doc(db, 'users', uid, 'notes', fields.id), {
          ...fields,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      seedBatch.update(doc(db, 'users', uid), {
        notesSeeded: true,
        updatedAt: serverTimestamp(),
      });
      await seedBatch.commit();
      noteFolders = seedFolders;
      notes = seedNotes;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, notesPath);
    }
  }

  const savedActiveBoardId = typeof userData.activeBoardId === 'string' ? userData.activeBoardId : '';
  const activeBoardId = boards.some((b) => b.id === savedActiveBoardId)
    ? savedActiveBoardId
    : boards[0].id;
  const theme: 'light' | 'dark' = userData.theme === 'dark' ? 'dark' : 'light';

  return {
    workspace: {
      activeBoardId,
      boards,
    },
    habits,
    noteFolders,
    notes,
    visibleCalendarIds: Array.isArray(userData.visibleCalendarIds)
      ? (userData.visibleCalendarIds as string[])
      : [],
    targetCalendarId:
      typeof userData.targetCalendarId === 'string' && userData.targetCalendarId
        ? userData.targetCalendarId
        : 'primary',
    theme,
  };
}

export async function saveUserPrefsToFirestore(
  uid: string,
  prefs: {
    activeBoardId?: string;
    visibleCalendarIds?: string[];
    targetCalendarId?: string;
    theme?: 'light' | 'dark';
  }
): Promise<void> {
  const userPath = `users/${uid}`;
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (prefs.activeBoardId && isValidEntityId(prefs.activeBoardId)) {
    payload.activeBoardId = prefs.activeBoardId;
  }
  if (prefs.visibleCalendarIds !== undefined) {
    payload.visibleCalendarIds = prefs.visibleCalendarIds
      .filter((x) => typeof x === 'string')
      .slice(0, 30)
      .map((x) => clampText(x, 254));
  }
  if (prefs.targetCalendarId !== undefined) {
    payload.targetCalendarId = clampText(prefs.targetCalendarId || 'primary', 254);
  }
  if (prefs.theme !== undefined) {
    payload.theme = prefs.theme === 'dark' ? 'dark' : 'light';
  }
  try {
    await updateDoc(doc(db, 'users', uid), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, userPath);
  }
}

export async function syncWorkspaceChangesToFirestore(
  uid: string,
  prev: WorkspaceData,
  next: WorkspaceData
): Promise<void> {
  if (prev.activeBoardId !== next.activeBoardId && isValidEntityId(next.activeBoardId)) {
    await saveUserPrefsToFirestore(uid, { activeBoardId: next.activeBoardId });
  }

  const prevBoardMap = new Map(prev.boards.map((b, idx) => [b.id, { board: b, order: idx }]));
  const nextBoardMap = new Map(next.boards.map((b, idx) => [b.id, { board: b, order: idx }]));

  // 1. Deleted boards: delete cards first, then board doc
  for (const [boardId, { board: oldBoard }] of prevBoardMap) {
    if (!nextBoardMap.has(boardId)) {
      for (const oldCard of oldBoard.state.cards) {
        const cardPath = `users/${uid}/boards/${boardId}/cards/${oldCard.id}`;
        try {
          await deleteDoc(doc(db, 'users', uid, 'boards', boardId, 'cards', oldCard.id));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, cardPath);
        }
      }
      const boardPath = `users/${uid}/boards/${boardId}`;
      try {
        await deleteDoc(doc(db, 'users', uid, 'boards', boardId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, boardPath);
      }
    }
  }

  // 2. Created or updated boards (must exist before creating child cards)
  for (const [boardId, { board: newBoard, order }] of nextBoardMap) {
    const prevEntry = prevBoardMap.get(boardId);
    const boardPath = `users/${uid}/boards/${boardId}`;

    if (!prevEntry) {
      const fields = buildBoardFields(newBoard, uid, order);
      try {
        await setDoc(doc(db, 'users', uid, 'boards', boardId), {
          ...fields,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, boardPath);
      }
    } else if (
      prevEntry.order !== order ||
      prevEntry.board.title !== newBoard.title ||
      prevEntry.board.color !== newBoard.color ||
      JSON.stringify(prevEntry.board.state.labels) !== JSON.stringify(newBoard.state.labels) ||
      JSON.stringify(prevEntry.board.state.lists) !== JSON.stringify(newBoard.state.lists)
    ) {
      const fields = buildBoardFields(newBoard, uid, order);
      try {
        await updateDoc(doc(db, 'users', uid, 'boards', boardId), {
          title: fields.title,
          color: fields.color,
          order: fields.order,
          labels: fields.labels,
          lists: fields.lists,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, boardPath);
      }
    }

    // 3. Diff cards inside this board
    const prevCards = new Map(
      (prevEntry?.board.state.cards ?? []).map((c) => [c.id, c])
    );
    const nextCards = new Map(newBoard.state.cards.map((c) => [c.id, c]));
    const fallbackListId = newBoard.state.lists[0]?.id ?? 'list-backlog';

    for (const [cardId] of prevCards) {
      if (!nextCards.has(cardId)) {
        const cardPath = `users/${uid}/boards/${boardId}/cards/${cardId}`;
        try {
          await deleteDoc(doc(db, 'users', uid, 'boards', boardId, 'cards', cardId));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, cardPath);
        }
      }
    }

    for (const [cardId, newCard] of nextCards) {
      const oldCard = prevCards.get(cardId);
      const cardPath = `users/${uid}/boards/${boardId}/cards/${cardId}`;
      const mutable = buildCardMutableFields(newCard, fallbackListId);

      if (!oldCard) {
        try {
          await setDoc(doc(db, 'users', uid, 'boards', boardId, 'cards', cardId), {
            id: cardId,
            boardId,
            ownerUid: uid,
            ...mutable,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, cardPath);
        }
      } else if (JSON.stringify(oldCard) !== JSON.stringify(newCard)) {
        try {
          await updateDoc(doc(db, 'users', uid, 'boards', boardId, 'cards', cardId), {
            ...mutable,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, cardPath);
        }
      }
    }
  }
}

export async function syncHabitsChangesToFirestore(
  uid: string,
  prevHabits: HabitItem[],
  nextHabits: HabitItem[]
): Promise<void> {
  const prevMap = new Map(prevHabits.map((h, idx) => [h.id, { habit: h, order: idx }]));
  const nextMap = new Map(nextHabits.map((h, idx) => [h.id, { habit: h, order: idx }]));

  for (const [habitId] of prevMap) {
    if (!nextMap.has(habitId)) {
      const habitPath = `users/${uid}/habits/${habitId}`;
      try {
        await deleteDoc(doc(db, 'users', uid, 'habits', habitId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, habitPath);
      }
    }
  }

  for (const [habitId, { habit: newHabit, order }] of nextMap) {
    const prevEntry = prevMap.get(habitId);
    const habitPath = `users/${uid}/habits/${habitId}`;

    if (!prevEntry) {
      const fields = buildHabitFields(newHabit, uid, order);
      try {
        await setDoc(doc(db, 'users', uid, 'habits', fields.id), {
          ...fields,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, habitPath);
      }
    } else if (
      prevEntry.order !== order ||
      JSON.stringify(prevEntry.habit) !== JSON.stringify(newHabit)
    ) {
      const mutable = buildHabitMutableFields(newHabit, order);
      const onlyCompletionsChanged =
        prevEntry.order === order &&
        prevEntry.habit.title === newHabit.title &&
        prevEntry.habit.color === newHabit.color &&
        prevEntry.habit.targetCount === newHabit.targetCount &&
        prevEntry.habit.unit === newHabit.unit &&
        JSON.stringify(prevEntry.habit.daysOfWeek) === JSON.stringify(newHabit.daysOfWeek);

      try {
        await updateDoc(
          doc(db, 'users', uid, 'habits', habitId),
          onlyCompletionsChanged
            ? {
                completions: mutable.completions,
                updatedAt: serverTimestamp(),
              }
            : {
                ...mutable,
                updatedAt: serverTimestamp(),
              }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, habitPath);
      }
    }
  }
}

export async function syncNoteFoldersChangesToFirestore(
  uid: string,
  prevFolders: NoteFolder[],
  nextFolders: NoteFolder[]
): Promise<void> {
  const prevMap = new Map(prevFolders.map((f, idx) => [f.id, { folder: f, order: idx }]));
  const nextMap = new Map(nextFolders.map((f, idx) => [f.id, { folder: f, order: idx }]));

  for (const [folderId] of prevMap) {
    if (!nextMap.has(folderId)) {
      const folderPath = `users/${uid}/noteFolders/${folderId}`;
      try {
        await deleteDoc(doc(db, 'users', uid, 'noteFolders', folderId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, folderPath);
      }
    }
  }

  for (const [folderId, { folder: newFolder, order }] of nextMap) {
    const prevEntry = prevMap.get(folderId);
    const folderPath = `users/${uid}/noteFolders/${folderId}`;

    if (!prevEntry) {
      const fields = buildNoteFolderFields(newFolder, uid, order);
      try {
        await setDoc(doc(db, 'users', uid, 'noteFolders', fields.id), {
          ...fields,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, folderPath);
      }
    } else if (
      prevEntry.order !== order ||
      JSON.stringify(prevEntry.folder) !== JSON.stringify(newFolder)
    ) {
      const mutable = buildNoteFolderMutableFields(newFolder, order);
      try {
        await updateDoc(doc(db, 'users', uid, 'noteFolders', folderId), {
          ...mutable,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, folderPath);
      }
    }
  }
}

export async function syncNotesChangesToFirestore(
  uid: string,
  prevNotes: NotePage[],
  nextNotes: NotePage[]
): Promise<void> {
  const prevMap = new Map(prevNotes.map((n, idx) => [n.id, { note: n, order: idx }]));
  const nextMap = new Map(nextNotes.map((n, idx) => [n.id, { note: n, order: idx }]));

  for (const [noteId] of prevMap) {
    if (!nextMap.has(noteId)) {
      const notePath = `users/${uid}/notes/${noteId}`;
      try {
        await deleteDoc(doc(db, 'users', uid, 'notes', noteId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, notePath);
      }
    }
  }

  for (const [noteId, { note: newNote, order }] of nextMap) {
    const prevEntry = prevMap.get(noteId);
    const notePath = `users/${uid}/notes/${noteId}`;

    if (!prevEntry) {
      const fields = buildNoteFields(newNote, uid, order);
      try {
        await setDoc(doc(db, 'users', uid, 'notes', fields.id), {
          ...fields,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, notePath);
      }
    } else if (
      prevEntry.order !== order ||
      JSON.stringify(prevEntry.note) !== JSON.stringify(newNote)
    ) {
      const mutable = buildNoteMutableFields(newNote, order);
      try {
        await updateDoc(doc(db, 'users', uid, 'notes', noteId), {
          ...mutable,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, notePath);
      }
    }
  }
}

