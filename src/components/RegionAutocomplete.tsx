import { useCallback, useEffect, useRef, useState } from 'react'
import { apiClient } from '../lib/apiClient'

export type RegionSearchHit = {
  id: string
  code: string
  provinceCode: string
  cityType: string
  cityName: string
  provinceName: string
  fullName: string
  label: string
}

type RegionAutocompleteProps = {
  label: string
  placeholder?: string
  inputClassName: string
  /** ID kota BPS terpilih (bigint sebagai string), atau null jika belum. */
  selectedId: string | null
  /** Label ringkas untuk ditampilkan di input saat sudah memilih. */
  selectedLabel: string | null
  onSelect: (hit: RegionSearchHit) => void
  onClear?: () => void
  disabled?: boolean
  /** Minimal panjang kata kunci sebelum memanggil API (default 3). */
  minQueryLength?: number
  /** Maksimal hasil dropdown (default 10, maks 10 di server). */
  maxResults?: number
}

export function RegionAutocomplete({
  label,
  placeholder = 'Ketik minimal 3 huruf untuk mencari…',
  inputClassName,
  selectedId,
  selectedLabel,
  onSelect,
  onClear,
  disabled = false,
  minQueryLength = 3,
  maxResults = 10,
}: RegionAutocompleteProps) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [hits, setHits] = useState<RegionSearchHit[]>([])
  const [active, setActive] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (selectedId && selectedLabel) {
      setText(selectedLabel)
    }
  }, [selectedId, selectedLabel])

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

  function pick(i: number) {
    const h = hits[i]
    if (!h) return
    onSelect(h)
    setText(h.label)
    setOpen(false)
    setHits([])
  }

  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <div ref={wrapRef} className="relative mt-1">
        <input
          className={inputClassName}
          disabled={disabled}
          value={text}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => {
            const v = e.target.value
            setText(v)
            if (selectedId && v !== selectedLabel) {
              onClear?.()
            }
          }}
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
        {loading ? (
          <p className="mt-1 text-xs text-slate-500">Mencari…</p>
        ) : null}
        {open && hits.length > 0 ? (
          <ul className="absolute z-30 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {hits.map((h, i) => (
              <li key={h.id}>
                <button
                  type="button"
                  className={`w-full px-3 py-2 text-left text-xs ${
                    i === active ? 'bg-accent/10 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => pick(i)}
                >
                  {h.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </label>
  )
}
