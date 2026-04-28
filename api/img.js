/**
 * Vercel Serverless Function: Image proxy with caching.
 *
 * Usage: /api/img?url=<encoded_url>
 *
 * Why:
 * - Avoid Mixed Content (HTTPS site requesting HTTP images)
 * - Improve reliability by caching at the edge (s-maxage)
 * - Centralize timeouts/retries and allowlisting
 */
 
const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_URL_LENGTH = 2048;
 
function getAllowedHosts() {
  // Comma-separated list, e.g. "repo-1.in.tv.br,repo-2.in.tv.br"
  const raw = process.env.IMAGE_PROXY_ALLOW_HOSTS;
  if (raw && raw.trim()) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  // Safe default based on observed EPG image host(s).
  return ['repo-1.in.tv.br'];
}
 
function isAllowedHost(hostname, allowedHosts) {
  const h = String(hostname || '').toLowerCase();
  return allowedHosts.some((x) => String(x).toLowerCase() === h);
}
 
function setCacheHeaders(res, contentType) {
  // Cache on Vercel edge (CDN). Adjust to your needs.
  // - s-maxage: cache in CDN
  // - stale-while-revalidate: allow serving stale while revalidating
  // For images that rarely change, these defaults are reasonable.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800');
  if (contentType) res.setHeader('Content-Type', contentType);
}
 
export default async function handler(req, res) {
  try {
    const urlParam = req.query?.url;
    if (!urlParam || typeof urlParam !== 'string') {
      res.status(400).json({ error: 'Missing "url" query parameter.' });
      return;
    }
    if (urlParam.length > MAX_URL_LENGTH) {
      res.status(414).json({ error: 'URL too long.' });
      return;
    }
 
    let target;
    try {
      target = new URL(urlParam);
    } catch {
      res.status(400).json({ error: 'Invalid URL.' });
      return;
    }
 
    const allowedHosts = getAllowedHosts();
    if (!isAllowedHost(target.hostname, allowedHosts)) {
      res.status(403).json({ error: `Host not allowed: ${target.hostname}` });
      return;
    }
 
    // Only proxy http/https.
    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      res.status(400).json({ error: 'Only http/https URLs are supported.' });
      return;
    }
 
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
 
    const upstream = await fetch(target.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        // Some origins are picky; provide a basic UA + accept for images.
        'accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'user-agent': 'appVideo-image-proxy/1.0',
      },
    }).finally(() => clearTimeout(timeout));
 
    if (!upstream.ok) {
      // Cache errors briefly so the UI doesn't hammer the origin.
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60');
      res.status(upstream.status).json({
        error: 'Upstream error',
        status: upstream.status,
        statusText: upstream.statusText,
      });
      return;
    }
 
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    setCacheHeaders(res, contentType);
 
    // Stream the response.
    const arrayBuffer = await upstream.arrayBuffer();
    res.status(200).send(Buffer.from(arrayBuffer));
  } catch (err) {
    const message = err?.name === 'AbortError' ? 'Upstream timeout' : (err?.message || 'Unknown error');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30');
    res.status(504).json({ error: message });
  }
}

