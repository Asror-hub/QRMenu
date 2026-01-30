import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME");
const apiKey = Deno.env.get("CLOUDINARY_API_KEY");
const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });

const sha1 = async (message: string) => {
  const data = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!cloudName || !apiKey || !apiSecret) {
    return json({ error: "Cloudinary env vars are missing." }, 500);
  }

  const { public_id: publicId } = await req.json().catch(() => ({}));
  if (!publicId) {
    return json({ error: "public_id is required." }, 400);
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await sha1(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`);

  const params = new URLSearchParams({
    public_id: publicId,
    api_key: apiKey,
    timestamp: `${timestamp}`,
    signature
  });

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    }
  );

  if (!response.ok) {
    const text = await response.text();
    return json({ error: text || "Cloudinary delete failed." }, 500);
  }

  const result = await response.json();
  return json({ result });
});
