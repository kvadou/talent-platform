import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import https from 'https';
import http from 'http';
import { lookup } from 'dns/promises';
import net from 'net';
import { getRequestIp, rateLimit } from '@/lib/security/rate-limit';

const MAX_REDIRECTS = 3;
const MAX_BYTES = 15 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;
const allowedHosts = (process.env.RESUME_PROXY_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

function hostAllowed(host: string): boolean {
  const candidate = host.toLowerCase();
  return allowedHosts.some((allowed) => {
    if (allowed.startsWith('*.')) {
      const suffix = allowed.slice(1);
      return candidate.endsWith(suffix);
    }
    return candidate === allowed;
  });
}

function isPrivateIpAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    return (
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:')
    );
  }
  return true;
}

export async function GET(request: NextRequest) {
  const session = await getSession();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const ip = getRequestIp(request);
  const limitResult = await rateLimit(`resume-proxy:${ip}`, 30, 60_000);
  if (!limitResult.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // Support both base64-encoded (b param) and URL-encoded (url param)
  const base64Url = request.nextUrl.searchParams.get('b');
  let url = request.nextUrl.searchParams.get('url');

  if (base64Url) {
    try {
      url = Buffer.from(base64Url, 'base64').toString('utf-8');
    } catch {
      return NextResponse.json({ error: 'Invalid base64 encoding' }, { status: 400 });
    }
  }

  if (!url) {
    return NextResponse.json({ error: 'URL parameter required' }, { status: 400 });
  }

  try {
    if (allowedHosts.length === 0) {
      return NextResponse.json({ error: 'Resume proxy host allowlist is not configured' }, { status: 500 });
    }

    const fetchPdf = async (
      targetUrl: string,
      redirectDepth = 0
    ): Promise<{ buffer: Buffer; contentType: string }> => {
      if (redirectDepth > MAX_REDIRECTS) {
        throw new Error('Too many redirects');
      }

      const parsedUrl = new URL(targetUrl);
      if (!['https:', 'http:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid URL protocol');
      }
      if (!hostAllowed(parsedUrl.hostname)) {
        throw new Error('Host is not allowed');
      }

      const resolved = await lookup(parsedUrl.hostname, { all: true });
      if (resolved.some((entry) => isPrivateIpAddress(entry.address))) {
        throw new Error('Blocked private network target');
      }

      return new Promise((resolve, reject) => {
        const client = parsedUrl.protocol === 'https:' ? https : http;
        const req = client.request({
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || undefined,
          path: `${parsedUrl.pathname}${parsedUrl.search}`,
          method: 'GET',
          timeout: REQUEST_TIMEOUT_MS,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'application/pdf,*/*',
            'Host': parsedUrl.host,
          },
        }, (res) => {
          // Handle redirects
          if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
            const location = res.headers.location;
            if (location) {
              const nextUrl = new URL(location, parsedUrl).toString();
              fetchPdf(nextUrl, redirectDepth + 1).then(resolve).catch(reject);
              return;
            }
          }

          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
            return;
          }

          const contentType = res.headers['content-type'] || 'application/pdf';
          const chunks: Buffer[] = [];
          let totalBytes = 0;
          res.on('data', (chunk) => {
            totalBytes += chunk.length;
            if (totalBytes > MAX_BYTES) {
              req.destroy(new Error('File too large'));
              return;
            }
            chunks.push(chunk);
          });
          res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType }));
          res.on('error', reject);
        });
        req.on('timeout', () => req.destroy(new Error('Upstream timeout')));
        req.on('error', reject);
        req.end();
      });
    };

    const { buffer, contentType } = await fetchPdf(url);

    // Return the PDF with proper headers for iframe embedding
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch resume' },
      { status: 500 }
    );
  }
}
