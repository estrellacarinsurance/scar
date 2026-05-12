export async function onRequestGet(context) {
  const { request, env } = context;

  function dateKey(date = new Date()) { return date.toISOString().slice(0, 10); }

  try {
    const url = new URL(request.url);
    const rawSessionId = url.searchParams.get("session_id") || "";
    const payout = url.searchParams.get("payout") || "";
    const status = url.searchParams.get("status") || "";
    const callId = url.searchParams.get("call_id") || "";
    const receivedAt = new Date().toISOString();
    const today = dateKey();

    const isPlaceholder = (val) => val && val.startsWith("{") && val.endsWith("}");
    const sessionId = isPlaceholder(rawSessionId) ? "" : rawSessionId;

    const record = { sessionId: rawSessionId, normalizedSessionId: sessionId || null, payout, status, callId, matched: !!sessionId, receivedAt, dateKey: today };

    if (sessionId) {
      await env.TRACKER_KV.put(`conversion:${sessionId}`, JSON.stringify(record));
      await env.TRACKER_KV.put(`conversion:${today}:${sessionId}`, JSON.stringify(record));
    } else {
      const fallbackId = callId || crypto.randomUUID();
      await env.TRACKER_KV.put(`unmatched:${fallbackId}`, JSON.stringify(record));
      await env.TRACKER_KV.put(`unmatched:${today}:${fallbackId}`, JSON.stringify(record));
    }

    console.log("Postback received:", record);
    return new Response("ok", { status: 200 });
  } catch (err) {
    console.log("Postback error:", err);
    return new Response("ok", { status: 200 });
  }
}
