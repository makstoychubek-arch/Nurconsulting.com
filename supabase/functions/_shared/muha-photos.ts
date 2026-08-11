export type MuhaPhotoResult = {
  ok: boolean;
  imageUrl?: string;
  imageBytes?: Uint8Array;
  error?: string;
};

function wantsPhoto(text: string): boolean {
  const t = text.toLowerCase();
  return /фото|картинк|изображен|сгенер|нарису|визуал|баннер|креатив|mockup|мокап|инфограф/.test(t);
}

function buildPrompt(text: string): string {
  return [
    "Professional e-commerce product photography for Wildberries marketplace card.",
    "Clean commercial look, high detail, realistic lighting, no watermarks, no text overlays unless asked.",
    "Square composition suitable for marketplace listing.",
    `User request: ${text.slice(0, 900)}`,
  ].join("\n");
}

async function generateWithImagesApi(apiKey: string, prompt: string): Promise<MuhaPhotoResult> {
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
        n: 1,
      }),
      signal: AbortSignal.timeout(90000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data?.error?.message || `images api ${res.status}` };
    }
    const b64 = data?.data?.[0]?.b64_json as string | undefined;
    const url = data?.data?.[0]?.url as string | undefined;
    if (b64) {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return { ok: true, imageBytes: bytes };
    }
    if (url) return { ok: true, imageUrl: url };
    return { ok: false, error: "empty image response" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function generateWithDalle(apiKey: string, prompt: string): Promise<MuhaPhotoResult> {
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        size: "1024x1024",
        n: 1,
        response_format: "url",
      }),
      signal: AbortSignal.timeout(90000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data?.error?.message || `dalle ${res.status}` };
    }
    const url = data?.data?.[0]?.url as string | undefined;
    if (!url) return { ok: false, error: "empty dalle url" };
    return { ok: true, imageUrl: url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function generateMuhaPhoto(userText: string): Promise<MuhaPhotoResult> {
  if (!wantsPhoto(userText)) {
    return { ok: false, error: "not_a_photo_request" };
  }
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return { ok: false, error: "OPENAI_API_KEY missing" };

  const prompt = buildPrompt(userText);
  const primary = await generateWithImagesApi(apiKey, prompt);
  if (primary.ok) return primary;
  return await generateWithDalle(apiKey, prompt);
}

export { wantsPhoto };
