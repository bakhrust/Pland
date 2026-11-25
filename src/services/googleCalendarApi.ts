import type { CardItem, GoogleCalendarEvent, GoogleCalendarMeta } from '../types/planner';
import { buildGoogleEventPayload } from '../utils/boardLogic';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

export class CalendarAuthExpiredError extends Error {
  constructor(message = 'Сессия Google Calendar истекла. Повторите вход.') {
    super(message);
    this.name = 'CalendarAuthExpiredError';
  }
}

async function calendarFetch(url: string, accessToken: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 401) {
    throw new CalendarAuthExpiredError();
  }

  if (!res.ok) {
    let errText = `Ошибка Google Calendar (${res.status})`;
    try {
      const json = await res.json();
      if (json?.error?.message) {
        errText = json.error.message;
      }
    } catch {
      // ignore json parse failure
    }
    throw new Error(errText);
  }

  if (res.status === 204) {
    return null;
  }
  return res.json();
}

export async function fetchCalendarList(accessToken: string): Promise<GoogleCalendarMeta[]> {
  const data = await calendarFetch(`${CALENDAR_API_BASE}/users/me/calendarList`, accessToken);
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map((item: Record<string, unknown>) => ({
    id: String(item.id ?? ''),
    summary: String(item.summaryOverride || item.summary || 'Календарь'),
    backgroundColor: typeof item.backgroundColor === 'string' ? item.backgroundColor : '#2563eb',
    foregroundColor: typeof item.foregroundColor === 'string' ? item.foregroundColor : '#ffffff',
    primary: Boolean(item.primary),
    accessRole: typeof item.accessRole === 'string' ? item.accessRole : undefined,
  }));
}

export async function fetchEventsInRange(
  accessToken: string,
  calendars: GoogleCalendarMeta[],
  timeMin: Date,
  timeMax: Date
): Promise<GoogleCalendarEvent[]> {
  if (calendars.length === 0) return [];

  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });

  const results = await Promise.all(
    calendars.map(async (cal) => {
      const url = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(cal.id)}/events?${params.toString()}`;
      const data = await calendarFetch(url, accessToken);
      const items = Array.isArray(data?.items) ? data.items : [];
      return items
        .filter((ev: Record<string, unknown>) => ev.status !== 'cancelled')
        .map((ev: Record<string, unknown>): GoogleCalendarEvent => {
          const startObj = (ev.start as Record<string, string>) || {};
          const endObj = (ev.end as Record<string, string>) || {};
          const allDay = Boolean(startObj.date && !startObj.dateTime);
          return {
            id: String(ev.id ?? ''),
            calendarId: cal.id,
            calendarSummary: cal.summary,
            calendarColor: cal.backgroundColor || '#2563eb',
            summary: String(ev.summary || '(Без названия)'),
            description: typeof ev.description === 'string' ? ev.description : undefined,
            location: typeof ev.location === 'string' ? ev.location : undefined,
            htmlLink: typeof ev.htmlLink === 'string' ? ev.htmlLink : undefined,
            hangoutLink: typeof ev.hangoutLink === 'string' ? ev.hangoutLink : undefined,
            start: startObj.dateTime || startObj.date || timeMin.toISOString(),
            end: endObj.dateTime || endObj.date || startObj.dateTime || startObj.date || timeMax.toISOString(),
            allDay,
            status: typeof ev.status === 'string' ? ev.status : undefined,
          };
        });
    })
  );

  return results.flat();
}

export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  card: CardItem,
  listTitle?: string
): Promise<{ id: string; htmlLink?: string }> {
  const payload = buildGoogleEventPayload(card, listTitle);
  const url = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`;
  const created = await calendarFetch(url, accessToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return {
    id: String(created.id),
    htmlLink: typeof created.htmlLink === 'string' ? created.htmlLink : undefined,
  };
}

export async function updateCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  card: CardItem,
  listTitle?: string
): Promise<{ id: string }> {
  const payload = buildGoogleEventPayload(card, listTitle);
  const url = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
  const updated = await calendarFetch(url, accessToken, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return { id: String(updated.id) };
}

export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const url = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
  await calendarFetch(url, accessToken, {
    method: 'DELETE',
  });
}
