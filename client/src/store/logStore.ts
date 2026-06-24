import { create } from 'zustand'
import type { LogEntry, LogLevel } from '../types'

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function makeLog(message: string, level: LogLevel): LogEntry {
  return {
    id: uid('log'),
    time: new Date().toLocaleTimeString(),
    level,
    message,
  }
}

interface LogState {
  logs: LogEntry[]
  pushLog: (message: string, level?: LogLevel) => void
}

export const useLogStore = create<LogState>()((set) => ({
  logs: [],
  pushLog: (message, level = 'info') => {
    set((s) => ({ logs: [makeLog(message, level), ...s.logs].slice(0, 200) }))
  },
}))
