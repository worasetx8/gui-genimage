import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";
import sharp from "sharp";

import multer from "multer";
import fs from "fs";
import path from "path";


const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
const upload = multer({ dest: "./server/tmp" });

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function mapAspectToSize(aspectRatio) {
  // OpenAI gpt-image-1 supported sizes: 1024x1024, 1536x1024, 1024x1536, auto :contentReference[oaicite:1]{index=1}
  if (aspectRatio === "9:16") return "1024x1536";
  if (aspectRatio === "16:9") return "1536x1024";
  if (aspectRatio === "1:1") return "1024x1024";
  if (aspectRatio === "4:5") return "1024x1536"; // closest; you can crop later
  return "auto";
}

async function toPngPath(uploadedFile) {
    // multer gives: { path, originalname, mimetype, ... }
    // Convert anything to PNG and return new file path.
    const outPath = `${uploadedFile.path}.png`;
    await sharp(uploadedFile.path).png().toFile(outPath);
    return outPath;
  }

app.post("/api/generate", async (req, res) => {
  try {
    const { model, prompt, n, aspectRatio, quality } = req.body ?? {};

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing prompt" });
    }

    // MVP: support OpenAI only first
    if (model && model !== "openai-image") {
      return res.status(400).json({ error: `Model not supported yet: ${model}` });
    }

    const size = mapAspectToSize(aspectRatio);

    // Use gpt-image-1 (recommended) :contentReference[oaicite:2]{index=2}
    const img = await client.images.generate({
      model: "gpt-image-1",
      prompt,
      n: Math.min(Math.max(Number(n || 1), 1), 10),
      size,                       // 1024x1536 for portrait, 1536x1024 for landscape :contentReference[oaicite:3]{index=3}
      quality: quality || "auto", // high/medium/low/auto supported for gpt-image-1 :contentReference[oaicite:4]{index=4}
      // gpt-image-1 always returns base64-encoded images :contentReference[oaicite:5]{index=5}
    });

    const images = (img.data || []).map((d, i) => ({
      name: `image_${String(i + 1).padStart(2, "0")}.png`,
      b64: d.b64_json,
      mime: "image/png",
    }));

    res.json({ images });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Generate failed" });
  }
});

app.post("/api/generate-ref", upload.any(), async (req, res) => {
    try {
      const job = JSON.parse(req.body.job || "{}");
      const prompt = String(req.body.prompt || "");
      const aspectRatio = String(req.body.aspectRatio || "9:16");
      const quality = String(req.body.quality || "low");
  
      const face = String(req.body.face || "");
      const pose = String(req.body.pose || "");
      const object = String(req.body.object || "");
      const outfits = JSON.parse(req.body.outfits || "[]"); // array of filenames
      const n = Math.min(Math.max(Number(req.body.n || outfits.length || 1), 1), 10);
  
      if (!prompt) return res.status(400).json({ error: "Missing prompt" });
      if (!face || !pose) return res.status(400).json({ error: "Missing face or pose selection" });
      if (!Array.isArray(outfits) || outfits.length === 0) return res.status(400).json({ error: "Missing outfits selection" });
  
      const files = req.files || [];
      const byName = new Map();
      for (const f of files) byName.set(f.originalname, f);
  
      const getUpload = (name) => {
        const f = byName.get(name);
        if (!f) throw new Error(`Missing uploaded file: ${name}`);
        return f;
      };
  
      const size = mapAspectToSize(aspectRatio);
  
      const results = [];
      const limit = Math.min(n, outfits.length);
  
      for (let i = 0; i < limit; i++) {
        const outfitName = outfits[i];
  
        const faceFile = getUpload(face);
        const poseFile = getUpload(pose);
        const outfitFile = getUpload(outfitName);
        const objFile = object ? getUpload(object) : null;
  
        const facePng = await toPngPath(faceFile);
        const posePng = await toPngPath(poseFile);
        const outfitPng = await toPngPath(outfitFile);
        const objPng = objFile ? await toPngPath(objFile) : null;
        
        // IMPORTANT: attach with correct filename so server sets proper content-type
        const images = [
          fs.createReadStream(facePng),
          fs.createReadStream(posePng),
          fs.createReadStream(outfitPng),
        ];
        if (objPng) images.push(fs.createReadStream(objPng));
        const strictPrompt =
          prompt +
          "\n\nSTRICT RULES:\n" +
          "- Keep the exact camera angle and pose from the POSE reference.\n" +
          "- Keep the same facial identity from the FACE reference.\n" +
          "- Apply the OUTFIT reference exactly.\n" +
          (object ? "- Include the OBJECT reference and match how it is held.\n" : "") +
          "- No extra fingers/limbs, no distorted labels.\n";
  
        const edited = await client.images.edit({
          model: "gpt-image-1",
          image: images,         // multiple refs
          prompt: strictPrompt,
          size,
          quality,               // low = cheapest test
          input_fidelity: "high",
          output_format: "png",
          n: 1,
        });
  
        results.push({
          name: `image_${String(i + 1).padStart(2, "0")}.png`,
          b64: edited.data?.[0]?.b64_json,
          mime: "image/png",
          outfit: outfitName,
        });
      }
  
      // cleanup
      for (const f of files) {
        try { fs.unlinkSync(f.path); } catch {}
      }
  
      res.json({ images: results });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err?.message || "Generate-ref failed" });
    }
  });
  
  
const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
