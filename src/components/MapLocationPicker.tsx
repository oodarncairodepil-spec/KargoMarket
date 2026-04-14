import { useEffect, useState } from 'react'

export type MapLocationSuggestion = {
  display_name: string
  lat: string
  lon: string
}

type MapLocationPickerProps = {
  /** Judul aksesibilitas iframe */
  iframeTitle: string
  label: string
  className?: string
  inputClassName: string
  /** Derajat desimal sebagai string, mis. "-6.200000" */
  latitude: string
  longitude: string
  /** Nilai tampilan kolom cari (bisa nama jalan atau koordinat) */
  searchDisplay: string
  onSearchDisplayChange: (v: string) => void
  onLatLngChange: (lat: string, lng: string) => void
}

/**
 * Pencarian alamat (Nominatim) + GPS + pratinjau Google Maps embed — pola sama dengan lokasi kantor vendor.
 */
export function MapLocationPicker({
  iframeTitle,
  label,
  className = '',
  inputClassName,
  latitude,
  longitude,
  searchDisplay,
  onSearchDisplayChange,
  onLatLngChange,
}: MapLocationPickerProps) {
  const [locationSuggestions, setLocationSuggestions] = useState<MapLocationSuggestion[]>([])
  const [locationLoading, setLocationLoading] = useState(false)
  const [locating, setLocating] = useState(false)

  const mapsLinkOrCoords =
    latitude && longitude ? `${latitude},${longitude}` : searchDisplay.trim()

  useEffect(() => {
    const q = searchDisplay.trim()
    if (q.length < 3) {
      setLocationSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        setLocationLoading(true)
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`,
        )
        const data = (await res.json()) as MapLocationSuggestion[]
        setLocationSuggestions(Array.isArray(data) ? data : [])
      } catch {
        setLocationSuggestions([])
      } finally {
        setLocationLoading(false)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [searchDisplay])

  function pickCurrentLocation() {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        onLatLngChange(lat.toFixed(6), lng.toFixed(6))
        onSearchDisplayChange(`${lat.toFixed(6)}, ${lng.toFixed(6)}`)
        setLocationSuggestions([])
        setLocating(false)
      },
      () => {
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return (
    <label className={`block text-sm font-medium text-slate-700 ${className}`}>
      {label}
      <div className="mt-1">
        <div className="relative">
          <input
            className={inputClassName}
            value={searchDisplay}
            onChange={(e) => onSearchDisplayChange(e.target.value)}
            placeholder="Cari alamat / lokasi…"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={pickCurrentLocation}
            disabled={locating}
            aria-label="Deteksi lokasi saat ini"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-accent disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
              <path
                d="M12 2a7 7 0 0 0-7 7c0 5.3 7 13 7 13s7-7.7 7-13a7 7 0 0 0-7-7Z"
                stroke="currentColor"
                strokeWidth="2"
              />
              <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
        </div>
        {(locationLoading || locationSuggestions.length > 0) && (
          <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {locationLoading && <p className="px-3 py-2 text-xs text-slate-500">Mencari lokasi...</p>}
            {!locationLoading && locationSuggestions.length > 0 && (
              <ul className="max-h-44 overflow-auto">
                {locationSuggestions.map((s, idx) => (
                  <li key={`${s.lat}-${s.lon}-${idx}`}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        onSearchDisplayChange(s.display_name)
                        onLatLngChange(Number(s.lat).toFixed(6), Number(s.lon).toFixed(6))
                        setLocationSuggestions([])
                      }}
                    >
                      {s.display_name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      {(latitude && longitude) || searchDisplay.trim() ? (
        <div className="mt-2 overflow-hidden rounded-lg border border-slate-200">
          <iframe
            title={iframeTitle}
            src={`https://maps.google.com/maps?q=${encodeURIComponent(mapsLinkOrCoords)}&z=14&output=embed`}
            className="h-44 w-full"
            loading="lazy"
          />
        </div>
      ) : null}
    </label>
  )
}
