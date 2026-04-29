import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const {
  generateLocalOpenAiApiKeyFile,
  parseDotenv,
  renderLocalOpenAiApiKeyModule,
  resolveLocalOpenAiApiKey,
} = await import("./generate-local-openai-key.mjs");

assert.deepEqual(
  parseDotenv("LOCAL_EMBED_OPENAI_KEY=1\nOPENAI_API_KEY=sk-file\n"),
  {
    LOCAL_EMBED_OPENAI_KEY: "1",
    OPENAI_API_KEY: "sk-file",
  },
);

assert.equal(resolveLocalOpenAiApiKey({ dotenv: {}, env: {} }), null);
assert.equal(
  resolveLocalOpenAiApiKey({
    dotenv: { LOCAL_EMBED_OPENAI_KEY: "1", OPENAI_API_KEY: " sk-file-key " },
    env: {},
  }),
  "sk-file-key",
);
assert.equal(
  resolveLocalOpenAiApiKey({
    dotenv: { LOCAL_EMBED_OPENAI_KEY: "1", OPENAI_API_KEY: "sk-file-key" },
    env: { OPENAI_API_KEY: "sk-env-key" },
  }),
  "sk-env-key",
);
assert.throws(
  () =>
    resolveLocalOpenAiApiKey({
      dotenv: { LOCAL_EMBED_OPENAI_KEY: "1" },
      env: {},
    }),
  /OPENAI_API_KEY/,
);

assert.match(renderLocalOpenAiApiKeyModule(null), /localOpenAiApiKey = null/);
assert.match(renderLocalOpenAiApiKeyModule("sk-demo-key"), /"sk-demo-key"/);

const rootDir = await mkdtemp(path.join(tmpdir(), "openai-key-generator-"));
try {
  const outputFile = path.join(
    rootDir,
    "src/config/localOpenAiApiKey.generated.ts",
  );
  await generateLocalOpenAiApiKeyFile({
    dotenv: { LOCAL_EMBED_OPENAI_KEY: "1", OPENAI_API_KEY: "sk-file-key" },
    env: {},
    outputFile,
  });

  const generated = await readFile(outputFile, "utf8");
  assert.match(generated, /"sk-file-key"/);
} finally {
  await rm(rootDir, { force: true, recursive: true });
}

console.log("local OpenAI secret generator checks passed");
