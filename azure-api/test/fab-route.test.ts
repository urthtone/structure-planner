import { describe, expect, it, vi } from 'vitest';
import { createFabHandler, fabDraftSchema, type FabDraft } from '../src/fab-route';
import { createPlanHandler } from '../src/plan';
import { createRateLimitState, MAX_IMAGE_DATA_LENGTH } from '../src/vision-handler';
import { BLIND_SPEC } from './fixtures/fab-specs';

const image = 'data:image/jpeg;base64,AAAA';
const req = (body: unknown, headers: Record<string, string> = {}, method = 'POST') => new Request('https://functions.example.test/api/fab', {
  method, headers: { origin: 'https://hilltopstructures.us', 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.9', ...headers },
  ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
});
const draft: FabDraft = {
  title: 'Steel box blind', projectType: 'blind',
  photoReadings: [1, 2].map(index => ({ index, reading: `Photo ${index}: square tube frame with corrugated skin.` })),
  observations: ['Corrugated galvanized skin', 'Sliding windows on the long walls'],
  widthFt: 0, lengthFt: 0, heightFt: 0,
  profiles: [{ role: 'wall', profileId: 'sq-2x2-11ga' }, { role: 'rail', profileId: 'channel-c4x5.4' }],
  openings: [{ kind: 'window', wall: 'front', widthIn: 24, heightIn: 14, sillIn: 38 }, { kind: 'window', wall: 'back', widthIn: 24, heightIn: 14, sillIn: 0 }],
  wallPanel: 'corrugated-29ga', roofPanel: 'unknown', floorPanel: 'plywood-3/4', roofStyle: 'flat', infill: 'unknown', leaves: 0, enclosed: 'unknown', sideRailHeightIn: 0,
  assumptions: ['Scale unknown from photos.'],
};
const provider = (value: unknown = draft) => vi.fn().mockImplementation(async () => new Response(JSON.stringify({ output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] })));
const env = { XAI_API_KEY: 'test-only', VISION_PROVIDER: 'xai' };

describe('/api/fab', () => {
  it('runs the deterministic engine for a structured spec without calling the provider or needing a key', async () => {
    const fetcher = provider();
    const result = await createFabHandler({ env: {}, fetcher })(req({ spec: BLIND_SPEC }));
    expect(result.status).toBe(200);
    const body = result.jsonBody as { ok: boolean; fab: { source: string; cutList: unknown[]; nesting: unknown; bom: unknown; plans: { parts: unknown[]; assembly: unknown[] } } };
    expect(body.ok).toBe(true);
    expect(body.fab.source).toBe('spec');
    expect(body.fab.cutList.length).toBeGreaterThan(5);
    expect(body.fab.plans.assembly.length).toBeGreaterThan(3);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('accepts a flat /api/plan-style payload (projectType + dims) with no images', async () => {
    const result = await createFabHandler({ env: {} })(req({ projectType: 'trailer', widthFt: 6, lengthFt: 12, heightFt: 1.5, notes: '' }));
    expect(result.status).toBe(200);
    expect((result.jsonBody as { fab: { title: string } }).fab.title).toMatch(/6′ × 12′/);
  });
  it('returns every spec problem as a 400', async () => {
    const result = await createFabHandler({ env: {} })(req({ spec: { projectType: 'blind', widthFt: 99, profiles: { floor: 'nope' } } }));
    expect(result.status).toBe(400);
    expect(result.jsonBody).toMatchObject({ ok: false, error: expect.stringMatching(/widthFt.*Unknown profile/s) });
    expect((await createFabHandler({ env: {} })(req({ spec: {} }))).status).toBe(400);
  });
  it('drafts a spec from photos with grok-4.3 strict JSON, then user values override the draft', async () => {
    const fetcher = provider();
    const result = await createFabHandler({ env, fetcher })(req({ images: [image, image], projectType: 'blind', widthFt: 6, lengthFt: 8, heightFt: 7, notes: 'my blind' }));
    expect(result.status).toBe(200);
    const fab = (result.jsonBody as { fab: { source: string; spec: { widthFt: number; skin: { wallPanel: string } }; photoReadings: unknown[]; cutList: { name: string; qty: number }[] } }).fab;
    expect(fab.source).toBe('photos');
    expect(fab.spec.widthFt).toBe(6);
    expect(fab.spec.skin.wallPanel).toBe('corrugated-29ga');
    expect(fab.photoReadings).toHaveLength(2);
    expect(fab.cutList.find(l => l.name === 'Window header')!.qty).toBe(2);
    const wire = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(wire.model).toBe('grok-4.3');
    expect(wire.text.format).toMatchObject({ type: 'json_schema', strict: true, name: 'fabrication_spec' });
    expect(wire.input[1].content.filter((c: { type: string }) => c.type === 'input_image')).toHaveLength(2);
  });
  it('labels assumed dimensions when neither the user nor the photos give them', async () => {
    const result = await createFabHandler({ env, fetcher: provider() })(req({ images: [image, image], projectType: 'blind' }));
    const fab = (result.jsonBody as { fab: { assumptions: string[] } }).fab;
    expect(fab.assumptions.join(' ')).toMatch(/not supplied or measurable/);
  });
  it('falls back to user inputs when the drafted openings do not fit', async () => {
    const bad = { ...draft, openings: [{ kind: 'door', wall: 'left', widthIn: 70, heightIn: 80, sillIn: 0 }] };
    const result = await createFabHandler({ env, fetcher: provider(bad) })(req({ images: [image, image], projectType: 'blind', widthFt: 6, lengthFt: 8, heightFt: 7 }));
    expect(result.status).toBe(200);
    expect((result.jsonBody as { fab: { assumptions: string[] } }).fab.assumptions.join(' ')).toMatch(/did not fit/);
  });
  it('rejects mismatched photo readings and invalid draft JSON as 502 without leaking provider errors', async () => {
    expect((await createFabHandler({ env, fetcher: provider({ ...draft, photoReadings: [draft.photoReadings[0]] }) })(req({ images: [image, image], projectType: 'blind' }))).status).toBe(502);
    expect((await createFabHandler({ env, fetcher: provider({ ...draft, profiles: [{ role: 'wall', profileId: 'adamantium' }] }) })(req({ images: [image, image], projectType: 'blind' }))).status).toBe(502);
    const failed = await createFabHandler({ env, fetcher: vi.fn().mockRejectedValue(new Error('secret-provider-detail')) })(req({ images: [image], projectType: 'gate' }));
    expect(failed.status).toBe(502);
    expect(JSON.stringify(failed.jsonBody)).not.toContain('secret-provider-detail');
  });
  it('returns 503 not configured for photo requests without a key, and 413 for oversized photos', async () => {
    expect((await createFabHandler({ env: {} })(req({ images: [image], projectType: 'blind' }))).status).toBe(503);
    const big = await createFabHandler({ env })(req({ images: ['data:image/jpeg;base64,' + 'A'.repeat(MAX_IMAGE_DATA_LENGTH)], projectType: 'blind' }));
    expect(big.status).toBe(413);
    expect(big.jsonBody).toMatchObject({ ok: false, error: expect.stringMatching(/Photo 1.*Resize/) });
  });
  it('keeps exact-origin CORS and preflight', async () => {
    const handler = createFabHandler({ env: {} });
    expect((await handler(req(undefined, {}, 'OPTIONS'))).status).toBe(204);
    const denied = await handler(req({ spec: BLIND_SPEC }, { origin: 'https://evil.test' }));
    expect(denied.status).toBe(403);
    expect(new Headers(denied.headers).has('Access-Control-Allow-Origin')).toBe(false);
  });
  it('shares the photo quota with /api/plan but gives spec-only requests their own larger quota', async () => {
    const rateLimitState = createRateLimitState();
    const shared = { env: { ...env, RATE_LIMIT_MAX: '1', RATE_LIMIT_SPEC_MAX: '2' }, rateLimitState, fetcher: provider() };
    await createPlanHandler(shared)(new Request('https://functions.example.test/api/plan', { method: 'POST', headers: { origin: 'https://hilltopstructures.us', 'x-forwarded-for': '192.0.2.9' }, body: JSON.stringify({ images: [image], structureType: 'shed', estimateSize: true, material: 'metal', notes: '' }) }));
    expect((await createFabHandler(shared)(req({ images: [image, image], projectType: 'blind' }))).status).toBe(429);
    const fab = createFabHandler(shared);
    expect((await fab(req({ spec: BLIND_SPEC }))).status).toBe(200);
    expect((await fab(req({ spec: BLIND_SPEC }))).status).toBe(200);
    expect((await fab(req({ spec: BLIND_SPEC }))).status).toBe(429);
  });
  it('exposes a strict-compatible draft schema', () => {
    expect(fabDraftSchema.safeParse(draft).success).toBe(true);
  });
});
describe('/api/fab opening defaults', () => {
  it('keeps visible openings of unknown size with labeled assumed sizes', async () => {
    const unknown = { ...draft, openings: [{ kind: 'window', wall: 'front', widthIn: 0, heightIn: 0, sillIn: 0 }, { kind: 'door', wall: 'left', widthIn: 0, heightIn: 0, sillIn: 0 }] };
    const result = await createFabHandler({ env, fetcher: provider(unknown) })(req({ images: [image, image], projectType: 'blind', widthFt: 6, lengthFt: 8, heightFt: 7 }));
    const fab = (result.jsonBody as { fab: { spec: { openings: unknown[] }; assumptions: string[] } }).fab;
    expect(fab.spec.openings).toHaveLength(2);
    expect(fab.assumptions.join(' ')).toMatch(/opening size\(s\) not measurable/);
  });
});
