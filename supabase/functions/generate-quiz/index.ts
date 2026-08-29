import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { content, numQuestions = 10, difficulty = "medium", topics = "", language = "ar", creativity = "balanced" } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    if (!OPENROUTER_API_KEY && !GOOGLE_API_KEY) throw new Error("OPENROUTER_API_KEY missing");

    const n = Math.max(3, Math.min(50, Number(numQuestions) || 10));
    const lang = language === "en" ? "English" : "Arabic";

    const creativityRule = creativity === "strict"
      ? "STRICT mode: stay 100% faithful to the provided source. Do NOT invent numbers, names, or facts. Only ask about content that is explicitly present."
      : creativity === "creative"
      ? "CREATIVE mode: feel free to introduce new numbers, scenarios, twists, and analogies that test the same underlying concept. Make it fun."
      : "BALANCED mode: stay close to the source but you may rephrase, use simple examples, and vary numbers slightly.";

    const difficultyRule = difficulty === "mixed"
      ? "Difficulty: MIXED. Spread the questions as evenly as possible across easy, medium, and hard (roughly a third each) and set each question's own \"difficulty\" field to match what you actually wrote."
      : `Difficulty: ${difficulty}. Set every question's "difficulty" field to "${difficulty}".`;

    const systemPrompt = `You are an expert quiz generator for teachers. Generate exactly ${n} multiple-choice questions in ${lang}. Each question has exactly 4 distinct plausible options and ONE correct answer. ${difficultyRule} ${topics ? `Teacher's request / focus: ${topics}.` : ""} ${creativityRule} You MUST respond with valid JSON only, matching this exact schema: {"title": string, "questions": [{"text": string, "options": [string, string, string, string], "correct_index": 0|1|2|3, "difficulty": "easy"|"medium"|"hard"}]}. No markdown, no explanation, just JSON.`;

    const userMessage = content?.trim()
      ? `Source content:\n\n${String(content).slice(0, 25000)}`
      : `Topic(s): ${topics || "general knowledge"}`;

    // Free-tier models on OpenRouter get upstream-rate-limited or pulled from
    // free routing unpredictably, so try a couple of fallbacks before giving up.
    const models = OPENROUTER_API_KEY
      ? ["openai/gpt-oss-20b:free", "openai/gpt-oss-120b:free", "meta-llama/llama-3.3-70b-instruct:free"]
      : [];

    let text: string | undefined;
    let lastErrText = "";
    let lastErrStatus = 0;

    for (const model of models) {
      const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://n7elha.com",
          "X-Title": "n7elha",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          temperature: creativity === "strict" ? 0.3 : creativity === "creative" ? 1.0 : 0.7,
          response_format: { type: "json_object" },
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        text = data?.choices?.[0]?.message?.content;
        break;
      }
      lastErrText = await resp.text();
      lastErrStatus = resp.status;
      console.error("AI error", model, resp.status, lastErrText);
      // Try the next fallback model on ANY failure, not just 429 — a model can
      // also come back 404 (upstream free-tier routing pulled), 400, 503, etc.
      // Stopping early here defeats the whole point of having fallbacks.
    }

    // OpenRouter's free-tier routing can go down for every configured model at
    // once (upstream providers pulling free access, not just per-model rate
    // limits). Google's Gemini API is already used directly (with its own key)
    // for question-image generation, so it's a reliable last resort here too.
    if (!text && GOOGLE_API_KEY) {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GOOGLE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\n${userMessage}` }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        }
      );
      if (resp.ok) {
        const data = await resp.json();
        text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      } else {
        lastErrText = await resp.text();
        lastErrStatus = resp.status;
        console.error("AI error", "gemini-3.6-flash", resp.status, lastErrText);
      }
    }

    if (!text) {
      if (lastErrStatus === 429) {
        return new Response(JSON.stringify({ error: "All models are rate-limited right now, try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`AI error ${lastErrStatus}: ${lastErrText.slice(0, 200)}`);
    }

    // Strip markdown fences if model wrapped the JSON
    const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const args = JSON.parse(clean);
    if (!args?.questions?.length) throw new Error("No questions generated");

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-quiz error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
