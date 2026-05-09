import { useEffect, useRef, useState } from 'react'

type Tip = AMap.AutoCompleteTip

export interface PlaceAutoCompleteValue {
  name: string
  address?: string
  lat?: number
  lng?: number
  adcode?: string
  poiId?: string
}

interface Props {
  city?: string
  value: string
  onChange: (name: string) => void
  onPick: (v: PlaceAutoCompleteValue) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

/**
 * AMap-powered as-you-type search.
 *
 * - `onChange(name)` fires on every keystroke (for controlled input)
 * - `onPick(value)` fires when the user selects a suggestion; the
 *   parent can then fill in coords / address / poiId.
 *
 * If the AMap script hasn't loaded yet, the component degrades to a
 * plain text input so the form still works.
 */
export function PlaceAutoComplete({
  city,
  value,
  onChange,
  onPick,
  placeholder,
  className,
  disabled,
}: Props) {
  const [tips, setTips] = useState<Tip[]>([])
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const reqSeq = useRef(0)
  const acRef = useRef<AMap.AutoComplete | null>(null)
  const psRef = useRef<AMap.PlaceSearch | null>(null)

  // Rebuild AMap helpers when `city` changes so `citylimit` applies.
  useEffect(() => {
    if (!window.AMap?.AutoComplete) return
    acRef.current = new window.AMap.AutoComplete({
      city: city || '全国',
      citylimit: Boolean(city),
    })
    if (window.AMap.PlaceSearch) {
      psRef.current = new window.AMap.PlaceSearch({
        city: city || '全国',
        citylimit: Boolean(city),
        pageSize: 1,
      })
    }
  }, [city])

  // Debounced keyword search.
  useEffect(() => {
    if (!value.trim() || disabled) {
      setTips([])
      setOpen(false)
      return
    }
    const ac = acRef.current
    if (!ac) {
      // Script not ready; silently skip suggestions.
      return
    }
    const mySeq = ++reqSeq.current
    const t = setTimeout(() => {
      ac.search(value.trim(), (status, result) => {
        if (mySeq !== reqSeq.current) return
        if (status !== 'complete' || !result.tips) {
          setTips([])
          return
        }
        // Filter out results without a location — they're district-only hits.
        const keep = result.tips.filter((tip) => {
          if (!tip.location) return false
          if (typeof tip.location === 'string') return tip.location.trim() !== ''
          return true
        })
        setTips(keep.slice(0, 8))
        setOpen(keep.length > 0)
        setHighlight(0)
      })
    }, 200)
    return () => clearTimeout(t)
  }, [value, disabled])

  // Close on outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const parseLocation = (
    loc: Tip['location'],
  ): { lng: number; lat: number } | undefined => {
    if (!loc) return undefined
    if (typeof loc === 'string') {
      const [lng, lat] = loc.split(',').map(Number)
      if (Number.isFinite(lng) && Number.isFinite(lat)) return { lng, lat }
      return undefined
    }
    return { lng: loc.lng, lat: loc.lat }
  }

  const emitPick = (tip: Tip) => {
    const loc = parseLocation(tip.location)
    const address =
      typeof tip.address === 'string'
        ? tip.address
        : Array.isArray(tip.address)
          ? tip.address.join('')
          : undefined
    onChange(tip.name)
    onPick({
      name: tip.name,
      address,
      lat: loc?.lat,
      lng: loc?.lng,
      adcode: tip.adcode,
      poiId: tip.id,
    })
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || tips.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => (h + 1) % tips.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => (h - 1 + tips.length) % tips.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      emitPick(tips[highlight])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={boxRef} className={`relative ${className ?? ''}`}>
      <input
        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => tips.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && tips.length > 0 && (
        <ul className="absolute z-[1100] mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {tips.map((tip, i) => {
            const addr =
              typeof tip.address === 'string'
                ? tip.address
                : Array.isArray(tip.address)
                  ? tip.address.join('')
                  : ''
            const secondary = [tip.district, addr].filter(Boolean).join(' · ')
            return (
              <li
                key={`${tip.id ?? ''}-${i}`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  emitPick(tip)
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  i === highlight ? 'bg-sky-50 text-sky-900' : 'text-slate-700'
                }`}
              >
                <div className="font-medium">{tip.name}</div>
                {secondary && (
                  <div className="mt-0.5 text-xs text-slate-500">{secondary}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
