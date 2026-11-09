import { useState } from "react";
import type { FabView } from "@/lib/fab";

const TABS = ["Cut list", "Stock", "Parts", "Plans"] as const;

export function WeldSheet({ view }: { view: FabView }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Cut list");
  return (
    <section className="print-sheet overflow-hidden rounded-xl border border-line bg-card">
      <header className="border-b border-line px-4 py-3">
        <h2 className="text-xl">{view.title}</h2>
        {view.message && <p className="mt-1 text-sm">{view.message}</p>}
      </header>
      <div className="grid grid-cols-4 gap-1 p-2">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={tab === item}
            onClick={() => setTab(item)}
            className={`min-h-11 rounded-lg border px-1 text-sm ${tab === item ? "border-ink bg-ink text-paper" : "border-line bg-card"}`}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="px-4 pb-4">
        {tab === "Cut list" &&
          (view.cuts.length ? (
            <ul className="divide-y divide-line text-sm">
              {view.cuts.map((row, index) => (
                <li key={`${row.name}-${index}`} className="grid grid-cols-[1fr_auto] gap-2 py-2">
                  <span className="font-semibold">{row.name}</span>
                  <span className="tabular-nums text-muted">{row.qty}</span>
                  <span className="col-span-2 text-muted">
                    {row.length}
                    {row.ends ? ` · ${row.ends}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No cuts yet. The shop reader will list each piece, length, and end cut.</p>
          ))}
        {tab === "Stock" && (
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted">Profile</dt>
            <dd>{view.stock.profile}</dd>
            <dt className="text-muted">Stick</dt>
            <dd>{view.stock.stick}</dd>
            <dt className="text-muted">Kerf</dt>
            <dd>{view.stock.kerf}</dd>
            <dt className="text-muted">Waste</dt>
            <dd>{view.stock.waste}</dd>
          </dl>
        )}
        {tab === "Parts" && (
          <ul className="space-y-2 text-sm">
            {view.parts.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        {tab === "Plans" && (
          <div className="space-y-4">
            {view.plans.map((plan) => (
              <figure key={plan.title}>
                <figcaption className="mb-2 text-sm font-semibold">{plan.title}</figcaption>
                {plan.svg ? <div className="overflow-x-auto" dangerouslySetInnerHTML={{ __html: plan.svg }} /> : null}
              </figure>
            ))}
          </div>
        )}
        {view.warnings.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm text-muted">
            {view.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
