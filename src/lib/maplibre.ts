type MapLibreModule = typeof import('maplibre-gl')

let maplibrePromise: Promise<MapLibreModule> | null = null

const isChunkLoadError = (error: unknown) =>
  error instanceof Error &&
  /ChunkLoadError|Loading chunk/i.test(error.message)

const recoverFromChunkError = (error: unknown) => {
  if (!isChunkLoadError(error) || typeof window === 'undefined') return
  const reloadKey = 'maplibre-chunk-reload'
  try {
    if (window.sessionStorage.getItem(reloadKey)) return
    window.sessionStorage.setItem(reloadKey, '1')
  } catch {
    // Ignore storage failures.
  }
  window.location.reload()
}

export const loadMaplibre = async () => {
  if (!maplibrePromise) {
    maplibrePromise = import('maplibre-gl') as Promise<MapLibreModule>
  }

  try {
    const module = await maplibrePromise
    return (module.default ?? module) as MapLibreModule
  } catch (error) {
    maplibrePromise = null
    recoverFromChunkError(error)
    throw error
  }
}
