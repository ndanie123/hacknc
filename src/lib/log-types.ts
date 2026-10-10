export type LogTypeId = "general" | "psychiatric" | "symptom" | "medication";

export interface LogTypeDef {
  id: LogTypeId;
  label: string;
  description: string;
  sections: string[];
}

export const LOG_TYPES: LogTypeDef[] = [
  {
    id: "general",
    label: "General Health",
    description: "Overall wellbeing, vitals, sleep, diet and activity.",
    sections: ["Summary", "Vitals & Measurements", "Sleep, Diet & Activity", "Questions for Provider"],
  },
  {
    id: "psychiatric",
    label: "Psychiatric / Mental Health",
    description: "Mood, anxiety, thoughts, triggers and coping.",
    sections: ["Mood Overview", "Symptoms & Triggers", "Coping & Therapy Notes", "Questions for Provider"],
  },
  {
    id: "symptom",
    label: "Symptom Tracker",
    description: "Onset, severity, duration and patterns of symptoms.",
    sections: ["Primary Symptoms", "Onset & Duration", "Severity & Patterns", "Questions for Provider"],
  },
  {
    id: "medication",
    label: "Medication Log",
    description: "Doses, adherence, side effects and changes.",
    sections: ["Current Medications", "Adherence", "Side Effects", "Questions for Provider"],
  },
];

export const getLogType = (id: string) => LOG_TYPES.find((t) => t.id === id) ?? LOG_TYPES[0]!;

/** Placeholder for the AI agent: turns a free-text prompt into a sectioned draft. */
export function draftFromPrompt(typeId: string, prompt: string): string {
  const t = getLogType(typeId);
  return t.sections
    .map((s, i) => `## ${s}\n${i === 0 ? prompt.trim() : ""}`)
    .join("\n\n");
}
