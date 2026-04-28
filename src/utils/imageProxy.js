const DEFAULT_ALLOWED_HOSTS = ['repo-1.in.tv.br'];

function safeParseUrl(input) {
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

function isHttpUrl(url) {
  return url?.protocol === 'http:' || url?.protocol === 'https:';
}

function isAllowedHost(hostname, allowedHosts) {
  const h = String(hostname || '').toLowerCase();
  return allowedHosts.some((x) => String(x).toLowerCase() === h);
}

/**
 * Returns a same-origin proxied URL for remote images to avoid Mixed Content and
 * improve reliability via Vercel edge caching.
 *
 * - Only proxies http(s) URLs.
 * - Only proxies allowlisted hosts.
 */
export function proxyImageUrl(inputUrl, opts = {}) {
  if (!inputUrl || typeof inputUrl !== 'string') return inputUrl;

  const parsed = safeParseUrl(inputUrl);
  if (!parsed || !isHttpUrl(parsed)) return inputUrl;

  const allowedHosts = Array.isArray(opts.allowedHosts) && opts.allowedHosts.length > 0
    ? opts.allowedHosts
    : DEFAULT_ALLOWED_HOSTS;

  if (!isAllowedHost(parsed.hostname, allowedHosts)) return inputUrl;

  // Same-origin proxy route on Vercel.
  const proxied = new URL('/api/img', window.location.origin);
  proxied.searchParams.set('url', parsed.toString());
  return proxied.toString();
}

