import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["./dist/index.js"],
  cwd: process.cwd(),
});
const client = new Client({ name: "ask-jev-smoke", version: "1.0.0" });

try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  const names = tools.map((tool) => tool.name).sort();
  const expected = ["jev_batch_evaluate", "jev_evaluate", "jev_ping"];

  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected MCP tools: ${names.join(", ")}`);
  }

  console.log(`MCP smoke test passed: ${names.join(", ")}`);
} finally {
  await client.close();
}
