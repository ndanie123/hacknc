# hacknc
Project Log Companion HackNC 2026 Repository
Team Yoshi: Devanshi, Lilian, Yashvi, Nick D.

## Gemini Structured Outputs

Log Companion uses the **Google Gemini API** to turn a patient's free-text journal entry into a consistent, structured summary, formatted like nurse's notes, that a provider can scan quickly.

### How it works
1. The patient writes an entry in their own words, as short or as long as they like.
2. The entry is sent to Google Gemini along with a fixed format we defined.
3. Gemini's structured output feature makes sure every summary comes back with the same sections, every time.

### What each summary includes
- **One-line summary** of the entry
- **Symptoms**, with severity, when they started, and the patient's own words
- **Medications mentioned**, with doses and any side effects the patient reported
- **Mood**, as the patient describes it
- **Urgent flags** for anything that sounds like an emergency, such as chest pain or trouble breathing
- **Questions for the provider** that the patient raised

### Safety by design
- Gemini only organizes what the patient actually said. It does not diagnose or suggest treatments.
- Anything the patient didn't mention is left out instead of guessed.
- Each symptom keeps the patient's original wording, so providers can check the summary against the entry.
- The API key is stored securely as a secret and never appears in the code.
- All testing used synthetic data. No real patient information was used.


# Log-ins
Patient — email: maya@aerohealth.app 
Password: Patient!2026 
Provider — email: dr.chen@aerohealth.app 
password: Provider!2026
