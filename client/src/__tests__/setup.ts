const memory = new Map<string, string>()

const localStorageMock = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => {
    memory.set(k, String(v))
    return undefined
  },
  removeItem: (k: string) => {
    memory.delete(k)
  },
  clear: () => {
    memory.clear()
  },
  key: (i: number) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size
  },
}

// Node has no real DOM localStorage; provide a tiny Storage for zustand persist.
const g = globalThis as unknown as Record<string, unknown>
g.localStorage = localStorageMock
if (!g.window) g.window = g
