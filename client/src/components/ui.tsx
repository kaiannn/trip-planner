import clsx from 'clsx'
import { useState, type ButtonHTMLAttributes } from 'react'

/** 统一输入框：与主流产品后台类似的浅边框 + 聚焦环 */
export const inputClass =
  'w-full min-w-0 rounded-md border border-slate-200/90 bg-white px-2.5 py-1.5 text-[13px] leading-snug text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-teal-500/60 focus:outline-none focus:ring-2 focus:ring-teal-500/15'

export function Btn({
  variant = 'secondary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  return (
    <button
      type="button"
      className={clsx(
        'inline-flex items-center justify-center rounded-md px-3 py-1.5 text-[13px] font-medium transition duration-150',
        'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        variant === 'primary' &&
          'bg-teal-600 text-white shadow-sm shadow-teal-600/20 hover:bg-teal-700',
        variant === 'secondary' &&
          'border border-slate-200/90 bg-white text-slate-800 shadow-sm hover:border-teal-300/80 hover:bg-slate-50',
        variant === 'ghost' && 'text-teal-700 hover:bg-teal-50',
        className,
      )}
      {...props}
    />
  )
}

export function Panel({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={clsx(
        'rounded-xl border border-slate-200/70 bg-white p-3 shadow-sm ring-1 ring-slate-900/[0.04] transition-shadow hover:shadow-md',
        className,
      )}
    >
      <h2 className="mb-2 flex items-center gap-2 border-b border-slate-100 pb-2 text-[13px] font-semibold text-slate-800">
        <span className="h-3 w-0.5 rounded-full bg-gradient-to-b from-teal-500 to-teal-600" aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  )
}

function SpotImagePlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-slate-100 to-slate-200',
        className,
      )}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 48 48"
        className="h-8 w-8 text-slate-300"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6 36 L16 22 L23 31 L30 24 L42 36 Z" />
        <circle cx="34" cy="16" r="4" />
        <rect x="4" y="8" width="40" height="32" rx="4" />
      </svg>
      <span className="text-[10px] text-slate-400">暂无图片</span>
    </div>
  )
}

export function SpotImg({
  src,
  alt = '',
  className,
  aspectClassName = 'aspect-[4/3]',
}: {
  src?: string | null
  alt?: string
  className?: string
  aspectClassName?: string
}) {
  const [failed, setFailed] = useState(false)
  const show = src && !failed
  return show ? (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={clsx('w-full object-cover', aspectClassName, className)}
      onError={() => setFailed(true)}
    />
  ) : (
    <SpotImagePlaceholder className={clsx('w-full', aspectClassName, className)} />
  )
}

export function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={clsx('flex flex-col gap-1 text-[11px] font-medium text-slate-600', className)}>
      {label}
      {children}
    </label>
  )
}
