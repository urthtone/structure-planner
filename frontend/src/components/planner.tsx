import { useRef, useState } from "react";
import { Camera, ImagePlus, Printer, RotateCcw, X } from "lucide-react";
import { FloorSheet } from "@/components/floor-sheet";
import { FrameSheet } from "@/components/frame-sheet";
import { requestPlan } from "@/lib/request-plan";
import {
  fallbackPlan,
  MATERIALS,
  MAX_PHOTOS,
  STRUCTURES,
  type Material,
  type Plan,
  type StructureType,
} from "@/lib/plan";
import { fileToShot, roomFor, type Shot } from "@/lib/photos";

type Stage = "photos" | "details" | "plan";

const TYPE_COPY: Record<StructureType, string> = {
  shed: "Storage shed",
  deck: "Deck",
  cabin: "Cabin",
  garage: "Garage",
};

const MATERIAL_COPY: Record<Material, string> = {
  wood: "Wood",
  metal: "Metal",
  composite: "Composite",
  concrete: "Block",
};

export function Planner() {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("photos");
  const [shots, setShots] = useState<Shot[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [structureType, setStructureType] = useState<StructureType>("shed");
  const [width, setWidth] = useState("10");
  const [length, setLength] = useState("12");
  const [height, setHeight] = useState("8");
  const [estimateSize, setEstimateSize] = useState(false);
  const [material, setMaterial] = useState<Material>("wood");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planNote, setPlanNote] = useState<string | null>(null);

  const remaining = roomFor(shots.length);

  async function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const slots = roomFor(shots.length);
    if (slots === 0) {
      setNotice("Five photos is the maximum. Remove one to swap it.");
      return;
    }
    const picked = Array.from(list).slice(0, slots);
    if (list.length > slots) setNotice("Only the first five photos are kept.");
    else setNotice(null);
    const next: Shot[] = [];
    for (const file of picked) {
      try {
        next.push(await fileToShot(file));
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Could not add that photo.");
      }
    }
    if (next.length) setShots((current) => [...current, ...next].slice(0, MAX_PHOTOS));
  }

  async function onDraft() {
    if (shots.length === 0) {
      setNotice("Add at least one photo from the camera or gallery.");
      setStage("photos");
      return;
    }
    const widthFt = Number(width);
    const lengthFt = Number(length);
    const heightFt = Number(height);
    if (!estimateSize && (!widthFt || !lengthFt || !heightFt)) {
      setNotice("Enter width, length, and height, or let the photos set the size.");
      return;
    }
    setBusy(true);
    setNotice(null);
    const brief = {
      images: shots.map((shot) => shot.dataUrl),
      structureType,
      widthFt: estimateSize ? undefined : widthFt,
      lengthFt: estimateSize ? undefined : lengthFt,
      heightFt: estimateSize ? undefined : heightFt,
      estimateSize,
      material,
      notes: notes.trim(),
    };
    try {
      const result = await requestPlan(brief);
      if (result.ok) {
        setPlan(result.plan);
        setPlanNote(null);
      } else {
        setPlan(fallbackPlan(brief, shots.length));
        setPlanNote(result.error);
      }
    } catch {
      setPlan(fallbackPlan(brief, shots.length));
      setPlanNote("The photos could not be read just now. This plan uses your measurements only.");
    } finally {
      setBusy(false);
      setStage("plan");
    }
  }

  function reset() {
    setStage("photos");
    setShots([]);
    setPlan(null);
    setPlanNote(null);
    setNotice(null);
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pb-16 pt-6 sm:px-6">
      <header className="no-print mb-8 flex items-end justify-between gap-4">
        <div>
          <a href="https://hilltopstructures.us/" className="text-sm font-semibold tracking-wide text-cedar uppercase">
            Hilltop Structures
          </a>
          <h1 className="mt-1 text-3xl leading-tight sm:text-4xl">Plans from the photos you take</h1>
          <p className="mt-2 max-w-prose text-sm text-muted">
            Open this page in your phone browser at hilltopstructures.us/planner. Nothing to install.
          </p>
        </div>
      </header>

      <ol className="no-print mb-6 grid grid-cols-3 gap-2 text-sm">
        {(
          [
            ["photos", "Photos"],
            ["details", "Details"],
            ["plan", "Plan"],
          ] as const
        ).map(([id, label], index) => {
          const active = stage === id;
          const done = (id === "photos" && stage !== "photos") || (id === "details" && stage === "plan");
          return (
            <li key={id}>
              <span
                className={`flex min-h-11 items-center justify-center rounded-lg border px-2 ${
                  active ? "border-ink bg-ink text-paper" : done ? "border-line bg-card text-ink" : "border-line text-muted"
                }`}
              >
                {index + 1}. {label}
              </span>
            </li>
          );
        })}
      </ol>

      {notice && (
        <p className="no-print mb-4 rounded-lg border border-cedar bg-cedar-soft px-3 py-2 text-sm text-ink" role="status">
          {notice}
        </p>
      )}

      {stage === "photos" && (
        <section className="space-y-5">
          <p className="max-w-prose text-muted">
            Add up to five pictures of the site, a sketch, or a structure you want to match. Camera and Gallery open from this page.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {shots.map((shot, index) => (
              <figure key={shot.id} className="relative overflow-hidden rounded-xl border border-line bg-card">
                <img src={shot.dataUrl} alt={`Photo ${index + 1} of ${shots.length}`} className="aspect-square w-full object-cover" />
                <figcaption className="absolute top-2 left-2 rounded bg-ink px-2 py-0.5 text-xs text-paper tabular-nums">
                  {index + 1}
                </figcaption>
                <button
                  type="button"
                  className="absolute top-2 right-2 flex size-11 items-center justify-center rounded-full bg-paper text-ink"
                  aria-label={`Remove photo ${index + 1}`}
                  onClick={() => setShots((current) => current.filter((item) => item.id !== shot.id))}
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </figure>
            ))}
            {shots.length < MAX_PHOTOS && (
              <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-line text-sm text-muted">
                {shots.length} / {MAX_PHOTOS}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={remaining === 0}
              onClick={() => cameraRef.current?.click()}
              className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-paper disabled:opacity-40"
            >
              <Camera className="size-4" aria-hidden="true" />
              Camera
            </button>
            <button
              type="button"
              disabled={remaining === 0}
              onClick={() => galleryRef.current?.click()}
              className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-ink bg-card px-4 text-ink disabled:opacity-40"
            >
              <ImagePlus className="size-4" aria-hidden="true" />
              Gallery
            </button>
          </div>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              void addFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(event) => {
              void addFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={shots.length === 0}
            onClick={() => {
              setNotice(null);
              setStage("details");
            }}
            className="flex min-h-11 w-full items-center justify-center rounded-lg bg-cedar px-4 text-paper disabled:opacity-40"
          >
            Continue with {shots.length || "no"} photo{shots.length === 1 ? "" : "s"}
          </button>
        </section>
      )}

      {stage === "details" && (
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl">What are you building?</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {STRUCTURES.map((type) => {
                const selected = structureType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setStructureType(type)}
                    className={`min-h-11 rounded-xl border px-3 py-3 text-left ${
                      selected ? "border-cedar bg-cedar-soft" : "border-line bg-card"
                    }`}
                  >
                    <span className="block font-semibold">{TYPE_COPY[type]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <fieldset className="space-y-3">
            <legend className="font-display text-2xl">Size</legend>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={estimateSize}
                onChange={(event) => setEstimateSize(event.target.checked)}
                className="size-4 accent-cedar"
              />
              Let the photos set the size
            </label>
            <div className={`grid grid-cols-3 gap-3 ${estimateSize ? "opacity-40" : ""}`}>
              {(
                [
                  ["Width", width, setWidth],
                  ["Length", length, setLength],
                  ["Height", height, setHeight],
                ] as const
              ).map(([label, value, setter]) => (
                <label key={label} className="block text-sm text-muted">
                  {label} (ft)
                  <input
                    inputMode="decimal"
                    disabled={estimateSize}
                    value={value}
                    onChange={(event) => setter(event.target.value)}
                    className="mt-1 min-h-11 w-full rounded-lg border border-line bg-card px-3 text-ink tabular-nums"
                  />
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <h2 className="text-2xl">Material</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {MATERIALS.map((item) => {
                const selected = material === item;
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setMaterial(item)}
                    className={`min-h-11 rounded-lg border px-2 ${selected ? "border-cedar bg-cedar-soft" : "border-line bg-card"}`}
                  >
                    {MATERIAL_COPY[item]}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block text-sm text-muted">
            Anything else — slope, snow, budget, doors, windows
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              maxLength={800}
              className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-ink"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setStage("photos")} className="min-h-11 rounded-lg border border-line bg-card">
              Back
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onDraft()}
              className="min-h-11 rounded-lg bg-cedar text-paper disabled:opacity-40"
            >
              {busy ? "Reading photos…" : "Draft the plan"}
            </button>
          </div>
        </section>
      )}

      {stage === "plan" && plan && (
        <section className="space-y-6">
          {busy && <p className="text-sm text-muted">Reading the photos and drafting the sheet…</p>}
          {planNote && (
            <p className="no-print rounded-lg border border-cedar bg-cedar-soft px-3 py-2 text-sm" role="status">
              {planNote} The framing takeoff from your measurements is shown instead.
            </p>
          )}
          <FloorSheet plan={plan} />
          <FrameSheet plan={plan} />

          <div className="print-sheet rounded-xl border border-line bg-card p-4">
            <h2 className="text-xl">What the photos showed</h2>
            <p className="mt-2 text-sm text-muted">{plan.siteNotes}</p>
            <ul className="mt-4 space-y-3">
              {shots.map((shot, index) => {
                const reading = plan.photoReadings.find((item) => item.index === index + 1)?.reading;
                return (
                  <li key={shot.id} className="flex gap-3">
                    <img src={shot.dataUrl} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
                    <p className="text-sm">
                      <span className="font-semibold">Photo {index + 1}. </span>
                      {reading ?? "No separate note for this photo."}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="print-sheet rounded-xl border border-line bg-card p-4">
            <h2 className="text-xl">Materials</h2>
            <p className="mt-1 text-sm text-muted">{plan.costRange}</p>
            <ul className="mt-3 divide-y divide-line">
              {plan.materials.map((row) => (
                <li key={row.item} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 py-3 text-sm">
                  <span className="font-semibold">{row.item}</span>
                  <span className="tabular-nums text-muted">{row.qty}</span>
                  <span className="col-span-2 text-muted">{row.notes}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="print-sheet rounded-xl border border-line bg-card p-4">
            <h2 className="text-xl">Build order</h2>
            <ol className="mt-3 space-y-4">
              {plan.steps.map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm text-paper tabular-nums">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-semibold">{step.title}</p>
                    <p className="text-sm text-muted">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <ul className="space-y-2 text-sm text-muted">
            {plan.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>

          <div className="no-print grid grid-cols-2 gap-3">
            <button type="button" onClick={reset} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-card">
              <RotateCcw className="size-4" aria-hidden="true" />
              Start over
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-ink text-paper"
            >
              <Printer className="size-4" aria-hidden="true" />
              Print
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
