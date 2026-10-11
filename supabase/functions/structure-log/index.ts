import { GoogleGenAI } from "npm:@google/genai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logSchema = {
  type: "object",
  properties: {
    one_line_summary: { type: "string" },
    symptoms: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          severity: { type: "string", enum: ["mild", "moderate", "severe", "not stated"] },
          onset: { type: "string" },
          patient_quote: { type: "string" },
        },
        required: ["name", "severity", "patient_quote"],
      },
    },
    medications_mentioned: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          dose: { type: "string" },
          side_effects_reported: { type: "array", items: { type: "string" } },
        },
        required: ["name"],
      },
    },
    mood: { type: "string" },
    urgent_flags: { type: "array", items: { type: "string" } },
    questions_for_provider: { type: "array", items: { type: "string" } },
  },
  required: ["one_line_summary", "symptoms", "medications_mentioned", "urgent_flags"],
};

const instructions = `You extract information from a patient's health log for their healthcare provider.
Only include what the patient actually said. Do not diagnose or suggest treatments.
Leave out any field the patient did not mention.
Put anything that sounds like an emergency (chest pain, trouble breathing, thoughts of self-harm,
severe allergic reaction, fainting) in urgent_flags.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { raw_text } = await req.json();
    if (!raw_text || typeof raw_text !== "string") {
      return new Response(JSON.stringify({ error: "raw_text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ai = new GoogleGenAI({ apiKey: Deno.env.get("GEMINI_API_KEY") });
    const interaction = await ai.interactions.create({
      model: "gemini-3.8-flash",
      input: `${instructions}\n\nPatient log:\n${raw_text}`,
      response_format: { type: "text", mime_type: "application/json", schema: logSchema },
    });

    const structured = JSON.parse(interaction.output_text);

    return new Response(JSON.stringify(structured), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Could not structure this log" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});