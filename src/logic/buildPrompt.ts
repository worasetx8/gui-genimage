import type { ImageJob } from "./buildjob";

export function buildPrompt(job: ImageJob) {
  const lines: string[] = [];

  lines.push(`ACTION: ${job.action}`);
  lines.push("");
  lines.push("INPUT_FILES:");   

  lines.push(`- FACE: ${job.files.face.join(", ") || "-"}`);
  lines.push(`- POSE: ${job.files.pose.join(", ") || "-"}`);
  lines.push(`- OUTFIT: ${job.files.outfit.join(", ") || "-"}`);
  lines.push(`- OBJECT: ${job.files.object.join(", ") || "-"}`);

  lines.push("");
  lines.push("SETTINGS:");
  lines.push(`- Model: ${job.settings.model}`);
  lines.push(`- Gender: ${job.settings.gender ?? "Female (default)"}`);
  lines.push(`- Location: ${job.settings.location ?? "Neutral studio (default)"}`);
  lines.push(`- Aspect Ratio: ${job.settings.aspectRatio}`);
  lines.push(`- Output Count: ${job.settings.outputCount}`);
  if (job.settings.style) {
    lines.push(`- Image Style: ${job.settings.style}`);
  }

  lines.push("");
  lines.push("MAPPING:");
  job.mapping.forEach((m) => {
    lines.push(
      `- image_${m.imageIndex}: pose=${m.pose ?? "auto"} outfit=${m.outfit ?? "auto"}`
    );
  });

  lines.push("");
  lines.push(
    "INSTRUCTIONS:\nFollow the System Context strictly. Reject execution immediately if any filename validation fails. Do not infer or guess missing roles."
  );

  return lines.join("\n");
}
