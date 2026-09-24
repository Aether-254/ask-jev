import { fetch as undiciFetch, ProxyAgent, type Dispatcher } from "undici";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type StructuredText = string | JsonValue[] | { [key: string]: JsonValue };

export type ChoiceQuestion = {
  type: "choice";
  instructions: StructuredText;
  criteria: Record<string, JsonValue>;
};
export type ScoreQuestion = {
  type: "score";
  instructions: StructuredText;
  criteria: StructuredText[];
};
export type NoulQuestion = {
  type: "noul";
  instructions: StructuredText;
  criteria?: { true?: JsonValue; false?: JsonValue };
};
export type Question = ChoiceQuestion | ScoreQuestion | NoulQuestion;
export type Questions = Record<string, Question>;

export type SystemOneRequest = {
  model: string;
  state: StructuredText;
  questions: Questions;
};

export type SystemOneResponse = {
  model: string;
  answers: Record<string, unknown>;
  usage?: unknown;
  cost?: unknown;
};

export type ClientConfig = {
  baseUrl: string;
  apiKey: string | undefined;
  model: string;
  timeoutMs: number;
  maxRetries: number;
};

export const DEFAULTS = {
  baseUrl: "https://api.typesafe.ai/v1",
  model: "jev-latest",
  timeoutMs: 30_000,
  maxRetries: 3,
};

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): ClientConfig {
  return {
    baseUrl: (env.JEV_BASE_URL ?? env.TYPESAFE_BASE_URL ?? DEFAULTS.baseUrl).replace(/\/+$/, ""),
    apiKey: env.JEV_API_KEY || env.TYPESAFE_API_KEY || undefined,
    model: env.JEV_MODEL ?? env.TYPESAFE_MODEL ?? DEFAULTS.model,
    timeoutMs: Number(env.JEV_TIMEOUT_MS) || DEFAULTS.timeoutMs,
    maxRetries: Number(env.JEV_MAX_RETRIES ?? DEFAULTS.maxRetries),
  };
}

export class JevHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`Jev API ${status}: ${body.slice(0, 500)}`);
    this.name = "JevHttpError";
  }
}

function proxyDispatcher(env: NodeJS.ProcessEnv): Dispatcher | undefined {
  const url = env.HTTPS_PROXY ?? env.https_proxy ?? env.HTTP_PROXY ?? env.http_proxy;
  return url ? new ProxyAgent(url) : undefined;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type FetchLike = typeof undiciFetch;

export class JevClient {
  private readonly dispatcher: Dispatcher | undefined;

  constructor(
    public readonly config: ClientConfig,
    private readonly fetchImpl: FetchLike = undiciFetch,
    env: NodeJS.ProcessEnv = process.env,
  ) {
    this.dispatcher = proxyDispatcher(env);
  }

  async systemOne(state: StructuredText, questions: Questions, model?: string): Promise<SystemOneResponse> {
    const body: SystemOneRequest = { model: model ?? this.config.model, state, questions };
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.config.apiKey) headers.authorization = `Bearer ${this.config.apiKey}`;

    let attempt = 0;
    for (;;) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
      try {
        const res = await this.fetchImpl(`${this.config.baseUrl}/systemone`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
          dispatcher: this.dispatcher,
        });
        const text = await res.text();
        if (res.ok) return JSON.parse(text) as SystemOneResponse;
        const retryable = res.status === 429 || res.status >= 500;
        if (!retryable || attempt >= this.config.maxRetries) throw new JevHttpError(res.status, text);
      } catch (err) {
        if (err instanceof JevHttpError) throw err;
        if (attempt >= this.config.maxRetries) throw err;
      } finally {
        clearTimeout(timer);
      }
      attempt += 1;
      await sleep(500 * 2 ** (attempt - 1));
    }
  }
}
