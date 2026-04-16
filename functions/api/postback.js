export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);

    const rawSessionId = url.searchParams.get("session_id") || "";
    const payout = url.searchParams.get("payout") || "";
    const status = url.searchParams.get("status") || "";
    const callId = url.searchParams.get("call_id") || "";

    // Detect if MarketCall DID NOT replace macros
    const isPlaceholder = (val) =>
      val && val.startsWith("{") && val.endsWith("}");

    const sessionId = isPlaceholder(rawSessionId) ? "" : rawSessionId;

    const record = {
      sessionId: rawSessionId,
      normalizedSessionId: sessionId || null,
      payout,
      status,
      callId,
      matched: !!sessionId,
      receivedAt: new Date().toISOString()
    };

    // If session is valid → store as conversion
    if (sessionId) {
      await env.TRACKER_KV.put(
        `conversion:${sessionId}`,
        JSON.stringify(record)
      );
    } else {
      // If macro failed → store separately for debugging
      const fallbackKey = `unmatched:${callId || Date.now()}`;
      await env.TRACKER_KV.put(
        fallbackKey,
        JSON.stringify(record)
      );
    }

    console.log("Postback received:", record);

    return new Response("ok", { status: 200 });

  } catch (err) {
    console.log("Postback error:", err);

    // Always return 200 so MarketCall doesn't retry endlessly
    return new Response("ok", { status: 200 });
  }
}