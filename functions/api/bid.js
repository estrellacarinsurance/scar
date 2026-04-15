export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();

    const {
      sessionId,
      caller_id,
      zip_code,
      is_currently_insured,
      own_home,
      insurance_carrier,
      state,
      pub_id = "",
      media_type = "Social"
    } = body;

    if (!sessionId || !caller_id) {
      return Response.json({ ok: false, error: "Missing sessionId or caller_id" }, { status: 400 });
    }

    const existing = await env.TRACKER_KV.get(`session:${sessionId}`);
    if (!existing) {
      return Response.json({ ok: false, error: "Invalid session" }, { status: 400 });
    }

    const session = JSON.parse(existing);

    const payload = {
      campaign_id: "340938",
      caller_id,
      zip_code: zip_code || "",
      is_currently_insured: String(is_currently_insured),
      own_home: String(own_home),
      insurance_carrier: insurance_carrier || "",
      IP_Address: request.headers.get("CF-Connecting-IP") || "",
      Landing_Page: session.landingPage,
      Pub_ID: pub_id,
      Media_Type: media_type,
      User_Agent: request.headers.get("user-agent") || "",
      state: state || ""
    };

    const mcResp = await fetch(
      "https://www.marketcall.com/api/v1/affiliate/offers/10702/bid-requests",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "X-Api-Key": env.MARKETCALL_API_KEY
        },
        body: JSON.stringify(payload)
      }
    );

    const mcJson = await mcResp.json();

    await env.TRACKER_KV.put(
      `bid:${sessionId}`,
      JSON.stringify({
        createdAt: new Date().toISOString(),
        request: payload,
        response: mcJson
      })
    );

    const data = mcJson?.data || {};
    const isAvailable = !!data.is_available;

    return Response.json({
      ok: true,
      is_available: isAvailable,
      target_number: data.target_number || "",
      payout: data?.earn?.amount || null,
      duration: data?.terms?.duration || null,
      expires_at: mcJson?.expires_at || null,
      raw: mcJson
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: err.message || "Bid request failed" },
      { status: 500 }
    );
  }
}