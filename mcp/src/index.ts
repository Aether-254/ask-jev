import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { JevClient, configFromEnv, type Questions, type StructuredText } from "./client.js";
import { batchEvaluate } from "./batch.js";
import { evaluateInput, batchEvaluateInput } from "./schema.js";

const client = new JevClient(configFromEnv());

const server = new McpServer({ name: "ask-jev", version: "0.1.0" });

const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });
const fail = (err: unknown) => ({
  isError: true,
  content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }],
});

server.registerTool(
  "jev_evaluate",
  {
    title: "Jev: typed decisions over one state",
    description:
      "Ask Jev (a System One model: no text generation, ~100-500ms, calibrated probabilities) one or more typed questions about a single state. " +
      "Question types: choice (pick one of 2-255 described options), score (position on an ordered scale), noul (probability a proposition is true). " +
      "Questions run in parallel and cannot see each other; keep each atomic and compose logic in your own code. " +
      "Returns the raw upstream response: answers keyed by question name with choice/score/noul plus probabilities and confidence.",
    inputSchema: evaluateInput,
  },
  async ({ state, questions, model }) => {
    try {
      return json(await client.systemOne(state as StructuredText, questions as Questions, model));
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  "jev_batch_evaluate",
  {
    title: "Jev: same questions over many states",
    description:
      "Run jev_evaluate over many states with the same question set, concurrently (default 4). " +
      "Per-item failures are isolated and reported inline; the call never fails as a whole because one item did. " +
      "Use for classifying, triaging, filtering or ranking dozens to hundreds of items.",
    inputSchema: batchEvaluateInput,
  },
  async ({ states, questions, model, concurrency }) => {
    try {
      return json(await batchEvaluate(client, states as StructuredText[], questions as Questions, concurrency, model));
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  "jev_ping",
  {
    title: "Jev: connectivity check",
    description: "Send a trivial noul question to verify JEV_BASE_URL, JEV_API_KEY and proxy settings. Returns model id and round-trip latency.",
    inputSchema: {},
  },
  async () => {
    const started = Date.now();
    try {
      const res = await client.systemOne("ping", { alive: { type: "noul", instructions: "The state is the word ping." } });
      return json({
        ok: true,
        baseUrl: client.config.baseUrl,
        model: res.model,
        latencyMs: Date.now() - started,
        hasApiKey: Boolean(client.config.apiKey),
      });
    } catch (err) {
      return json({
        ok: false,
        baseUrl: client.config.baseUrl,
        model: client.config.model,
        hasApiKey: Boolean(client.config.apiKey),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
