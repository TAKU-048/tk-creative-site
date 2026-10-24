// 静的ファイルに一致しなかったリクエストだけがここに来る。
// トップURL（/）はさくらと同じく index.html を返す。それ以外は404。
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      return env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
    }
    return new Response("Not Found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
};
