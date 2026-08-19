import { useEffect, useState } from 'react'

/** Animates a number from 0 to `target` on mount/when target changes.
 * Purely presentational (reactive-feel for the dashboard KPIs) - the
 * underlying value never changes, only how it's revealed. */
export default function useCountUp(target, { duration = 700 } = {}) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (target === null || target === undefined || Number.isNaN(target)) return undefined

    let raf
    const start = performance.now()

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out-cubic
      setValue(target * eased)
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}
