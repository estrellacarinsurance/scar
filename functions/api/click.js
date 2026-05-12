export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  function dateKey(date = new Date()) { return date.toISOString().slice(0, 10); }

  const sessionId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const today = dateKey();
  const landingPage = `${url.origin}/`;

  const data = {
    sessionId,
    createdAt,
    dateKey: today,
    landingPage,
    referrer: request.headers.get("referer") || "",
    userAgent: request.headers.get("user-agent") || "",
    ip: request.headers.get("CF-Connecting-IP") || "",
    cfPseudoIpv4: request.headers.get("CF-Pseudo-IPv4") || "",
    utm_source: url.searchParams.get("utm_source") || "",
    utm_campaign: url.searchParams.get("utm_campaign") || "",
    utm_medium: url.searchParams.get("utm_medium") || "",
    utm_term: url.searchParams.get("utm_term") || "",
    utm_content: url.searchParams.get("utm_content") || ""
  };

  await env.TRACKER_KV.put(`session:${sessionId}`, JSON.stringify(data));
  await env.TRACKER_KV.put(`session:${today}:${sessionId}`, JSON.stringify(data));

  return Response.json({ ok: true, sessionId, dateKey: today });
}
