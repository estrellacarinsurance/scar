export async function onRequestPost(context) {
  const { request, env } = context;

  const CAMPAIGN_ID = env.MARKETCALL_CAMPAIGN_ID || "340938";
  const MARKETCALL_ENDPOINT = env.MARKETCALL_ENDPOINT || "https://www.marketcall.com/api/v1/affiliate/offers/10702/bid-requests";

  function nowIso() { return new Date().toISOString(); }
  function dateKey(date = new Date()) { return date.toISOString().slice(0, 10); }
  function boolValue(value) { return value === true || value === "true"; }
  function cleanState(value) { return String(value || "").trim().toUpperCase(); }
  function cleanZip(value) { return String(value || "").replace(/\D/g, "").slice(0, 5); }
  function isIPv4(ip) { return /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(ip || ""); }
  function isValidPhone(value) { const digits = String(value || "").replace(/\D/g, ""); return digits.length === 10 || (digits.length === 11 && digits.startsWith("1")); }

  function getTimeParts(timeZone, at = new Date()) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(at).reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});
    return {
      weekday: parts.weekday,
      minutes: Number(parts.hour) * 60 + Number(parts.minute),
      hhmm: `${parts.hour}:${parts.minute}`
    };
  }

  function stateTimeZone(state, zip) {
    const z = cleanZip(zip);
    const zip3 = z.length >= 3 ? Number(z.slice(0, 3)) : null;
    const tz = {
      AL:"America/Chicago", AK:"America/Anchorage", AZ:"America/Phoenix", AR:"America/Chicago", CA:"America/Los_Angeles",
      CO:"America/Denver", CT:"America/New_York", DC:"America/New_York", DE:"America/New_York", FL:"America/New_York",
      GA:"America/New_York", HI:"Pacific/Honolulu", IA:"America/Chicago", ID:"America/Boise", IL:"America/Chicago",
      IN:"America/Indiana/Indianapolis", KS:"America/Chicago", KY:"America/New_York", LA:"America/Chicago", MA:"America/New_York",
      MD:"America/New_York", ME:"America/New_York", MI:"America/Detroit", MN:"America/Chicago", MO:"America/Chicago",
      MS:"America/Chicago", MT:"America/Denver", NC:"America/New_York", ND:"America/Chicago", NE:"America/Chicago",
      NH:"America/New_York", NJ:"America/New_York", NM:"America/Denver", NV:"America/Los_Angeles", NY:"America/New_York",
      OH:"America/New_York", OK:"America/Chicago", OR:"America/Los_Angeles", PA:"America/New_York", RI:"America/New_York",
      SC:"America/New_York", SD:"America/Chicago", TN:"America/Chicago", TX:"America/Chicago", UT:"America/Denver",
      VA:"America/New_York", VT:"America/New_York", WA:"America/Los_Angeles", WI:"America/Chicago", WV:"America/New_York", WY:"America/Denver"
    };
    // Practical split-state ZIP approximations for lead filtering.
    if (state === "FL" && zip3 && (zip3 === 324 || zip3 === 325)) return "America/Chicago"; // Florida panhandle
    if (state === "TX" && zip3 && (zip3 === 798 || zip3 === 799 || zip3 === 885)) return "America/Denver"; // El Paso region
    if (state === "ID" && zip3 && zip3 >= 832 && zip3 <= 838) return "America/Boise";
    if (state === "ID" && zip3 && zip3 >= 835 && zip3 <= 838) return "America/Los_Angeles"; // north Idaho
    if (state === "OR" && zip3 && (zip3 === 979)) return "America/Boise"; // Malheur area
    if (state === "TN" && zip3 && zip3 >= 370 && zip3 <= 385) return "America/Chicago";
    if (state === "TN" && zip3 && zip3 >= 376 && zip3 <= 379) return "America/New_York";
    if (state === "KY" && zip3 && zip3 >= 420 && zip3 <= 427) return "America/Chicago";
    if (state === "IN" && zip3 && [463,464,475,476,477].includes(zip3)) return "America/Chicago";
    if (state === "KS" && zip3 && zip3 >= 677 && zip3 <= 679) return "America/Denver";
    if (state === "NE" && zip3 && zip3 >= 690 && zip3 <= 693) return "America/Denver";
    if (state === "ND" && zip3 && zip3 >= 586 && zip3 <= 588) return "America/Denver";
    if (state === "SD" && zip3 && zip3 >= 576 && zip3 <= 577) return "America/Denver";
    return tz[state] || "America/New_York";
  }

  function daysMatch(days, weekday) {
    const map = { Sun:"sun", Mon:"mon", Tue:"tue", Wed:"wed", Thu:"thu", Fri:"fri", Sat:"sat" };
    return days.includes(map[weekday]);
  }
  function minutes(hhmm) {
    const [h, m = "0"] = String(hhmm).split(":");
    return Number(h) * 60 + Number(m);
  }
  function timeMatches(window, currentMinutes) {
    const start = minutes(window.start);
    const end = minutes(window.end);
    return currentMinutes >= start && currentMinutes < end;
  }
  function set(list) { return new Set(list.split(/[,\s]+/).map(s => s.trim()).filter(Boolean)); }
  const ALL_STATES_EX_PR_GU = set("AL AK AZ AR CA CO CT DC DE FL GA HI IA ID IL IN KS KY LA MA MD ME MI MN MO MS MT NC ND NE NH NJ NM NV NY OH OK OR PA RI SC SD TN TX UT VA VT WA WI WV WY");

  const tiers = [
    // INSURED TIERS
    { id:"insured_tier_1_dynamic", status:"insured", days:set("mon tue wed thu fri"), start:"08:00", end:"20:00", states:ALL_STATES_EX_PR_GU, priority:90 },
    { id:"insured_tier_1_dynamic_weekend", status:"insured", days:set("sat sun"), start:"11:00", end:"20:00", states:ALL_STATES_EX_PR_GU, priority:80 },
    { id:"insured_tier_2_34_135", status:"insured", days:set("mon tue wed thu fri"), start:"10:00", end:"18:00", states:set("AK AZ ID ME OH OR RI TN VT WI WY"), priority:72 },
    { id:"insured_tier_3_36_150", status:"insured", days:set("mon tue wed thu fri sat sun"), start:"07:00", end:"23:00", states:set("AL AR AZ CO DC IA ID IL IN KS KY ME MO NE OH OR PA RI SC TN UT VT WA WI WY"), priority:76 },
    { id:"insured_tier_4_36_160", status:"insured", days:set("mon tue wed thu fri"), start:"10:00", end:"18:00", states:set("IL IN OH OR PA TN VA"), priority:74 },
    { id:"insured_tier_5_36_165", status:"insured", days:set("mon tue wed thu fri sat sun"), start:"08:00", end:"20:00", states:set("AL AZ AR CO CT DE GA HI ID IL IN IA KS KY LA ME MD MN MS MO MT NE NH NM NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY"), priority:73 },
    { id:"insured_tier_6_25_120", status:"insured", days:set("mon tue wed thu fri"), start:"09:00", end:"18:00", states:set("AL CO CT GA IL IN ME NE OH OK OR PA SC TN TX VA WA WI"), priority:65 },
    { id:"insured_tier_7_27_150", status:"insured", days:set("mon tue wed thu fri sat"), start:"07:00", end:"23:00", states:set("CT DE FL MS SD WV"), priority:68 },
    { id:"insured_tier_8_rtb", status:"insured", days:set("mon tue wed thu fri"), start:"09:00", end:"19:00", states:ALL_STATES_EX_PR_GU, priority:55 },
    { id:"insured_tier_8_rtb_sat", status:"insured", days:set("sat"), start:"12:00", end:"17:00", states:ALL_STATES_EX_PR_GU, priority:50 },
    { id:"insured_tier_9_rtb", status:"insured", days:set("mon tue wed thu fri"), start:"08:00", end:"21:00", states:ALL_STATES_EX_PR_GU, priority:45 },

    // UNINSURED TIERS
    { id:"uninsured_tier_1_16_150", status:"uninsured", days:set("mon tue wed thu fri sat sun"), start:"07:00", end:"23:30", states:set("AL AR AZ CA CO CT DE FL GA HI ID IL IN KS KY LA MA ME MI MN MO MS MT NC ND NE NJ NM OH OK OR PA RI SC SD TN TX UT VA VT WA WI"), priority:70 },
    { id:"uninsured_tier_2_19_165", status:"uninsured", days:set("mon tue wed thu fri sat sun"), start:"08:00", end:"20:00", states:set("AL AR AZ CO CT GA IL IN KS KY LA ME MI MS MO MT ND NV OH OK OR TX PA RI SC SD TN UT VA VT WA WV WY"), priority:67 },
    { id:"uninsured_tier_3_dynamic_135", status:"uninsured", days:set("mon tue wed thu fri"), start:"10:00", end:"18:00", states:set("AL AK AZ AR CO CT DC GA ID IL IN IA KS ME MD MN MS MO MT NE NV NH NM NC OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY"), priority:63 }
  ];

  function getMatchingTiers({ state, zip, isInsured, at = new Date() }) {
    const mode = String(env.HOURS_MODE || "local").toLowerCase(); // local recommended for state-region filtering; set HOURS_MODE=est to match published EST literally.
    const timeZone = mode === "est" ? "America/New_York" : stateTimeZone(state, zip);
    const local = getTimeParts(timeZone, at);
    const status = isInsured ? "insured" : "uninsured";
    const blockedStates = set("PR GU");
    if (!state || blockedStates.has(state)) {
      return { allowed: false, reason: "Unsupported state for this campaign.", timeZone, local, matches: [] };
    }
    const matches = tiers
      .filter(t => t.status === status)
      .filter(t => t.states.has(state))
      .filter(t => daysMatch(t.days, local.weekday))
      .filter(t => timeMatches(t, local.minutes))
      .sort((a, b) => b.priority - a.priority);

    if (!matches.length) {
      return {
        allowed: false,
        reason: `Agents are currently unavailable for ${state}. Best time to try is during active campaign hours in your state.`,
        timeZone,
        local,
        matches: []
      };
    }
    return { allowed: true, reason: "Matched active campaign tier.", timeZone, local, matches };
  }

  function normalizeMediaType(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "social" || raw.includes("facebook") || raw.includes("instagram") || raw.includes("tiktok") || raw.includes("reddit") || raw.includes("nextdoor")) return "Social";
    return "Paid Search";
  }

  async function putBothKeys(kv, baseKey, value, createdDate = dateKey()) {
    await kv.put(baseKey, value);
    const [prefix, id] = baseKey.split(":");
    if (prefix && id) await kv.put(`${prefix}:${createdDate}:${id}`, value);
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
      media_type = "Paid Search"
    } = body;

    const normalizedState = cleanState(state);
    const normalizedZip = cleanZip(zip_code);
    const isInsured = boolValue(is_currently_insured);
    const createdAt = nowIso();
    const today = dateKey();

    if (!sessionId || !caller_id) {
      return Response.json({ ok: false, error: "Missing sessionId or caller_id" }, { status: 400 });
    }
    if (!isValidPhone(caller_id)) {
      return Response.json({ ok: false, error: "Invalid caller_id" }, { status: 400 });
    }
    if (!normalizedState || normalizedState.length !== 2) {
      return Response.json({ ok: false, error: "Invalid state" }, { status: 400 });
    }

    const existing = await env.TRACKER_KV.get(`session:${sessionId}`);
    if (!existing) return Response.json({ ok: false, error: "Invalid session" }, { status: 400 });
    const session = JSON.parse(existing);

    const hoursCheck = getMatchingTiers({ state: normalizedState, zip: normalizedZip, isInsured });
    const safeBodyForLogs = {
      sessionId,
      caller_id_last4: String(caller_id).replace(/\D/g, "").slice(-4),
      zip_code: normalizedZip,
      state: normalizedState,
      is_currently_insured: isInsured,
      own_home: boolValue(own_home),
      insurance_carrier,
      pub_id,
      media_type
    };

    if (String(env.TIER_HOURS_GUARD || "on").toLowerCase() !== "off" && !hoursCheck.allowed) {
      const record = {
        createdAt,
        type: "bid_blocked_by_tier_hours",
        reason: hoursCheck.reason,
        state: normalizedState,
        zip_code: normalizedZip,
        status: isInsured ? "insured" : "uninsured",
        timeZone: hoursCheck.timeZone,
        localTime: hoursCheck.local,
        body: safeBodyForLogs
      };
      await putBothKeys(env.TRACKER_KV, `bid_blocked:${sessionId}`, JSON.stringify(record), today);
      return Response.json({
        ok: true,
        is_available: false,
        blocked: true,
        reason: "outside_campaign_hours",
        message: hoursCheck.reason,
        state: normalizedState,
        time_zone: hoursCheck.timeZone,
        local_time: hoursCheck.local?.hhmm || null,
        matching_tiers: []
      });
    }

    const cfConnectingIp = request.headers.get("CF-Connecting-IP") || "";
    const cfConnectingIpv6 = request.headers.get("CF-Connecting-IPv6") || "";
    const cfPseudoIpv4 = request.headers.get("CF-Pseudo-IPv4") || "";
    const userAgent = request.headers.get("user-agent") || "";
    const bidIp = isIPv4(cfConnectingIp) ? cfConnectingIp : isIPv4(cfPseudoIpv4) ? cfPseudoIpv4 : "";
    const normalizedMediaType = normalizeMediaType(media_type);

    const debugHeaders = { cfConnectingIp, cfConnectingIpv6, cfPseudoIpv4, selectedBidIp: bidIp, userAgent, checkedAt: createdAt };

    if (!bidIp) {
      const record = {
        createdAt,
        reason: "No valid IPv4 available for MarketCall bid request",
        debugHeaders,
        tierHours: hoursCheck,
        body: safeBodyForLogs
      };
      await putBothKeys(env.TRACKER_KV, `bid_error:${sessionId}`, JSON.stringify(record), today);
      return Response.json({ ok: false, error: "No valid IPv4 available for bid request." }, { status: 422 });
    }

    const payload = {
      campaign_id: CAMPAIGN_ID,
      caller_id,
      zip_code: normalizedZip,
      is_currently_insured: isInsured,
      own_home: boolValue(own_home),
      insurance_carrier,
      IP_Address: bidIp,
      Landing_Page: session.landingPage || "https://www.estrellacarinsurance.com/",
      Pub_ID: pub_id || sessionId,
      Media_Type: normalizedMediaType,
      User_Agent: userAgent,
      state: normalizedState
    };

    const mcResp = await fetch(MARKETCALL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8", "X-Api-Key": env.MARKETCALL_API_KEY },
      body: JSON.stringify(payload)
    });
    const mcJson = await mcResp.json();
    const data = mcJson?.data || {};
    const isAvailable = !!data.is_available;

    const bidRecord = {
      createdAt,
      request: payload,
      debugHeaders,
      tierHours: {
        allowed: hoursCheck.allowed,
        timeZone: hoursCheck.timeZone,
        localTime: hoursCheck.local,
        matchedTiers: hoursCheck.matches.map(t => t.id)
      },
      response: mcJson
    };
    await putBothKeys(env.TRACKER_KV, `bid:${sessionId}`, JSON.stringify(bidRecord), today);

    return Response.json({
      ok: true,
      is_available: isAvailable,
      target_number: data.target_number || "",
      payout: data?.earn?.amount || null,
      duration: data?.terms?.duration || null,
      expires_at: data?.expires_at || mcJson?.expires_at || null,
      time_zone: hoursCheck.timeZone,
      local_time: hoursCheck.local?.hhmm || null,
      matched_tiers: hoursCheck.matches.map(t => t.id),
      raw: mcJson
    });
  } catch (err) {
    return Response.json({ ok: false, error: err.message || "Bid request failed" }, { status: 500 });
  }
}
