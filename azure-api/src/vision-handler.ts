import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { HttpResponseInit } from '@azure/functions';

/** Base64 data-URL characters per photo (≈2.1 MB of JPEG). Larger phone photos are rejected with a clear 413. */
export const MAX_IMAGE_DATA_LENGTH = 2_800_000;
export const MAX_PHOTOS = 10;
/** 10 photos at the cap plus spec/notes headroom. */
export const MAX_BODY_BYTES = 29_000_000;
const mb = (n: number) => (n / 1_000_000).toFixed(1);
export class PayloadTooLargeError extends Error {}
interface BodyRequest {
  headers: { get(name: string): string | null };
  body: { getReader(): {
    read(): Promise<{done?: boolean;value?: Uint8Array}>;
    cancel(): Promise<void>;
    releaseLock(): void;
  } } | null;
}
export interface AnalysisRequest extends BodyRequest { method: string }
export type Environment = Record<string, string | undefined>;
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const positive = (value: string | undefined, fallback: number, max: number) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= max ? number : fallback;
};
async function readBoundedJson(request: BodyRequest, maxBytes = MAX_BODY_BYTES): Promise<unknown> {
  const declared = Number(request.headers.get("content-length"));
  if (declared > maxBytes)
    throw new PayloadTooLargeError(`Request is ${mb(declared)} MB; the limit is ${mb(maxBytes)} MB. Resize photos to about 1600 px on the long side (JPEG quality ~80) and retry.`);
  if (!request.body) throw new Error("Missing body.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) throw new Error("Invalid body stream.");
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new PayloadTooLargeError(`Request exceeds the ${mb(maxBytes)} MB limit. Resize photos to about 1600 px on the long side (JPEG quality ~80) and retry.`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(body));
}


function responseText(result: unknown, xai: boolean): string {
  const root = object(result);
  if (xai && Array.isArray(root.output)) {
    for (const item of root.output) {
      const message = object(item);
      if (message.type !== 'message' || !Array.isArray(message.content)) continue;
      for (const part of message.content) {
        const content = object(part);
        if (content.type === 'output_text' && typeof content.text === 'string') return content.text;
      }
    }
  } else if (Array.isArray(root.choices)) {
    const text = object(object(root.choices[0]).message).content;
    if (typeof text === 'string') return text;
  }
  throw new Error('Missing provider output.');
}

// App Service/proxies can append a source port. It must not create a fresh
// quota bucket for each TCP connection. Canonicalize IPv6 spellings as well.
function requestIp(forwarded: string | null): string {
  let address=forwarded?.split(',').at(-1)?.trim().slice(0,128) || '';
  const bracketed=address.match(/^\[([^\]]+)\](?::\d+)?$/);
  if(bracketed) address=bracketed[1];
  else if(/^[\d.]+:\d+$/.test(address)) address=address.slice(0,address.lastIndexOf(':'));
  const family=isIP(address);
  if(!family) return 'unknown';
  if(family===6) {
    try {return new URL(`http://[${address}]/`).hostname.slice(1,-1);}
    catch {return 'unknown';}
  }
  return address;
}

export interface RateLimitState {
  buckets: Map<string, {count:number;expires:number}>;
  cleanupAt: number;
}
export const createRateLimitState = (): RateLimitState => ({buckets:new Map(),cleanupAt:0});
export interface HandlerOptions {
  env?: Environment;
  fetcher?: typeof fetch;
  now?: () => number;
  rateLimitState?: RateLimitState;
}
export class RequestValidationError extends Error {}
export interface VisionTask<T> {
  name: string;
  schema: object;
  systemPrompt: string;
  parseInput(body: Record<string,unknown>): T;
  prompt(input: T, images: string[]): string;
  result(value: unknown, input: T, images: string[]): Record<string,unknown>;
  maxTokens?: number;
  lowLatency?: boolean;
  /**
   * When set, a request with no images skips the vision provider entirely and
   * returns direct(input). Used by /api/fab for structured specs. These calls use a
   * separate, more generous per-IP quota (RATE_LIMIT_SPEC_MAX, default 120/window).
   */
  direct?(input: T): Record<string,unknown>;
  providerTimeoutMs?: number;
}

/** Best-effort process-local limiter, not distributed auth/DDoS protection. See DEPLOY.md. */
export function createVisionHandler<T>(task: VisionTask<T>, options: HandlerOptions = {}) {
  const env = options.env ?? process.env;
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const allowed = (env.ALLOWED_ORIGINS || 'https://hilltopstructures.us').split(',').map(value => value.trim());
  const validOrigins = allowed.every(value => {
    try {
      const url = new URL(value);
      return url.origin === value && (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname)));
    } catch { return false; }
  });
  const windowMs = positive(env.RATE_LIMIT_WINDOW_SECONDS,600,86400) * 1000;
  const maxRequests = positive(env.RATE_LIMIT_MAX,10,1000);
  const specMax = positive(env.RATE_LIMIT_SPEC_MAX,120,10000);
  const state = options.rateLimitState ?? createRateLimitState();
  const {buckets} = state;
  return async (request: AnalysisRequest): Promise<HttpResponseInit> => {
    const origin = request.headers.get('origin');
    const permitted = !!origin && validOrigins && allowed.includes(origin);
    const headers: Record<string,string> = { 'Cache-Control':'no-store', Vary:'Origin', 'X-Content-Type-Options':'nosniff' };
    if (permitted) Object.assign(headers,{
      'Access-Control-Allow-Origin':origin,
      'Access-Control-Allow-Methods':'POST, OPTIONS',
      'Access-Control-Allow-Headers':'Content-Type, X-Analysis-Key, X-Functions-Key',
      'Access-Control-Max-Age':'600',
    });
    const reply = (jsonBody: unknown, status = 200): HttpResponseInit => ({status,jsonBody,headers});
    if (!validOrigins) return reply({status:'error',message:'Analysis origin configuration is invalid.'},503);
    if ((origin && !permitted) || (!origin && env.REQUIRE_ORIGIN !== 'false'))
      return reply({status:'error',message:'Origin not allowed.'},403);
    if (request.method === 'OPTIONS') return {status:204,headers};
    if (request.method !== 'POST') return {...reply({status:'error',message:'Use POST.'},405),headers:{...headers,Allow:'POST, OPTIONS'}};
    if (env.ANALYZE_SHARED_KEY) {
      const supplied = Buffer.from(request.headers.get('x-analysis-key') || '');
      const expected = Buffer.from(env.ANALYZE_SHARED_KEY);
      if (supplied.length !== expected.length || !timingSafeEqual(supplied,expected))
        return reply({status:'error',message:'Analysis authorization required.'},401);
    }
    const time = now();
    if (time >= state.cleanupAt || buckets.size >= 10000) {
      for (const [key, bucket] of buckets) if (time >= bucket.expires) buckets.delete(key);
      state.cleanupAt = time + windowMs;
    }
    // Trust only the last proxy-appended hop, not the caller-controlled first entry.
    // Verify ingress header behavior before deployment; unidentified callers share a bucket.
    const ip = requestIp(request.headers.get('x-forwarded-for'));
    const take = (key: string, max: number) => {
      const prior = buckets.get(key);
      const bucket = prior && time < prior.expires ? prior : {count:0,expires:time+windowMs};
      if (bucket.count >= max || (!prior && buckets.size >= 10000)) {
        headers['Retry-After'] = String(Math.max(1,Math.ceil((bucket.expires-time)/1000)));
        return false;
      }
      bucket.count++; buckets.set(key,bucket);
      return true;
    };
    const tooMany = () => reply({status:'error',message:'Too many photo requests; wait before retrying or continue manually.'},429);
    // Photo requests are charged before the body is read; spec-only requests are charged after.
    if (!task.direct && !take(ip,maxRequests)) return tooMany();
    let images: string[];
    let input: T;
    try {
      const body = object(await readBoundedJson(request));
      const value = body.images ?? (task.direct ? [] : undefined);
      if (!Array.isArray(value) || value.length > MAX_PHOTOS || (!task.direct && value.length < 1))
        throw new RequestValidationError(`Send ${task.direct ? '0' : '1'}–${MAX_PHOTOS} photos as JPEG/PNG data URLs.`);
      value.forEach((image, i) => {
        if (typeof image !== 'string' || !/^data:image\/(jpeg|png|webp|gif);base64,/.test(image))
          throw new RequestValidationError(`Photo ${i+1} is not a JPEG/PNG/WebP/GIF base64 data URL.`);
        if (image.length > MAX_IMAGE_DATA_LENGTH)
          throw new PayloadTooLargeError(`Photo ${i+1} is ${mb(image.length)} MB encoded; the limit is ${mb(MAX_IMAGE_DATA_LENGTH)} MB per photo. Resize it to about 1600 px on the long side (JPEG quality ~80) and retry.`);
        if (!/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(image))
          throw new RequestValidationError(`Photo ${i+1} is not a JPEG/PNG/WebP/GIF base64 data URL.`);
      });
      images = value as string[];
      input = task.parseInput(body);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) return reply({status:'error',message:error.message},413);
      if (error instanceof RequestValidationError) return reply({status:'error',message:error.message},400);
      return reply({status:'error',message:`Send valid JSON with 1–10 JPEG/PNG data URLs, each under ${mb(MAX_IMAGE_DATA_LENGTH)} MB encoded; total request under ${mb(MAX_BODY_BYTES)} MB.`},400);
    }
    if (task.direct && !images.length) {
      if (!take('spec:'+ip,specMax)) return tooMany();
      try { return reply({status:'ok',...task.direct(input)}); }
      catch (error) {
        if (error instanceof RequestValidationError) return reply({status:'error',message:error.message},400);
        return reply({status:'error',message:'Could not build the plan from that spec.'},500);
      }
    }
    if (task.direct && !take(ip,maxRequests)) return tooMany();
    if (env.VISION_PROVIDER && !['xai','openai','auto'].includes(env.VISION_PROVIDER))
      return reply({status:'error',message:'Invalid photo-analysis provider configuration.'},503);
    const automatic = !env.VISION_PROVIDER || env.VISION_PROVIDER === 'auto';
    const xai = automatic ? !!env.XAI_API_KEY : env.VISION_PROVIDER === 'xai';
    const key = xai ? env.XAI_API_KEY : env.OPENAI_API_KEY;
    if (!key) return reply({status:'not_configured',message:'Photo analysis not configured. Set XAI_API_KEY on the Function app; manual planning remains available.'});
    if (xai && images.some(image => !/^data:image\/(jpeg|png);/.test(image)))
      return reply({status:'error',message:'xAI requires JPEG or PNG. Upload through the planner to compress other raster formats to JPEG.'},400);
    try {
      const base = new URL(env.VISION_BASE_URL || (xai ? 'https://api.x.ai/v1' : 'https://api.openai.com/v1'));
      if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw new Error('Invalid provider base.');
      const userPrompt = task.prompt(input,images);
      const model = env.VISION_MODEL || (xai ? 'grok-4.3' : 'gpt-4o');
      const body = xai ? {
        model, store:false, max_output_tokens:task.maxTokens ?? 2000,
        // Grok 4.3 defaults to low reasoning. Long plans otherwise exhaust the
        // bounded request budget. Only apply to documented compatible IDs.
        ...(task.lowLatency && ['grok-4.3','grok-4.3-latest'].includes(model) ? {reasoning:{effort:'none'}} : {}),
        input:[{role:'system',content:task.systemPrompt},{role:'user',content:[{type:'input_text',text:userPrompt},...images.map(image_url=>({type:'input_image',image_url}))]}],
        text:{format:{type:'json_schema',name:task.name,strict:true,schema:task.schema}},
      } : {
        model,store:false,max_tokens:task.maxTokens ?? 1600,response_format:{type:'json_object'},
        messages:[{role:'system',content:task.systemPrompt},{role:'user',content:[{type:'text',text:`${userPrompt}\nRequired JSON schema: ${JSON.stringify(task.schema)}`},...images.map(url=>({type:'image_url',image_url:{url}}))]}],
      };
      const response = await fetcher(`${base.href.replace(/\/$/,'')}/${xai ? 'responses' : 'chat/completions'}`,{
        method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
        signal:AbortSignal.timeout(task.providerTimeoutMs ?? 80000),body:JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Provider failed.');
      const text = responseText(await readBoundedJson(response,128000),xai);
      if (text.length > 24000) throw new Error('Oversized analysis.');
      return reply({status:'ok',...task.result(JSON.parse(text),input,images)});
    } catch {
      return reply({status:'error',message:'Photo analysis is temporarily unavailable or the provider returned invalid data. Check Function provider/model settings; continue planning manually.'},502);
    }
  };
}
