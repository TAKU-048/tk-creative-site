// 静的ファイルに一致しなかったリクエストだけがここに来る。
// トップURL（/）はさくらと同じく index.html を返す。それ以外は404。
// 2026-10-26：静的ファイルと同じブラウザ向けの安全設定（site/tk-creative.org/_headers と同じ内容）をここでも付ける。
const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Content-Security-Policy": "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self' https://formspree.io; upgrade-insecure-requests",
};

function withSecurityHeaders(response) {
  const res = new Response(response.body, response);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
  return res;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      return withSecurityHeaders(await env.ASSETS.fetch(new Request(new URL("/index.html", url), request)));
    }
    return withSecurityHeaders(new Response("Not Found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    }));
  },
};
