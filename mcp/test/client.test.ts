import { describe, expect, it } from "vitest";
import { JevClient, JevHttpError, configFromEnv, type FetchLike } from "../src/client.js";
import { batchEvaluate } from "../src/batch.js";
import { questionsSchema } from "../src/schema.js";

const cfg = { baseUrl: "https://example.test/v1", apiKey: "k", model: "m", timeoutMs: 1000, maxRetries: 2 };

function fakeFetch(handler: (call: number, init: any) => { status: number; body: unknown }): { fetch: FetchLike; calls: () => number } {
  let n = 0;
  const fetch = (async (_url: any, init: any) => {
    n += 1;
    const r = handler(n, init);
    const text = typeof r.body === "string" ? r.body : JSON.stringify(r.body);
    return { ok: r.status < 400, status: r.status, text: async () => text } as any;
  }) as FetchLike;
  return { fetch, calls: () => n };
}

describe("configFromEnv", () => {
  it("applies defaults and strips trailing slash", () => {
    const c = configFromEnv({ JEV_BASE_URL: "https://x.test/v1///" } as any);
    expect(c.baseUrl).toBe("https://x.test/v1");
    expect(c.model).toBe("jev-latest");
    expect(c.apiKey).toBeUndefined();
  });

  it("uses an ASCII default API hostname", () => {
    expect(configFromEnv({} as any).baseUrl).toBe("https://api.typesafe.ai/v1");
  });

  it("accepts the official TypeSafe environment names", () => {
    const c = configFromEnv({
      TYPESAFE_BASE_URL: "https://gateway.example/v1/",
      TYPESAFE_API_KEY: "official-key",
      TYPESAFE_MODEL: "jev-preview",
    } as any);
    expect(c).toMatchObject({
      baseUrl: "https://gateway.example/v1",
      apiKey: "official-key",
      model: "jev-preview",
    });
  });
});

describe("JevClient.systemOne", () => {
  it("posts the systemone body with bearer auth", async () => {
    let seen: any;
    const { fetch } = fakeFetch((_n, init) => {
      seen = init;
      return { status: 200, body: { model: "m", answers: { q: { type: "noul", noul: 0.5 } } } };
    });
    const res = await new JevClient(cfg, fetch, {}).systemOne("s", { q: { type: "noul", instructions: "i" } });
    expect(res.answers.q).toEqual({ type: "noul", noul: 0.5 });
    expect(seen.headers.authorization).toBe("Bearer k");
    expect(JSON.parse(seen.body)).toEqual({ model: "m", state: "s", questions: { q: { type: "noul", instructions: "i" } } });
  });

  it("retries 429 then succeeds", async () => {
    const { fetch, calls } = fakeFetch((n) => (n < 3 ? { status: 429, body: "slow down" } : { status: 200, body: { model: "m", answers: {} } }));
    await new JevClient(cfg, fetch, {}).systemOne("s", { q: { type: "noul", instructions: "i" } });
    expect(calls()).toBe(3);
  });

  it("does not retry 4xx other than 429", async () => {
    const { fetch, calls } = fakeFetch(() => ({ status: 401, body: "bad key" }));
    await expect(new JevClient(cfg, fetch, {}).systemOne("s", { q: { type: "noul", instructions: "i" } })).rejects.toBeInstanceOf(JevHttpError);
    expect(calls()).toBe(1);
  });
});

describe("batchEvaluate", () => {
  it("isolates per-item failures and preserves order", async () => {
    const { fetch } = fakeFetch((_n, init) => {
      const { state } = JSON.parse(init.body);
      return state === "bad" ? { status: 400, body: "nope" } : { status: 200, body: { model: "m", answers: { s: state } } };
    });
    const client = new JevClient({ ...cfg, maxRetries: 0 }, fetch, {});
    const out = await batchEvaluate(client, ["a", "bad", "c"], { q: { type: "noul", instructions: "i" } }, 2);
    expect(out.total).toBe(3);
    expect(out.failed).toBe(1);
    expect(out.items.map((i) => i.ok)).toEqual([true, false, true]);
    expect(out.items[2]).toMatchObject({ index: 2, state: "c", answers: { s: "c" } });
  });
});

describe("questionsSchema", () => {
  it("rejects a choice with a single option", () => {
    expect(questionsSchema.safeParse({ q: { type: "choice", instructions: "i", criteria: { a: "x" } } }).success).toBe(false);
  });
  it("accepts all three primitives", () => {
    const r = questionsSchema.safeParse({
      a: { type: "choice", instructions: "i", criteria: { x: "1", y: "2" } },
      b: { type: "score", instructions: "i", criteria: ["lo", "hi"] },
      c: { type: "noul", instructions: "i" },
    });
    expect(r.success).toBe(true);
  });
});
