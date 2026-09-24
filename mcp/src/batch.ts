import { JevClient, type Questions, type StructuredText, type SystemOneResponse } from "./client.js";

export type BatchItem =
  | { index: number; state: StructuredText; ok: true; answers: SystemOneResponse["answers"] }
  | { index: number; state: StructuredText; ok: false; error: string };

export async function batchEvaluate(
  client: JevClient,
  states: StructuredText[],
  questions: Questions,
  concurrency: number,
  model?: string,
): Promise<{ model: string; total: number; failed: number; items: BatchItem[] }> {
  const items: BatchItem[] = new Array(states.length);
  let next = 0;
  let failed = 0;

  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= states.length) return;
      try {
        const res = await client.systemOne(states[i], questions, model);
        items[i] = { index: i, state: states[i], ok: true, answers: res.answers };
      } catch (err) {
        failed += 1;
        items[i] = { index: i, state: states[i], ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, states.length) }, worker));
  return { model: model ?? client.config.model, total: states.length, failed, items };
}
