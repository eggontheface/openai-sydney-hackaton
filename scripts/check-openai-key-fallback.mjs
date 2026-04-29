import assert from "node:assert/strict";

const { normalizeOpenAiApiKey, resolveOpenAiApiKey } =
  await import("../src/config/openAiKeyFallback.ts");

assert.equal(normalizeOpenAiApiKey(undefined), null);
assert.equal(normalizeOpenAiApiKey(null), null);
assert.equal(normalizeOpenAiApiKey("   "), null);
assert.equal(normalizeOpenAiApiKey(123), null);
assert.equal(normalizeOpenAiApiKey(" sk-demo-key "), "sk-demo-key");

assert.deepEqual(
  resolveOpenAiApiKey({
    storedApiKey: " sk-byo-key ",
    storedSource: "secure_store",
    embeddedApiKey: "sk-demo-key",
  }),
  {
    apiKey: "sk-byo-key",
    source: "secure_store",
  },
);

assert.deepEqual(
  resolveOpenAiApiKey({
    storedApiKey: null,
    storedSource: "secure_store",
    embeddedApiKey: " sk-demo-key ",
  }),
  {
    apiKey: "sk-demo-key",
    source: "embedded",
  },
);

assert.deepEqual(
  resolveOpenAiApiKey({
    storedApiKey: null,
    storedSource: "local_storage",
    embeddedApiKey: undefined,
  }),
  {
    apiKey: null,
    source: null,
  },
);

console.log("OpenAI key fallback checks passed");
