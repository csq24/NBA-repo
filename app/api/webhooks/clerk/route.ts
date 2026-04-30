import type { WebhookEvent } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";

import { createServiceClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CLERK_WEBHOOK_SECRET is not set" }, { status: 500 });
  }

  const payload = await req.text();
  const h = headers();
  const svixId = h.get("svix-id");
  const svixTimestamp = h.get("svix-timestamp");
  const svixSignature = h.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  let evt: WebhookEvent;
  try {
    const wh = new Webhook(secret);
    evt = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (evt.type !== "user.created" && evt.type !== "user.updated") {
    return NextResponse.json({ received: true });
  }

  const u = evt.data;
  const username =
    u.username ??
    u.first_name ??
    u.email_addresses?.[0]?.email_address?.split("@")[0] ??
    "user";
  const avatar =
    (u as { image_url?: string }).image_url ??
    (u as { profile_image_url?: string }).profile_image_url ??
    null;

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Supabase admin not configured" },
      { status: 500 },
    );
  }

  const { error } = await supabase.from("users").upsert(
    {
      id: u.id,
      username: String(username).slice(0, 80),
      avatar_url: avatar,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
