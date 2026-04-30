/**
 * Sends a signed Svix-style POST to /api/webhooks/clerk (same shape Clerk uses).
 *
 * Usage (from repo root, dev server on :3000):
 *   node --env-file=.env.local scripts/test-clerk-webhook.mjs
 *
 * Requires CLERK_WEBHOOK_SECRET=whsec_… in .env.local (Clerk → Webhooks → endpoint → Signing secret).
 */
import crypto from "node:crypto";
import { Webhook } from "svix";

const secret = process.env.CLERK_WEBHOOK_SECRET?.trim();
if (!secret) {
  console.error(
    "Missing CLERK_WEBHOOK_SECRET.\n" +
      "1) Clerk Dashboard → Webhooks → your endpoint → reveal Signing secret (whsec_…)\n" +
      "2) Add to .env.local: CLERK_WEBHOOK_SECRET=whsec_...\n" +
      "3) Restart: npm run dev\n" +
      "4) Run this script again.",
  );
  process.exit(1);
}

const clerkUserId = `user_test_${crypto.randomBytes(6).toString("hex")}`;
const payloadObj = {
  type: "user.created",
  data: {
    id: clerkUserId,
    username: "webhook-smoke",
    first_name: "Smoke",
    email_addresses: [{ email_address: "smoke-webhook-test@example.com" }],
  },
};
const payload = JSON.stringify(payloadObj);
const msgId = crypto.randomUUID();
const timestamp = new Date();

const wh = new Webhook(secret);
const signature = wh.sign(msgId, timestamp, payload);
const ts = String(Math.floor(timestamp.getTime() / 1000));

const url = process.env.WEBHOOK_TEST_URL ?? "http://127.0.0.1:3000/api/webhooks/clerk";
const res = await fetch(url, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "svix-id": msgId,
    "svix-timestamp": ts,
    "svix-signature": signature,
  },
  body: payload,
});

const body = await res.text();
console.log(`POST ${url} → ${res.status}`);
console.log(body);
process.exit(res.ok ? 0 : 1);
