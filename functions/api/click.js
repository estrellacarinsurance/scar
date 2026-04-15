export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const sessionId = crypto.randomUUID();
  const landingPage = `${url.origin}/`;

  const data = {
    sessionId,
    createdAt: new Date().toISOString(),
    landingPage,
    referrer: request.headers.get("referer") || "",
    userAgent: request.headers.get("user-agent") || "",
    ip: request.headers.get("CF-Connecting-IP") || "",
    utm_source: url.searchParams.get("utm_source") || "",
    utm_campaign: url.searchParams.get("utm_campaign") || "",
    utm_medium: url.searchParams.get("utm_medium") || "",
  };

  await env.TRACKER_KV.put(`session:${sessionId}`, JSON.stringify(data));

  return Response.json({ ok: true, sessionId });
}