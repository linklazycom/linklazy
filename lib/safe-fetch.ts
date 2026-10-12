import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";
import { assertPublicHttpUrl, isBlockedIp, UrlNotAllowedError } from "@/lib/safe-url";

/**
 * SSRF-safe server-side HTTP client (audit R2/R3). Use it for EVERY fetch of a
 * URL that a user (or an admin-entered provider URL) controls.
 *
 * Protections:
 *  - static URL rules (protocol, port, credentials, internal hostnames) via lib/safe-url.ts
 *  - the hostname is resolved and EVERY returned address is checked; the
 *    connection is then made to that exact checked address (a custom `lookup`
 *    is used at connect time), which defeats DNS-rebinding
 *  - redirects are followed manually and each hop is re-validated
 *  - timeout and response-size limits; compressed bodies are size-limited after decompression
 *
 * Runs on the Node.js runtime only (not Edge).
 */

export type SafeFetchErrorCode =
  | "blocked"
  | "invalid_url"
  | "timeout"
  | "too_large"
  | "too_many_redirects"
  | "network";

export class SafeFetchError extends Error {
  code: SafeFetchErrorCode;
  constructor(code: SafeFetchErrorCode, message: string) {
    super(message);
    this.name = "SafeFetchError";
    this.code = code;
  }
}

export interface SafeFetchOptions {
  method?: "GET" | "POST" | "HEAD";
  headers?: Record<string, string>;
  body?: string;
  /** Total time budget for the whole call, including redirects. Default 10s. */
  timeoutMs?: number;
  /** Max response bytes read. Default 2 MB. */
  maxBytes?: number;
  /** When the body exceeds maxBytes: truncate (true) or throw "too_large" (false, default). */
  truncate?: boolean;
  /** Redirects to follow. Default 5. Each hop is re-validated. */
  maxRedirects?: number;
  /** Test hook: replaces DNS resolution. Must return every address for the host. */
  resolveAll?: (hostname: string) => Promise<string[]>;
}

export interface SafeFetchResponse {
  status: number;
  ok: boolean;
  /** Final URL after redirects. */
  url: string;
  headers: Record<string, string>;
  text: string;
  truncated: boolean;
}

const DEFAULT_UA = "Mozilla/5.0 (compatible; LinkLazyBot/1.0; +https://linklazy.com)";

async function defaultResolveAll(hostname: string): Promise<string[]> {
  const results = await dns.promises.lookup(hostname, { all: true, verbatim: true });
  return results.map((r) => r.address);
}

/**
 * Builds the `lookup` function Node's http(s) uses to resolve the host at
 * connect time. It resolves, rejects if ANY address is blocked, and hands back
 * a validated address — so the socket can only ever connect to a checked IP.
 */
export function createGuardedLookup(resolveAll: (hostname: string) => Promise<string[]>) {
  return (
    hostname: string,
    options: dns.LookupOptions,
    callback: (err: NodeJS.ErrnoException | null, address?: string | dns.LookupAddress[], family?: number) => void
  ) => {
    resolveAll(hostname)
      .then((addresses) => {
        if (addresses.length === 0) {
          callback(Object.assign(new Error("DNS lookup returned no addresses"), { code: "ENOTFOUND" }));
          return;
        }
        if (addresses.some((a) => isBlockedIp(a))) {
          callback(Object.assign(new Error("Blocked address"), { code: "EBLOCKED" }));
          return;
        }
        if (options && options.all) {
          callback(
            null,
            addresses.map((address) => ({ address, family: net.isIP(address) })) as dns.LookupAddress[]
          );
        } else {
          callback(null, addresses[0], net.isIP(addresses[0]));
        }
      })
      .catch((err: NodeJS.ErrnoException) => callback(err));
  };
}

function decompressStream(encoding: string | undefined) {
  switch ((encoding ?? "").toLowerCase()) {
    case "gzip":
    case "x-gzip":
      return zlib.createGunzip();
    case "deflate":
      return zlib.createInflate();
    case "br":
      return zlib.createBrotliDecompress();
    default:
      return null;
  }
}

interface RawResponse {
  status: number;
  headers: Record<string, string>;
  text: string;
  truncated: boolean;
}

function requestOnce(
  url: URL,
  opts: Required<Pick<SafeFetchOptions, "method" | "maxBytes" | "truncate">> & {
    headers: Record<string, string>;
    body?: string;
    deadline: number;
    resolveAll: (hostname: string) => Promise<string[]>;
  }
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const remaining = opts.deadline - Date.now();
    if (remaining <= 0) {
      reject(new SafeFetchError("timeout", "The request took too long."));
      return;
    }

    const lib = url.protocol === "https:" ? https : http;
    const headers: Record<string, string> = {
      "user-agent": DEFAULT_UA,
      accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.5",
      "accept-encoding": "gzip, deflate, br",
      ...opts.headers,
    };
    if (opts.body !== undefined) headers["content-length"] = String(Buffer.byteLength(opts.body));

    const req = lib.request(
      url,
      {
        method: opts.method,
        headers,
        // Connect only to addresses we have checked (anti DNS-rebinding).
        lookup: createGuardedLookup(opts.resolveAll) as unknown as net.LookupFunction,
        agent: false, // no connection reuse across users/hosts
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const outHeaders: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers)) {
          if (typeof v === "string") outHeaders[k.toLowerCase()] = v;
          else if (Array.isArray(v)) outHeaders[k.toLowerCase()] = v.join(", ");
        }

        // Redirect / no-body responses: don't read the body.
        if (status >= 300 && status < 400) {
          res.resume();
          resolve({ status, headers: outHeaders, text: "", truncated: false });
          return;
        }

        const decoder = decompressStream(outHeaders["content-encoding"]);
        const stream: NodeJS.ReadableStream = decoder ? res.pipe(decoder) : res;
        const chunks: Buffer[] = [];
        let total = 0;
        let truncated = false;
        let settled = false;

        const finish = (err?: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (err) {
            reject(err);
            return;
          }
          resolve({ status, headers: outHeaders, text: Buffer.concat(chunks).toString("utf8"), truncated });
        };

        stream.on("data", (chunk: Buffer) => {
          if (settled) return;
          total += chunk.length;
          if (total > opts.maxBytes) {
            if (!opts.truncate) {
              req.destroy();
              finish(new SafeFetchError("too_large", "The response was too large."));
              return;
            }
            const allowed = opts.maxBytes - (total - chunk.length);
            if (allowed > 0) chunks.push(chunk.subarray(0, allowed));
            truncated = true;
            req.destroy();
            finish();
            return;
          }
          chunks.push(chunk);
        });
        stream.on("end", () => finish());
        stream.on("error", () => finish(new SafeFetchError("network", "The response could not be read.")));
        res.on("error", () => finish(new SafeFetchError("network", "The response could not be read.")));
      }
    );

    const timer = setTimeout(() => {
      req.destroy();
      reject(new SafeFetchError("timeout", "The request took too long."));
    }, remaining);

    req.on("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (err.code === "EBLOCKED") {
        reject(new SafeFetchError("blocked", "This URL points to a private or internal address."));
      } else {
        reject(new SafeFetchError("network", "The site could not be reached."));
      }
    });

    if (opts.body !== undefined) req.write(opts.body);
    req.end();
  });
}

export async function safeFetch(rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResponse> {
  const method = options.method ?? "GET";
  const maxBytes = options.maxBytes ?? 2 * 1024 * 1024;
  const truncate = options.truncate ?? false;
  const maxRedirects = options.maxRedirects ?? 5;
  const deadline = Date.now() + (options.timeoutMs ?? 10_000);
  const resolveAll = options.resolveAll ?? defaultResolveAll;

  let current = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    let url: URL;
    try {
      url = assertPublicHttpUrl(current);
    } catch (err) {
      if (err instanceof UrlNotAllowedError) {
        const code = err.reason === "invalid_url" ? "invalid_url" : "blocked";
        throw new SafeFetchError(code, err.message);
      }
      throw err;
    }

    const res = await requestOnce(url, {
      method,
      maxBytes,
      truncate,
      headers: options.headers ?? {},
      body: hop === 0 ? options.body : undefined,
      deadline,
      resolveAll,
    });

    const location = res.headers["location"];
    if (res.status >= 300 && res.status < 400 && location) {
      if (hop === maxRedirects) throw new SafeFetchError("too_many_redirects", "Too many redirects.");
      current = new URL(location, url).toString();
      continue;
    }

    return {
      status: res.status,
      ok: res.status >= 200 && res.status < 300,
      url: url.toString(),
      headers: res.headers,
      text: res.text,
      truncated: res.truncated,
    };
  }

  throw new SafeFetchError("too_many_redirects", "Too many redirects.");
}
