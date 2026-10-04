export default function Loading() {
  return (
    <section className="page-shell section-space" role="status" aria-live="polite" aria-busy="true">
      <p className="eyebrow">Bir fincanlık bekleyiş</p>
      <p className="mt-4 font-display text-3xl">Sayfa hazırlanıyor…</p>
      <div aria-hidden="true" className="mt-9 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((item) => <div key={item} className="overflow-hidden rounded-xl border border-line"><div className="aspect-[4/3] bg-tint" /><div className="space-y-4 p-6"><div className="h-3 w-1/3 rounded bg-tint" /><div className="h-5 w-4/5 rounded bg-tint" /><div className="h-3 w-1/2 rounded bg-tint" /></div></div>)}
      </div>
    </section>
  );
}
