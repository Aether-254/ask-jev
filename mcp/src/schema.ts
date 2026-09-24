import { z } from "zod";

export const choiceSchema = z.object({
  type: z.literal("choice"),
  instructions: z.string().min(1).describe("What to decide about the state."),
  criteria: z
    .record(z.string(), z.string())
    .refine((c) => Object.keys(c).length >= 2 && Object.keys(c).length <= 255, {
      message: "choice.criteria needs 2-255 options",
    })
    .describe("Options as { optionKey: description }. Descriptions materially improve accuracy."),
});

export const scoreSchema = z.object({
  type: z.literal("score"),
  instructions: z.string().min(1).describe("What to rate about the state."),
  criteria: z
    .array(z.string().min(1))
    .min(2)
    .describe("Ordered scale rungs, lowest first, e.g. [\"calm\", \"annoyed\", \"furious\"]."),
});

export const noulSchema = z.object({
  type: z.literal("noul"),
  instructions: z.string().min(1).describe("A proposition about the state; returns P(true) in [0,1]."),
});

export const questionSchema = z.discriminatedUnion("type", [choiceSchema, scoreSchema, noulSchema]);

export const questionsSchema = z
  .record(z.string().min(1), questionSchema)
  .refine((q) => Object.keys(q).length >= 1, { message: "at least one question" })
  .describe("Named questions evaluated in parallel against the same state. Keep each atomic.");

export const evaluateInput = {
  state: z.string().min(1).describe("The context to judge: an email, a log line, a ticket, a diff, JSON, ..."),
  questions: questionsSchema,
  model: z.string().optional().describe("Override JEV_MODEL for this call."),
};

export const batchEvaluateInput = {
  states: z.array(z.string().min(1)).min(1).max(1000).describe("One state per item; the same questions are asked of each."),
  questions: questionsSchema,
  model: z.string().optional(),
  concurrency: z.number().int().min(1).max(16).default(4).describe("Parallel requests (default 4)."),
};
