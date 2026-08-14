/**
 * Minimal Google Sheets append via service account JWT (no external deps).
 * Env: GOOGLE_SERVICE_ACCOUNT_JSON — full SA JSON string
 */

function b64url(data: ArrayBuffer | Uint8Array | string): string {
  const bytes =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : data instanceof Uint8Array
        ? data
        : new Uint8Array(data);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: sa.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${b64url(sig)}`;

  const res = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(data?.error_description || data?.error || `token ${res.status}`);
  }
  return data.access_token as string;
}

export async function appendSheetRows(
  spreadsheetId: string,
  range: string,
  rows: (string | number | boolean | null)[][],
): Promise<{ ok: boolean; error?: string }> {
  const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!raw) return { ok: false, error: "GOOGLE_SERVICE_ACCOUNT_JSON missing" };

  let sa: ServiceAccount;
  try {
    sa = JSON.parse(raw) as ServiceAccount;
  } catch {
    return { ok: false, error: "invalid GOOGLE_SERVICE_ACCOUNT_JSON" };
  }
  if (!sa.client_email || !sa.private_key) {
    return { ok: false, error: "SA missing client_email/private_key" };
  }

  try {
    const token = await getAccessToken(sa);
    const url =
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}` +
      `/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: rows }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: `sheets ${res.status}: ${t.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
