export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  const date = url.searchParams.get("date") || "";

  if (!sessionId) return Response.json({ ok: false, error: "Missing sessionId" }, { status: 400 });

  async function getAny(prefix) {
    const direct = await env.TRACKER_KV.get(`${prefix}:${sessionId}`);
    if (direct) return JSON.parse(direct);
    if (date) {
      const byDate = await env.TRACKER_KV.get(`${prefix}:${date}:${sessionId}`);
      if (byDate) return JSON.parse(byDate);
    }
    return null;
  }

  const session = await getAny("session");
  const bid = await getAny("bid");
  const bidBlocked = await getAny("bid_blocked");
  const bidError = await getAny("bid_error");
  const conversion = await getAny("conversion");

  return Response.json({ ok: true, session, bid, bidBlocked, bidError, conversion });
}
