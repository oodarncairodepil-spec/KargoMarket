import { useEffect, useRef, type RefObject } from 'react'

/**
 * Memanggil onClose saat pointer di luar `ref` (capture phase).
 * Berguna untuk menutup `<details>` atau panel dropdown.
 */
export function useOnClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onClose: () => void,
  enabled = true,
) {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!enabled) return
    function listener(event: MouseEvent | TouchEvent) {
      const el = ref.current
      if (!el || el.contains(event.target as Node)) return
      onCloseRef.current()
    }
    document.addEventListener('mousedown', listener, true)
    document.addEventListener('touchstart', listener, true)
    return () => {
      document.removeEventListener('mousedown', listener, true)
      document.removeEventListener('touchstart', listener, true)
    }
  }, [ref, enabled])
}
