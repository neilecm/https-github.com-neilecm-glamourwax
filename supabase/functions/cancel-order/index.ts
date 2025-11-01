// Supabase Edge Function: cancel-order (v3)
// Built: 2025-11-01T08:20:47Z
// This version includes:
//  - safe JSON parsing (no crashes on empty/invalid JSON)
//  - query param fallback (?orderNo=...)
//  - maps camelCase orderNo -> Komerce snake_case order_no
//  - interprets Komerce 422 as 409 not_cancelable for clearer app logic
//  - guards against misconfigured KOMERCE_BASE_URL (e.g., Supabase domain)
//  - consistent CORS headers
//  - per-request IDs and boot banner logs

const JSON_HDR = { "Content-Type": "application/json" };
const CORS_HDR = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Boot banner
console.log("[cancel-order][v3] booted at 2025-11-01T08:20:47Z");

function withCors(body: BodyInit | null, init: ResponseInit): Response {
  const headers = new Headers(init.headers || {});
  for (const [k, v] of Object.entries(CORS_HDR)) headers.set(k, v as string);
  return new Response(body, { ...init, headers });
}

Deno.serve(async (req) => {
  const reqId = crypto.randomUUID().slice(0, 8);
  try {
    // CORS preflight
    if (req.method === "OPTIONS") {
      return withCors(null, { status: 204 });
    }

    const urlObj = new URL(req.url);
    const ct = req.headers.get("content-type") ?? "";
    const rawIn = await req.text();
    let body: any = {};
    if (ct.includes("application/json") && rawIn.trim() !== "") {
      try { body = JSON.parse(rawIn); }
      catch (e) {
        console.error("[cancel-order][v3]", reqId, "bad_json:", String(e));
        return withCors(
          JSON.stringify({ error: "bad_json", detail: String(e), sampleLen: rawIn.length }),
          { status: 400, headers: JSON_HDR }
        );
      }
    }

    // Accept orderNo from body or query param
    let orderNo: string | null = body?.orderNo ?? urlObj.searchParams.get("orderNo");
    // If a client sent orderNos: string[] (from arrange-pickup pattern), take the first for cancel
    if (!orderNo && Array.isArray(body?.orderNos) && body.orderNos.length > 0) {
      orderNo = String(body.orderNos[0]);
    }

    if (!orderNo || typeof orderNo !== "string" || orderNo.trim() === "") {
      console.warn("[cancel-order][v3]", reqId, "missing_orderNo");
      return withCors(
        JSON.stringify({ error: "missing_orderNo" }),
        { status: 400, headers: JSON_HDR }
      );
    }
    orderNo = orderNo.trim();

    // Env
    const BASE = Deno.env.get("KOMERCE_BASE_URL");
    const API_KEY = Deno.env.get("KOMERCE_API_KEY");
    if (!BASE || !API_KEY) {
      console.error("[cancel-order][v3]", reqId, "missing_env", { hasBASE: !!BASE, hasAPI: !!API_KEY });
      return withCors(
        JSON.stringify({ error: "missing_env", hasBASE: !!BASE, hasAPI: !!API_KEY }),
        { status: 500, headers: JSON_HDR }
      );
    }

    // Guard: wrong base (common mistake: using Supabase domain)
    if ((BASE ?? "").includes("supabase.co")) {
      console.error("[cancel-order][v3]", reqId, "misconfigured_base_url", BASE);
      return withCors(
        JSON.stringify({
          error: "misconfigured_base_url",
          hint: "Set KOMERCE_BASE_URL to the Komerce/Komship Delivery API base, not your Supabase URL."
        }),
        { status: 500, headers: JSON_HDR }
      );
    }

    // Upstream request to Komerce (adjust path/method if their docs require)
    const upstreamUrl = new URL("/order/api/v1/orders/cancel", BASE).toString();
    console.log("[cancel-order][v3]", reqId, "→", upstreamUrl, "orderNo:", orderNo);

    const upstream = await fetch(upstreamUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      // Komerce expects snake_case field name
      body: JSON.stringify({ order_no: orderNo }),
    });

    const rawOut = await upstream.text();
    const outCT = upstream.headers.get("content-type") ?? "";

    if (upstream.status === 422) {
      console.warn("[cancel-order][v3]", reqId, "not_cancelable 422");
      return withCors(
        JSON.stringify({
          error: "not_cancelable",
          reason: "order_status_invalid",
          provider: { status: upstream.status, raw: rawOut.slice(0, 1000) }
        }),
        { status: 409, headers: JSON_HDR }
      );
    }

    if (!upstream.ok) {
      console.error("[cancel-order][v3]", reqId, "provider_error", upstream.status, outCT);
      return withCors(
        JSON.stringify({
          error: "provider_error",
          status: upstream.status,
          contentType: outCT,
          url: upstreamUrl,
          raw: rawOut.slice(0, 1000),
        }),
        { status: 502, headers: JSON_HDR }
      );
    }

    let payload: unknown = rawOut;
    if (outCT.includes("application/json")) {
      try { payload = JSON.parse(rawOut); } catch { payload = { raw: rawOut }; }
    }

    console.log("[cancel-order][v3]", reqId, "ok");
    return withCors(JSON.stringify({ ok: true, payload }), { status: 200, headers: JSON_HDR });
  } catch (e) {
    console.error("[cancel-order][v3]", reqId, "unhandled", String(e));
    return withCors(JSON.stringify({ error: "unhandled", message: String(e) }), { status: 500, headers: JSON_HDR });
  }
});
