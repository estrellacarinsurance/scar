export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const sessionId = url.searchParams.get("session_id");
  const payout = url.searchParams.get("payout");
  const status = url.searchParams.get("status");
  const callId = url.searchParams.get("call_id");

  if (!sessionId) {
    return new Response("missing session_id", { status: 400 });
  }

  await env.TRACKER_KV.put(
    `conversion:${sessionId}`,
    JSON.stringify({
      sessionId,
      payout,
      status,
      callId,
      receivedAt: new Date().toISOString()
    })
  );

  return new Response("ok");
}