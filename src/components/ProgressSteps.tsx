const labels = ['Lokasi', 'Barang', 'Layanan', 'Review']

export function ProgressSteps({ step }: { step: 0 | 1 | 2 | 3 }) {
  const total = labels.length
  return (
    <div className="mb-6">
      <div className="flex justify-between gap-1">
        {labels.map((label, i) => {
          const active = i === step
          const done = i < step
          return (
            <div key={label} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                  done
                    ? 'bg-accent text-white'
                    : active
                      ? 'bg-accent-soft text-accent ring-2 ring-accent'
                      : 'bg-slate-100 text-slate-400'
                }`}
              >
                {done ? '✓' : i + 1}
              </div>
              <span
                className={`text-center text-[11px] font-medium leading-tight sm:text-xs ${
                  active || done ? 'text-slate-800' : 'text-slate-400'
                }`}
              >
                {label}
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300"
          style={{ width: `${((step + 1) / total) * 100}%` }}
        />
      </div>
    </div>
  )
}
