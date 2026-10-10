import { getLogType } from "./log-types";

interface PdfInput {
  title: string;
  log_type: string;
  content: string;
  created_at: string;
  patientName?: string | null | undefined;
  dateOfBirth?: string | null | undefined;
}

export async function downloadLogPdf(log: PdfInput) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const type = getLogType(log.log_type);
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 54;

  doc.setFillColor(120, 83, 213);
  doc.rect(0, 0, W, 80, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("AeroHealth Log", M, 38);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(type.label.toUpperCase(), M, 58);

  doc.setTextColor(30, 40, 60);
  let y = 112;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(log.title, M, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const meta = [
    `Patient: ${log.patientName || "—"}`,
    `DOB: ${log.dateOfBirth || "—"}`,
    `Created: ${new Date(log.created_at).toLocaleString()}`,
  ].join("     ");
  doc.text(meta, M, y);
  y += 14;
  doc.setDrawColor(217, 210, 246);
  doc.line(M, y, W - M, y);
  y += 22;

  const ensure = (h: number) => {
    if (y + h > H - M) {
      doc.addPage();
      y = M;
    }
  };

  for (const raw of log.content.split("\n")) {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) {
      ensure(30);
      y += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(120, 83, 213);
      doc.text(line.slice(3), M, y);
      y += 18;
      doc.setTextColor(30, 40, 60);
      continue;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const wrapped = doc.splitTextToSize(line || " ", W - M * 2) as string[];
    for (const w of wrapped) {
      ensure(15);
      doc.text(w, M, y);
      y += 15;
    }
  }

  doc.setFontSize(8);
  doc.setTextColor(120, 130, 150);
  doc.text("Patient-reported information. For reference during clinical visits.", M, H - 28);
  doc.save(`${log.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "health-log"}.pdf`);
}
