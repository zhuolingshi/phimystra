const DB_NAME = 'phimystra'
const STORE_NAME = 'generations'
const MAX_ENTRIES = 5
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

export interface SavedGeneration {
  id: string
  timestamp: number
  songName: string
  composer: string
  difficulty: number
  chart: unknown
  analysis: unknown
  audioData: ArrayBuffer
  audioFormat: string
  audioName: string
  backgroundData: Uint8Array | null
}

export interface GenerationPreview {
  id: string
  timestamp: number
  songName: string
  composer: string
  difficulty: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveGeneration(entry: Omit<SavedGeneration, 'id' | 'timestamp'>): Promise<void> {
  const db = await openDB()
  const record: SavedGeneration = {
    ...entry,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: Date.now(),
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  await cleanExpired(db)
  await trimEntries(db)
  db.close()
}

export async function getGeneration(id: string): Promise<SavedGeneration | null> {
  const db = await openDB()
  const result = await new Promise<SavedGeneration | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(id)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return result
}

export async function deleteGeneration(id: string): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function listGenerations(): Promise<GenerationPreview[]> {
  const db = await openDB()
  await cleanExpired(db)
  const all = await new Promise<SavedGeneration[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result as SavedGeneration[])
    req.onerror = () => reject(req.error)
  })
  db.close()
  return all
    .sort((a, b) => b.timestamp - a.timestamp)
    .map(e => ({
      id: e.id,
      timestamp: e.timestamp,
      songName: e.songName,
      composer: e.composer,
      difficulty: e.difficulty,
    }))
}

async function cleanExpired(db: IDBDatabase): Promise<void> {
  const cutoff = Date.now() - SEVEN_DAYS
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.getAll()
    req.onsuccess = () => {
      for (const entry of req.result as SavedGeneration[]) {
        if (entry.timestamp < cutoff) store.delete(entry.id)
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function trimEntries(db: IDBDatabase): Promise<void> {
  const all = await new Promise<SavedGeneration[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result as SavedGeneration[])
    req.onerror = () => reject(req.error)
  })
  if (all.length <= MAX_ENTRIES) return
  const sorted = all.sort((a, b) => b.timestamp - a.timestamp)
  const toDelete = sorted.slice(MAX_ENTRIES)
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    for (const entry of toDelete) store.delete(entry.id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
