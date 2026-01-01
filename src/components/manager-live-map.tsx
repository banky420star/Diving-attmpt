'use client'

import { useEffect, useRef, useState } from 'react'

import { loadMaplibre } from '@/lib/maplibre'

type DriverStatus = 'ONLINE' | 'OFFLINE' | 'ON_JOB' | 'BREAK'
type OrderStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'PICKED_UP'
  | 'EN_ROUTE'
  | 'DELIVERED'
  | 'CANCELLED'

export type DriverMapPoint = {
  id: string
  name: string
  status: DriverStatus
  latitude: number
  longitude: number
}

export type OrderMapPoint = {
  id: string
  status: OrderStatus
  customerName: string
  pickupLat: number
  pickupLng: number
  deliveryLat: number
  deliveryLng: number
  assignedDriverId?: string | null
}

const DEFAULT_CENTER: [number, number] = [18.4241, -33.9249]
const DEFAULT_ZOOM = 11
const ORDER_POINTS_SOURCE_ID = 'order-points'
const ORDER_ROUTES_SOURCE_ID = 'order-routes'
const ORDER_ROUTE_LAYER_ID = 'order-route-line'
const ORDER_ROUTE_GLOW_LAYER_ID = 'order-route-glow'
const ORDER_ROUTE_CASING_LAYER_ID = 'order-route-casing'
const ORDER_PICKUP_LAYER_ID = 'order-pickup-point'
const ORDER_DROPOFF_LAYER_ID = 'order-dropoff-point'
const LIVE_ROUTES_SOURCE_ID = 'live-order-routes'
const LIVE_ROUTE_LAYER_ID = 'live-route-line'
const LIVE_ROUTE_GLOW_LAYER_ID = 'live-route-glow'
const LIVE_ROUTE_CASING_LAYER_ID = 'live-route-casing'
const LIVE_ROUTE_LABELS_SOURCE_ID = 'live-route-labels'
const LIVE_ROUTE_LABEL_LAYER_ID = 'live-route-labels'

const OSM_STYLE = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    osm: {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors'
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

const getMarkerClass = (status: DriverStatus) => {
  switch (status) {
    case 'ONLINE':
      return 'manager-marker--online'
    case 'ON_JOB':
      return 'manager-marker--on-job'
    case 'BREAK':
      return 'manager-marker--break'
    default:
      return 'manager-marker--offline'
  }
}

const getLabel = (name: string) => {
  const trimmed = name.trim()
  if (!trimmed) return 'Driver'
  return trimmed.split(' ')[0]
}

const buildFallbackRoute = (order: OrderMapPoint): GeoJSON.LineString => ({
  type: 'LineString',
  coordinates: [
    [order.pickupLng, order.pickupLat],
    [order.deliveryLng, order.deliveryLat]
  ]
})

const buildLiveFallbackRoute = (
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): GeoJSON.LineString => ({
  type: 'LineString',
  coordinates: [
    [origin.lng, origin.lat],
    [destination.lng, destination.lat]
  ]
})

const calculateDistanceKm = (
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
) => {
  const R = 6371
  const dLat = ((destination.lat - origin.lat) * Math.PI) / 180
  const dLng = ((destination.lng - origin.lng) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((origin.lat * Math.PI) / 180) *
      Math.cos((destination.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

const getLiveDestination = (order: OrderMapPoint) => {
  if (!order.assignedDriverId) return null
  if (['PICKED_UP', 'EN_ROUTE'].includes(order.status)) {
    return { lat: order.deliveryLat, lng: order.deliveryLng }
  }
  if (['ASSIGNED', 'ACCEPTED'].includes(order.status)) {
    return { lat: order.pickupLat, lng: order.pickupLng }
  }
  return null
}

const buildOrderPointFeatures = (orders: OrderMapPoint[]) =>
  orders.flatMap((order) => [
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [order.pickupLng, order.pickupLat]
      },
      properties: {
        kind: 'pickup',
        orderId: order.id,
        label: `${order.customerName} pickup`
      }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [order.deliveryLng, order.deliveryLat]
      },
      properties: {
        kind: 'dropoff',
        orderId: order.id,
        label: `${order.customerName} drop-off`
      }
    }
  ]) as GeoJSON.Feature<GeoJSON.Point>[]

export function ManagerLiveMap({
  drivers,
  orders = [],
  className
}: {
  drivers: DriverMapPoint[]
  orders?: OrderMapPoint[]
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<import('maplibre-gl').Map | null>(null)
  const maplibreRef = useRef<typeof import('maplibre-gl') | null>(null)
  const markersRef = useRef(
    new Map<string, import('maplibre-gl').Marker>()
  )
  const routeCacheRef = useRef(new Map<string, GeoJSON.LineString>())
  const pendingRoutesRef = useRef(new Set<string>())
  const [routeVersion, setRouteVersion] = useState(0)
  const liveRouteCacheRef = useRef(
    new Map<string, { geometry: GeoJSON.LineString; etaMinutes: number }>()
  )
  const liveRouteKeyRef = useRef(new Map<string, string>())
  const pendingLiveRoutesRef = useRef(new Set<string>())
  const [liveRouteVersion, setLiveRouteVersion] = useState(0)

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
          attributionControl: false
        })

        map.addControl(
          new maplibregl.NavigationControl({
            showCompass: false,
            showZoom: true
          }),
          'top-right'
        )
        map.scrollZoom.disable()
        mapRef.current = map
      } catch (error) {
        console.error('Failed to load maplibre:', error)
      }
    }

    init()

    return () => {
      isMounted = false
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current.clear()
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  const ensureOrderLayers = (map: import('maplibre-gl').Map) => {
    if (!map.getSource(ORDER_POINTS_SOURCE_ID)) {
      map.addSource(ORDER_POINTS_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      })
    }

    if (!map.getSource(ORDER_ROUTES_SOURCE_ID)) {
      map.addSource(ORDER_ROUTES_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      })
    }

    if (!map.getSource(LIVE_ROUTES_SOURCE_ID)) {
      map.addSource(LIVE_ROUTES_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      })
    }

    if (!map.getSource(LIVE_ROUTE_LABELS_SOURCE_ID)) {
      map.addSource(LIVE_ROUTE_LABELS_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      })
    }

    if (!map.getLayer(ORDER_ROUTE_GLOW_LAYER_ID)) {
      map.addLayer({
        id: ORDER_ROUTE_GLOW_LAYER_ID,
        type: 'line',
        source: ORDER_ROUTES_SOURCE_ID,
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

    if (!map.getLayer(ORDER_ROUTE_CASING_LAYER_ID)) {
      map.addLayer({
        id: ORDER_ROUTE_CASING_LAYER_ID,
        type: 'line',
        source: ORDER_ROUTES_SOURCE_ID,
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

    if (!map.getLayer(ORDER_ROUTE_LAYER_ID)) {
      map.addLayer({
        id: ORDER_ROUTE_LAYER_ID,
        type: 'line',
        source: ORDER_ROUTES_SOURCE_ID,
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        },
        paint: {
          'line-color': 'rgba(255, 0, 122, 0.9)',
          'line-width': 4
        }
      })
    }

    if (!map.getLayer(LIVE_ROUTE_GLOW_LAYER_ID)) {
      map.addLayer({
        id: LIVE_ROUTE_GLOW_LAYER_ID,
        type: 'line',
        source: LIVE_ROUTES_SOURCE_ID,
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        },
        paint: {
          'line-color': 'rgba(56, 189, 248, 0.35)',
          'line-width': 9,
          'line-blur': 4
        }
      })
    }

    if (!map.getLayer(LIVE_ROUTE_CASING_LAYER_ID)) {
      map.addLayer({
        id: LIVE_ROUTE_CASING_LAYER_ID,
        type: 'line',
        source: LIVE_ROUTES_SOURCE_ID,
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        },
        paint: {
          'line-color': 'rgba(255, 255, 255, 0.85)',
          'line-width': 7
        }
      })
    }

    if (!map.getLayer(LIVE_ROUTE_LAYER_ID)) {
      map.addLayer({
        id: LIVE_ROUTE_LAYER_ID,
        type: 'line',
        source: LIVE_ROUTES_SOURCE_ID,
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        },
        paint: {
          'line-color': 'rgba(56, 189, 248, 0.95)',
          'line-width': 5
        }
      })
    }

    if (!map.getLayer(LIVE_ROUTE_LABEL_LAYER_ID)) {
      map.addLayer({
        id: LIVE_ROUTE_LABEL_LAYER_ID,
        type: 'symbol',
        source: LIVE_ROUTE_LABELS_SOURCE_ID,
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 12,
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'],
          'text-offset': [0, 1.1],
          'text-allow-overlap': true
        },
        paint: {
          'text-color': '#38bdf8',
          'text-halo-color': 'rgba(5, 2, 7, 0.9)',
          'text-halo-width': 2
        }
      })
    }

    if (!map.getLayer(ORDER_PICKUP_LAYER_ID)) {
      map.addLayer({
        id: ORDER_PICKUP_LAYER_ID,
        type: 'circle',
        source: ORDER_POINTS_SOURCE_ID,
        filter: ['==', ['get', 'kind'], 'pickup'],
        paint: {
          'circle-radius': 6,
          'circle-color': '#7dd3fc',
          'circle-stroke-width': 2,
          'circle-stroke-color': 'rgba(255, 255, 255, 0.8)'
        }
      })
    }

    if (!map.getLayer(ORDER_DROPOFF_LAYER_ID)) {
      map.addLayer({
        id: ORDER_DROPOFF_LAYER_ID,
        type: 'circle',
        source: ORDER_POINTS_SOURCE_ID,
        filter: ['==', ['get', 'kind'], 'dropoff'],
        paint: {
          'circle-radius': 6,
          'circle-color': '#f472b6',
          'circle-stroke-width': 2,
          'circle-stroke-color': 'rgba(255, 255, 255, 0.8)'
        }
      })
    }
  }

  useEffect(() => {
    if (orders.length === 0) return
    const controller = new AbortController()

    orders.forEach((order) => {
      if (routeCacheRef.current.has(order.id)) return
      if (pendingRoutesRef.current.has(order.id)) return

      pendingRoutesRef.current.add(order.id)
      const url = `https://router.project-osrm.org/route/v1/driving/${order.pickupLng},${order.pickupLat};${order.deliveryLng},${order.deliveryLat}?overview=full&geometries=geojson`

      fetch(url, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) {
            throw new Error('Route request failed')
          }
          return response.json()
        })
        .then((data) => {
          const geometry = data?.routes?.[0]?.geometry
          if (!geometry || geometry.type !== 'LineString') {
            throw new Error('Missing route geometry')
          }
          routeCacheRef.current.set(order.id, geometry as GeoJSON.LineString)
          setRouteVersion((prev) => prev + 1)
        })
        .catch(() => {
          routeCacheRef.current.set(order.id, buildFallbackRoute(order))
          setRouteVersion((prev) => prev + 1)
        })
        .finally(() => {
          pendingRoutesRef.current.delete(order.id)
        })
    })

    return () => controller.abort()
  }, [orders])

  useEffect(() => {
    if (orders.length === 0 || drivers.length === 0) {
      liveRouteKeyRef.current.clear()
      return
    }
    const controller = new AbortController()

    orders.forEach((order) => {
      const destination = getLiveDestination(order)
      if (!destination || !order.assignedDriverId) {
        liveRouteKeyRef.current.delete(order.id)
        return
      }
      const driver = drivers.find(
        (item) => item.id === order.assignedDriverId
      )
      if (
        !driver ||
        typeof driver.latitude !== 'number' ||
        typeof driver.longitude !== 'number'
      ) {
        liveRouteKeyRef.current.delete(order.id)
        return
      }

      const origin = { lat: driver.latitude, lng: driver.longitude }
      const key = `${order.id}:${order.status}:${origin.lat.toFixed(
        4
      )},${origin.lng.toFixed(4)}:${destination.lat.toFixed(
        4
      )},${destination.lng.toFixed(4)}`

      liveRouteKeyRef.current.set(order.id, key)

      if (
        liveRouteCacheRef.current.has(key) ||
        pendingLiveRoutesRef.current.has(key)
      ) {
        return
      }

      pendingLiveRoutesRef.current.add(key)
      const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`

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
          if (!geometry || geometry.type !== 'LineString') {
            throw new Error('Missing route geometry')
          }
          const etaMinutes =
            typeof durationSeconds === 'number' && durationSeconds > 0
              ? Math.max(1, Math.round(durationSeconds / 60))
              : Math.max(3, Math.round(calculateDistanceKm(origin, destination) * 2.2))
          liveRouteCacheRef.current.set(key, {
            geometry: geometry as GeoJSON.LineString,
            etaMinutes
          })
          setLiveRouteVersion((prev) => prev + 1)
        })
        .catch(() => {
          const fallback = buildLiveFallbackRoute(origin, destination)
          const etaMinutes = Math.max(
            3,
            Math.round(calculateDistanceKm(origin, destination) * 2.2)
          )
          liveRouteCacheRef.current.set(key, { geometry: fallback, etaMinutes })
          setLiveRouteVersion((prev) => prev + 1)
        })
        .finally(() => {
          pendingLiveRoutesRef.current.delete(key)
        })
    })

    return () => controller.abort()
  }, [orders, drivers])

  useEffect(() => {
    const map = mapRef.current
    const maplibre = maplibreRef.current
    if (!map || !maplibre) return

    const updateSources = () => {
      ensureOrderLayers(map)

      const pointFeatures = buildOrderPointFeatures(orders)
      const pointsSource = map.getSource(
        ORDER_POINTS_SOURCE_ID
      ) as import('maplibre-gl').GeoJSONSource | null
      const pointsData: GeoJSON.FeatureCollection<GeoJSON.Point> = {
        type: 'FeatureCollection',
        features: pointFeatures
      }
      pointsSource?.setData(pointsData)

      const routeFeatures = orders.map((order) => ({
        type: 'Feature',
        geometry:
          routeCacheRef.current.get(order.id) ?? buildFallbackRoute(order),
        properties: {
          orderId: order.id,
          status: order.status
        }
      })) as GeoJSON.Feature<GeoJSON.LineString>[]

      const routesSource = map.getSource(
        ORDER_ROUTES_SOURCE_ID
      ) as import('maplibre-gl').GeoJSONSource | null
      const routesData: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
        type: 'FeatureCollection',
        features: routeFeatures
      }
      routesSource?.setData(routesData)

      const liveRouteFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = []
      const liveLabelFeatures: GeoJSON.Feature<GeoJSON.Point>[] = []

      orders.forEach((order) => {
        const key = liveRouteKeyRef.current.get(order.id)
        if (!key) return
        const cached = liveRouteCacheRef.current.get(key)
        if (!cached) return
        liveRouteFeatures.push({
          type: 'Feature',
          geometry: cached.geometry,
          properties: { orderId: order.id, status: order.status }
        })

        const coords = cached.geometry.coordinates
        if (coords.length > 0 && Number.isFinite(cached.etaMinutes)) {
          const mid = coords[Math.floor(coords.length / 2)]
          liveLabelFeatures.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: mid
            },
            properties: {
              label: `${cached.etaMinutes} min`
            }
          })
        }
      })

      const liveRoutesSource = map.getSource(
        LIVE_ROUTES_SOURCE_ID
      ) as import('maplibre-gl').GeoJSONSource | null
      liveRoutesSource?.setData({
        type: 'FeatureCollection',
        features: liveRouteFeatures
      })

      const liveLabelsSource = map.getSource(
        LIVE_ROUTE_LABELS_SOURCE_ID
      ) as import('maplibre-gl').GeoJSONSource | null
      liveLabelsSource?.setData({
        type: 'FeatureCollection',
        features: liveLabelFeatures
      })
    }

    if (map.isStyleLoaded()) {
      updateSources()
    } else {
      map.once('load', updateSources)
    }
  }, [orders, routeVersion, liveRouteVersion])

  useEffect(() => {
    const map = mapRef.current
    const maplibre = maplibreRef.current
    if (!map || !maplibre) return

    const seen = new Set<string>()

    drivers.forEach((driver) => {
      if (
        typeof driver.latitude !== 'number' ||
        typeof driver.longitude !== 'number'
      ) {
        return
      }

      seen.add(driver.id)
      const position: [number, number] = [
        driver.longitude,
        driver.latitude
      ]
      const existing = markersRef.current.get(driver.id)
      const label = getLabel(driver.name)

      if (!existing) {
        const markerEl = document.createElement('div')
        markerEl.className = `manager-marker ${getMarkerClass(driver.status)}`

        const pulse = document.createElement('span')
        pulse.className = 'manager-marker__pulse'
        const dot = document.createElement('span')
        dot.className = 'manager-marker__dot'
        const text = document.createElement('span')
        text.className = 'manager-marker__label'
        text.textContent = label

        markerEl.appendChild(pulse)
        markerEl.appendChild(dot)
        markerEl.appendChild(text)

        const marker = new maplibre.Marker({
          element: markerEl,
          anchor: 'bottom'
        })
          .setLngLat(position)
          .addTo(map)

        markersRef.current.set(driver.id, marker)
      } else {
        existing.setLngLat(position)
        const el = existing.getElement()
        el.className = `manager-marker ${getMarkerClass(driver.status)}`
        const labelEl = el.querySelector('.manager-marker__label')
        if (labelEl) {
          labelEl.textContent = label
        }
      }
    })

    markersRef.current.forEach((marker, id) => {
      if (!seen.has(id)) {
        marker.remove()
        markersRef.current.delete(id)
      }
    })

  }, [drivers])

  useEffect(() => {
    const map = mapRef.current
    const maplibre = maplibreRef.current
    if (!map || !maplibre) return

    const bounds = new maplibre.LngLatBounds()
    let hasPoint = false

    drivers.forEach((driver) => {
      if (
        typeof driver.latitude !== 'number' ||
        typeof driver.longitude !== 'number'
      ) {
        return
      }
      bounds.extend([driver.longitude, driver.latitude])
      hasPoint = true
    })

    orders.forEach((order) => {
      if (
        typeof order.pickupLat !== 'number' ||
        typeof order.pickupLng !== 'number' ||
        typeof order.deliveryLat !== 'number' ||
        typeof order.deliveryLng !== 'number'
      ) {
        return
      }
      bounds.extend([order.pickupLng, order.pickupLat])
      bounds.extend([order.deliveryLng, order.deliveryLat])
      hasPoint = true
    })

    if (!hasPoint || bounds.isEmpty()) return

    const fit = () => {
      map.fitBounds(bounds, { padding: 60, duration: 800, maxZoom: 14 })
    }

    if (map.isStyleLoaded()) {
      fit()
    } else {
      map.once('load', fit)
    }
  }, [drivers, orders])

  const wrapperClass = ['manager-map', className].filter(Boolean).join(' ')

  return (
    <div className={wrapperClass}>
      <div ref={containerRef} className="manager-map__canvas" />
      <div className="manager-map__overlay" />
      <div className="manager-map__grid" />
      <style jsx global>{`
        .manager-map {
          position: relative;
          height: 100%;
          width: 100%;
          overflow: hidden;
          border-radius: 1rem;
        }

        .manager-map__canvas {
          position: absolute;
          inset: 0;
        }

        .manager-map__overlay {
          position: absolute;
          inset: 0;
          background: radial-gradient(
              circle at 20% 20%,
              rgba(255, 0, 122, 0.18),
              transparent 60%
            ),
            radial-gradient(
              circle at 80% 80%,
              rgba(255, 120, 200, 0.16),
              transparent 60%
            );
          mix-blend-mode: screen;
          pointer-events: none;
        }

        .manager-map__grid {
          position: absolute;
          inset: 0;
          background-image: linear-gradient(
              90deg,
              rgba(255, 255, 255, 0.08) 1px,
              transparent 1px
            ),
            linear-gradient(
              0deg,
              rgba(255, 255, 255, 0.08) 1px,
              transparent 1px
            );
          background-size: 32px 32px;
          opacity: 0.2;
          pointer-events: none;
        }

        .manager-marker {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          transform: translateY(4px);
        }

        .manager-marker__pulse {
          position: absolute;
          top: -6px;
          width: 22px;
          height: 22px;
          border-radius: 999px;
          background: rgba(255, 0, 122, 0.2);
          animation: managerPulse 2.4s ease-in-out infinite;
        }

        .manager-marker__dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          box-shadow: 0 0 12px rgba(255, 0, 122, 0.6);
        }

        .manager-marker__label {
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: rgba(4, 2, 7, 0.85);
          color: rgba(255, 255, 255, 0.82);
          font-size: 10px;
          letter-spacing: 0.22em;
          padding: 2px 8px;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .manager-marker--online .manager-marker__dot {
          background: #34d399;
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.7);
        }

        .manager-marker--on-job .manager-marker__dot {
          background: #f472b6;
          box-shadow: 0 0 12px rgba(244, 114, 182, 0.7);
        }

        .manager-marker--break .manager-marker__dot {
          background: #fbbf24;
          box-shadow: 0 0 12px rgba(251, 191, 36, 0.7);
        }

        .manager-marker--offline .manager-marker__dot {
          background: #94a3b8;
          box-shadow: 0 0 12px rgba(148, 163, 184, 0.6);
        }

        .manager-marker--online .manager-marker__pulse {
          background: rgba(52, 211, 153, 0.25);
        }

        .manager-marker--on-job .manager-marker__pulse {
          background: rgba(244, 114, 182, 0.25);
        }

        .manager-marker--break .manager-marker__pulse {
          background: rgba(251, 191, 36, 0.25);
        }

        .manager-marker--offline .manager-marker__pulse {
          background: rgba(148, 163, 184, 0.18);
        }

        @keyframes managerPulse {
          0%,
          100% {
            transform: scale(0.9);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.4);
            opacity: 0;
          }
        }

        .manager-map .maplibregl-ctrl {
          background: rgba(4, 2, 7, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
        }

        .manager-map .maplibregl-ctrl button {
          filter: invert(1) brightness(0.85);
        }
      `}</style>
    </div>
  )
}
