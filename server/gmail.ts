// server/gmail.ts
import { db } from "./db";
import { apiKeys } from "shared/schema";
import { eq, and } from "drizzle-orm";
import express from "express";
import { google } from "googleapis";

import { contacts } from "shared/schema";

import { parse } from "node-html-parser";

const router = express.Router();

// Helper: create OAuth2 client from stored client_id/client_secret
async function makeOAuthClient() {
  // try environment first, then DB
  const clientId = process.env.GMAIL_CLIENT_ID || (await getApiKeyValue("gmail", "clientId"));
  const clientSecret =
    process.env.GMAIL_CLIENT_SECRET || (await getApiKeyValue("gmail", "clientSecret"));

  if (!clientId || !clientSecret) {
    throw new Error("Gmail client_id / client_secret not configured");
  }

  const redirectUri =
    process.env.GMAIL_REDIRECT_URI ||
    `${process.env.APP_BASE_URL || "http://localhost:5000"}/api/gmail/callback`;

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Read a key from apiKeys table. Maps clientId/clientSecret to your DB's key names.
 */
async function getApiKeyValue(service: string, keyName: string): Promise<string | null> {
  try {
    console.log("Looking for:", service, keyName);

    const rows = await db.select().from(apiKeys).where(eq(apiKeys.service, service));
    console.log("DB keys for gmail:", rows);

    // Map our logical names to what's stored in DB
    const mappedKey =
      keyName === "clientId" ? "client_id" : keyName === "clientSecret" ? "client_secret" : keyName;

    const row = rows.find((r: any) => r.keyName === mappedKey);
    if (!row) {
      console.log("Key not found in DB:", mappedKey);
      return null;
    }
    return row.encryptedValue;
  } catch (err) {
    console.error("getApiKeyValue error:", err);
    return null;
  }
}

/**
 * Saves refresh token for the given userId.
 * IMPORTANT: userId must exist in users table (foreign-key).
 */
async function saveRefreshTokenForUser(userId: string, refreshToken: string) {
  try {
    if (!userId) throw new Error("Missing userId for saving refresh token");

    const keyName = `refresh_${userId}`;

    const existing = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.service, "gmail"), eq(apiKeys.keyName, keyName)))
      .limit(1);

    if (existing.length > 0) {
      await db.update(apiKeys).set({ encryptedValue: refreshToken }).where(eq(apiKeys.id, existing[0].id));
      console.log("Updated refresh token for", userId);
    } else {
      await db.insert(apiKeys).values({
        id: crypto.randomUUID(),
        userId,
        service: "gmail",
        keyName,
        encryptedValue: refreshToken,
        isValid: true,
      });
      console.log("Inserted refresh token for", userId);
    }
  } catch (err) {
    console.error("saveRefreshTokenForUser error:", err);
    throw err; // rethrow so caller knows it failed
  }
}

async function getStoredRefreshTokenForUser(userId: string): Promise<string | null> {
  try {
    if (!userId) return null;
    const keyName = `refresh_${userId}`;
    const rows = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.service, "gmail"), eq(apiKeys.keyName, keyName)))
      .limit(1);

    if (rows.length === 0) return null;
    return rows[0].encryptedValue;
  } catch (err) {
    console.error("getStoredRefreshTokenForUser error:", err);
    return null;
  }
}

/**
 * Build oauth2 client for a user (using stored refresh token).
 */
async function oauthClientForUser(userId: string) {
  const oauth2Client = await makeOAuthClient();
  const refreshToken = await getStoredRefreshTokenForUser(userId);
  if (!refreshToken) throw new Error("No refresh token stored for user");
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

// --- Step 1: create auth URL ---
// Include the currently logged in user's id in the OAuth `state` so callback knows which user to associate token with.
router.get("/auth-url", async (req, res) => {
  try {
    const oauth2Client = await makeOAuthClient();
    const scopes = ["https://www.googleapis.com/auth/gmail.readonly"];

    // IMPORTANT: prefer session user id if available; otherwise send nothing
    const sessionUserId = (req as any).session?.user?.id;
    const stateObj = { userId: sessionUserId || null };

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent",
      state: encodeURIComponent(JSON.stringify(stateObj)),
    });

    return res.json({ url });
  } catch (err: any) {
    console.error("gmail auth-url error:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// --- Step 2: OAuth callback ---
// Read userId from state (or fallback to session) — do NOT use "default" user id because that violates FK
router.get("/callback", async (req, res) => {
  try {
    const code = req.query.code as string;
    const stateRaw = (req.query.state as string) || "";
    let stateUserId: string | null = null;

    if (stateRaw) {
      try {
        const decoded = JSON.parse(decodeURIComponent(stateRaw));
        stateUserId = decoded?.userId || null;
      } catch (e) {
        console.warn("Failed to parse OAuth state:", e);
      }
    }

    const oauth2Client = await makeOAuthClient();
    if (!code) return res.status(400).send("Missing code");

    let tokens;
    try {
      const t = await oauth2Client.getToken(code);
      tokens = t.tokens;
    } catch (err: any) {
      console.error("gmail callback getToken error:", err?.response?.data || err?.message || err);
      const remoteErr = err?.response?.data;
      if (remoteErr && remoteErr.error === "invalid_grant") {
        return res.status(400).send(
          "Invalid grant from Google: possible causes are an incorrect/changed redirect URI, expired or already-used code, or mismatched client credentials. Retry the flow."
        );
      }
      throw err;
    }

    // Determine which user to associate the refresh token with:
    const sessionUserId = (req as any).session?.user?.id || null;
    const userId = sessionUserId || stateUserId;

    if (!userId) {
      // We cannot save a refresh token without a valid user in users table.
      // Return a clear error so developer can retry but with a logged-in session.
      console.error("OAuth callback: no user id in session or state; cannot save refresh token.");
      // If you want to support userless flows, you'd need a separate 'system' user id that exists.
      return res
        .status(400)
        .send("No session or user id present. Sign in to the app before authorizing Gmail.");
    }

    if (tokens.refresh_token) {
      await saveRefreshTokenForUser(userId, tokens.refresh_token);
      console.log("Saved refresh token for user:", userId);
    } else {
      console.warn("No refresh_token returned. If this is not first consent, Google may not return refresh_token.");
      // You could save access_token with expiry temporarily if you want:
      // await saveAccessTokenTemporarily(userId, tokens.access_token, tokens.expiry_date)
    }

    return res.redirect("/dashboard");
  } catch (err: any) {
    console.error("gmail callback error:", err);
    return res.status(500).send("Gmail callback error: " + (err.message || String(err)));
  }
});

// --- Step 3: list messages for the user (subject/from/date) ---
router.get("/messages", async (req, res) => {
  try {
    const userId = (req as any).session?.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: no session user" });

    // Ensure we have a stored refresh token before attempting to build an OAuth client
    const storedRefresh = await getStoredRefreshTokenForUser(userId);
    if (!storedRefresh) {
      return res.status(401).json({ error: "No refresh token stored for user" });
    }

    const oauth2Client = await makeOAuthClient();
    oauth2Client.setCredentials({ refresh_token: storedRefresh });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const listRes = await gmail.users.messages.list({ userId: "me", maxResults: 50 });
    const messages = listRes.data.messages || [];

    const results = await Promise.all(
      (messages as any[]).map(async (m) => {
        const msg = (await gmail.users.messages.get({
          userId: "me",
          id: String(m.id),
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        })) as any;

        const headers = msg?.data?.payload?.headers || [];
        const getHeader = (name: string) => (headers.find((h: any) => h.name === name)?.value) || "";

        return {
          id: m.id,
          threadId: m.threadId || "",
          snippet: msg?.data?.snippet || "",
          from: getHeader("From"),
          subject: getHeader("Subject"),
          date: getHeader("Date"),
        };
      })
    );

    res.json(results);
  } catch (err: any) {
    console.error("gmail messages error:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// --- Step 4: fetch full message and extract signature and create contact ---
router.post("/import", async (req, res) => {
  try {
    const { messageIds } = req.body as { messageIds: string[] };
    if (!Array.isArray(messageIds) || messageIds.length === 0)
      return res.status(400).json({ error: "No message IDs" });

    const userId = (req as any).session?.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Ensure we have a stored refresh token before attempting to build an OAuth client
    const storedRefresh = await getStoredRefreshTokenForUser(userId);
    if (!storedRefresh) {
      return res.status(401).json({ error: "No refresh token stored for user" });
    }

    const oauth2Client = await makeOAuthClient();
    oauth2Client.setCredentials({ refresh_token: storedRefresh });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const importedContacts: any[] = [];

    for (const id of messageIds) {
      const msgRes = await gmail.users.messages.get({ userId: "me", id, format: "full" });
      const parts = (msgRes as any)?.data?.payload?.parts || [];
      let body = (msgRes as any)?.data?.snippet || "";

      const findHtmlPart = (partsArr: any[]): string | null => {
        for (const p of partsArr) {
          if (p.mimeType === "text/html" && p.body?.data)
            return Buffer.from(p.body.data, "base64").toString("utf-8");
          if (p.mimeType === "text/plain" && p.body?.data)
            return Buffer.from(p.body.data, "base64").toString("utf-8");
          if (p.parts) {
            const r = findHtmlPart(p.parts);
            if (r) return r;
          }
        }
        return null;
      };

      const html = findHtmlPart(parts);
      if (html) {
        body = html;
      } else if ((msgRes as any)?.data?.payload?.body?.data) {
        body = Buffer.from((msgRes as any).data.payload.body.data, "base64").toString("utf-8");
      }

      const signatureText = extractSignatureFromBody(body);
      const extracted = parseSignatureHeuristics(signatureText);

      const contactPayload = {
  name: extracted.name || extracted.email || "Unknown",
  emails: extracted.email ? [extracted.email] : [],
  phones: extracted.phone ? [extracted.phone] : [],
  company: extracted.company || null,
  title: extracted.title || null,
  website: extracted.website || null,
  skills: extracted.skills || [],
  provenance: {
    messageId: id,
    threadId: msgRes.data.threadId,
  },
  rawHtml: body,
};


      try {
        await createContact(userId, contactPayload);
        importedContacts.push({ contact: contactPayload });
      } catch (e) {
        console.error("contact save err", e);
      }
    }

    res.json({ success: true, count: importedContacts.length, importedContacts });
  } catch (err: any) {
    console.error("gmail import error:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

export default router;

/* -----------------------
   Helper functions below
   ----------------------- */

function extractSignatureFromBody(bodyHtmlOrText: string): string {
  if (!bodyHtmlOrText) return "";
  let text = bodyHtmlOrText;
  try {
    const root = parse(bodyHtmlOrText);
    text = root.textContent;
  } catch {}
  const splitters = ["--", "Regards,", "Best regards", "Thanks,", "Best,", "Sincerely", "Sent from my"];
  let sig = "";
  for (const s of splitters) {
    const idx = text.lastIndexOf(s);
    if (idx !== -1 && text.length - idx < 800) {
      sig = text.slice(idx);
      break;
    }
  }
  if (!sig) sig = text.slice(Math.max(0, text.length - 800));
  return sig.trim();
}

function parseSignatureHeuristics(sig: string) {
  const out: any = {};
  const emailMatch = sig.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/);
  if (emailMatch) out.email = emailMatch[0];
  const phoneMatch = sig.match(/(\+?\d{1,4}[\s-]?)?(\(?\d{3,4}\)?[\s-]?)?[\d\s-]{6,12}/);
  if (phoneMatch) out.phone = phoneMatch[0].trim();
  const webMatch = sig.match(/(https?:\/\/[^\s]+)/);
  if (webMatch) out.website = webMatch[0];
  const lines = sig.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length) {
    out.name = lines[0];
    if (lines[1] && /(LLC|Inc|Ltd|Company|Corp|University|Institute)/i.test(lines[1])) {
      out.company = lines[1];
    } else if (lines[1]) {
      out.title = lines[1];
    }
  }
  out.skills = [];
  for (const l of lines.slice(0, 6)) {
    if (l.split(",").length >= 3 && l.length < 120) {
      out.skills = l.split(",").map((s) => s.trim()).filter(Boolean);
      break;
    }
  }
  return out;
}

async function createContact(userId: string, payload: any) {
  await db.insert(contacts).values({
    id: crypto.randomUUID(),
    userId,

    name: payload.name || "Unknown",
    email: payload.emails?.[0] || null,
    phone: payload.phones?.[0] || null,

    company: payload.company || null,
    title: payload.title || null,

    websiteUrl: payload.website || null,

    skills: Array.isArray(payload.skills) ? payload.skills : [],

    extractedData: {
      gmail: {
        messageId: payload.provenance?.messageId,
        threadId: payload.provenance?.threadId,
        rawHtml: payload.rawHtml || null,
      },
    },

    sources: [
      {
        source: "gmail",
        url: "",
        verified: false,
      },
    ],

    notes: "Imported from Gmail",
  });
}
