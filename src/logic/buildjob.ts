import { z } from "zod";
import type { GroupedFiles } from "./groupFiles";

export const ActionSchema = z.enum([
  "OUTFIT_SWAP",
  "POSE_VARIATION",
  "LOOKBOOK",
  "PRODUCT_SHOOT",
  "CUSTOM_MAPPING",
]);

export type Action = z.infer<typeof ActionSchema>;

export const AspectRatioSchema = z.enum(["9:16", "16:9", "1:1", "4:5"]);
export type AspectRatio = z.infer<typeof AspectRatioSchema>;

export type JobSettings = {
    model: ModelId;
    gender?: string;
    location?: string;
    aspectRatio: AspectRatio;
    outputCount: number;
    style?: string;
  };

export type MappingItem = {
  imageIndex: number; // 1-based
  pose?: string;      // filename
  outfit?: string;    // filename
};

export type ImageJob = {
  action: Action;
  files: {
    face: string[];
    pose: string[];
    outfit: string[];
    object: string[];
  };
  settings: JobSettings;
  mapping: MappingItem[]; // can be auto-generated
};

export function autoMappingRotate(
  grouped: GroupedFiles,
  outputCount: number,
  poseMode: "FIRST" | "ROTATE" = "FIRST"
): MappingItem[] {
  const poses = grouped.POSE.map((f: File) => f.name);
  const outfits = grouped.OUTFIT.map((f: File) => f.name);

  const mapping: MappingItem[] = [];
  for (let i = 1; i <= outputCount; i++) {
    const outfit = outfits.length ? outfits[(i - 1) % outfits.length] : undefined;
    const pose =
      poses.length === 0
        ? undefined
        : poseMode === "ROTATE"
          ? poses[(i - 1) % poses.length]
          : poses[0];

    mapping.push({ imageIndex: i, pose, outfit });
  }
  return mapping;
}

export function buildJob(params: {
  action: Action;
  grouped: GroupedFiles;
  settings: JobSettings;
  explicitMapping?: MappingItem[]; // if user custom
  poseMode?: "FIRST" | "ROTATE";
}): ImageJob {
  const { action, grouped, settings, explicitMapping, poseMode = "FIRST" } = params;

  const job: ImageJob = {
    action,
    files: {
      face: grouped.FACE.map((f: File) => f.name),
      pose: grouped.POSE.map((f: File) => f.name),
      outfit: grouped.OUTFIT.map((f: File) => f.name),
      object: grouped.OBJECT.map((f: File) => f.name),
    },
    settings,
    mapping:
      explicitMapping && explicitMapping.length
        ? explicitMapping
        : autoMappingRotate(grouped, settings.outputCount, poseMode),
  };

  return job;
}
export const ModelSchema = z.enum([
    "google-imagen",
    "openai-image",
  ]);
  export type ModelId = z.infer<typeof ModelSchema>;