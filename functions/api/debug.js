export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    return Response.json({ ok: false, error: "Missing sessionId" }, { status: 400 });
  }

  const session = await env.TRACKER_KV.get(`session:${sessionId}`);
  const bid = await env.TRACKER_KV.get(`bid:${sessionId}`);
  const conversion = await env.TRACKER_KV.get(`conversion:${sessionId}`);

  return Response.json({
    ok: true,
    session: session ? JSON.parse(session) : null,
    bid: bid ? JSON.parse(bid) : null,
    conversion: conversion ? JSON.parse(conversion) : null
  });
}