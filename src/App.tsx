import { useEffect, useMemo, useState } from "react";
import { validateFilesStrict } from "./logic/validateFilename";
import { groupByRole, type GroupedFiles } from "./logic/groupFiles";
import { buildJob, type Action, type AspectRatio } from "./logic/buildjob";
import { buildPrompt } from "./logic/buildPrompt";

type ModelId = "google-imagen" | "openai-image";

type SelectMode = "NONE" | "SINGLE" | "MULTIPLE";
type MapMode = "FIRST" | "ROTATE" | "PAIR_BY_INDEX";

type RefSelectionState = {
  mode: SelectMode;
  selected: string[]; // filenames
  mapMode: MapMode; // used when MULTIPLE
};

const sortByName = (arr: File[]) => [...arr].sort((a, b) => a.name.localeCompare(b.name));

function displayName(name: string) {
  // for UI only: collapse repeated extensions at the end
  return name.replace(/(\.(jpg|jpeg|png|webp))\1+$/i, "$1");
}

export default function App() {
  const [pickedFiles, setPickedFiles] = useState<File[]>([]);
  const [action, setAction] = useState<Action>("OUTFIT_SWAP");
  const [model, setModel] = useState<ModelId>("openai-image");

  const [outputCount, setOutputCount] = useState<number>(5);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  const [gender, setGender] = useState<string>("หญิง");
  const [location, setLocation] = useState<string>("ห้องนอนโมเดิร์น");

  // kept for backwards compatibility with your earlier buildJob
  const [poseMode, setPoseMode] = useState<"FIRST" | "ROTATE">("FIRST");

  // ref selection states (checkbox list)
  const [faceSel, setFaceSel] = useState<RefSelectionState>({
    mode: "SINGLE",
    selected: [],
    mapMode: "FIRST",
  });
  const [poseSel, setPoseSel] = useState<RefSelectionState>({
    mode: "SINGLE",
    selected: [],
    mapMode: "FIRST",
  });
  const [objectSel, setObjectSel] = useState<RefSelectionState>({
    mode: "NONE",
    selected: [],
    mapMode: "FIRST",
  });
  const [outfitSel, setOutfitSel] = useState<RefSelectionState>({
    mode: "MULTIPLE",
    selected: [],
    mapMode: "PAIR_BY_INDEX",
  });

  // output images UI (to be wired with /api/generate-ref later)
  const [images, setImages] = useState<{ name: string; url: string }[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string>("");

  const { valid, errors } = useMemo(() => validateFilesStrict(pickedFiles), [pickedFiles]);

  const grouped: GroupedFiles | null = useMemo(() => ifValidGrouped(valid, errors), [valid, errors]);

  // auto defaults when grouped is ready (only if user hasn't picked yet)
  useEffect(() => {
    if (!grouped) return;

    const face = sortByName(grouped.FACE).map((f) => f.name);
    const pose = sortByName(grouped.POSE).map((f) => f.name);
    const obj = sortByName(grouped.OBJECT).map((f) => f.name);
    const outf = sortByName(grouped.OUTFIT).map((f) => f.name);

    setFaceSel((s) =>
      s.selected.length ? s : { ...s, mode: "SINGLE", selected: face[0] ? [face[0]] : [], mapMode: "FIRST" }
    );
    setPoseSel((s) =>
      s.selected.length ? s : { ...s, mode: "SINGLE", selected: pose[0] ? [pose[0]] : [], mapMode: "FIRST" }
    );
    setObjectSel((s) =>
      s.selected.length || s.mode !== "NONE"
        ? s
        : { ...s, mode: obj.length ? "SINGLE" : "NONE", selected: obj[0] ? [obj[0]] : [], mapMode: "FIRST" }
    );
    setOutfitSel((s) =>
      s.selected.length
        ? s
        : { ...s, mode: "MULTIPLE", mapMode: "PAIR_BY_INDEX", selected: outf } // select all outfits by default
    );
  }, [grouped]);

  const job = useMemo(() => {
    if (!grouped) return null;
    return buildJob({
      action,
      grouped,
      settings: {
        model,
        gender,
        location,
        aspectRatio,
        outputCount: Math.max(1, outputCount),
        style: "Photorealistic, Ultra High Fidelity, Cinema Quality",
      } as any,
      poseMode,
      // selections will be used later when we update buildJob/buildMapping
      selections: {
        face: faceSel,
        pose: poseSel,
        object: objectSel,
        outfit: outfitSel,
      } as any,
    } as any);
  }, [grouped, action, model, gender, location, aspectRatio, outputCount, poseMode, faceSel, poseSel, objectSel, outfitSel]);

  const prompt = useMemo(() => {
    if (!job) return "";
    return buildPrompt(job as any);
  }, [job]);

  return (
    <div style={{ fontFamily: "system-ui", padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <h1>AI Image Studio (MVP)</h1>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* LEFT */}
        <section style={{ flex: "1 1 360px", padding: 12, border: "1px solid #ddd", borderRadius: 12 }}>
          <h2>1) Import Folder</h2>
          <input
            type="file"
            // @ts-expect-error - Chromium-only folder picker
            webkitdirectory="true"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              setPickedFiles(files);
              setImages([]);
              setGenError("");
            }}
          />
          <div style={{ marginTop: 8, fontSize: 14, opacity: 0.8 }}>
            เลือกโฟลเดอร์ที่มีชื่อไฟล์จับ keyword: face / pose / outfit / object
          </div>

          <hr style={{ margin: "12px 0" }} />

          <h2>2) Settings</h2>
          <div style={{ display: "grid", gap: 8 }}>
            <label>
              Action:{" "}
              <select value={action} onChange={(e) => setAction(e.target.value as Action)}>
                <option value="OUTFIT_SWAP">OUTFIT_SWAP</option>
                <option value="POSE_VARIATION">POSE_VARIATION</option>
                <option value="LOOKBOOK">LOOKBOOK</option>
                <option value="PRODUCT_SHOOT">PRODUCT_SHOOT</option>
                <option value="CUSTOM_MAPPING">CUSTOM_MAPPING</option>
              </select>
            </label>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
            ℹ️ {ACTION_HELP[action]}
          </div>
            <label>
              Model:{" "}
              <select value={model} onChange={(e) => setModel(e.target.value as ModelId)}>
                <option value="openai-image">OpenAI (gpt-image-1)</option>
                <option value="google-imagen">Google (Imagen) - later</option>
              </select>
            </label>

            <label>
              Output count:{" "}
              <input
                type="number"
                min={1}
                value={outputCount}
                onChange={(e) => setOutputCount(parseInt(e.target.value || "1", 10))}
              />
            </label>

            <label>
              Aspect ratio:{" "}
              <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}>
                <option value="9:16">9:16</option>
                <option value="16:9">16:9</option>
                <option value="1:1">1:1</option>
                <option value="4:5">4:5</option>
              </select>
            </label>

            <label>
              Gender (user-defined): <input value={gender} onChange={(e) => setGender(e.target.value)} />
            </label>

            <label>
              Location (user-defined): <input value={location} onChange={(e) => setLocation(e.target.value)} />
            </label>

            <label>
              Pose mode (legacy):{" "}
              <select value={poseMode} onChange={(e) => setPoseMode(e.target.value as any)}>
                <option value="FIRST">FIRST</option>
                <option value="ROTATE">ROTATE</option>
              </select>
            </label>
          </div>
        </section>

        {/* RIGHT */}
        <section style={{ flex: "1 1 520px", padding: 12, border: "1px solid #ddd", borderRadius: 12 }}>
          <h2>3) Validation (Reject Mode)</h2>
          {pickedFiles.length === 0 && <div>ยังไม่ได้เลือกโฟลเดอร์</div>}

          {pickedFiles.length > 0 && errors.length > 0 && (
            <div style={{ color: "#b00020" }}>
              <b>REJECT:</b> พบชื่อไฟล์ไม่ถูกต้อง ({errors.length} ไฟล์) — แก้ชื่อแล้วเลือกใหม่
              <ul>
                {errors.slice(0, 20).map((e: any) => (
                  <li key={e.filename}>
                    <code>{e.filename}</code> —{" "}
                    {e.reason === "NO_ROLE_KEYWORD"
                      ? "ไม่มี keyword (face/pose/outfit/object)"
                      : e.reason === "DUPLICATE_EXTENSION"
                      ? "มีนามสกุลไฟล์ซ้ำ (.jpg/.png ซ้ำ) กรุณาแก้ชื่อ"
                      : `มีหลาย keyword (${(e.detectedRoles || []).join(", ")})`}
                  </li>
                ))}
              </ul>
              {errors.length > 20 && <div>…แสดงแค่ 20 รายการแรก</div>}
            </div>
          )}

          {pickedFiles.length > 0 && errors.length === 0 && grouped && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                <GroupBox title="FACE" files={sortByName(grouped.FACE)} />
                <GroupBox title="POSE" files={sortByName(grouped.POSE)} />
                <GroupBox title="OUTFIT" files={sortByName(grouped.OUTFIT)} />
                <GroupBox title="OBJECT" files={sortByName(grouped.OBJECT)} />
              </div>

              <hr style={{ margin: "12px 0" }} />

              <h2>4) Ref Selection</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                <RefPicker
                  title="FACE"
                  files={sortByName(grouped.FACE)}
                  state={faceSel}
                  setState={setFaceSel}
                  defaultMapModeForMultiple="ROTATE"
                />
                <RefPicker
                  title="POSE"
                  files={sortByName(grouped.POSE)}
                  state={poseSel}
                  setState={setPoseSel}
                  defaultMapModeForMultiple="ROTATE"
                />
                <RefPicker
                  title="OBJECT"
                  files={sortByName(grouped.OBJECT)}
                  allowNone
                  state={objectSel}
                  setState={setObjectSel}
                  defaultMapModeForMultiple="ROTATE"
                />
                <RefPicker
                  title="OUTFIT"
                  files={sortByName(grouped.OUTFIT)}
                  state={outfitSel}
                  setState={setOutfitSel}
                  defaultMapModeForMultiple="PAIR_BY_INDEX"
                />
              </div>

              <hr style={{ margin: "12px 0" }} />

              <h2>5) Preview Job Payload</h2>
              <pre style={{ background: "#111", color: "#eee", padding: 12, borderRadius: 12, overflow: "auto" }}>
{JSON.stringify(job, null, 2)}
              </pre>

              <hr style={{ margin: "12px 0" }} />

              <h2>6) Prompt Preview (English)</h2>
              <textarea
                value={prompt}
                readOnly
                rows={14}
                style={{
                  width: "100%",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  fontSize: 12,
                  padding: 12,
                  borderRadius: 12,
                  background: "#0f0f0f",
                  color: "#eaeaea",
                  border: "1px solid #333",
                }}
              />

              <button
                style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, border: "1px solid #ccc" }}
                disabled={isGenerating}
                onClick={async () => {
                  try {
                    setIsGenerating(true);
                    setGenError("");
                    setImages([]);
                
                    if (!job || !grouped) throw new Error("Job not ready");
                
                    // resolve selections to filenames
                    const face = faceSel.selected[0] || "";
                    const pose = poseSel.selected[0] || "";
                    const object = objectSel.mode === "NONE" ? "" : (objectSel.selected[0] || "");
                
                    // outfits: ถ้า MULTIPLE ให้ใช้ selected (เรียง A→Z อยู่แล้ว); ถ้า SINGLE ใช้ 1 ตัว
                    const outfits =
                      outfitSel.mode === "SINGLE"
                        ? (outfitSel.selected[0] ? [outfitSel.selected[0]] : [])
                        : [...outfitSel.selected];
                
                    if (!face || !pose || outfits.length === 0) {
                      throw new Error("Please select FACE, POSE, and at least 1 OUTFIT");
                    }
                
                    const fd = new FormData();
                    fd.append("prompt", prompt);
                    fd.append("job", JSON.stringify(job));
                    fd.append("aspectRatio", aspectRatio);
                    fd.append("quality", "low"); // cheapest test
                    fd.append("n", String(outputCount));
                
                    // selections
                    fd.append("face", face);
                    fd.append("pose", pose);
                    fd.append("object", object);
                    fd.append("outfits", JSON.stringify(outfits));
                
                    // attach all valid files so backend can find by originalname
                    for (const f of valid) fd.append("files", f, f.name);
                
                    const resp = await fetch("/api/generate-ref", { method: "POST", body: fd });
                    const data = await resp.json();
                    if (!resp.ok) throw new Error(data?.error || "Request failed");
                
                    const imgs = (data.images || []).map((it: any) => ({
                      name: it.name,
                      url: `data:${it.mime};base64,${it.b64}`,
                    }));
                    setImages(imgs);
                  } catch (e: any) {
                    setGenError(e?.message || "Generate failed");
                  } finally {
                    setIsGenerating(false);
                  }
                }}
                
              >
                ▶ {isGenerating ? "Generating..." : "Generate (Ref - OpenAI) (TODO)"}
              </button>

              {genError && (
                <div style={{ marginTop: 10, color: "#b00020" }}>
                  <b>Error:</b> {genError}
                </div>
              )}

              {images.length > 0 && (
                <>
                  <hr style={{ margin: "12px 0" }} />
                  <h2>7) Output Images</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                    {images.map((im) => (
                      <div key={im.name} style={{ border: "1px solid #eee", borderRadius: 12, padding: 10 }}>
                        <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>{im.name}</div>
                        <img src={im.url} alt={im.name} style={{ width: "100%", borderRadius: 10 }} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function ifValidGrouped(valid: File[], errors: any[]) {
  if (errors.length) return null;
  return groupByRole(valid);
}

function GroupBox({ title, files }: { title: string; files: File[] }) {
  return (
    <div style={{ padding: 10, border: "1px solid #eee", borderRadius: 12 }}>
      <b>{title}</b> <span style={{ opacity: 0.7 }}>({files.length})</span>
      <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
        {files.slice(0, 12).map((f) => (
          <li key={f.name}>
            <code>{displayName(f.name)}</code>
          </li>
        ))}
      </ul>
      {files.length > 12 && <div style={{ opacity: 0.7 }}>…</div>}
    </div>
  );
}

function RefPicker({
  title,
  files,
  allowNone,
  state,
  setState,
  defaultMapModeForMultiple = "ROTATE",
}: {
  title: string;
  files: File[];
  allowNone?: boolean;
  state: RefSelectionState;
  setState: (v: RefSelectionState) => void;
  defaultMapModeForMultiple?: MapMode;
}) {
  const names = files.map((f) => f.name);

  const setMode = (mode: SelectMode) => {
    if (mode === "NONE") return setState({ mode, selected: [], mapMode: "FIRST" });

    if (mode === "SINGLE") {
      const first = names[0] ? [names[0]] : [];
      return setState({ mode, selected: state.selected[0] ? [state.selected[0]] : first, mapMode: "FIRST" });
    }

    // MULTIPLE
    const selected = state.selected.length ? state.selected : [...names];
    const nextMapMode =
      state.mapMode === "FIRST" ? defaultMapModeForMultiple : state.mapMode;

    return setState({ mode, selected, mapMode: nextMapMode });
  };

  const toggle = (name: string) => {
    const has = state.selected.includes(name);
    const next = has ? state.selected.filter((x) => x !== name) : [...state.selected, name];
    setState({ ...state, selected: next });
  };

  const setSingle = (name: string) => setState({ ...state, selected: name ? [name] : [] });

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 10 }}>
      <b>{title}</b> <span style={{ opacity: 0.7 }}>({files.length})</span>

      <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
        <label>
          Mode:{" "}
          <select value={state.mode} onChange={(e) => setMode(e.target.value as SelectMode)}>
            {allowNone && <option value="NONE">NONE</option>}
            <option value="SINGLE">SINGLE</option>
            <option value="MULTIPLE">MULTIPLE</option>
          </select>
        </label>

        {state.mode === "SINGLE" && (
          <label>
            Select one:{" "}
            <select value={state.selected[0] ?? ""} onChange={(e) => setSingle(e.target.value)}>
              {names.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}

        {state.mode === "MULTIPLE" && (
          <>
            <label>
              Mapping:{" "}
              <select value={state.mapMode} onChange={(e) => setState({ ...state, mapMode: e.target.value as MapMode })}>
                <option value="ROTATE">ROTATE</option>
                <option value="PAIR_BY_INDEX">PAIR_BY_INDEX</option>
              </select>
            </label>

            <div
              style={{
                maxHeight: 180,
                overflow: "auto",
                border: "1px solid #f0f0f0",
                borderRadius: 10,
                padding: 8,
              }}
            >
              {names.map((n) => (
                <label key={n} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0" }}>
                  <input type="checkbox" checked={state.selected.includes(n)} onChange={() => toggle(n)} />
                  <span
                    style={{
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      fontSize: 12,
                    }}
                  >
                    {displayName(n)}
                  </span>
                </label>
              ))}
            </div>

            <div style={{ fontSize: 12, opacity: 0.7 }}>Selected: {state.selected.length}</div>
          </>
        )}
      </div>
    </div>
  );
}

const ACTION_HELP: Record<string, string> = {
  OUTFIT_SWAP:
    "เปลี่ยนชุดหลายแบบ แต่คงคนเดิม ท่าเดิม และฉากเดิม เหมาะสำหรับลองหลาย outfit",
  POSE_VARIATION:
    "เปลี่ยนท่าหรือมุมกล้องหลายแบบ แต่คงหน้าและชุดเดิม",
  LOOKBOOK:
    "สร้างหลายลุคจากหลายองค์ประกอบ เช่น outfit + pose จับคู่กันเป็นชุด",
  PRODUCT_SHOOT:
    "โฟกัสที่สินค้า (object) เป็นหลัก เหมาะกับภาพรีวิวหรือถ่ายสินค้า",
  CUSTOM_MAPPING:
    "กำหนดเองว่ารูปไหนใช้ face / pose / outfit / object อะไร (ขั้นสูง)",
};