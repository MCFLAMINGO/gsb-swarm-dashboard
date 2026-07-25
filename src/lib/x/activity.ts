/**
 * X API helpers — Activity API / Webhooks (CRC + signature)
 * Docs: https://docs.x.com/x-api/activity/introduction
 *       https://docs.x.com/x-api/webhooks/introduction
 */

import crypto from "crypto";
import { mcp } from "@/lib/mcp";

export type XKeys = {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
};

export async function getXKeys(): Promise<XKeys | null> {
  const creds = await mcp.xCredentials();
  if (creds?.apiKey && creds.apiSecret && creds.accessToken && creds.accessTokenSecret) {
    return creds;
  }
  if (process.env.X_API_KEY && process.env.X_API_SECRET) {
    return {
      apiKey: process.env.X_API_KEY,
      apiSecret: process.env.X_API_SECRET,
      accessToken: process.env.X_ACCESS_TOKEN || "",
      accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET || "",
    };
  }
  return null;
}

/** CRC response for webhook registration / hourly validation */
export function crcResponseToken(crcToken: string, consumerSecret: string): string {
  const hash = crypto
    .createHmac("sha256", consumerSecret)
    .update(crcToken)
    .digest("base64");
  return `sha256=${hash}`;
}

/**
 * Verify x-twitter-webhooks-signature header on inbound POSTs.
 * Signature = base64(HMAC-SHA256(rawBody, consumerSecret)) prefixed with sha256=
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  consumerSecret: string
): boolean {
  if (!signatureHeader) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", consumerSecret).update(rawBody).digest("base64");
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signatureHeader);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function signOAuth1(
  method: string,
  url: string,
  keys: XKeys,
  extraParams: Record<string, string> = {}
): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: keys.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: keys.accessToken,
    oauth_version: "1.0",
  };
  const allParams = { ...oauth, ...extraParams };
  const sortedParams = Object.keys(allParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
    .join("&");
  const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  const signingKey = `${encodeURIComponent(keys.apiSecret)}&${encodeURIComponent(keys.accessTokenSecret)}`;
  const signature = crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
  const headerParams: Record<string, string> = { ...oauth, oauth_signature: signature };
  return (
    "OAuth " +
    Object.keys(headerParams)
      .map((k) => `${k}="${encodeURIComponent(headerParams[k])}"`)
      .join(", ")
  );
}

/** Normalize Activity API + Account Activity style payloads into a common shape */
export interface NormalizedXEvent {
  type: string;
  userId?: string;
  text?: string;
  postId?: string;
  fromUser?: string;
  direction?: "inbound" | "outbound" | string;
  raw: Record<string, unknown>;
}

export function normalizeXEvents(payload: Record<string, unknown>): NormalizedXEvent[] {
  const events: NormalizedXEvent[] = [];

  // X Activity API style: { event_type / type, data, ... }
  const topType =
    (typeof payload.event_type === "string" && payload.event_type) ||
    (typeof payload.type === "string" && payload.type) ||
    null;

  if (topType) {
    const data = (payload.data as Record<string, unknown>) || payload;
    events.push({
      type: topType,
      userId: String(data.user_id || data.userId || payload.user_id || ""),
      text: typeof data.text === "string" ? data.text : undefined,
      postId: String(data.id || data.post_id || data.tweet_id || ""),
      fromUser: String(data.username || data.screen_name || data.from_user || ""),
      direction: (data.direction as string) || undefined,
      raw: payload,
    });
    return events;
  }

  // Legacy Account Activity API style (tweet_create_events, etc.)
  const map: Array<[string, string]> = [
    ["tweet_create_events", "post.create"],
    ["tweet_delete_events", "post.delete"],
    ["favorite_events", "like.create"],
    ["follow_events", "follow.follow"],
    ["direct_message_events", "dm.received"],
    ["direct_message_indicate_typing_events", "dm.indicate_typing"],
    ["direct_message_mark_read_events", "dm.read"],
  ];

  for (const [key, type] of map) {
    const arr = payload[key];
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      const obj = item as Record<string, unknown>;
      const user = (obj.user as Record<string, unknown> | undefined) || undefined;
      const source = (obj.source as Record<string, unknown> | undefined) || undefined;
      const messageCreate = (obj.message_create as Record<string, unknown>) || {};
      const messageData = (messageCreate.message_data as Record<string, unknown>) || {};
      events.push({
        type,
        userId: String(user?.id_str || source?.id_str || obj.for_user_id || ""),
        text:
          (typeof obj.text === "string" && obj.text) ||
          (typeof messageData.text === "string" && messageData.text) ||
          undefined,
        postId: String(obj.id_str || obj.id || ""),
        fromUser: String(user?.screen_name || source?.screen_name || ""),
        raw: obj,
      });
    }
  }

  // Mentions sometimes arrive as tweet_create with entities.user_mentions
  if (Array.isArray(payload.tweet_create_events)) {
    // already mapped as post.create — leave as-is; router can detect @mentions in text
  }

  return events;
}
