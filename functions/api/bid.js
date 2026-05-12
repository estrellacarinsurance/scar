export async function onRequestPost(context) {
  const { request, env } = context;

  function isIPv4(ip) {
    return /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(ip || "");
  }

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
      return Response.json(
        { ok: false, error: "Missing sessionId or caller_id" },
        { status: 400 }
      );
    }

    const existing = await env.TRACKER_KV.get(`session:${sessionId}`);
    if (!existing) {
      return Response.json(
        { ok: false, error: "Invalid session" },
        { status: 400 }
      );
    }

    const session = JSON.parse(existing);

    const cfConnectingIp = request.headers.get("CF-Connecting-IP") || "";
    const cfConnectingIpv6 = request.headers.get("CF-Connecting-IPv6") || "";
    const cfPseudoIpv4 = request.headers.get("CF-Pseudo-IPv4") || "";
    const userAgent = request.headers.get("user-agent") || "";

    // Prefer real IPv4 if present, otherwise fall back to Cloudflare pseudo IPv4
    const bidIp = isIPv4(cfConnectingIp)
      ? cfConnectingIp
      : isIPv4(cfPseudoIpv4)
        ? cfPseudoIpv4
        : "";

    const debugHeaders = {
      cfConnectingIp,
      cfConnectingIpv6,
      cfPseudoIpv4,
      selectedBidIp: bidIp,
      userAgent,
      checkedAt: new Date().toISOString()
    };

    if (!bidIp) {
      await env.TRACKER_KV.put(
        `bid_error:${sessionId}`,
        JSON.stringify({
          createdAt: new Date().toISOString(),
          reason: "No valid IPv4 available for MarketCall bid request",
          debugHeaders,
          body: {
            sessionId,
            caller_id,
            zip_code,
            is_currently_insured,
            own_home,
            insurance_carrier,
            state,
            pub_id,
            media_type
          }
        })
      );

      return Response.json(
        {
          ok: false,
          error: "No valid IPv4 available for bid request."
        },
        { status: 422 }
      );
    }

    const payload = {
      campaign_id: "340938",
      caller_id,
      zip_code,
      is_currently_insured:
        is_currently_insured === true || is_currently_insured === "true",
      own_home: own_home === true || own_home === "true",
      insurance_carrier,
      IP_Address: bidIp,
      Landing_Page:
        session.landingPage || "https://www.estrellacarinsurance.com/",
      Pub_ID: pub_id || sessionId,
      Media_Type: media_type,
      User_Agent: userAgent,
      state
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
        debugHeaders,
        response: mcJson
      })
    );

    const data = mcJson?.data || {};
    const isAvailable = !!data.is_available;

    // Important: if MarketCall says no buyer/agent is available, return a safe
    // front-end response that prevents the website from opening a call.
    // This protects ad spend and avoids sending users to a dead/no-agent route.
    if (!isAvailable) {
      await env.TRACKER_KV.put(
        `bid_unavailable:${sessionId}`,
        JSON.stringify({
          createdAt: new Date().toISOString(),
          request: payload,
          debugHeaders,
          response: mcJson,
          reason: "MarketCall returned is_available=false"
        })
      );

      return Response.json({
        ok: true,
        is_available: false,
        target_number: "",
        payout: null,
        duration: null,
        expires_at: data?.expires_at || mcJson?.expires_at || null,
        message:
          "No live insurance agent is available for this profile right now. Please try again during active campaign hours.",
        recommended_hours:
          "Monday-Friday 9:00 AM-8:00 PM Eastern Time. Some tiers may also route on weekends.",
        raw: mcJson
      });
    }

    return Response.json({
      ok: true,
      is_available: true,
      target_number: data.target_number || "",
      payout: data?.earn?.amount || null,
      duration: data?.terms?.duration || null,
      expires_at: data?.expires_at || mcJson?.expires_at || null,
      message: "Live insurance agent available now.",
      raw: mcJson
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: err.message || "Bid request failed" },
      { status: 500 }
    );
  }
}