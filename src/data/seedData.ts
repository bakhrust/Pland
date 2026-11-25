import type { BoardState, NoteFolder, NotePage, WorkspaceData } from '../types/planner';
import { addDays, getWeekStartMonday, toLocalDateKey } from '../utils/dateUtils';

export function createInitialBoardState(referenceDate = new Date()): BoardState {
  const monday = getWeekStartMonday(referenceDate);
  const monKey = toLocalDateKey(monday);
  const tueKey = toLocalDateKey(addDays(monday, 1));
  const wedKey = toLocalDateKey(addDays(monday, 2));
  const thuKey = toLocalDateKey(addDays(monday, 3));
  const friKey = toLocalDateKey(addDays(monday, 4));
  const nextMonKey = toLocalDateKey(addDays(monday, 7));

  return {
    labels: [
      { id: 'lbl-product', name: 'Продукт', color: 'blue' },
      { id: 'lbl-design', name: 'Дизайн', color: 'violet' },
      { id: 'lbl-dev', name: 'Разработка', color: 'emerald' },
      { id: 'lbl-urgent', name: 'Срочно', color: 'rose' },
      { id: 'lbl-meeting', name: 'Событие', color: 'amber' },
    ],
    lists: [
      { id: 'list-backlog', title: 'Бэклог', order: 0 },
      { id: 'list-planned', title: 'Запланировано', order: 1 },
      { id: 'list-progress', title: 'В работе', order: 2 },
      { id: 'list-review', title: 'На проверке', order: 3 },
      { id: 'list-done', title: 'Готово', order: 4 },
    ],
    cards: [
      {
        id: 'card-1',
        listId: 'list-backlog',
        order: 0,
        title: 'Собрать заметки по итогам недели',
        description: 'Выписать ключевые достижения, открытые вопросы и приоритеты на следующую неделю.',
        labelIds: ['lbl-product'],
        checklist: [
          { id: 'chk-1', text: 'Проверить выполненные задачи', done: true },
          { id: 'chk-2', text: 'Обновить приоритеты в бэклоге', done: false },
          { id: 'chk-3', text: 'Наметить фокус-блоки на утро', done: false },
        ],
        startDate: null,
        endDate: null,
        dueDate: nextMonKey,
      },
      {
        id: 'card-2',
        listId: 'list-backlog',
        order: 1,
        title: 'Настроить шаблоны повторяющихся задач',
        description: 'Подготовить личные чек-листы для еженедельного планирования и ретроспективы.',
        labelIds: ['lbl-dev'],
        checklist: [],
        startDate: null,
        endDate: null,
        dueDate: null,
      },
      {
        id: 'card-3',
        listId: 'list-planned',
        order: 0,
        title: 'Обзор спринта и планирование релизов',
        description: 'Проверить готовые сценарии планирования и согласовать даты выката в календаре.',
        labelIds: ['lbl-meeting', 'lbl-product'],
        checklist: [
          { id: 'chk-4', text: 'Проверить стенд перед обзором', done: true },
          { id: 'chk-5', text: 'Обновить заметки к релизу', done: false },
        ],
        startDate: `${tueKey}T11:00`,
        endDate: `${tueKey}T12:30`,
        allDay: false,
        dueDate: tueKey,
      },
      {
        id: 'card-4',
        listId: 'list-planned',
        order: 1,
        title: 'Редизайн карточек календаря и сетки недели',
        description: 'Уточнить отступы, читаемость времени и контрастность цветов при наложении событий.',
        labelIds: ['lbl-design'],
        checklist: [
          { id: 'chk-6', text: 'Проверить сетку на 1440px', done: true },
          { id: 'chk-7', text: 'Проверить адаптацию под смартфон', done: false },
        ],
        startDate: `${wedKey}T10:00`,
        endDate: `${wedKey}T12:00`,
        allDay: false,
        dueDate: thuKey,
      },
      {
        id: 'card-5',
        listId: 'list-progress',
        order: 0,
        title: 'Синхронизация задач с Google Calendar',
        description: 'Проверить выгрузку запланированных карточек и обновление событий с подтверждением.',
        labelIds: ['lbl-dev', 'lbl-urgent'],
        checklist: [
          { id: 'chk-8', text: 'Подключить выбор календарей', done: true },
          { id: 'chk-9', text: 'Проверить создание и обновление событий', done: true },
          { id: 'chk-10', text: 'Проверить удаление с диалогом подтверждения', done: false },
        ],
        startDate: `${monKey}T09:30`,
        endDate: `${monKey}T12:00`,
        allDay: false,
        dueDate: wedKey,
      },
      {
        id: 'card-6',
        listId: 'list-progress',
        order: 1,
        title: 'Личная дорожная карта квартала',
        description: 'Распределить многодневные задачи по категориям и колонкам на 2 недели вперёд.',
        labelIds: ['lbl-product', 'lbl-design'],
        checklist: [],
        startDate: tueKey,
        endDate: thuKey,
        allDay: true,
        dueDate: friKey,
      },
      {
        id: 'card-7',
        listId: 'list-review',
        order: 0,
        title: 'Проверка перетаскивания карточек на сетку',
        description: 'Протестировать перенос карточек между колонками и прямо на слоты недели.',
        labelIds: ['lbl-dev'],
        checklist: [
          { id: 'chk-11', text: 'Тест переноса в другую колонку', done: true },
          { id: 'chk-12', text: 'Тест назначения времени из бэклога', done: true },
        ],
        startDate: `${thuKey}T15:00`,
        endDate: `${thuKey}T16:30`,
        allDay: false,
        dueDate: thuKey,
      },
      {
        id: 'card-8',
        listId: 'list-done',
        order: 0,
        title: 'Утверждение палитры и типографики PLAND',
        description: 'Финальный выбор шрифтов Plus Jakarta Sans и DM Sans, настройка светлой темы.',
        labelIds: ['lbl-design'],
        checklist: [
          { id: 'chk-13', text: 'Согласовать токены цветов', done: true },
        ],
        startDate: `${monKey}T14:00`,
        endDate: `${monKey}T15:30`,
        allDay: false,
        dueDate: monKey,
      },
    ],
  };
}

export function createInitialWorkspaceData(referenceDate = new Date()): WorkspaceData {
  const monday = getWeekStartMonday(referenceDate);
  const wedKey = toLocalDateKey(addDays(monday, 2));
  const friKey = toLocalDateKey(addDays(monday, 4));
  const satKey = toLocalDateKey(addDays(monday, 5));

  const personalBoard: BoardState = {
    labels: [
      { id: 'lbl-p-life', name: 'Быт', color: 'emerald' },
      { id: 'lbl-p-health', name: 'Здоровье', color: 'blue' },
      { id: 'lbl-p-family', name: 'Семья', color: 'violet' },
      { id: 'lbl-p-urgent', name: 'Важно', color: 'rose' },
    ],
    lists: [
      { id: 'plist-ideas', title: 'Идеи и планы', order: 0 },
      { id: 'plist-week', title: 'На этой неделе', order: 1 },
      { id: 'plist-done', title: 'Сделано', order: 2 },
    ],
    cards: [
      {
        id: 'pcard-1',
        listId: 'plist-ideas',
        order: 0,
        title: 'Разобрать домашний архив документов',
        description: 'Отсканировать квитанции и сложить в облачную папку.',
        labelIds: ['lbl-p-life'],
        checklist: [],
        startDate: null,
        endDate: null,
        dueDate: satKey,
      },
      {
        id: 'pcard-2',
        listId: 'plist-week',
        order: 0,
        title: 'Тренировка и пробежка в парке',
        description: '45 минут в спокойном темпе и растяжка.',
        labelIds: ['lbl-p-health'],
        checklist: [],
        startDate: `${wedKey}T18:30`,
        endDate: `${wedKey}T19:30`,
        allDay: false,
        dueDate: wedKey,
      },
      {
        id: 'pcard-3',
        listId: 'plist-week',
        order: 1,
        title: 'Выбрать подарок и поздравить близких',
        description: 'Заказать доставку заранее до выходных.',
        labelIds: ['lbl-p-family', 'lbl-p-urgent'],
        checklist: [
          { id: 'pchk-1', text: 'Подобрать вариант подарка', done: true },
          { id: 'pchk-2', text: 'Оформить заказ', done: false },
        ],
        startDate: `${friKey}T19:00`,
        endDate: `${friKey}T20:00`,
        allDay: false,
        dueDate: friKey,
      },
    ],
  };

  return {
    activeBoardId: 'board-work',
    boards: [
      {
        id: 'board-work',
        title: 'Работа',
        color: 'blue',
        state: createInitialBoardState(referenceDate),
      },
      {
        id: 'board-personal',
        title: 'Личные дела',
        color: 'emerald',
        state: personalBoard,
      },
    ],
  };
}

export function createInitialHabits(referenceDate = new Date()): import('../types/planner').HabitItem[] {
  const todayKey = toLocalDateKey(referenceDate);
  const yesterdayKey = toLocalDateKey(addDays(referenceDate, -1));
  const twoDaysAgoKey = toLocalDateKey(addDays(referenceDate, -2));

  return [
    {
      id: 'habit-workout',
      title: 'Утренняя зарядка и растяжка',
      color: 'emerald',
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      targetCount: 1,
      unit: 'раз',
      order: 0,
      completions: {
        [twoDaysAgoKey]: 1,
        [yesterdayKey]: 1,
      },
    },
    {
      id: 'habit-water',
      title: 'Пить воду в течение дня',
      color: 'blue',
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      targetCount: 8,
      unit: 'стак.',
      order: 1,
      completions: {
        [twoDaysAgoKey]: 8,
        [yesterdayKey]: 7,
        [todayKey]: 3,
      },
    },
    {
      id: 'habit-reading',
      title: 'Чтение книги перед сном',
      color: 'violet',
      daysOfWeek: [1, 2, 3, 4, 5],
      targetCount: 20,
      unit: 'мин',
      order: 2,
      completions: {
        [yesterdayKey]: 20,
      },
    },
  ];
}

export function createInitialNoteFolders(): NoteFolder[] {
  return [
    { id: 'folder-personal', parentId: null, title: 'Личное', color: 'blue', order: 0 },
    { id: 'folder-projects', parentId: null, title: 'Проекты', color: 'violet', order: 1 },
    { id: 'folder-ideas', parentId: null, title: 'Идеи и знания', color: 'amber', order: 2 },
  ];
}

export function createInitialNotes(referenceTime = Date.now()): NotePage[] {
  return [
    {
      id: 'note-welcome',
      folderId: 'folder-personal',
      title: 'Добро пожаловать в личный блокнот',
      icon: '📝',
      pinned: true,
      order: 0,
      updatedAtMs: referenceTime,
      blocks: [
        {
          id: 'blk-w-1',
          type: 'callout',
          content: 'Подсказка: введите «/» в пустой строке или используйте быстрые команды вроде «# », «- », «[] », «1. », «> » для создания блоков как в Notion.',
          checked: false,
          indent: 0,
        },
        {
          id: 'blk-w-2',
          type: 'heading2',
          content: 'Что уже можно делать в заметках',
          checked: false,
          indent: 0,
        },
        {
          id: 'blk-w-3',
          type: 'todo',
          content: 'Создавать папки и вложенные подпапки слева',
          checked: true,
          indent: 0,
        },
        {
          id: 'blk-w-4',
          type: 'todo',
          content: 'Собирать списки дел, маркированные и нумерованные списки',
          checked: false,
          indent: 0,
        },
        {
          id: 'blk-w-5',
          type: 'todo',
          content: 'Искать по всем страницам и закреплять важные в «Избранном»',
          checked: false,
          indent: 0,
        },
        {
          id: 'blk-w-6',
          type: 'quote',
          content: 'Хорошая система заметок снимает нагрузку с памяти и оставляет место для ясного мышления.',
          checked: false,
          indent: 0,
        },
      ],
    },
    {
      id: 'note-roadmap',
      folderId: 'folder-projects',
      title: 'Дорожная карта супер-приложения PLAND',
      icon: '🚀',
      pinned: true,
      order: 1,
      updatedAtMs: referenceTime - 3600 * 1000,
      blocks: [
        {
          id: 'blk-r-1',
          type: 'heading2',
          content: 'Этапы развития',
          checked: false,
          indent: 0,
        },
        {
          id: 'blk-r-2',
          type: 'numbered',
          content: 'Планирование, доски и календарь с привычками',
          checked: false,
          indent: 0,
        },
        {
          id: 'blk-r-3',
          type: 'numbered',
          content: 'Блокнот в стиле Notion с папками и блоками',
          checked: false,
          indent: 0,
        },
        {
          id: 'blk-r-4',
          type: 'numbered',
          content: 'Учёт личных финансов и категорий бюджета',
          checked: false,
          indent: 0,
        },
        {
          id: 'blk-r-5',
          type: 'numbered',
          content: 'Спорт, подходы, веса и дневник тренировок',
          checked: false,
          indent: 0,
        },
        {
          id: 'blk-r-6',
          type: 'divider',
          content: '',
          checked: false,
          indent: 0,
        },
        {
          id: 'blk-r-7',
          type: 'paragraph',
          content: 'Все данные привязаны только к вашему личному аккаунту Google и доступны на компьютере и телефоне.',
          checked: false,
          indent: 0,
        },
      ],
    },
    {
      id: 'note-reading',
      folderId: 'folder-ideas',
      title: 'Конспекты и полезные мысли',
      icon: '💡',
      pinned: false,
      order: 2,
      updatedAtMs: referenceTime - 24 * 3600 * 1000,
      blocks: [
        {
          id: 'blk-i-1',
          type: 'heading3',
          content: 'Правило трёх приоритетов дня',
          checked: false,
          indent: 0,
        },
        {
          id: 'blk-i-2',
          type: 'bullet',
          content: 'Главная задача утра — без отвлечений и мессенджеров',
          checked: false,
          indent: 0,
        },
        {
          id: 'blk-i-3',
          type: 'bullet',
          content: 'Две поддерживающие задачи после обеда',
          checked: false,
          indent: 0,
        },
        {
          id: 'blk-i-4',
          type: 'code',
          content: '// Мини-формула фокуса:\nconst focus = singleTask + deepWorkMinutes(50);',
          checked: false,
          indent: 0,
        },
      ],
    },
  ];
}

