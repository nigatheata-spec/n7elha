// Direct DeepSeek API client — bypasses Supabase Edge Functions
// Requires VITE_DEEPSEEK_API_KEY in .env

const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY as string;
const BASE_URL = "https://api.deepseek.com/chat/completions";

export interface GeneratedQuestion {
  text: string;
  options: [string, string, string, string];
  correct_index: 0 | 1 | 2 | 3;
  difficulty: "easy" | "medium" | "hard";
}

export interface GenerateQuizResult {
  title: string;
  questions: GeneratedQuestion[];
}

export interface GenerateQuizParams {
  content?: string;
  topics?: string;
  numQuestions?: number;
  difficulty?: "easy" | "medium" | "hard";
  creativity?: "strict" | "balanced" | "creative";
  language?: string;
}

export async function generateQuiz(params: GenerateQuizParams): Promise<GenerateQuizResult> {
  if (!API_KEY) throw new Error("VITE_DEEPSEEK_API_KEY is not set in .env");

  const {
    content = "",
    topics = "",
    numQuestions = 10,
    difficulty = "medium",
    creativity = "balanced",
    language = "ar",
  } = params;

  const n = Math.max(3, Math.min(50, Number(numQuestions) || 10));
  const lang = language === "en" ? "English" : "Arabic";

  const creativityRule =
    creativity === "strict"
      ? "STRICT mode: stay 100% faithful to the provided source. Do NOT invent numbers, names, or facts. Only ask about content that is explicitly present."
      : creativity === "creative"
      ? "CREATIVE mode: feel free to introduce new numbers, scenarios, twists, and analogies that test the same underlying concept. Make it fun."
      : "BALANCED mode: stay close to the source but you may rephrase, use simple examples, and vary numbers slightly.";

  const systemPrompt = `You are an expert quiz generator for teachers. Generate exactly ${n} multiple-choice questions in ${lang}. Each question has exactly 4 distinct plausible options and ONE correct answer. Difficulty: ${difficulty}. ${topics ? `Teacher's request / focus: ${topics}.` : ""} ${creativityRule} You MUST respond with valid JSON only, matching this exact schema: {"title": string, "questions": [{"text": string, "options": [string, string, string, string], "correct_index": 0|1|2|3, "difficulty": "easy"|"medium"|"hard"}]}. No markdown, no explanation, just JSON.`;

  const userMessage = content?.trim()
    ? `Source content:\n\n${String(content).slice(0, 25000)}`
    : `Topic(s): ${topics || "general knowledge"}`;

  const resp = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: creativity === "strict" ? 0.3 : creativity === "creative" ? 1.0 : 0.7,
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    if (resp.status === 429) throw new Error("Rate limit exceeded, try again shortly.");
    throw new Error(`DeepSeek error ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("No response from AI");

  const result: GenerateQuizResult = JSON.parse(text);
  if (!result?.questions?.length) throw new Error("No questions generated");

  return result;
}
