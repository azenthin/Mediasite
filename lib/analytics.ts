export type AnalyticsEventInput = {
  userId?: string | null;
  sessionId?: string;
  mediaId?: string | null;
  uploaderId?: string | null;
  eventType: string;
  position?: number;
  algorithmVersion?: string;
  score?: number;
  seed?: string;
  meta?: Record<string, unknown> | null;
};

const SESSION_KEY = 'ms_session_id';

export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  let id = window.localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export async function sendEvents(events: AnalyticsEventInput | AnalyticsEventInput[]): Promise<void> {
  try {
    const arr = Array.isArray(events) ? events : [events];
    const sessionId = getOrCreateSessionId();
    const payload = arr.map(e => ({
      sessionId,
      eventType: e.eventType,
      userId: e.userId ?? null,
      mediaId: e.mediaId ?? null,
      uploaderId: e.uploaderId ?? null,
      position: e.position ?? null,
      algorithmVersion: e.algorithmVersion ?? null,
      score: e.score ?? null,
      seed: e.seed ?? null,
      meta: e.meta ? JSON.stringify(e.meta) : null,
    }));
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // swallow
  }
}

export function logImpression(mediaId: string | undefined, position?: number): void {
  if (!mediaId) return;
  void sendEvents({ mediaId, eventType: 'IMPRESSION', position });
}

export function logClick(mediaId: string | undefined, position?: number): void {
  if (!mediaId) return;
  void sendEvents({ mediaId, eventType: 'CLICK', position });
}

export function logStartPlay(mediaId: string | undefined): void {
  if (!mediaId) return;
  void sendEvents({ mediaId, eventType: 'START_PLAY' });
}


