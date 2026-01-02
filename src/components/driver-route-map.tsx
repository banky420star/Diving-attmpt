'use client'

import { useEffect, useRef } from 'react'

import { loadMaplibre } from '@/lib/maplibre'

export type RoutePoint = {
  lat: number
  lng: number
}

const DEFAULT_CENTER: [number, number] = [18.4241, -33.9249]
const DEFAULT_ZOOM = 12
const ROUTE_SOURCE_ID = 'driver-route'
const STOPS_SOURCE_ID = 'driver-stops'
const ROUTE_LAYER_ID = 'driver-route-line'
const ROUTE_GLOW_LAYER_ID = 'driver-route-glow'
const ROUTE_CASING_LAYER_ID = 'driver-route-casing'
const PICKUP_LAYER_ID = 'driver-pickup-point'
const DROPOFF_LAYER_ID = 'driver-dropoff-point'
const DRIVER_LAYER_ID = 'driver-location-point'

const OSM_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
      maxzoom: 19
    }
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm'
    }
  ]
} as const

const buildFallbackRoute = (
  start: RoutePoint | null,
  end: RoutePoint | null
): GeoJSON.LineString | null => {
  if (!start || !end) return null
  return {
    type: 'LineString',
    coordinates: [
      [start.lng, start.lat],
      [end.lng, end.lat]
    ]
  }
}

const calculateDistanceKm = (start: RoutePoint, end: RoutePoint) => {
  const R = 6371
  const dLat = ((end.lat - start.lat) * Math.PI) / 180
  const dLng = ((end.lng - start.lng) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((start.lat * Math.PI) / 180) *
      Math.cos((end.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

const ensureRouteLayers = (map: import('maplibre-gl').Map) => {
  if (!map.getSource(ROUTE_SOURCE_ID)) {
    map.addSource(ROUTE_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    })
  }
  if (!map.getSource(STOPS_SOURCE_ID)) {
    map.addSource(STOPS_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    })
  }
  if (!map.getLayer(ROUTE_GLOW_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_GLOW_LAYER_ID,
      type: 'line',
      source: ROUTE_SOURCE_ID,
      layout: {
        'line-cap': 'round',
        'line-join': 'round'
      },
      paint: {
        'line-color': 'rgba(255, 0, 122, 0.25)',
        'line-width': 8,
        'line-blur': 3
      }
    })
  }
  if (!map.getLayer(ROUTE_CASING_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_CASING_LAYER_ID,
      type: 'line',
      source: ROUTE_SOURCE_ID,
      layout: {
        'line-cap': 'round',
        'line-join': 'round'
      },
      paint: {
        'line-color': 'rgba(255, 255, 255, 0.85)',
        'line-width': 6
      }
    })
  }
  if (!map.getLayer(ROUTE_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_LAYER_ID,
      type: 'line',
      source: ROUTE_SOURCE_ID,
      layout: {
        'line-cap': 'round',
        'line-join': 'round'
      },
      paint: {
        'line-color': 'rgba(255, 0, 122, 0.95)',
        'line-width': 4
      }
    })
  }
  if (!map.getLayer(PICKUP_LAYER_ID)) {
    map.addLayer({
      id: PICKUP_LAYER_ID,
      type: 'circle',
      source: STOPS_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'pickup'],
      paint: {
        'circle-radius': 6,
        'circle-color': '#7dd3fc',
        'circle-stroke-width': 2,
        'circle-stroke-color': 'rgba(255, 255, 255, 0.9)'
      }
    })
  }
  if (!map.getLayer(DROPOFF_LAYER_ID)) {
    map.addLayer({
      id: DROPOFF_LAYER_ID,
      type: 'circle',
      source: STOPS_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'dropoff'],
      paint: {
        'circle-radius': 6,
        'circle-color': '#f472b6',
        'circle-stroke-width': 2,
        'circle-stroke-color': 'rgba(255, 255, 255, 0.9)'
      }
    })
  }
  if (!map.getLayer(DRIVER_LAYER_ID)) {
    map.addLayer({
      id: DRIVER_LAYER_ID,
      type: 'circle',
      source: STOPS_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'driver'],
      paint: {
        'circle-radius': 7,
        'circle-color': '#34d399',
        'circle-stroke-width': 2,
        'circle-stroke-color': 'rgba(255, 255, 255, 0.95)'
      }
    })
  }
}

export function DriverRouteMap({
  origin,
  destination,
  pickup,
  dropoff,
  onEtaChange,
  onRouteStatus,
  onRouteSteps
}: {
  origin: RoutePoint | null
  destination: RoutePoint | null
  pickup?: RoutePoint | null
  dropoff?: RoutePoint | null
  onEtaChange?: (etaMinutes: number | null) => void
  onRouteStatus?: (status: 'idle' | 'loading' | 'ready' | 'fallback') => void
  onRouteSteps?: (steps: Array<{ instruction: string; distance: number }>) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<import('maplibre-gl').Map | null>(null)
  const maplibreRef = useRef<typeof import('maplibre-gl') | null>(null)
  const lastRouteKeyRef = useRef<string>('')
  const lastRouteRef = useRef<GeoJSON.LineString | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  useEffect(() => {
    let isMounted = true

    const init = async () => {
      if (!containerRef.current || mapRef.current) return
      try {
        const maplibregl = await loadMaplibre()
        if (!isMounted || !containerRef.current) return
        maplibreRef.current = maplibregl

        const map = new maplibregl.Map({
          container: containerRef.current,
          style: OSM_STYLE,
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          maxZoom: 18,
          attributionControl: false
        })

        map.scrollZoom.disable()
        map.doubleClickZoom.disable()

        map.on('error', (event) => {
          if (event?.sourceId === 'osm') {
            event?.preventDefault?.()
          }
        })

        mapRef.current = map

        map.on('load', () => {
          ensureRouteLayers(map)
          map.resize()
        })
      } catch (error) {
        console.error('Failed to load maplibre:', error)
      }
    }

    init()

    return () => {
      isMounted = false
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const maplibre = maplibreRef.current
    if (!map || !maplibre) return

    const hasPrimaryRoute = Boolean(origin && destination)
    const routeStart = hasPrimaryRoute ? origin : pickup ?? null
    const routeEnd = hasPrimaryRoute ? destination : dropoff ?? null
    const routeKey =
      routeStart && routeEnd
        ? `${routeStart.lat.toFixed(4)},${routeStart.lng.toFixed(4)}:${routeEnd.lat.toFixed(4)},${routeEnd.lng.toFixed(4)}`
        : ''

    const updateSources = (route: GeoJSON.LineString | null) => {
      if (!map.isStyleLoaded()) {
        map.once('load', () => updateSources(route))
        return
      }
      ensureRouteLayers(map)

      const routeSource = map.getSource(
        ROUTE_SOURCE_ID
      ) as import('maplibre-gl').GeoJSONSource | null
      const stopsSource = map.getSource(
        STOPS_SOURCE_ID
      ) as import('maplibre-gl').GeoJSONSource | null

      const routeData: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
        type: 'FeatureCollection',
        features: route
          ? [
              {
                type: 'Feature',
                geometry: route,
                properties: {}
              }
            ]
          : []
      }
      routeSource?.setData(routeData)

      const stopFeatures: GeoJSON.Feature<GeoJSON.Point>[] = []

      if (origin) {
        stopFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [origin.lng, origin.lat]
          },
          properties: { kind: 'driver' }
        })
      }

      if (pickup) {
        stopFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [pickup.lng, pickup.lat]
          },
          properties: { kind: 'pickup' }
        })
      }

      if (dropoff) {
        stopFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [dropoff.lng, dropoff.lat]
          },
          properties: { kind: 'dropoff' }
        })
      }

      const stopsData: GeoJSON.FeatureCollection<GeoJSON.Point> = {
        type: 'FeatureCollection',
        features: stopFeatures
      }
      stopsSource?.setData(stopsData)

      if (stopFeatures.length > 0) {
        const bounds = new maplibre.LngLatBounds()
        stopFeatures.forEach((feature) => {
          const [lng, lat] = feature.geometry.coordinates
          bounds.extend([lng, lat])
        })
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, { padding: 40, duration: 600, maxZoom: 14 })
        }
      }
    }

    const fallbackRoute = buildFallbackRoute(routeStart, routeEnd)

    if (!routeStart || !routeEnd) {
      lastRouteKeyRef.current = ''
      lastRouteRef.current = null
      onRouteStatus?.('idle')
      onEtaChange?.(null)
      onRouteSteps?.([])
      if (map.isStyleLoaded()) {
        updateSources(fallbackRoute)
      } else {
        map.once('load', () => updateSources(fallbackRoute))
      }
      return
    }

    if (routeKey && routeKey === lastRouteKeyRef.current) {
      if (map.isStyleLoaded()) {
        updateSources(lastRouteRef.current ?? fallbackRoute)
      } else {
        map.once('load', () =>
          updateSources(lastRouteRef.current ?? fallbackRoute)
        )
      }
      onRouteStatus?.(lastRouteRef.current ? 'ready' : 'fallback')
      return
    }

    lastRouteKeyRef.current = routeKey
    onRouteStatus?.('loading')
    if (map.isStyleLoaded()) {
      updateSources(fallbackRoute)
    } else {
      map.once('load', () => updateSources(fallbackRoute))
    }

    const controller = new AbortController()
    const url = `https://router.project-osrm.org/route/v1/driving/${routeStart.lng},${routeStart.lat};${routeEnd.lng},${routeEnd.lat}?overview=full&geometries=geojson`

    fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Route request failed')
        }
        return response.json()
      })
      .then((data) => {
        const geometry = data?.routes?.[0]?.geometry
        const durationSeconds = data?.routes?.[0]?.duration
        const steps = data?.routes?.[0]?.legs?.[0]?.steps ?? []
        if (!geometry || geometry.type !== 'LineString') {
          throw new Error('Missing route geometry')
        }
        lastRouteRef.current = geometry as GeoJSON.LineString
        updateSources(lastRouteRef.current)
        if (typeof durationSeconds === 'number' && durationSeconds > 0) {
          onEtaChange?.(Math.max(1, Math.round(durationSeconds / 60)))
        }
        if (Array.isArray(steps)) {
          const normalizeInstruction = (value: string) =>
            value.replace(/\s+/g, ' ').trim()
          const cleanedSteps = steps
            .map((step: any) => {
              const maneuver = step?.maneuver ?? {}
              const name =
                typeof step?.name === 'string' &&
                step.name.trim() &&
                step.name.trim().toLowerCase() !== 'unnamed road'
                  ? step.name.trim()
                  : ''
              const modifier =
                typeof maneuver.modifier === 'string' ? maneuver.modifier : ''
              const type =
                typeof maneuver.type === 'string' ? maneuver.type : 'continue'

              let instruction = ''
              if (type === 'depart') {
                instruction = name ? `Depart on ${name}` : 'Depart'
              } else if (type === 'arrive') {
                instruction = 'Arrive at destination'
              } else if (type === 'turn') {
                instruction = `Turn ${modifier}${name ? ` onto ${name}` : ''}`
              } else if (type === 'merge') {
                instruction = `Merge ${modifier}${name ? ` onto ${name}` : ''}`
              } else if (type === 'fork') {
                instruction = `Keep ${modifier}${name ? ` toward ${name}` : ''}`
              } else if (type === 'roundabout' || type === 'rotary') {
                instruction = `Enter roundabout${name ? ` toward ${name}` : ''}`
              } else if (type === 'on ramp') {
                instruction = `Take ramp${name ? ` to ${name}` : ''}`
              } else if (type === 'off ramp') {
                instruction = `Take exit${name ? ` toward ${name}` : ''}`
              } else if (type === 'new name') {
                instruction = name ? `Continue on ${name}` : 'Continue'
              } else {
                instruction = name ? `Continue on ${name}` : 'Continue'
              }

              const distance =
                typeof step?.distance === 'number' ? step.distance : 0
              return instruction
                ? { instruction: normalizeInstruction(instruction), distance }
                : null
            })
            .filter(Boolean)
          onRouteSteps?.(cleanedSteps as Array<{
            instruction: string
            distance: number
          }>)
        } else {
          onRouteSteps?.([])
        }
        onRouteStatus?.('ready')
      })
      .catch(() => {
        lastRouteRef.current = fallbackRoute
        updateSources(lastRouteRef.current)
        if (routeStart && routeEnd) {
          const distance = calculateDistanceKm(routeStart, routeEnd)
          const minutes = Math.max(3, Math.round(distance * 2.2))
          onEtaChange?.(minutes)
        }
        onRouteSteps?.([])
        onRouteStatus?.('fallback')
      })

    return () => controller.abort()
  }, [
    origin,
    destination,
    pickup,
    dropoff,
    onEtaChange,
    onRouteStatus
  ])

  useEffect(() => {
    const map = mapRef.current
    const container = containerRef.current
    if (!map || !container) return

    const resize = () => {
      try {
        map.resize()
      } catch {
        // Ignore resize failures.
      }
    }

    resizeObserverRef.current?.disconnect()
    resizeObserverRef.current = new ResizeObserver(() => resize())
    resizeObserverRef.current.observe(container)
    window.addEventListener('resize', resize)

    return () => {
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div className="driver-route-map">
      <div ref={containerRef} className="driver-route-map__canvas" />
      <div className="driver-route-map__overlay" />
      <style jsx global>{`
        .driver-route-map {
          position: relative;
          height: 100%;
          width: 100%;
          overflow: hidden;
          border-radius: 1rem;
        }

        .driver-route-map__canvas {
          position: absolute;
          inset: 0;
        }

        .driver-route-map__overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            180deg,
            rgba(5, 2, 7, 0.2),
            rgba(5, 2, 7, 0.5)
          );
          pointer-events: none;
        }
      `}</style>
    </div>
  )
}
