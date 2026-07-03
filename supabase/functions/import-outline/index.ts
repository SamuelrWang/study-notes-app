// Outline-import proxy: holds the shared Anthropic key server-side and
// streams NDJSON back to the app. Supabase verifies the caller's JWT before
// this runs (verify_jwt), so only signed-in Study Notes users can spend.
import Anthropic from "npm:@anthropic-ai/sdk";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mirrors AGENTS.md §3 — the verse-inheritance rules the markdown importer
// implements in code, enforced here by instruction.
const SYSTEM = `You transcribe ONE printed Bible-study message outline (Living Stream Ministry / Recovery Version style) into NDJSON. Accuracy is critical: copy wording exactly as printed — never paraphrase, correct, or abbreviate.

OUTPUT: one JSON object per line, nothing else (no code fences, no commentary, no wrapping array):
{"kind":"meta","number":"<message number if visible, else omit>","title":"<title without the 'Message N' prefix>","scriptureReading":"<Scripture Reading refs joined by '; ', omit if none>"}
{"kind":"point","depth":<int>,"text":"<point text>"}
{"kind":"error","message":"<why the upload can't be imported>"}

RULES
1. Emit the meta line first, then every outline point in printed order, one line each, as soon as each is ready.
2. depth from the outline label hierarchy: I./II. = 0, A./B. = 1, 1./2. = 2, a./b. = 3, deeper = 4. Do NOT include the label itself in the text — the app renumbers automatically.
3. ONE MESSAGE ONLY: if the upload contains more than one message outline (e.g. several messages of a conference), emit exactly one {"kind":"error","message":"This looks like N message outlines. Import one message at a time — open each note and upload just that message's pages."} and stop.
4. VERSE REFERENCES — wrap every scripture reference in square brackets, inline where it appears: "…God's spiritual house—[1 Pet. 2:4-5]:". Use Recovery Version abbreviations as printed (Matt., Rom., 1 Cor., Psa., Ezek., Rev., S.S., …). Separate refs in a cluster stay separate brackets.
5. RESOLVE SHORTENED REFERENCES to their full canonical form inside the brackets. The outline never repeats itself — a reference that omits the book and/or chapter inherits from the most recent reference above it that stated it:
   - Within a citation cluster, book AND chapter carry forward: "Num. 24:9; Psa. 71:14; 103:1-5" → the bare "103:1-5" is [Psa. 103:1-5] (inherits Psa. from just before, NOT the message's main book).
   - "Matt. 3:11-12; 13:24-30, 38-42" → [Matt. 3:11-12], [Matt. 13:24-30], [Matt. 13:38-42] (bare "38-42" reuses chapter 13).
   - A cluster that STARTS bare ("—1:1, 17; 2:1-2") inherits the message's central book (the book the message is about): [Matt. 1:1], [Matt. 1:17], [Matt. 2:1-2].
   - "v. 12a" / "vv. 21, 27" inherit both book and chapter from the nearest preceding reference in document order — under a parent citing 16:16, "vv. 21, 27" → [Matt. 16:21], [Matt. 16:27].
   - Keep letter suffixes (11a, 25b) in the bracket label.
   - Keep the visible text natural: the printed "v. 12a" may be written as its resolved bracket [Matt. 3:12a] in place.
6. Only bracket text that is actually a scripture citation (has a chapter:verse colon or a v./vv. marker) — never prose numbers.
7. Keep punctuation exactly as printed (em dashes before citation clusters, trailing ":" or ";" on points).
8. Multiple pages/images are consecutive pages of the SAME message — continue through them in order.
9. Every line must be valid standalone JSON. Escape quotes inside text properly.`;

type UploadedFile = { kind: "image" | "pdf"; media_type: string; data: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const { files } = (await req.json()) as { files: UploadedFile[] };
  if (!files?.length) {
    return Response.json({ error: "No files uploaded." }, { status: 400, headers: CORS });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return Response.json({ error: "Import service not configured." }, { status: 500, headers: CORS });
  }

  const client = new Anthropic({ apiKey });
  const content: Anthropic.ContentBlockParam[] = [
    ...files.map<Anthropic.ContentBlockParam>((f) =>
      f.kind === "pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: f.data } }
        : {
            type: "image",
            source: {
              type: "base64",
              media_type: f.media_type as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: f.data,
            },
          },
    ),
    { type: "text", text: "Transcribe this message outline as NDJSON." },
  ];

  const stream = client.messages.stream({
    model: "claude-sonnet-5",
    max_tokens: 64000,
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Import failed";
        controller.enqueue(encoder.encode(`\n${JSON.stringify({ kind: "error", message: msg })}\n`));
      }
      controller.close();
    },
    cancel() {
      stream.controller.abort();
    },
  });

  return new Response(body, {
    headers: { ...CORS, "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
});
