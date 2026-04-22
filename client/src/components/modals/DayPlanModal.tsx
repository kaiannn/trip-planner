import { useMemo, useState } from 'react'
import clsx from 'clsx'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTripStore } from '../../store/tripStore'
import { Btn, Field } from '../ui'

interface SortableSpotItemProps {
  id: string
  name: string
  onRemove: () => void
}

function SortableSpotItem({ id, name, onRemove }: SortableSpotItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={clsx(
        'flex items-center justify-between rounded-lg border bg-slate-50 px-2 py-1.5 text-sm',
        isDragging
          ? 'border-teal-300 bg-teal-50 opacity-80 shadow-md ring-2 ring-teal-400'
          : 'border-slate-100 hover:border-slate-200',
      )}
    >
      <span className="flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab touch-none select-none text-slate-400 hover:text-slate-600 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path
              fillRule="evenodd"
              d="M7.48 8.78a.75.75 0 01-.53.22H4.75a.75.75 0 010-1.5h2.2a.75.75 0 01.53.22l.97.97a.75.75 0 010 1.06l-1.72 1.72a.75.75 0 01-1.06 0L3.22 8.53a.75.75 0 010-1.06l1.72-1.72a.75.75 0 011.06 0l.97.97a.75.75 0 01.53.22zM12.52 8.78a.75.75 0 01.53-.22h2.2a.75.75 0 010 1.5h-2.2a.75.75 0 01-.53-.22l-.97-.97a.75.75 0 010-1.06l1.72-1.72a.75.75 0 011.06 0l1.72 1.72a.75.75 0 010 1.06l-1.72 1.72a.75.75 0 01-1.06 0l-.97-.97a.75.75 0 01-.53-.22zM7.48 14.78a.75.75 0 01-.53.22H4.75a.75.75 0 010-1.5h2.2a.75.75 0 01.53.22l.97.97a.75.75 0 010 1.06l-1.72 1.72a.75.75 0 01-1.06 0L3.22 14.53a.75.75 0 010-1.06l1.72-1.72a.75.75 0 011.06 0l.97.97a.75.75 0 01.53.22zM12.52 14.78a.75.75 0 01.53-.22h2.2a.75.75 0 010 1.5h-2.2a.75.75 0 01-.53-.22l-.97-.97a.75.75 0 010-1.06l1.72-1.72a.75.75 0 011.06 0l1.72 1.72a.75.75 0 010 1.06l-1.72 1.72a.75.75 0 01-1.06 0l-.97-.97a.75.75 0 01-.53-.22z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <span className={clsx(isDragging && 'font-medium text-teal-700')}>
          {name || '已删除'}
        </span>
      </span>
      <Btn
        variant="ghost"
        className="!px-2 !py-0.5 text-xs text-red-600 hover:bg-red-50"
        onClick={onRemove}
      >
        移除
      </Btn>
    </li>
  )
}

export function DayPlanModal() {
  const open = useTripStore((s) => s.dayPlanOpen)
  const setDayPlanOpen = useTripStore((s) => s.setDayPlanOpen)
  const cities = useTripStore((s) => s.cities)
  const spots = useTripStore((s) => s.spots)
  const dailyPlans = useTripStore((s) => s.dailyPlans)
  const saveDay = useTripStore((s) => s.saveDay)
  const deleteDay = useTripStore((s) => s.deleteDay)
  const setMapFocusDayId = useTripStore((s) => s.setMapFocusDayId)
  const extendDaySpotsByAI = useTripStore((s) => s.extendDaySpotsByAI)

  const sortedCities = useMemo(
    () => cities.slice().sort((a, b) => a.order - b.order),
    [cities],
  )
  const sortedDays = useMemo(
    () => dailyPlans.slice().sort((a, b) => a.dayIndex - b.dayIndex),
    [dailyPlans],
  )

  const [dayIndex, setDayIndex] = useState(1)
  const [cityId, setCityId] = useState('')
  const [date, setDate] = useState('')
  const [lodgingName, setLodgingName] = useState('')
  const [lodgingAddr, setLodgingAddr] = useState('')
  const [transportMode, setTransportMode] = useState('')
  const [spotOrder, setSpotOrder] = useState<string[]>([])
  const [daySpotPick, setDaySpotPick] = useState('')
  const [activeDayId, setActiveDayId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  if (sortedCities.length && !cityId) {
    setCityId(sortedCities[0].id)
  }

  const citySpots = useMemo(
    () => spots.filter((s) => s.cityId === cityId),
    [spots, cityId],
  )

  const loadDay = (dayId: string) => {
    const day = dailyPlans.find((d) => d.id === dayId)
    if (!day) return
    setDayIndex(day.dayIndex)
    setCityId(day.cityId)
    setDate(day.date || '')
    setLodgingName(day.lodging?.name || '')
    setLodgingAddr(day.lodging?.address || '')
    setTransportMode(day.transportMode || '')
    setSpotOrder([...day.spotOrder])
    setActiveDayId(dayId)
    setMapFocusDayId(dayId)
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (over && active.id !== over.id) {
      const oldIndex = spotOrder.indexOf(active.id as string)
      const newIndex = spotOrder.indexOf(over.id as string)

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = [...spotOrder]
        const [removed] = newOrder.splice(oldIndex, 1)
        newOrder.splice(newIndex, 0, removed)
        setSpotOrder(newOrder)
      }
    }
  }

  const activeSpot = useMemo(
    () => spots.find((s) => s.id === activeId),
    [spots, activeId],
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && setDayPlanOpen(false)}
    >
      <div className="flex max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-slate-100 bg-slate-50 p-3">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">日程</h3>
          {sortedDays.length === 0 && (
            <p className="text-xs text-slate-500">还没有每日行程，先在下方保存一天。</p>
          )}
          {sortedDays.map((day) => {
            const city = cities.find((c) => c.id === day.cityId)
            return (
              <button
                key={day.id}
                type="button"
                onClick={() => loadDay(day.id)}
                className={clsx(
                  'mb-2 w-full rounded-xl border px-2 py-2 text-left text-xs transition',
                  activeDayId === day.id
                    ? 'border-teal-400 bg-teal-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-teal-200',
                )}
              >
                <div className="font-semibold text-slate-800">
                  第 {day.dayIndex} 天 · {city?.name || '?'}
                </div>
                <div className="text-slate-500">{day.date || '日期未填'}</div>
              </button>
            )
          })}
        </aside>
        <section className="min-h-0 flex-1 overflow-y-auto p-4">
          <header className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">按天行程时间线</h2>
            <Btn variant="secondary" onClick={() => setDayPlanOpen(false)}>
              × 关闭
            </Btn>
          </header>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="天数">
              <input
                type="number"
                min={1}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={dayIndex}
                onChange={(e) => setDayIndex(parseInt(e.target.value, 10) || 1)}
              />
            </Field>
            <Field label="所在城市">
              <select
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={cityId}
                onChange={(e) => {
                  setCityId(e.target.value)
                  setSpotOrder([])
                }}
              >
                {sortedCities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="日期（可选）">
              <input
                type="date"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="住宿名称">
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={lodgingName}
                onChange={(e) => setLodgingName(e.target.value)}
              />
            </Field>
            <Field label="住宿地址">
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={lodgingAddr}
                onChange={(e) => setLodgingAddr(e.target.value)}
              />
            </Field>
            <Field label="当日交通">
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={transportMode}
                onChange={(e) => setTransportMode(e.target.value)}
              />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <Field label="从景点池选择">
              <select
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={daySpotPick}
                onChange={(e) => setDaySpotPick(e.target.value)}
              >
                <option value="">选择景点</option>
                {citySpots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Btn
              variant="secondary"
              onClick={() => {
                if (!daySpotPick) return
                if (spotOrder.includes(daySpotPick)) return
                setSpotOrder([...spotOrder, daySpotPick])
              }}
            >
              加入当天
            </Btn>
          </div>
          <h3 className="mt-4 text-sm font-semibold text-slate-800">
            当天顺序 <span className="text-xs font-normal text-slate-500">（拖拽调整顺序）</span>
          </h3>
          {spotOrder.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">从上方景点池添加或拖拽景点到此处</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={spotOrder} strategy={verticalListSortingStrategy}>
                <ul className="mt-2 space-y-1">
                  {spotOrder.map((sid) => {
                    const sp = spots.find((s) => s.id === sid)
                    return (
                      <SortableSpotItem
                        key={sid}
                        id={sid}
                        name={sp?.name || '已删除'}
                        onRemove={() => setSpotOrder(spotOrder.filter((id) => id !== sid))}
                      />
                    )
                  })}
                </ul>
              </SortableContext>
              <DragOverlay>
                {activeSpot ? (
                  <li className="flex items-center justify-between rounded-lg border border-teal-300 bg-teal-50 px-2 py-1.5 text-sm shadow-lg ring-2 ring-teal-400">
                    <span className="flex items-center gap-2">
                      <span className="cursor-grab text-slate-400">⋮⋮</span>
                      <span className="font-medium text-teal-700">{activeSpot.name}</span>
                    </span>
                    <span className="text-xs text-slate-400">移动中</span>
                  </li>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Btn
              variant="primary"
              onClick={() => {
                if (!cityId) return
                saveDay({
                  dayIndex,
                  cityId,
                  date: date || undefined,
                  lodging: { name: lodgingName || undefined, address: lodgingAddr || undefined },
                  spotOrder,
                  transportMode: transportMode || undefined,
                })
              }}
            >
              保存当天行程
            </Btn>
            {activeDayId && (
              <>
                <Btn variant="secondary" onClick={() => deleteDay(activeDayId)}>
                  删除此天
                </Btn>
                <Btn variant="secondary" onClick={() => extendDaySpotsByAI(activeDayId)}>
                  为这一天 AI 补充景点
                </Btn>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
