import { useCallback, useEffect, useRef, useState } from 'react'
import { apiClient } from '../lib/apiClient'
import type { RegionSearchHit } from './RegionAutocomplete'

type RegionMultiAutocompleteProps = {
  label: string
  /** Daftar `fullName` kota BPS yang dipilih (unik). */
  selected: string[]
  onChange: (next: string[]) => void
  inputClassName: string
  hasError?: boolean
  disabled?: boolean
  onInteract?: () => void
  minQueryLength?: number
  maxResults?: number
}

export function RegionMultiAutocomplete({
  label,
  selected,
  onChange,
  inputClassName,
  hasError = false,
  disabled = false,
  onInteract,
  minQueryLength = 3,
  maxResults = 10,
}: RegionMultiAutocompleteProps) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [hits, setHits] = useState<RegionSearchHit[]>([])
  const [active, setActive] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim()
      if (trimmed.length < minQueryLength) {
        setHits([])
        setOpen(false)
        return
      }
      const lim = Math.min(10, Math.max(5, maxResults))
      setLoading(true)
      try {
        const data = (await apiClient.get(
          `/locations/search?q=${encodeURIComponent(trimmed)}&limit=${lim}`,
        )) as RegionSearchHit[]
        const list = Array.isArray(data) ? data : []
        setHits(list)
        setOpen(list.length > 0)
        setActive(0)
      } catch {
        setHits([])
        setOpen(false)
      } finally {
        setLoading(false)
      }
    },
    [minQueryLength, maxResults],
  )

  useEffect(() => {
    if (disabled) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void runSearch(text)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [text, disabled, runSearch])

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const el = wrapRef.current
      if (!el || el.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  function addHit(h: RegionSearchHit) {
    const name = h.fullName.trim()
    if (!name || selected.includes(name)) return
    onChange([...selected, name])
    onInteract?.()
    setText('')
    setHits([])
    setOpen(false)
  }

  function removeAt(name: string) {
    onChange(selected.filter((x) => x !== name))
    onInteract?.()
  }

  function pick(i: number) {
    const h = hits[i]
    if (h) addHit(h)
  }

  const ring = hasError ? 'rounded-lg ring-2 ring-red-500 ring-offset-1' : ''

  return (
    <div className={`text-sm font-medium text-slate-700 ${ring}`} ref={wrapRef}>
      <span className="block text-slate-700">{label}</span>
      {selected.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((name) => (
            <span
              key={name}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-800"
            >
              <span className="min-w-0 truncate" title={name}>
                {name}
              </span>
              <button
                type="button"
                disabled={disabled}
                className="shrink-0 rounded-full p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-40"
                aria-label={`Hapus ${name}`}
                onClick={() => removeAt(name)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="relative mt-2">
        <input
          className={inputClassName}
          disabled={disabled}
          value={text}
          placeholder={`Cari kota/kab (min. ${minQueryLength} huruf), lalu pilih untuk menambah`}
          autoComplete="off"
          onChange={(e) => setText(e.target.value)}
          onFocus={() => {
            if (hits.length > 0) setOpen(true)
          }}
          onKeyDown={(e) => {
            if (!open || hits.length === 0) return
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(a + 1, hits.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              pick(active)
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
        />
        {loading ? <p className="mt-1 text-xs text-slate-500">Mencari…</p> : null}
        {open && hits.length > 0 ? (
          <ul className="absolute z-30 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {hits.map((h, i) => {
              const disabledPick = selected.includes(h.fullName.trim())
              return (
                <li key={h.id}>
                  <button
                    type="button"
                    disabled={disabled || disabledPick}
                    className={`w-full px-3 py-2 text-left text-xs ${
                      disabledPick
                        ? 'cursor-not-allowed text-slate-400'
                        : i === active
                          ? 'bg-accent/10 text-slate-900'
                          : 'text-slate-700 hover:bg-slate-50'
                    }`}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => !disabledPick && addHit(h)}
                  >
                    {h.label}
                    {disabledPick ? ' (sudah dipilih)' : ''}
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
