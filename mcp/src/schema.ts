import { z } from "zod";

export const structuredTextSchema = z
  .union([z.string(), z.record(z.unknown()), z.array(z.unknown())])
  .describe("Natural-language text or JSON-structured text content.");

export const choiceSchema = z.object({
  type: z.literal("choice"),
  instructions: structuredTextSchema.describe("What to decide about the state."),
  criteria: z
    .record(z.string(), z.unknown())
    .refine((c) => Object.keys(c).length >= 2 && Object.keys(c).length <= 255, {
      message: "choice.criteria needs 2-255 options",
    })
    .describe("Options as { optionKey: description }. Descriptions may be strings, structured JSON, or null."),
});

export const scoreSchema = z.object({
  type: z.literal("score"),
  instructions: structuredTextSchema.describe("What to rate about the state."),
  criteria: z
    .array(structuredTextSchema)
    .min(2)
    .max(10)
    .describe("Ordered scale rungs, lowest first, e.g. [\"calm\", \"annoyed\", \"furious\"]."),
});

export const noulSchema = z.object({
  type: z.literal("noul"),
  instructions: structuredTextSchema.describe("A proposition about the state; returns P(true) in [0,1]."),
  criteria: z
    .object({
      true: z.unknown().optional().describe("What a true or yes result means."),
      false: z.unknown().optional().describe("What a false or no result means."),
    })
    .optional(),
});

export const questionSchema = z.discriminatedUnion("type", [choiceSchema, scoreSchema, noulSchema]);

export const questionsSchema = z
  .record(z.string().min(1), questionSchema)
  .refine((q) => Object.keys(q).length >= 1, { message: "at least one question" })
  .describe("Named questions evaluated in parallel against the same state. Keep each atomic.");

export const evaluateInput = {
  state: structuredTextSchema.describe("The context to judge: text, a JSON object, or an array."),
  questions: questionsSchema,
  model: z.string().optional().describe("Override JEV_MODEL for this call."),
};

export const batchEvaluateInput = {
  states: z.array(structuredTextSchema).min(1).max(1000).describe("One state per item; the same questions are asked of each."),
  questions: questionsSchema,
  model: z.string().optional(),
  concurrency: z.number().int().min(1).max(16).default(4).describe("Parallel requests (default 4)."),
};
