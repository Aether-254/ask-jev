import { describe, expect, it } from "vitest";
import { JevClient, configFromEnv } from "../src/client.js";

// Runs only with JEV_LIVE=1 and a reachable backend (JEV_API_KEY, optional HTTPS_PROXY).
describe.skipIf(!process.env.JEV_LIVE)("live systemone", () => {
  it("answers choice, score and noul in one request", async () => {
    const client = new JevClient(configFromEnv());
    const res = await client.systemOne("My card was charged twice, please refund one.", {
      dept: {
        type: "choice",
        instructions: "Which team should handle this?",
        criteria: { billing: "payments, charges, invoices, refunds", technical: "bugs or integration", sales: "pricing questions" },
      },
      anger: { type: "score", instructions: "How upset is the customer?", criteria: ["calm", "annoyed", "furious"] },
      urgent: { type: "noul", instructions: "This needs a same-day response." },
    });
    expect(res.answers.dept).toMatchObject({ type: "choice", choice: "billing" });
    expect(res.answers.anger).toMatchObject({ type: "score" });
    expect(res.answers.urgent).toMatchObject({ type: "noul" });
  }, 30_000);
});
