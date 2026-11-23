import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

test("POST /api/triage", async (t) => {
  process.env.PORT = "0";
  const { server } = await import("../server.mjs");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  if (!server.listening) await once(server, "listening");
  const url = `http://127.0.0.1:${server.address().port}/api/triage`;

  async function post(body) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    return { code: response.status, body: await response.json() };
  }

  await t.test("returns a topic and draft for a valid request", async () => {
    assert.deepEqual(await post(JSON.stringify({ text: "Когда будет доставка?" })), {
      code: 200,
      body: {
        status: "ready",
        topic: "delivery",
        draft: "Спасибо за обращение. Уточним детали заявки.",
      },
    });
  });

  await t.test("rejects malformed JSON and invalid text", async () => {
    for (const body of ["{", "null", "{}", '{"text":42}', '{"text":""}', '{"text":"  "}']) {
      assert.deepEqual(await post(body), {
        code: 400,
        body: { status: "invalid_input" },
      }, body);
    }
  });

  for (const marker of ["timeout", "error", "bad-json", "bad-topic", "empty-draft"]) {
    await t.test(`requests manual review for [${marker}]`, {
      timeout: marker === "timeout" ? 1000 : undefined,
    }, async () => {
      assert.deepEqual(await post(JSON.stringify({ text: `[${marker}]` })), {
        code: 200,
        body: { status: "manual_review", topic: null, draft: null },
      });
    });
  }
});
