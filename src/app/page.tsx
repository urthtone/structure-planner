'use client';

import { useState } from 'react';

type StructureType = 'shed' | 'deck' | 'cabin' | 'garage';

interface PlanData {
  type: StructureType;
  width: number;
  length: number;
  height: number;
  materials: string;
  notes: string;
  photos: string[];
}

export default function Home() {
  const [step, setStep] = useState(1);
  const [photos, setPhotos] = useState<string[]>([]);
  const [plan, setPlan] = useState<PlanData>({
    type: 'shed',
    width: 10,
    length: 12,
    height: 8,
    materials: 'wood',
    notes: '',
    photos: [],
  });
  const [generated, setGenerated] = useState(false);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newPhotos: string[] = [];
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          newPhotos.push(ev.target.result as string);
          if (newPhotos.length === files.length) {
            setPhotos((prev) => [...prev, ...newPhotos]);
          }
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const generatePlan = () => {
    setPlan((p) => ({ ...p, photos }));
    setGenerated(true);
    setStep(4);
  };

  const FloorPlanSVG = ({ data }: { data: PlanData }) => {
    const scale = 20;
    const w = data.width * scale;
    const l = data.length * scale;
    return (
      <svg width={w + 40} height={l + 40} className="border bg-white rounded shadow max-w-full">
        <rect x="20" y="20" width={w} height={l} fill="#f5f5f0" stroke="#333" strokeWidth="2" />
        <rect x={20 + w / 2 - 15} y={20 + l - 2} width={30} height={10} fill="#8B4513" />
        <rect x={20 + 20} y={20 + 20} width={40} height={8} fill="#87CEEB" stroke="#333" />
        <text x={20 + w / 2} y={l + 35} textAnchor="middle" fontSize="12" fill="#333">
          {data.width}' x {data.length}' {data.type}
        </text>
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-950 dark:to-zinc-900 text-zinc-900 dark:text-zinc-100">
      <header className="border-b bg-white/80 dark:bg-zinc-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <span className="text-2xl">🔨</span>
          <h1 className="text-xl font-semibold">Structure Planner</h1>
          <span className="text-sm text-zinc-500 ml-auto">Sheds · Decks · Cabins · Garages</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-8 text-sm">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={`flex-1 h-1 rounded ${step >= s ? 'bg-amber-500' : 'bg-zinc-300'}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">📸 Upload Photos</h2>
            <p className="text-zinc-600">Upload site photos, inspiration images, or existing structures. (Optional but helpful)</p>
            <label className="border-2 border-dashed border-zinc-300 rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer hover:border-amber-400 transition">
              <span className="text-4xl mb-2">📤</span>
              <span>Click or drag photos here</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
            </label>
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {photos.map((src, i) => (
                  <img key={i} src={src} alt="" className="rounded-lg object-cover h-32 w-full" />
                ))}
              </div>
            )}
            <button onClick={() => setStep(2)} className="flex items-center gap-2 bg-amber-600 text-white px-6 py-3 rounded-lg hover:bg-amber-700">
              Next →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">🏠 Structure Type & Size</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(['shed', 'deck', 'cabin', 'garage'] as StructureType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setPlan((p) => ({ ...p, type: t }))}
                  className={`p-4 rounded-xl border-2 capitalize ${plan.type === t ? 'border-amber-500 bg-amber-50' : 'border-zinc-200'}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <label className="space-y-1">
                <span className="text-sm">Width (ft)</span>
                <input type="number" value={plan.width} onChange={(e) => setPlan((p) => ({ ...p, width: +e.target.value }))} className="w-full border rounded px-3 py-2" />
              </label>
              <label className="space-y-1">
                <span className="text-sm">Length (ft)</span>
                <input type="number" value={plan.length} onChange={(e) => setPlan((p) => ({ ...p, length: +e.target.value }))} className="w-full border rounded px-3 py-2" />
              </label>
              <label className="space-y-1">
                <span className="text-sm">Height (ft)</span>
                <input type="number" value={plan.height} onChange={(e) => setPlan((p) => ({ ...p, height: +e.target.value }))} className="w-full border rounded px-3 py-2" />
              </label>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex items-center gap-2 border px-6 py-3 rounded-lg">← Back</button>
              <button onClick={() => setStep(3)} className="flex items-center gap-2 bg-amber-600 text-white px-6 py-3 rounded-lg">Next →</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">📏 Materials & Notes</h2>
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm">Primary material</span>
                <select value={plan.materials} onChange={(e) => setPlan((p) => ({ ...p, materials: e.target.value }))} className="mt-1 w-full border rounded px-3 py-2">
                  <option value="wood">Wood / Lumber</option>
                  <option value="metal">Metal / Steel</option>
                  <option value="composite">Composite</option>
                  <option value="concrete">Concrete block</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm">Additional notes (climate, budget, features...)</span>
                <textarea value={plan.notes} onChange={(e) => setPlan((p) => ({ ...p, notes: e.target.value }))} rows={4} className="mt-1 w-full border rounded px-3 py-2" placeholder="e.g. snow load, need windows, budget under $3k..." />
              </label>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex items-center gap-2 border px-6 py-3 rounded-lg">← Back</button>
              <button onClick={generatePlan} className="flex items-center gap-2 bg-amber-600 text-white px-6 py-3 rounded-lg">Generate Plan 🔨</button>
            </div>
          </div>
        )}

        {step === 4 && generated && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">📄 Your Plan</h2>
              <button onClick={() => window.print()} className="flex items-center gap-2 border px-4 py-2 rounded-lg hover:bg-zinc-100">
                ⬇️ Print / PDF
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-medium mb-3">Floor Plan</h3>
                <FloorPlanSVG data={plan} />
              </div>
              <div className="space-y-4">
                <h3 className="font-medium">Summary</h3>
                <ul className="space-y-1 text-sm">
                  <li><strong>Type:</strong> {plan.type}</li>
                  <li><strong>Size:</strong> {plan.width}' × {plan.length}' × {plan.height}'</li>
                  <li><strong>Material:</strong> {plan.materials}</li>
                  <li><strong>Area:</strong> {plan.width * plan.length} sq ft</li>
                </ul>
                {plan.photos.length > 0 && (
                  <div>
                    <h4 className="font-medium mt-4">Reference Photos</h4>
                    <div className="flex gap-2 mt-2">
                      {plan.photos.slice(0, 3).map((src, i) => (
                        <img key={i} src={src} alt="" className="h-20 w-20 object-cover rounded" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-3">Estimated Materials</h3>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Framing lumber: ~{Math.round(plan.width * plan.length * 1.5)} linear feet 2x4 / 2x6</li>
                <li>Roofing: {plan.width * plan.length} sq ft + 10% waste</li>
                <li>Foundation / floor: pressure-treated skids or concrete piers</li>
                <li>Doors & windows: 1 door + {plan.type === 'cabin' ? 2 : 1} windows</li>
                <li>Fasteners, hardware, sealant</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium mb-3">Build Steps (overview)</h3>
              <ol className="list-decimal list-inside text-sm space-y-2">
                <li>Prepare site and foundation (level, drainage).</li>
                <li>Build floor frame and decking.</li>
                <li>Erect walls (pre-frame if possible).</li>
                <li>Install roof structure and sheathing.</li>
                <li>Add doors, windows, and exterior finish.</li>
                <li>Interior finishing as needed.</li>
              </ol>
            </div>

            <button onClick={() => { setGenerated(false); setStep(1); }} className="text-sm text-amber-600 hover:underline">Start over</button>
          </div>
        )}
      </main>
    </div>
  );
}
