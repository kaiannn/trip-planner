import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'trip-planner-images'
const DB_VERSION = 1
const STORE = 'images'

interface ImageDBSchema {
  images: {
    key: string
    value: Blob
  }
}

let dbPromise: Promise<IDBPDatabase<ImageDBSchema>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<ImageDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE)
        }
      },
    })
  }
  return dbPromise
}

/**
 * Persist an image Blob under the given id. The id is normally the
 * spot id, but doesn't have to be. Existing entry is overwritten.
 */
export async function saveImageBlob(id: string, blob: Blob): Promise<void> {
  const db = await getDb()
  await db.put(STORE, blob, id)
}

/** Returns null if the id has no stored image. */
export async function getImageBlob(id: string): Promise<Blob | null> {
  const db = await getDb()
  const blob = (await db.get(STORE, id)) as Blob | undefined
  return blob ?? null
}

export async function deleteImageBlob(id: string): Promise<void> {
  const db = await getDb()
  await db.delete(STORE, id)
}

/** Best-effort: rough total size of all stored image blobs in bytes. */
export async function getImageStorageBytes(): Promise<number> {
  const db = await getDb()
  const tx = db.transaction(STORE, 'readonly')
  let total = 0
  for await (const cursor of tx.store.iterate()) {
    const v = cursor.value as Blob
    total += v.size
  }
  return total
}
