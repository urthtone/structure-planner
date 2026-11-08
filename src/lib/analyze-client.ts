import { parseAnalysis, type PhotoAnalysis } from './analysis';
type AnalysisResult = {status:'ok';analysis:PhotoAnalysis} | {status:'error'|'not_configured';message:string};
export async function requestAnalysis(images: string[], endpoint: string | undefined, fetcher: typeof fetch = fetch): Promise<AnalysisResult> {
  if (!endpoint) return {status:'not_configured',message:'Photo analysis not configured. Manual planning works fully without it.'};
  const url = new URL(endpoint);
  if (url.username || url.password || url.search || url.hash ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))))
    throw new Error('Use a public HTTPS analysis URL without credentials, query keys or fragments.');
  const response = await fetcher(url.href,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({images}),
    signal:AbortSignal.timeout(45000),credentials:'omit',cache:'no-store',
  });
  const data = await response.json();
  if (response.ok && data.status === 'ok') return {status:'ok',analysis:parseAnalysis(data.analysis)};
  return {status:data.status === 'not_configured' ? 'not_configured' : 'error',message:typeof data.message === 'string' ? data.message : 'Photo analysis unavailable; continue planning manually.'};
}
