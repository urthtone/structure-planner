"use client";

import { useRef, useState } from "react";
import {
  DEFAULT_INPUT,
  DEFAULT_PRICES,
  PRICE_ITEMS,
  generatePlan,
  validateInput,
  type Foundation,
  type GeneratedPlan,
  type PlanInput,
  type PriceId,
  type StructureType,
} from "../lib/planning";
import { compressImage, MAX_PHOTOS, selectImageFiles } from "../lib/photos";
import type { PhotoAnalysis } from "../lib/analysis";
import { requestAnalysis } from "../lib/analyze-client";
import { PwaControls } from "../components/PwaControls";
import { FloorPlan } from "../components/FloorPlan";

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n,
  );

export default function Home() {
  const [step, setStep] = useState(1);
  const [photos, setPhotos] = useState<string[]>([]);
  const [input, setInput] = useState<PlanInput>({ ...DEFAULT_INPUT });
  const [prices, setPrices] = useState({ ...DEFAULT_PRICES });
  const [result, setResult] = useState<GeneratedPlan | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const uploadLock = useRef(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState("");
  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null);
  const [showFraming, setShowFraming] = useState(false);
  const photoVersion = useRef(0);

  function update<K extends keyof PlanInput>(key: K, value: PlanInput[K]) {
    setInput((previous) => ({ ...previous, [key]: value }));
    setError("");
  }
  async function upload(files: File[]) {
    // A synchronous ref closes the gap before React renders the disabled input.
    if (uploadLock.current) {
      setError("Please wait for the current photos to finish processing.");
      return;
    }
    uploadLock.current = true;
    setUploading(true);
    setError("");
    setAnalysis(null);
    setAnalysisMessage("");
    photoVersion.current++;
    try {
      const selected = selectImageFiles(files, photos.length);
      const settled = await Promise.allSettled(
        selected.files.map(compressImage),
      );
      const next: string[] = [];
      const errors = [...selected.errors];
      for (const item of settled) {
        if (item.status === "fulfilled") next.push(item.value);
        else
          errors.push(
            "A photo could not be decoded/compressed. Try a smaller JPEG or PNG.",
          );
      }
      // Promise results preserve order; failures never prevent the other images loading.
      setPhotos((previous) => [...previous, ...next].slice(0, MAX_PHOTOS));
      setError([...new Set(errors)].join(" "));
    } finally {
      uploadLock.current = false;
      setUploading(false);
    }
  }
  function removePhoto(index: number) {
    photoVersion.current++;
    setPhotos((previous) => previous.filter((_, i) => i !== index));
    setAnalysis(null);
    setAnalysisMessage("");
  }
  async function analyze() {
    setAnalyzing(true);
    setAnalysisMessage("");
    const version = photoVersion.current;
    try {
      const data = await requestAnalysis(
        photos,
        process.env.NEXT_PUBLIC_ANALYZE_URL,
      );
      if (version !== photoVersion.current) return;
      if (data.status === "ok") {
        setAnalysis(data.analysis);
        setAnalysisMessage(
          "Tentative photo observations — verify on site. Suggestions never override your choices automatically.",
        );
      } else
        setAnalysisMessage(
          data.message ||
            "Photo analysis unavailable; continue planning manually.",
        );
    } catch {
      if (version === photoVersion.current)
        setAnalysisMessage(
          "Photo analysis unavailable; continue planning manually.",
        );
    } finally {
      setAnalyzing(false);
    }
  }
  function nextFromSize() {
    try {
      validateInput(input);
      setError("");
      setStep(3);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function generate() {
    try {
      setResult(generatePlan(input, prices));
      setError("");
      setStep(4);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function chooseType(type: StructureType) {
    setInput((previous) => ({
      ...previous,
      type,
      foundation:
        type === "deck" ? "piers" : type === "garage" ? "slab" : "skids",
      material: "wood",
    }));
    setError("");
  }
  const numeric = (
    key: "width" | "length" | "height" | "doorWidth" | "windows",
    label: string,
    min: number,
    max: number,
    increment = 1,
  ) => (
    <label>
      {label}
      <input
        type="number"
        min={min}
        max={Number.isFinite(max) ? max : undefined}
        step={increment}
        value={Number.isNaN(input[key]) ? "" : input[key]}
        onChange={(event) =>
          update(
            key,
            event.target.value === "" ? NaN : Number(event.target.value),
          )
        }
      />
    </label>
  );
  const suggestedFoundation = analysis?.suggestedFoundation;
  const canUseSuggestion =
    suggestedFoundation &&
    suggestedFoundation !== "unknown" &&
    (input.type !== "deck" || suggestedFoundation === "piers") &&
    (input.type !== "garage" || suggestedFoundation === "slab");

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>🔨 Structure Planner</h1>
          <p>Photos → choices → a practical preliminary takeoff</p>
        </div>
        <span>Sheds · Decks · Cabins · Garages</span>
      </header>
      <main>
        <PwaControls />
        <nav aria-label="Progress" className="progress no-print">
          {["Photos", "Structure", "Prices & notes", "Your plan"].map(
            (label, index) => (
              <span
                key={label}
                className={step === index + 1 ? "active" : ""}
                aria-current={step === index + 1 ? "step" : undefined}
              >
                {index + 1}. {label}
              </span>
            ),
          )}
        </nav>
        {error && (
          <p className="error no-print" role="alert">
            {error}
          </p>
        )}
        {step === 1 && (
          <section className="panel stack">
            <div>
              <p className="eyebrow">Start with the site</p>
              <h2>
                Upload photos <span className="count">{photos.length}/5</span>
              </h2>
            </div>
            <p>
              Optional site or inspiration photos. Up to ten raster images, 20
              MB each before compression. Photos stay in memory unless you
              choose analysis.
            </p>
            <label
              className="drop-zone"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void upload(Array.from(event.dataTransfer.files));
              }}
            >
              <strong>
                {uploading
                  ? "Compressing photos…"
                  : "Choose images or drag them here"}
              </strong>
              <span>JPEG · PNG · WebP · GIF</span>
              <input
                aria-label="Upload photos"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                capture="environment"
                multiple
                disabled={uploading || photos.length === MAX_PHOTOS}
                onChange={(event) => {
                  const files = Array.from(event.currentTarget.files || []);
                  event.currentTarget.value = "";
                  void upload(files);
                }}
              />
            </label>
            <div className="photo-grid">
              {photos.map((src, i) => (
                <figure key={`${i}-${src.slice(-20)}`}>
                  {/* Data URLs are already compressed; next/image optimization isn't applicable. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Reference photo ${i + 1}`} />
                  <button
                    className="secondary"
                    disabled={uploading}
                    onClick={() => removePhoto(i)}
                  >
                    Remove photo {i + 1}
                  </button>
                </figure>
              ))}
            </div>
            <div className="actions">
              <button
                className="secondary"
                disabled={!photos.length || uploading || analyzing}
                onClick={() => void analyze()}
              >
                {analyzing ? "Analyzing…" : "Analyze photos"}
              </button>
              <small>
                Explicitly sends these compressed photos to your configured AI
                provider. No key? Continue without analysis.
              </small>
            </div>
            {analysisMessage && <p role="status">{analysisMessage}</p>}
            {analysis && (
              <aside className="notice stack">
                <h3>Photo observations (not a survey)</h3>
                <dl>
                  <dt>Slope</dt>
                  <dd>{analysis.groundSlope}</dd>
                  <dt>Ground</dt>
                  <dd>{analysis.groundType}</dd>
                  <dt>Sun / shade</dt>
                  <dd>{analysis.sunShade}</dd>
                  <dt>Obstructions</dt>
                  <dd>{analysis.obstructions.join("; ") || "Unknown"}</dd>
                  <dt>Style hints</dt>
                  <dd>{analysis.styleHints.join("; ") || "None"}</dd>
                </dl>
                <p>
                  Suggested foundation:{" "}
                  <strong>{analysis.suggestedFoundation}</strong>. Review this
                  on the next step.
                </p>
                <ul>
                  {analysis.notes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              </aside>
            )}
            <div className="actions">
              <button
                disabled={uploading}
                onClick={() => {
                  setError("");
                  setStep(2);
                }}
              >
                Next: structure →
              </button>
            </div>
          </section>
        )}
        {step === 2 && (
          <section className="panel stack">
            <div>
              <p className="eyebrow">Define the footprint</p>
              <h2>Structure & dimensions</h2>
            </div>
            <div className="type-grid">
              {(["shed", "deck", "cabin", "garage"] as const).map((type) => (
                <button
                  key={type}
                  className={input.type === type ? "selected" : "secondary"}
                  aria-pressed={input.type === type}
                  onClick={() => chooseType(type)}
                >
                  {type}
                </button>
              ))}
            </div>
            <p>
              Wood-framed{" "}
              {input.type === "deck" ? "freestanding platform" : "shell"}{" "}
              estimate. Not a load-checked structural design. All dimensions in
              feet.
            </p>
            <div className="field-grid">
              {numeric("width", "Width / roof span (ft)", 6, 60, 0.5)}
              {numeric("length", "Length (ft)", 6, 60, 0.5)}
              {numeric(
                "height",
                input.type === "deck"
                  ? "Platform height (ft)"
                  : "Low-eave wall height (ft)",
                input.type === "deck" ? 1 : 8,
                12,
                0.5,
              )}
              <label>
                Foundation
                <select
                  value={input.foundation}
                  onChange={(event) =>
                    update("foundation", event.target.value as Foundation)
                  }
                >
                  {(["skids", "piers", "slab"] as const).map((value) => (
                    <option
                      key={value}
                      disabled={
                        (input.type === "deck" && value !== "piers") ||
                        (input.type === "garage" && value !== "slab")
                      }
                      value={value}
                    >
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              {input.type !== "deck" && (
                <>
                  <label>
                    Roof style
                    <select
                      value={input.roofStyle}
                      onChange={(event) =>
                        update(
                          "roofStyle",
                          event.target.value as PlanInput["roofStyle"],
                        )
                      }
                    >
                      <option value="gable">Gable</option>
                      <option value="single-slope">Single slope</option>
                    </select>
                  </label>
                  <label>
                    Roof pitch
                    <select
                      value={input.pitch}
                      onChange={(event) =>
                        update("pitch", Number(event.target.value))
                      }
                    >
                      {[4, 6, 8, 12].map((value) => (
                        <option key={value} value={value}>
                          {value}/12
                        </option>
                      ))}
                    </select>
                  </label>
                  {numeric(
                    "doorWidth",
                    "Door width (ft; one 7-ft-tall door)",
                    2,
                    input.width - 2,
                    0.5,
                  )}
                  {numeric(
                    "windows",
                    "Window count (assumed 3×3 ft)",
                    0,
                    Math.min(8, 2 * Math.floor((input.length - 2) / 4)),
                  )}
                  <label>
                    Wall stud spacing
                    <select
                      value={input.studSpacing}
                      onChange={(event) =>
                        update(
                          "studSpacing",
                          Number(event.target.value) as 16 | 24,
                        )
                      }
                    >
                      <option value={16}>16 inches OC</option>
                      <option value={24}>24 inches OC</option>
                    </select>
                  </label>
                </>
              )}
            </div>
            <p className="notice">
              Floor framing stays 16″ OC. Roof overhang is 12″ horizontally.
              Door is centered on the front, windows alternate along side walls.
              Member sizes, headers and foundations must be verified locally.
            </p>
            {analysis && (
              <div className="notice">
                <p>
                  Photo suggestion: <strong>{suggestedFoundation}</strong>{" "}
                  (unverified; you decide).
                </p>
                {canUseSuggestion ? (
                  <button
                    className="secondary"
                    onClick={() =>
                      update("foundation", suggestedFoundation as Foundation)
                    }
                  >
                    Use suggested foundation
                  </button>
                ) : (
                  <p>
                    This suggestion is unknown or incompatible with the selected
                    structure; choose manually.
                  </p>
                )}
              </div>
            )}
            <div className="actions">
              <button
                className="secondary"
                onClick={() => {
                  setError("");
                  setStep(1);
                }}
              >
                ← Photos
              </button>
              <button onClick={nextFromSize}>Next: prices & notes →</button>
            </div>
          </section>
        )}
        {step === 3 && (
          <section className="panel stack">
            <div>
              <p className="eyebrow">Make the estimate yours</p>
              <h2>Materials, notes & example prices</h2>
            </div>
            <label>
              Material
              <select
                value={input.material}
                onChange={(event) =>
                  update(
                    "material",
                    event.target.value as PlanInput["material"],
                  )
                }
              >
                <option value="wood">
                  Wood framing
                  {input.type === "deck" ? " + wood deck boards" : ""}
                </option>
                {input.type === "deck" && (
                  <option value="composite">
                    Wood frame + composite deck boards
                  </option>
                )}
              </select>
            </label>
            <label>
              Project notes (reference only, not interpreted as structural
              inputs)
              <textarea
                rows={4}
                value={input.notes}
                onChange={(event) => update("notes", event.target.value)}
                placeholder="Site concerns, budget, questions for your local builder…"
              />
            </label>
            <details>
              <summary>
                Edit example/default price table (USD — not quotes)
              </summary>
              <p>
                Not live store prices. Edits last for this session only. Lumber
                is priced by linear foot, not optimized stock lengths.
              </p>
              <div className="price-grid">
                {(Object.keys(PRICE_ITEMS) as PriceId[]).map((id) => (
                  <label key={id}>
                    {PRICE_ITEMS[id].label}
                    <small>USD / {PRICE_ITEMS[id].unit}</small>
                    <input
                      aria-label={`Price: ${PRICE_ITEMS[id].label}`}
                      type="number"
                      min="0"
                      max="100000"
                      step="0.01"
                      value={Number.isNaN(prices[id]) ? "" : prices[id]}
                      onChange={(event) =>
                        setPrices((previous) => ({
                          ...previous,
                          [id]:
                            event.target.value === ""
                              ? NaN
                              : Number(event.target.value),
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
              <button
                className="secondary"
                onClick={() => setPrices({ ...DEFAULT_PRICES })}
              >
                Reset default prices
              </button>
            </details>
            <div className="actions">
              <button
                className="secondary"
                onClick={() => {
                  setError("");
                  setStep(2);
                }}
              >
                ← Structure
              </button>
              <button onClick={generate}>Generate preliminary plan →</button>
            </div>
          </section>
        )}
        {step === 4 && result && (
          <article className="stack plan-output">
            <div className="title-row">
              <div>
                <p className="eyebrow">Preliminary takeoff</p>
                <h2>
                  Your {input.width} × {input.length} ft {input.type}
                </h2>
              </div>
              <button
                className="secondary no-print"
                onClick={() => window.print()}
              >
                Print / PDF
              </button>
            </div>
            <div className="notice">
              <strong>Not construction-ready.</strong> Photos cannot verify
              soil, loads or structural safety. Have a qualified local
              professional review the plan before buying materials or building.
            </div>
            <section className="summary-grid panel">
              <div>
                <label className="check no-print">
                  <input
                    type="checkbox"
                    checked={showFraming}
                    onChange={(event) => setShowFraming(event.target.checked)}
                  />
                  Show conceptual framing
                </label>
                <FloorPlan input={input} showFraming={showFraming} />
              </div>
              <div className="stack">
                <h3>Dimensions & assumptions</h3>
                <dl>
                  <dt>Footprint</dt>
                  <dd>{result.geometry.area} sq ft</dd>
                  <dt>
                    {input.type === "deck"
                      ? "Platform height"
                      : "Low-eave height"}
                  </dt>
                  <dd>{input.height} ft</dd>
                  <dt>Foundation</dt>
                  <dd>{input.foundation}</dd>
                  <dt>Material</dt>
                  <dd>{input.material}</dd>
                  {input.type !== "deck" && (
                    <>
                      <dt>Roof</dt>
                      <dd>
                        {input.roofStyle}, {input.pitch}/12, 12″ overhang
                      </dd>
                      <dt>Roof rise</dt>
                      <dd>{result.geometry.rise.toFixed(2)} ft</dd>
                      <dt>Rafter length (geometric)</dt>
                      <dd>{result.geometry.rafterLength.toFixed(2)} ft</dd>
                      <dt>Roof area (net)</dt>
                      <dd>{result.geometry.roofArea.toFixed(2)} sq ft</dd>
                      <dt>Openings</dt>
                      <dd>
                        1 door ({input.doorWidth} × 7 ft), {input.windows}{" "}
                        windows (3×3 ft)
                      </dd>
                    </>
                  )}
                </dl>
                <p className="estimate">
                  {money(result.total)}
                  <small>Example/default materials estimate only</small>
                </p>
              </div>
            </section>
            {input.notes && (
              <section className="panel">
                <h3>Your notes (reference only)</h3>
                <p className="preserve-lines">{input.notes}</p>
              </section>
            )}
            {analysis && (
              <section className="panel">
                <h3>Photo observations (unverified)</h3>
                <p>
                  {analysis.groundSlope} · {analysis.groundType} ·{" "}
                  {analysis.sunShade}
                </p>
                <p>
                  Obstructions: {analysis.obstructions.join("; ") || "Unknown"}.
                  Style: {analysis.styleHints.join("; ") || "Unknown"}.
                </p>
                <p>
                  Suggested foundation: {analysis.suggestedFoundation};
                  selected: {input.foundation}.
                </p>
                <ul>
                  {analysis.notes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              </section>
            )}
            <section className="panel">
              <h3>Purchase quantities & example costs</h3>
              <p>
                Includes approximately 10% waste once; sheets/packages rounded
                up. Prices are editable examples, not quotes. Cut list below
                excludes waste.
              </p>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Qty</th>
                      <th>Unit</th>
                      <th>USD/unit</th>
                      <th>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.materials.map((item) => (
                      <tr key={item.id}>
                        <td>{item.label}</td>
                        <td>{item.quantity}</td>
                        <td>{item.unit}</td>
                        <td>{money(item.unitPrice)}</td>
                        <td>{money(item.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th colSpan={4}>Example materials total</th>
                      <th>{money(result.total)}</th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
            <section className="panel">
              <h3>Net cut list — geometric lengths, not stock optimization</h3>
              <p>
                No waste in these counts. Check actual member deductions,
                joinery, header design, stock lengths and framing layout before
                cutting. Average infill lengths must be field-fit.
              </p>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Piece</th>
                      <th>Nominal size</th>
                      <th>Qty</th>
                      <th>Length (ft)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.cutList.map((item, i) => (
                      <tr key={i}>
                        <td>{item.piece}</td>
                        <td>{item.size}</td>
                        <td>{item.quantity}</td>
                        <td>{item.length.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="panel">
              <h3>
                {input.type} + {input.foundation}: build sequence overview
              </h3>
              <ol>
                {result.steps.map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ol>
            </section>
            <section className="panel">
              <h3>Scope & safety limits</h3>
              <ul>
                {result.warnings.map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ul>
            </section>
            <div className="actions no-print">
              <button className="secondary" onClick={() => setStep(2)}>
                ← Edit plan
              </button>
              <button className="secondary" onClick={() => setStep(1)}>
                Back to photos
              </button>
            </div>
          </article>
        )}
      </main>
      <footer>
        Preliminary quantities, not engineering. Verify before you build.
      </footer>
    </div>
  );
}
