import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const image = "data:image/jpeg;base64,/9j/";
const request = (body: unknown) =>
  new Request("http://localhost/api/analyze", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
const analysis = {
  groundSlope: "unknown",
  groundType: "grass",
  obstructions: ["tree"],
  sunShade: "partial shade",
  styleHints: ["gable"],
  suggestedFoundation: "piers",
  notes: ["Verify soil on site"],
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("optional vision endpoint", () => {
  it("works without credentials and explains configuration", async () => {
    vi.stubEnv("XAI_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    const res = await POST(request({ images: [image] }));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("not_configured");
  });
  it("rejects invalid and excessive images before calling a model", async () => {
    for (const images of [
      [],
      Array(6).fill(image),
      ["https://example.com/a.jpg"],
      ["data:image/svg+xml;base64,AAAA"],
    ]) {
      expect((await POST(request({ images }))).status).toBe(400);
    }
  });
  it("returns structured suggestions from the configured provider", async () => {
    vi.stubEnv("XAI_API_KEY", "test-only-key");
    vi.stubEnv("VISION_MODEL", "test-vision");
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(analysis) } }],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    const res = await POST(request({ images: [image] }));
    expect(res.status).toBe(200);
    expect((await res.json()).analysis.suggestedFoundation).toBe("piers");
    expect(fetcher.mock.calls[0][0]).toBe(
      "https://api.x.ai/v1/chat/completions",
    );
    expect(JSON.parse(fetcher.mock.calls[0][1].body).model).toBe("test-vision");
  });
  it("does not leak provider errors or keys", async () => {
    vi.stubEnv("XAI_API_KEY", "test-only-secret");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("private provider detail", { status: 401 }),
        ),
    );
    const res = await POST(request({ images: [image] }));
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("private provider detail");
  });
  it("rejects malformed model output instead of applying it", async () => {
    vi.stubEnv("XAI_API_KEY", "test-only-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    ...analysis,
                    suggestedFoundation: "magic",
                  }),
                },
              },
            ],
          }),
        ),
      ),
    );
    expect((await POST(request({ images: [image] }))).status).toBe(502);
  });
});

it("supports OpenAI and a configurable compatible HTTPS endpoint", async () => {
  vi.stubEnv("XAI_API_KEY", "");
  vi.stubEnv("OPENAI_API_KEY", "test-only-openai-key");
  vi.stubEnv("VISION_BASE_URL", "https://vision.example.test/v1/");
  vi.stubEnv("VISION_MODEL", "custom-vision");
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(analysis) } }],
        }),
      ),
    );
  vi.stubGlobal("fetch", fetcher);
  expect((await POST(request({ images: [image] }))).status).toBe(200);
  expect(fetcher.mock.calls[0][0]).toBe(
    "https://vision.example.test/v1/chat/completions",
  );
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBe(
    "Bearer test-only-openai-key",
  );
});

it("rejects oversized bodies, malformed JSON and unsafe provider URLs", async () => {
  const large = new Request("http://localhost/api/analyze", {
    method: "POST",
    body: "{}",
    headers: { "content-length": "4500001" },
  });
  expect((await POST(large)).status).toBe(400);
  expect(
    (
      await POST(
        new Request("http://localhost/api/analyze", {
          method: "POST",
          body: "{",
        }),
      )
    ).status,
  ).toBe(400);
  vi.stubEnv("XAI_API_KEY", "test-only-key");
  vi.stubEnv("VISION_BASE_URL", "http://unsafe.example.test/v1");
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  expect((await POST(request({ images: [image] }))).status).toBe(502);
  expect(fetcher).not.toHaveBeenCalled();
});
