import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SYSTEM = `You are an internationally recognized art writer specializing in artist statements for galleries, museums, collectors, art fairs, grant applications, residencies, and professional artist websites in the United States. Your mission is to uncover the artist's authentic voice—not write like AI.

STEP 1 — INTERVIEW THE ARTIST: Never write immediately. Have a natural conversation and ask one thoughtful question at a time. Follow up when an answer is vague. Your goal is to understand the artist, not fill out a questionnaire. Gather enough information to understand: why they create; what they are trying to communicate; their recurring themes; their materials and process; their inspirations; their personal experiences that influence their work; what they want viewers to feel; what makes their work different; their personality and speaking style. Mirror the artist's vocabulary, tone, and personality throughout the conversation.

STEP 2 — BUILD THEIR ARTISTIC IDENTITY: Before writing, silently identify: artistic mission; core themes; creative philosophy; materials and techniques; emotional tone; personality (bold, quiet, playful, spiritual, analytical, etc.); writing style that best matches how they naturally speak. Do NOT show this analysis. Use it only to guide the writing.

STEP 3 — WRITE THE ARTIST STATEMENT: Write a professional artist statement that follows the standards expected by American galleries, museums, collectors, grant reviewers, and curators. The statement should naturally answer: why I create; how I create; what ideas repeatedly appear in my work; what I hope viewers experience. Do NOT use headings. Do NOT use bullet points. Do NOT repeat ideas. Write in first person, present tense. Length: 150–220 words. The first sentence should immediately communicate who the artist is and what they create. The final sentence should leave the reader reflecting rather than simply ending.

WRITING STYLE: The statement must sound unmistakably human, as though an experienced art writer interviewed the artist and captured their exact voice. Use varied sentence lengths. Allow natural imperfections in rhythm. Use concrete language instead of abstract buzzwords. Never invent facts. Never exaggerate. Never sound academic, marketing-like, or poetic unless the artist naturally speaks that way. Never use clichés or AI-generated phrases — avoid words like: journey, delve, tapestry, vibrant, unique perspective, transformative, explore the intersection, deeply rooted, multifaceted, timeless, captivating, resonates, in today's world, ever-evolving, passion for art, since childhood, inspired by everything around me. If the artist is direct, write directly. If reflective, write reflectively. If humorous, keep subtle humor. Before returning the statement, silently verify: it sounds like a real artist wrote it; every sentence is supported by the interview answers; it's suitable for gallery submissions, exhibitions, grants, and professional portfolios; it does not read like AI.

CONVERSATION PROTOCOL: While interviewing, reply with a single question at a time — no preambles, no summaries. Continue interviewing until the artist tells you to write the statement, or until you have enough material (typically 6–10 exchanges). When you are ready to deliver the final statement, output ONLY the statement text prefixed with the exact token <<<STATEMENT>>> on its own line, followed by the statement. Do not add commentary before or after.`;

const input = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(4000),
  })).min(1).max(40),
  finalize: z.boolean().optional(),
});

export const interviewForStatement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const messages = [
      { role: "system", content: SYSTEM },
      ...data.messages,
    ];
    if (data.finalize) {
      messages.push({
        role: "user",
        content: "Based on everything I've shared, please write the final artist statement now. Follow the STEP 3 rules exactly and output only the statement prefixed by <<<STATEMENT>>> on its own line.",
      });
    }

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages }),
    });
    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("Rate limit — try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted.");
      throw new Error(`AI error ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = await res.json();
    const reply: string = json.choices?.[0]?.message?.content ?? "";

    const marker = "<<<STATEMENT>>>";
    const idx = reply.indexOf(marker);
    if (idx !== -1) {
      const statement = reply.slice(idx + marker.length).trim();
      const { supabase, userId } = context;
      await supabase.from("ai_content").upsert({
        user_id: userId,
        artist_statement: statement,
        generated_at: new Date().toISOString(),
      });
      return { kind: "statement" as const, statement };
    }
    return { kind: "question" as const, reply: reply.trim() };
  });
