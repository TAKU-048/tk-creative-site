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

// 2026-10-31：contact@tk-creative.org に届いたメールの処理（Cloudflare Email Routing から呼ばれる）。
// 1) これまでどおり Gmail へ転送する（転送が最優先。失敗したら送信元へエラーを返す）
// 2) 定期タスク「contact@tk-creative.org 受信時の確認と通知」を呼び出す（差出人・件名・日時だけを渡す。本文は渡さない）
//    ROUTINE_FIRE_URL・ROUTINE_FIRE_TOKEN は Worker のシークレット（未設定なら呼び出しは行わない）
const FORWARD_TO = "takuma.yamaura@gmail.com";
const SKIP_FROM = /(mailer-daemon|postmaster|no-?reply|bounce)/i;

async function fireRoutine(message, env) {
  if (!env.ROUTINE_FIRE_URL || !env.ROUTINE_FIRE_TOKEN) return;
  if (SKIP_FROM.test(message.from || "")) return;
  const subject = (message.headers.get("subject") || "").slice(0, 300);
  const text = [
    "contact@tk-creative.org にメールが届きました。",
    `差出人：${message.from}`,
    `宛先：${message.to}`,
    `件名：${subject}`,
    `受信日時：${new Date().toISOString()}`,
  ].join("\n");
  const res = await fetch(env.ROUTINE_FIRE_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.ROUTINE_FIRE_TOKEN}`,
      "anthropic-version": "2026-10-21",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) console.log("routine fire failed", res.status, await res.text());
}

export default {
  async email(message, env, ctx) {
    await message.forward(FORWARD_TO);
    ctx.waitUntil(fireRoutine(message, env).catch((e) => console.log("routine fire error", String(e))));
  },

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
