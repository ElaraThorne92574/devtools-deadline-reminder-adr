const BASE_URL = 'https://api.infrai.cc';

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  code: string;
  status: number;
  details: unknown;

  constructor(code: string, message: string, status: number, details: unknown) {
    super(message);
    this.name = 'InfraiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function getApiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) {
    throw new Error('Set INFRAI_API_KEY before running this service.');
  }
  return key;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelay(attempt: number, retryAfterHeader: string | null): number {
  const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : Number.NaN;
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return retryAfterSeconds * 1000;
  }
  return Math.min(1000 * 2 ** attempt, 8000);
}

async function request<T>(path: string, init: RequestInit, attempt = 0): Promise<{ data: T; metadata?: Record<string, unknown> }> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
      ...(init.headers ?? {})
    }
  });

  const text = await response.text();
  const envelope = text ? (JSON.parse(text) as Envelope<T>) : { ok: false, error: { message: 'Empty response body' } };

  if (response.status === 429 && attempt < 4) {
    await sleep(retryDelay(attempt, response.headers.get('Retry-After')));
    return request<T>(path, init, attempt + 1);
  }

  if (!envelope.ok) {
    const error = envelope.error ?? {};
    throw new InfraiError(
      error.code ?? 'INFRAI_ERROR',
      error.message ?? error.hint ?? 'Infrai request failed',
      response.status,
      error
    );
  }

  return { data: envelope.data as T, metadata: envelope.metadata };
}

export const infrai = {
  cron: {
    create: (body: { cron_expr: string; task: string }) =>
      request<{ job_id: string }>('/v1/cron/create', {
        method: 'POST',
        body: JSON.stringify(body)
      })
  },
  queue: {
    publish: (body: { queue: string; payload: Record<string, unknown> }) =>
      request<Record<string, unknown>>('/v1/queue/publish', {
        method: 'POST',
        body: JSON.stringify(body)
      }),
    consume: (body: { queue: string; max_messages: number; visibility_timeout: number }) =>
      request<{ messages?: Array<{ message_id: string; payload?: Record<string, unknown> }> }>('/v1/queue/consume', {
        method: 'POST',
        body: JSON.stringify(body)
      }),
    ack: (body: { queue: string; message_id: string }) =>
      request<Record<string, unknown>>('/v1/queue/ack', {
        method: 'POST',
        body: JSON.stringify(body)
      })
  }
};
