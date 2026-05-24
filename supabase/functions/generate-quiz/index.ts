import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { content, numQuestions = 10, difficulty = "medium", topics = "", language = "ar", creativity = "balanced", images = [] } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const n = Math.max(3, Math.min(50, Number(numQuestions) || 10));
    const lang = language === "en" ? "English" : "Arabic";

    const creativityRule = creativity === "strict"
      ? "STRICT mode: stay 100% faithful to the provided source. Do NOT invent numbers, names, or facts. Only ask about content that is explicitly present."
      : creativity === "creative"
      ? "CREATIVE mode: feel free to introduce new numbers, scenarios, twists, and analogies that test the same underlying concept. Make it fun."
      : "BALANCED mode: stay close to the source but you may rephrase, use simple examples, and vary numbers slightly.";

    const systemPrompt = `You are an expert quiz generator for teachers. Generate exactly ${n} multiple-choice questions in ${lang}. Each question has exactly 4 distinct plausible options and ONE correct answer. Difficulty: ${difficulty}. ${topics ? `Teacher's request / focus: ${topics}.` : ""} ${creativityRule} Output via the provided tool only.`;

    const textPart = content?.trim()
      ? `Source content:\n\n${String(content).slice(0, 25000)}`
      : `Topic(s): ${topics || "general knowledge"}`;
    const imgs = Array.isArray(images) ? images.filter((u: any) => typeof u === "string" && u.startsWith("data:image")) : [];
    const userContent: any = imgs.length
      ? [{ type: "text", text: textPart + (imgs.length ? "\n\nAlso use the attached image(s) as source material." : "") },
         ...imgs.map((url: string) => ({ type: "image_url", image_url: { url } }))]
      : textPart;

    const tools = [{
      type: "function",
      function: {
        name: "create_quiz",
        description: "Return generated quiz questions",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Suggested quiz title (short)" },
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  text: { type: "string" },
                  options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
                  correct_index: { type: "integer", minimum: 0, maximum: 3 },
                  difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                },
                required: ["text", "options", "correct_index", "difficulty"],
                additionalProperties: false,
              },
            },
          },
          required: ["title", "questions"],
          additionalProperties: false,
        },
      },
    }];

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "create_quiz" } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in workspace settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await resp.text();
      console.error("AI error", resp.status, t);
      throw new Error(`AI gateway ${resp.status}`);
    }

    const data = await resp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = call?.function?.arguments ? JSON.parse(call.function.arguments) : null;
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
