'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DriverRouteMap } from '@/components/driver-route-map'
import { useToast } from '@/hooks/use-toast'
import {
  playNotificationTone,
  requestNotificationPermission,
  sendBrowserNotification
} from '@/lib/notifications'
import {
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  LogOut,
  MapPin,
  Navigation,
  Package,
  Phone,
  Star,
  TrendingUp,
  XCircle
} from 'lucide-react'

type DriverStatus = 'ONLINE' | 'OFFLINE' | 'ON_JOB' | 'BREAK'
type DeliveryStage = 'PICKUP' | 'DELIVERY'
const LOCATION_GEOFENCE_METERS = 150
type OrderStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'PICKED_UP'
  | 'EN_ROUTE'
  | 'DELIVERED'
  | 'CANCELLED'
type IssueType =
  | 'CUSTOMER_NO_RESPONSE'
  | 'ADDRESS_ISSUE'
  | 'VEHICLE_ISSUE'
  | 'ACCIDENT'
  | 'PAYMENT_DISPUTE'
  | 'OTHER'

interface Driver {
  id: string
  name: string
  status: DriverStatus
  totalEarnings: number
  rating: number
  totalJobs: number
}

interface Order {
  id: string
  customerName: string
  customerPhone: string
  pickupAddress: string
  pickupLat: number
  pickupLng: number
  deliveryAddress: string
  deliveryLat: number
  deliveryLng: number
  orderValue: number
  deliveryFee: number
  driverPay: number
  paymentType: 'EFT' | 'CASH'
  estimatedTime?: number | null
  status: OrderStatus
  assignedDriverId?: string | null
}

const statusConfig: Record<
  DriverStatus,
  { label: string; detail: string; dotClass: string; badgeClass: string }
> = {
  ONLINE: {
    label: 'Online',
    detail: 'Waiting for new drops.',
    dotClass: 'bg-emerald-400',
    badgeClass: 'border-emerald-400/50 text-emerald-200 bg-emerald-500/15'
  },
  OFFLINE: {
    label: 'Offline',
    detail: 'Go online to start your shift.',
    dotClass: 'bg-slate-500',
    badgeClass: 'border-white/15 text-white/70 bg-white/5'
  },
  BREAK: {
    label: 'Break',
    detail: 'Paused until you are ready.',
    dotClass: 'bg-amber-400',
    badgeClass: 'border-amber-400/50 text-amber-200 bg-amber-500/15'
  },
  ON_JOB: {
    label: 'On job',
    detail: 'Finish the active delivery to switch status.',
    dotClass: 'bg-pink-400',
    badgeClass: 'border-pink-400/50 text-pink-200 bg-pink-500/20'
  }
}

const issueOptions: Array<{ value: IssueType; label: string; detail: string }> = [
  {
    value: 'CUSTOMER_NO_RESPONSE',
    label: 'Client not responding',
    detail: 'Call attempts failed or no answer.'
  },
  {
    value: 'ADDRESS_ISSUE',
    label: 'Address issue',
    detail: 'Pin or address does not match the location.'
  },
  {
    value: 'VEHICLE_ISSUE',
    label: 'Vehicle issue',
    detail: 'Breakdown or unsafe to continue.'
  },
  {
    value: 'ACCIDENT',
    label: 'Accident / incident',
    detail: 'Report any accident or emergency.'
  },
  {
    value: 'PAYMENT_DISPUTE',
    label: 'Payment dispute',
    detail: 'Cash or payment conflict at drop-off.'
  },
  {
    value: 'OTHER',
    label: 'Other',
    detail: 'Something else needs attention.'
  }
]

const statusOptions: Array<{ value: DriverStatus; label: string }> = [
  { value: 'OFFLINE', label: 'Offline' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'BREAK', label: 'Break' }
]

export default function DriverApp() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [driverId, setDriverId] = useState<string | null>(null)
  const [driver, setDriver] = useState<Driver | null>(null)
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [currentStatus, setCurrentStatus] = useState<DriverStatus>('OFFLINE')
  const [loading, setLoading] = useState(true)
  const [jobAlert, setJobAlert] = useState<Order | null>(null)
  const [deliveryStage, setDeliveryStage] = useState<DeliveryStage>('PICKUP')
  const [isWorking, setIsWorking] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isRequestingLocation, setIsRequestingLocation] = useState(false)
  const [locationStatus, setLocationStatus] = useState<
    'unknown' | 'granted' | 'denied'
  >('unknown')
  const [driverLocation, setDriverLocation] = useState<{
    lat: number
    lng: number
  } | null>(null)
  const [routeEta, setRouteEta] = useState<number | null>(null)
  const [routeSteps, setRouteSteps] = useState<
    Array<{ instruction: string; distance: number }>
  >([])
  const [routeStatus, setRouteStatus] = useState<
    'idle' | 'loading' | 'ready' | 'fallback'
  >('idle')
  const [issueDialogOpen, setIssueDialogOpen] = useState(false)
  const [issueType, setIssueType] = useState<IssueType>('CUSTOMER_NO_RESPONSE')
  const [issueNote, setIssueNote] = useState('')
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const lastLocationPing = useRef(0)
  const lastJobAlertIdRef = useRef<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const paramId = searchParams.get('driverId')
    if (paramId) {
      setDriverId(paramId)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('driverId', paramId)
      }
      return
    }
    if (typeof window !== 'undefined') {
      const storedId = window.localStorage.getItem('driverId')
      if (storedId) {
        setDriverId(storedId)
      }
    }
  }, [searchParams])

  useEffect(() => {
    if (!driverId) return
    requestNotificationPermission()
  }, [driverId])

  const fetchJson = useCallback(
    async <T,>(url: string, options?: RequestInit): Promise<T> => {
      const response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(options?.headers ?? {})
        }
      })

      if (response.status === 401 || response.status === 403) {
        setDriver(null)
        setActiveOrder(null)
        setJobAlert(null)
        setDriverId(null)
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('driverId')
        }
        throw new Error('Unauthorized')
      }

      if (!response.ok) {
        throw new Error('Request failed')
      }

      const result = (await response.json()) as {
        success: boolean
        data?: T
        error?: string
      }

      if (!result.success) {
        throw new Error(result.error || 'Request failed')
      }

      return result.data as T
    },
    []
  )

  const updateLocation = useCallback(
    async (latitude: number, longitude: number) => {
      if (!driverId) return
      try {
        await fetchJson<Driver>(`/api/drivers/${driverId}`, {
          method: 'PUT',
          body: JSON.stringify({ latitude, longitude })
        })
        setLocationStatus('granted')
        setDriverLocation({ lat: latitude, lng: longitude })
        setDriver((prev) =>
          prev ? { ...prev, latitude, longitude } : prev
        )
      } catch (error) {
        // Ignore location update failures to avoid blocking UI.
      }
    },
    [driverId, fetchJson]
  )

  const requestLocationPermission = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      toast({
        title: 'Location unavailable',
        description: 'Your browser does not support location services.'
      })
      return
    }
    if (isRequestingLocation) {
      return
    }
    setIsRequestingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDriverLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        })
        setLocationStatus('granted')
        updateLocation(position.coords.latitude, position.coords.longitude)
        setIsRequestingLocation(false)
        toast({
          title: 'Location enabled',
          description: 'Sharing your live position with dispatch.'
        })
      },
      () => {
        setLocationStatus('denied')
        setIsRequestingLocation(false)
        toast({
          title: 'Location blocked',
          description: 'Allow location to show your live position.'
        })
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [isRequestingLocation, toast, updateLocation])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('permissions' in navigator)) {
      return
    }
    try {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((result) => {
          setLocationStatus(
            result.state === 'granted'
              ? 'granted'
              : result.state === 'denied'
                ? 'denied'
                : 'unknown'
          )
          result.onchange = () => {
            setLocationStatus(
              result.state === 'granted'
                ? 'granted'
                : result.state === 'denied'
                  ? 'denied'
                  : 'unknown'
            )
          }
        })
    } catch (error) {
      // Ignore permissions API errors.
    }
  }, [])

  const loadDriver = useCallback(
    async (id: string) => {
      const data = await fetchJson<Driver>(`/api/drivers/${id}`)
      setDriver(data)
      setCurrentStatus(data.status)
      return data
    },
    [fetchJson]
  )

  const loadOrders = useCallback(
    async (statusOverride?: DriverStatus) => {
      if (!driverId) return
      try {
        const driverStatus = statusOverride ?? currentStatus
        const activeStatuses: OrderStatus[] = [
          'ACCEPTED',
          'PICKED_UP',
          'EN_ROUTE'
        ]
        const activeResults = await Promise.all(
          activeStatuses.map((status) =>
            fetchJson<Order[]>(`/api/orders?status=${status}`)
          )
        )
        const activeCandidates = activeResults
          .flat()
          .filter((order) => order.assignedDriverId === driverId)
        const active = activeCandidates[0] ?? null

        setActiveOrder(active)

        if (active) {
          setJobAlert(null)
          return
        }

        if (driverStatus === 'ONLINE') {
          const assignedOrders = await fetchJson<Order[]>(
            `/api/orders?status=ASSIGNED`
          )
          const assignedForDriver = assignedOrders.find(
            (order) => order.assignedDriverId === driverId
          )
          if (assignedForDriver) {
            setJobAlert(assignedForDriver)
            return
          }

          const pendingOrders = await fetchJson<Order[]>(
            `/api/orders?status=PENDING`
          )
          const pending = pendingOrders.find(
            (order) => !order.assignedDriverId
          )
          setJobAlert(pending ?? null)
          return
        }

        setJobAlert(null)
      } catch (error) {
        setActiveOrder(null)
        setJobAlert(null)
        toast({
          title: 'Unable to load orders',
          description: 'Please refresh or try again shortly.'
        })
      }
    },
    [currentStatus, driverId, fetchJson, toast]
  )

  useEffect(() => {
    let isMounted = true
    if (!driverId) {
      setDriver(null)
      setActiveOrder(null)
      setJobAlert(null)
      setCurrentStatus('OFFLINE')
      setLoading(false)
      return
    }

    const init = async () => {
      try {
        setLoading(true)
        const loadedDriver = await loadDriver(driverId)
        if (!isMounted) return
        await loadOrders(loadedDriver.status)
      } catch (error) {
        setDriver(null)
        setActiveOrder(null)
        setJobAlert(null)
        const message =
          error instanceof Error && error.message
            ? error.message
            : 'Check the driver ID and try again.'
        if (message === 'Driver account disabled') {
          setDriverId(null)
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem('driverId')
          }
          router.replace('/driver')
        }
        toast({
          title: 'Unable to load driver',
          description: message
        })
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    init()

    return () => {
      isMounted = false
    }
  }, [driverId, loadDriver, loadOrders, toast])

  useEffect(() => {
    if (driver?.latitude == null || driver?.longitude == null) return
    setDriverLocation({ lat: driver.latitude, lng: driver.longitude })
  }, [driver?.latitude, driver?.longitude])

  useEffect(() => {
    if (!activeOrder) {
      setDeliveryStage('PICKUP')
      setRouteEta(null)
      setRouteStatus('idle')
      return
    }
    if (['PICKED_UP', 'EN_ROUTE'].includes(activeOrder.status)) {
      setDeliveryStage('DELIVERY')
    } else {
      setDeliveryStage('PICKUP')
    }
  }, [activeOrder])

  useEffect(() => {
    setRouteEta(null)
  }, [deliveryStage])

  const effectiveStatus: DriverStatus = activeOrder ? 'ON_JOB' : currentStatus

  useEffect(() => {
    if (!driverId) return
    if (!['ONLINE', 'ON_JOB'].includes(effectiveStatus)) return
    const timer = setInterval(() => {
      loadOrders(effectiveStatus)
    }, 15000)
    return () => clearInterval(timer)
  }, [driverId, effectiveStatus, loadOrders])

  useEffect(() => {
    if (!jobAlert || !jobAlert.id) {
      lastJobAlertIdRef.current = null
      return
    }
    if (jobAlert.id === lastJobAlertIdRef.current) return
    lastJobAlertIdRef.current = jobAlert.id

    playNotificationTone('order')
    sendBrowserNotification(
      'New trip available',
      `${jobAlert.customerName} · ${jobAlert.pickupAddress}`
    )
    toast({
      title: 'New trip available',
      description: `${jobAlert.customerName} · ${jobAlert.pickupAddress}`
    })
  }, [jobAlert, toast])

  const updateStatus = async (
    status: DriverStatus,
    options?: { track?: boolean; refresh?: boolean }
  ) => {
    const shouldTrack = options?.track ?? true
    const shouldRefresh = options?.refresh ?? true
    if (!driverId) {
      toast({
        title: 'No driver linked',
        description: 'Add ?driverId= to the URL to connect your profile.'
      })
      return
    }
    if (
      ['ONLINE', 'ON_JOB'].includes(status) &&
      locationStatus !== 'granted'
    ) {
      requestLocationPermission()
    }
    try {
      if (shouldTrack) {
        setIsWorking(true)
      }
      const updated = await fetchJson<Driver>(`/api/drivers/${driverId}`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      })
      setDriver(updated)
      setCurrentStatus(status)
      if (shouldRefresh) {
        await loadOrders(status)
      }
    } catch (error) {
      toast({
        title: 'Status update failed',
        description: 'Please try again.'
      })
    } finally {
      if (shouldTrack) {
        setIsWorking(false)
      }
    }
  }

  const updateOrder = useCallback(
    async (orderId: string, payload: Record<string, unknown>) => {
      return fetchJson<Order>(`/api/orders/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      })
    },
    [fetchJson]
  )

  const handleDriverLogin = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!loginForm.email.trim() || !loginForm.password.trim()) {
      toast({
        title: 'Missing details',
        description: 'Enter your email and password.'
      })
      return
    }

    try {
      setIsLoggingIn(true)
      const loggedIn = await fetchJson<Driver>('/api/drivers/login', {
        method: 'POST',
        body: JSON.stringify({
          email: loginForm.email.trim(),
          password: loginForm.password.trim()
        })
      })
      setDriverId(loggedIn.id)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('driverId', loggedIn.id)
      }
      requestNotificationPermission()
      router.replace(`/driver?driverId=${loggedIn.id}`)
      setLoginForm({ email: '', password: '' })
      toast({
        title: 'Logged in',
        description: `Welcome back, ${loggedIn.name}.`
      })
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Check your credentials and try again.'
      toast({
        title: 'Login failed',
        description: message
      })
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleDriverLogout = async () => {
    if (!driverId) return
    if (
      activeOrder &&
      typeof window !== 'undefined' &&
      !window.confirm(
        'You are on an active trip. Logging out will mark you offline. Continue?'
      )
    ) {
      return
    }
    try {
      setIsLoggingOut(true)
      await fetch('/api/logout', { method: 'POST' })
      await updateStatus('OFFLINE', { track: false, refresh: false })
    } catch (error) {
      // Ignore logout errors so the UI can still reset.
    } finally {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('driverId')
      }
      setDriverLocation(null)
      setDriverId(null)
      setIsLoggingOut(false)
      router.replace('/driver')
      toast({
        title: 'Logged out',
        description: 'You are now offline.'
      })
    }
  }

  const handleAcceptJob = async (order: Order) => {
    if (!driverId) {
      toast({
        title: 'No driver linked',
        description: 'Add ?driverId= to the URL to connect your profile.'
      })
      return
    }
    if (locationStatus !== 'granted') {
      requestLocationPermission()
    }
    try {
      setIsWorking(true)
      setJobAlert(null)
      await updateOrder(order.id, {
        status: 'ACCEPTED',
        assignedDriverId: driverId,
        acceptedAt: new Date().toISOString()
      })
      await updateStatus('ON_JOB', { track: false, refresh: false })
      try {
        playNotificationTone('accept')
      } catch {}
      toast({
        title: 'Job accepted',
        description: `Head to pickup for ${order.customerName}. Tap Navigate when ready.`
      })
    } catch (error) {
      toast({
        title: 'Unable to accept job',
        description: 'Please try again.'
      })
    } finally {
      setIsWorking(false)
      await loadOrders('ON_JOB')
    }
  }

  const handleRejectJob = async () => {
    if (!jobAlert) {
      return
    }
    setJobAlert(null)
    try {
      if (jobAlert.assignedDriverId === driverId) {
        await updateOrder(jobAlert.id, {
          status: 'PENDING',
          assignedDriverId: null
        })
      }
      try {
        playNotificationTone('decline')
      } catch {}
      toast({
        title: 'Job declined',
        description: 'We will keep looking for the next order.'
      })
    } catch (error) {
      toast({
        title: 'Decline failed',
        description: 'Unable to release the trip. Please try again.'
      })
    } finally {
      await loadOrders(currentStatus)
    }
  }

  const buildWazeLinks = (address: string, lat?: number, lng?: number) => {
    const trimmedAddress = address.trim()
    const hasCoords =
      typeof lat === 'number' &&
      Number.isFinite(lat) &&
      typeof lng === 'number' &&
      Number.isFinite(lng)
    const params = [
      hasCoords ? `ll=${lat},${lng}` : null,
      trimmedAddress ? `q=${encodeURIComponent(trimmedAddress)}` : null,
      'navigate=yes'
    ]
      .filter(Boolean)
      .join('&')
    return {
      app: `waze://?${params}`,
      web: `https://www.waze.com/ul?${params}`
    }
  }

  const handleNavigate = (
    address: string,
    label: string,
    lat?: number,
    lng?: number
  ) => {
    const links = buildWazeLinks(address, lat, lng)
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent)
      const openWeb = () => {
        window.open(links.web, '_blank', 'noopener,noreferrer')
      }
      if (isMobile) {
        window.location.href = links.app
        window.setTimeout(() => {
          openWeb()
        }, 900)
      } else {
        openWeb()
      }
    }
    toast({
      title: `Opening ${label} in Waze`,
      description: address
    })
  }

  const handleNavigateDelivery = () => {
    if (!activeOrder) return
    if (deliveryStage !== 'DELIVERY') {
      toast({
        title: 'Pickup first',
        description: 'Confirm pickup to unlock delivery navigation.'
      })
      return
    }
    handleNavigate(
      activeOrder.deliveryAddress,
      'delivery',
      activeOrder.deliveryLat,
      activeOrder.deliveryLng
    )
  }

  const handleCallCustomer = (phone: string) => {
    if (typeof window !== 'undefined') {
      window.open(`tel:${phone}`)
    }
    toast({
      title: 'Calling customer',
      description: phone
    })
  }

  const handlePickupComplete = async () => {
    if (!activeOrder) return
    if (deliveryStage === 'DELIVERY') {
      toast({
        title: 'Pickup already confirmed',
        description: 'Head to the drop-off address.'
      })
      return
    }
    if (!driverLocation || pickupDistanceMeters === null) {
      toast({
        title: 'Location needed',
        description: 'Enable location to confirm pickup.'
      })
      return
    }
    if (pickupDistanceMeters > LOCATION_GEOFENCE_METERS) {
      toast({
        title: 'Too far from pickup',
        description: `Move within ${LOCATION_GEOFENCE_METERS}m to confirm (currently ${formatMeters(
          pickupDistanceMeters
        )} away).`
      })
      return
    }
    try {
      setIsWorking(true)
      await updateOrder(activeOrder.id, {
        status: 'PICKED_UP',
        pickedUpAt: new Date().toISOString()
      })
      setDeliveryStage('DELIVERY')
      toast({
        title: 'Pickup confirmed',
        description: 'Navigate to the delivery address when ready.'
      })
    } catch (error) {
      toast({
        title: 'Pickup update failed',
        description: 'Please try again.'
      })
    } finally {
      setIsWorking(false)
      await loadOrders('ON_JOB')
    }
  }

  const handleCompleteDelivery = async () => {
    if (!activeOrder) return
    if (deliveryStage !== 'DELIVERY') {
      toast({
        title: 'Pickup not confirmed',
        description: 'Mark pickup first to complete the delivery.'
      })
      return
    }
    if (!driverLocation || dropoffDistanceMeters === null) {
      toast({
        title: 'Location needed',
        description: 'Enable location to confirm drop-off.'
      })
      return
    }
    if (dropoffDistanceMeters > LOCATION_GEOFENCE_METERS) {
      toast({
        title: 'Too far from drop-off',
        description: `Move within ${LOCATION_GEOFENCE_METERS}m to complete (currently ${formatMeters(
          dropoffDistanceMeters
        )} away).`
      })
      return
    }
    try {
      setIsWorking(true)
      await updateOrder(activeOrder.id, {
        status: 'DELIVERED',
        deliveredAt: new Date().toISOString()
      })
      setActiveOrder(null)
      setDeliveryStage('PICKUP')
      setRouteEta(null)
      setRouteStatus('idle')
      await updateStatus('ONLINE', { track: false, refresh: false })
      toast({
        title: 'Delivery complete',
        description: `You earned ${formatCurrency(activeOrder.driverPay)}.`
      })
    } catch (error) {
      toast({
        title: 'Delivery update failed',
        description: 'Please try again.'
      })
    } finally {
      setIsWorking(false)
      await loadOrders('ONLINE')
    }
  }

  const handleCancelTrip = async () => {
    if (!activeOrder) return
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        'Cancel this trip? Dispatch will be notified.'
      )
      if (!confirmed) return
    }
    try {
      setIsWorking(true)
      await updateOrder(activeOrder.id, {
        status: 'CANCELLED'
      })
      setActiveOrder(null)
      setDeliveryStage('PICKUP')
      setRouteEta(null)
      setRouteStatus('idle')
      await updateStatus('ONLINE', { track: false, refresh: false })
      toast({
        title: 'Trip cancelled',
        description: 'Dispatch has been notified.'
      })
    } catch (error) {
      toast({
        title: 'Cancel failed',
        description: 'Please try again.'
      })
    } finally {
      setIsWorking(false)
      await loadOrders('ONLINE')
    }
  }

  const handleReportIssue = () => {
    setIssueDialogOpen(true)
  }

  const handleSubmitIssue = async () => {
    if (!driverId) {
      toast({
        title: 'Not signed in',
        description: 'Log in to report a driver issue.'
      })
      return
    }
    try {
      setIsWorking(true)
      await fetchJson('/api/issues', {
        method: 'POST',
        body: JSON.stringify({
          type: issueType,
          message: issueNote.trim(),
          orderId: activeOrder?.id ?? null
        })
      })
      setIssueDialogOpen(false)
      setIssueNote('')
      toast({
        title: 'Issue sent',
        description: 'Dispatch has been notified.'
      })
    } catch (error) {
      toast({
        title: 'Issue failed',
        description: 'Please try again.'
      })
    } finally {
      setIsWorking(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const calculateDistance = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ) => {
    const R = 6371
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  const getOrderDistance = (order: Order) =>
    calculateDistance(
      order.pickupLat,
      order.pickupLng,
      order.deliveryLat,
      order.deliveryLng
    )

  const getOrderEta = (order: Order) => {
    if (typeof order.estimatedTime === 'number') {
      return order.estimatedTime
    }
    const distance = getOrderDistance(order)
    return Math.max(10, Math.round(distance * 6 + 8))
  }

  const formatDistance = (distance: number) => `${distance.toFixed(1)} km`
  const formatMeters = (meters: number) =>
    meters >= 1000
      ? `${(meters / 1000).toFixed(2)} km`
      : `${Math.round(meters)} m`
  const formatStepDistance = (distance: number) =>
    distance >= 1000
      ? `${(distance / 1000).toFixed(1)} km`
      : `${Math.max(1, Math.round(distance))} m`

  const standbyAction =
    effectiveStatus === 'BREAK' ? 'Resume driving' : 'Go online'

  const locationDetail = !driverId
    ? 'Log in to share your live position.'
    : locationStatus === 'granted'
      ? 'Sharing your live position with dispatch.'
      : locationStatus === 'denied'
        ? 'Permission blocked. Enable location in your browser settings.'
        : 'Enable location to appear on the live map.'

  const locationActionLabel =
    locationStatus === 'granted'
      ? 'Location active'
      : isRequestingLocation
        ? 'Requesting...'
        : 'Enable location'

  const selectedIssueOption = issueOptions.find(
    (option) => option.value === issueType
  )

  const pickupPoint = activeOrder
    ? { lat: activeOrder.pickupLat, lng: activeOrder.pickupLng }
    : null
  const dropoffPoint = activeOrder
    ? { lat: activeOrder.deliveryLat, lng: activeOrder.deliveryLng }
    : null
  const routeDestination =
    deliveryStage === 'DELIVERY' ? dropoffPoint : pickupPoint

  const pickupDistanceMeters =
    driverLocation && pickupPoint
      ? calculateDistance(
          driverLocation.lat,
          driverLocation.lng,
          pickupPoint.lat,
          pickupPoint.lng
        ) * 1000
      : null
  const dropoffDistanceMeters =
    driverLocation && dropoffPoint
      ? calculateDistance(
          driverLocation.lat,
          driverLocation.lng,
          dropoffPoint.lat,
          dropoffPoint.lng
        ) * 1000
      : null
  const canConfirmPickup =
    deliveryStage === 'PICKUP' &&
    pickupDistanceMeters !== null &&
    pickupDistanceMeters <= LOCATION_GEOFENCE_METERS
  const canConfirmDropoff =
    deliveryStage === 'DELIVERY' &&
    dropoffDistanceMeters !== null &&
    dropoffDistanceMeters <= LOCATION_GEOFENCE_METERS
  const canNavigateDelivery = deliveryStage === 'DELIVERY'
  const canCompleteDelivery = canConfirmDropoff

  useEffect(() => {
    if (!driverId) return
    if (typeof navigator === 'undefined') return
    if (!('geolocation' in navigator)) return
    if (!['ONLINE', 'ON_JOB'].includes(effectiveStatus)) return

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now()
        if (now - lastLocationPing.current < 15000) return
        lastLocationPing.current = now
        setDriverLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        })
        updateLocation(position.coords.latitude, position.coords.longitude)
      },
      () => {
        // Ignore errors; driver may deny location.
      },
      {
        enableHighAccuracy: true,
        maximumAge: 15000,
        timeout: 10000
      }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [driverId, effectiveStatus, updateLocation])

  const content = loading ? (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-pink-400"></div>
        <p className="text-sm uppercase tracking-[0.3em] text-white/60">
          Booting Driver OS
        </p>
      </div>
    </div>
  ) : (
    <>
      {jobAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <Card className="neon-card w-full max-w-lg border border-pink-500/40 text-white">
            <CardHeader className="flex flex-col gap-4 border-b border-white/10 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="display-font text-2xl text-pink-100">
                  Incoming drop
                </CardTitle>
                <Badge className="neon-chip uppercase tracking-[0.2em]">
                  Hot alert
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-white/70">
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-pink-200" />
                  {getOrderEta(jobAlert)} min
                </span>
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-pink-200" />
                  {formatDistance(getOrderDistance(jobAlert))}
                </span>
                <span className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-pink-200" />
                  {formatCurrency(jobAlert.driverPay)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                  Pickup
                </p>
                <div className="mt-2 flex items-start gap-2 text-sm text-white/70">
                  <Package className="mt-0.5 h-4 w-4 text-pink-200" />
                  <p>{jobAlert.pickupAddress}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                  Drop-off
                </p>
                <div className="mt-2 flex items-start gap-2 text-sm text-white/70">
                  <Navigation className="mt-0.5 h-4 w-4 text-pink-200" />
                  <p>{jobAlert.deliveryAddress}</p>
                </div>
              </div>
              {jobAlert.paymentType === 'CASH' && (
                <div className="flex items-center justify-between text-sm text-white/60">
                  <span>Order value (cash)</span>
                  <span>{formatCurrency(jobAlert.orderValue)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm text-white/60">
                <span>Delivery fee</span>
                <span>{formatCurrency(jobAlert.deliveryFee)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-white/60">
                <span>Payment</span>
                <span>{jobAlert.paymentType}</span>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  onClick={() => handleAcceptJob(jobAlert)}
                  className="neon-button flex-1"
                  disabled={isWorking}
                >
                  <CheckCircle className="h-4 w-4" />
                  Accept job
                </Button>
                <Button
                  onClick={handleRejectJob}
                  className="neon-outline flex-1"
                  variant="outline"
                  disabled={isWorking}
                >
                  <XCircle className="h-4 w-4" />
                  Decline
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <header className="px-4 pb-6 pt-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-pink-400/40 bg-black/40 p-2 shadow-[0_0_30px_rgba(255,0,122,0.35)]">
              <img
                src="/logo.svg"
                alt="Grilled Inc logo"
                className="h-full w-full object-contain drop-shadow-[0_0_18px_rgba(255,0,122,0.5)]"
              />
            </div>
            <div>
              <p className="display-font text-4xl text-pink-200">
                Grilled Inc
              </p>
              <p className="text-xs uppercase tracking-[0.4em] text-white/50">
                Driver OS 26
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Badge
              className={`rounded-full px-4 py-1 text-xs uppercase tracking-[0.3em] ${statusConfig[effectiveStatus].badgeClass}`}
              variant="outline"
            >
              {statusConfig[effectiveStatus].label}
            </Badge>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                Today
              </p>
              <p className="text-2xl font-semibold text-white">
                {driver ? formatCurrency(driver.totalEarnings) : '--'}
              </p>
            </div>
            <div className="hidden h-10 w-px bg-white/10 sm:block"></div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                Driver
              </p>
              <p className="text-lg font-semibold text-white">
                {driver?.name ?? 'Driver not linked'}
              </p>
              <div className="flex items-center gap-1 text-xs text-white/60">
                <Star className="h-3.5 w-3.5 text-pink-200" />
                {driver ? `${driver.rating.toFixed(1)} rating` : '--'}
              </div>
            </div>
            {driverId && (
              <Button
                type="button"
                onClick={handleDriverLogout}
                className="neon-outline"
                variant="outline"
                disabled={isLoggingOut}
              >
                <LogOut className="h-4 w-4" />
                {isLoggingOut ? 'Logging out...' : 'Log out'}
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 pb-12">
        {!driverId && (
          <Card className="neon-card text-white">
            <CardHeader className="border-b border-white/10 pb-4">
              <CardTitle className="display-font text-2xl text-pink-100">
                Driver login
              </CardTitle>
              <p className="text-sm text-white/60">
                Use the credentials created by your manager.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <form onSubmit={handleDriverLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white/70">Email</Label>
                  <Input
                    className="neon-field"
                    type="email"
                    autoComplete="email"
                    value={loginForm.email}
                    onChange={(event) =>
                      setLoginForm((prev) => ({
                        ...prev,
                        email: event.target.value
                      }))
                    }
                    placeholder="driver@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70">Password</Label>
                  <Input
                    className="neon-field"
                    type="password"
                    autoComplete="current-password"
                    value={loginForm.password}
                    onChange={(event) =>
                      setLoginForm((prev) => ({
                        ...prev,
                        password: event.target.value
                      }))
                    }
                    placeholder="********"
                  />
                </div>
                <Button
                  type="submit"
                  className="neon-button w-full"
                  disabled={isLoggingIn}
                >
                  {isLoggingIn ? 'Signing in...' : 'Sign in'}
                </Button>
              </form>
              <p className="text-xs text-white/50">
                You can also open a direct driver link from the manager dashboard.
              </p>
            </CardContent>
          </Card>
        )}
        <Card className="neon-card text-white">
          <CardContent className="p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div
                  className={`status-dot mt-2 h-3 w-3 rounded-full ${statusConfig[effectiveStatus].dotClass} ${
                    effectiveStatus === 'ONLINE' ? 'animate-glow' : ''
                  }`}
                ></div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                    Status
                  </p>
                  <p className="text-xl font-semibold text-white">
                    {statusConfig[effectiveStatus].label}
                  </p>
                  <p className="text-sm text-white/60">
                    {statusConfig[effectiveStatus].detail}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map((option) => {
                  const isActive = currentStatus === option.value
                  return (
                    <Button
                      key={option.value}
                      onClick={() => updateStatus(option.value)}
                      className={`rounded-full px-5 py-2 text-xs uppercase tracking-[0.3em] ${
                        isActive ? 'neon-button' : 'neon-outline'
                      }`}
                      variant="outline"
                      disabled={effectiveStatus === 'ON_JOB' || isWorking}
                    >
                      {option.label}
                    </Button>
                  )
                })}
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/40">
                  <MapPin className="h-4 w-4 text-pink-200" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                    Location sharing
                  </p>
                  <p className="text-sm text-white/70">{locationDetail}</p>
                </div>
              </div>
              <Button
                type="button"
                onClick={requestLocationPermission}
                className="neon-outline"
                variant="outline"
                disabled={
                  !driverId ||
                  locationStatus === 'granted' ||
                  isRequestingLocation
                }
              >
                {locationActionLabel}
              </Button>
            </div>
            {effectiveStatus === 'ON_JOB' && (
              <p className="mt-4 text-xs uppercase tracking-[0.3em] text-white/40">
                Finish the delivery to unlock status changes.
              </p>
            )}
            {effectiveStatus === 'ONLINE' && !activeOrder && (
              <div className="mt-6 space-y-2">
                <div className="flex flex-wrap items-center justify-between text-xs uppercase tracking-[0.3em] text-white/50">
                  <span>Live position</span>
                  <span>
                    {driverLocation
                      ? 'Tracking'
                      : locationStatus === 'granted'
                        ? 'Waiting for GPS'
                        : 'GPS off'}
                  </span>
                </div>
                <div className="h-52 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                  <DriverRouteMap
                    origin={driverLocation}
                    destination={null}
                  />
                </div>
                {!driverLocation && (
                  <p className="text-xs text-white/50">
                    Enable location sharing to show your live map.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {activeOrder ? (
          <Card className="neon-card text-white">
            <CardHeader className="border-b border-white/10 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <CardTitle className="display-font text-2xl text-pink-100">
                  Active delivery
                </CardTitle>
                <Badge className="neon-chip uppercase tracking-[0.2em]">
                  In flight
                </Badge>
              </div>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-white/70">
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-pink-200" />
                    {getOrderEta(activeOrder)} min ETA
                  </span>
                  <span className="flex items-center gap-2">
                    <Navigation className="h-4 w-4 text-pink-200" />
                    {routeEta
                      ? `${routeEta} min to ${
                          deliveryStage === 'DELIVERY' ? 'drop-off' : 'pickup'
                        }`
                      : 'Route syncing'}
                  </span>
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-pink-200" />
                    {formatDistance(getOrderDistance(activeOrder))}
                  </span>
                <span className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-pink-200" />
                  {formatCurrency(activeOrder.driverPay)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between text-xs uppercase tracking-[0.3em] text-white/50">
                  <span>Route preview</span>
                  <span>
                    {routeEta
                      ? `${routeEta} min to ${deliveryStage === 'DELIVERY' ? 'drop-off' : 'pickup'}`
                      : routeStatus === 'loading'
                        ? 'Loading route...'
                        : driverLocation
                          ? 'Route ready'
                          : 'GPS not shared'}
                  </span>
                </div>
                <div className="h-48 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                  <DriverRouteMap
                    origin={driverLocation}
                    destination={routeDestination}
                    pickup={pickupPoint}
                    dropoff={dropoffPoint}
                    onEtaChange={setRouteEta}
                    onRouteStatus={setRouteStatus}
                    onRouteSteps={setRouteSteps}
                  />
                </div>
                {routeSteps.length > 0 && (
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-white/70">
                    <p className="mb-2 text-[0.65rem] uppercase tracking-[0.3em] text-white/50">
                      Next directions
                    </p>
                    <div className="space-y-2">
                      {routeSteps.slice(0, 4).map((step, index) => (
                        <div
                          key={`${step.instruction}-${index}`}
                          className="flex items-start justify-between gap-3"
                        >
                          <span className="text-white/80">
                            {step.instruction}
                          </span>
                          <span className="text-white/50">
                            {formatStepDistance(step.distance)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                  <p className="text-xs text-white/50">
                    Enable location sharing to draw your live route.
                  </p>
              </div>
              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-4">
                  <div
                    className={`rounded-2xl border p-4 ${
                      deliveryStage === 'PICKUP'
                        ? 'border-pink-500/40 bg-pink-500/10'
                        : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                        Pickup
                      </p>
                      {deliveryStage === 'PICKUP' && (
                        <Badge className="neon-chip">Now</Badge>
                      )}
                    </div>
                    <div className="mt-3 flex items-start gap-2 text-sm text-white/70">
                      <MapPin className="mt-0.5 h-4 w-4 text-pink-200" />
                      <p>{activeOrder.pickupAddress}</p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        onClick={() =>
                          handleNavigate(
                            activeOrder.pickupAddress,
                            'pickup',
                            activeOrder.pickupLat,
                            activeOrder.pickupLng
                          )
                        }
                        className="neon-outline"
                        variant="outline"
                        disabled={isWorking}
                      >
                        <Navigation className="h-4 w-4" />
                        Navigate
                      </Button>
                      <Button
                        onClick={handlePickupComplete}
                        className="neon-button"
                        disabled={isWorking || !canConfirmPickup}
                      >
                        <CheckCircle className="h-4 w-4" />
                        Mark picked up
                      </Button>
                      {pickupDistanceMeters !== null && !canConfirmPickup && (
                        <p className="basis-full text-xs text-white/50">
                          Move within {LOCATION_GEOFENCE_METERS}m to confirm pickup
                          ({formatMeters(pickupDistanceMeters)} away).
                        </p>
                      )}
                    </div>
                  </div>

                  <div
                    className={`rounded-2xl border p-4 ${
                      deliveryStage === 'DELIVERY'
                        ? 'border-pink-500/40 bg-pink-500/10'
                        : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                        Delivery
                      </p>
                      {deliveryStage === 'DELIVERY' && (
                        <Badge className="neon-chip">Next</Badge>
                      )}
                    </div>
                    <div className="mt-3 flex items-start gap-2 text-sm text-white/70">
                      <Navigation className="mt-0.5 h-4 w-4 text-pink-200" />
                      <p>{activeOrder.deliveryAddress}</p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        onClick={handleNavigateDelivery}
                        className="neon-outline"
                        variant="outline"
                        disabled={isWorking || !canNavigateDelivery}
                      >
                        <Navigation className="h-4 w-4" />
                        Navigate
                      </Button>
                      <Button
                        onClick={handleCompleteDelivery}
                        className="neon-button"
                        disabled={isWorking || !canCompleteDelivery}
                      >
                        <CheckCircle className="h-4 w-4" />
                        Complete delivery
                      </Button>
                      {!canCompleteDelivery && (
                        <p className="basis-full text-xs text-white/50">
                          {deliveryStage !== 'DELIVERY'
                            ? 'Confirm pickup to unlock delivery completion.'
                            : `Move within ${LOCATION_GEOFENCE_METERS}m to complete drop-off${
                                dropoffDistanceMeters !== null
                                  ? ` (${formatMeters(dropoffDistanceMeters)} away)`
                                  : ''
                              }.`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                      Customer
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {activeOrder.customerName}
                    </p>
                    <p className="text-sm text-white/60">
                      {activeOrder.customerPhone}
                    </p>
                    <Button
                      onClick={() =>
                        handleCallCustomer(activeOrder.customerPhone)
                      }
                      className="neon-outline mt-4 w-full"
                      variant="outline"
                      disabled={isWorking}
                    >
                      <Phone className="h-4 w-4" />
                      Call customer
                    </Button>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                      Earnings
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-white">
                      {formatCurrency(activeOrder.driverPay)}
                    </p>
                    <div className="mt-3 space-y-2 text-sm text-white/60">
                      {activeOrder.paymentType === 'CASH' && (
                        <div className="flex items-center justify-between">
                          <span>Order value (cash)</span>
                          <span>{formatCurrency(activeOrder.orderValue)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span>Delivery fee</span>
                        <span>{formatCurrency(activeOrder.deliveryFee)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Payment</span>
                        <span>{activeOrder.paymentType}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleReportIssue}
                    className="neon-outline w-full"
                    variant="outline"
                    disabled={isWorking}
                  >
                    <AlertCircle className="h-4 w-4" />
                    Report issue
                  </Button>
                  <Button
                    onClick={handleCancelTrip}
                    className="neon-outline w-full border-red-400/60 text-red-200 hover:border-red-300 hover:text-red-100"
                    variant="outline"
                    disabled={isWorking}
                  >
                    <XCircle className="h-4 w-4" />
                    Cancel trip
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="neon-card text-white">
            <CardContent className="p-8 text-center">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-pink-500/30 bg-pink-500/10">
                <Package className="h-9 w-9 text-pink-200" />
              </div>
              <h3 className="display-font text-2xl text-white">
                {effectiveStatus === 'ONLINE'
                  ? 'Waiting for job requests'
                  : 'Ready when you are'}
              </h3>
              <p className="mt-2 text-sm text-white/60">
                {effectiveStatus === 'ONLINE'
                  ? 'Stay sharp. New drops will appear here with a neon alert.'
                  : 'Switch online to start receiving drops in your zone.'}
              </p>
              {effectiveStatus !== 'ONLINE' && (
                <Button
                  onClick={() => updateStatus('ONLINE')}
                  className="neon-button mt-6"
                  disabled={isWorking}
                >
                  {standbyAction}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="neon-card text-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-white/50">
                <span>Today</span>
                <DollarSign className="h-4 w-4 text-pink-200" />
              </div>
              <p className="mt-4 text-3xl font-semibold text-white">
                {driver ? formatCurrency(driver.totalEarnings) : '--'}
              </p>
            </CardContent>
          </Card>

          <Card className="neon-card text-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-white/50">
                <span>Total jobs</span>
                <Package className="h-4 w-4 text-pink-200" />
              </div>
              <p className="mt-4 text-3xl font-semibold text-white">
                {driver ? driver.totalJobs : '--'}
              </p>
            </CardContent>
          </Card>

          <Card className="neon-card text-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-white/50">
                <span>Rating</span>
                <Star className="h-4 w-4 text-pink-200" />
              </div>
              <p className="mt-4 text-3xl font-semibold text-white">
                {driver ? driver.rating.toFixed(1) : '--'}
              </p>
            </CardContent>
          </Card>

          <Card className="neon-card text-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-white/50">
                <span>This week</span>
                <TrendingUp className="h-4 w-4 text-pink-200" />
              </div>
              <p className="mt-4 text-3xl font-semibold text-white">
                {driver ? formatCurrency(driver.totalEarnings * 7) : '--'}
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog
        open={issueDialogOpen}
        onOpenChange={(open) => {
          setIssueDialogOpen(open)
          if (!open) {
            setIssueNote('')
          }
        }}
      >
        <DialogContent className="neon-panel border border-pink-500/40 text-white">
          <DialogHeader>
            <DialogTitle className="display-font text-xl sm:text-2xl text-pink-100">
              Report an issue
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-white/70">Issue type</Label>
              <select
                className="neon-field h-10 w-full rounded-md px-3 text-sm"
                value={issueType}
                onChange={(event) =>
                  setIssueType(event.target.value as IssueType)
                }
              >
                {issueOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {selectedIssueOption && (
                <p className="text-xs text-white/50">
                  {selectedIssueOption.detail}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">Notes (optional)</Label>
              <textarea
                className="neon-field min-h-[96px] w-full rounded-md p-3 text-sm"
                value={issueNote}
                onChange={(event) => setIssueNote(event.target.value)}
                placeholder="Add a quick note for dispatch..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="neon-outline"
              onClick={() => setIssueDialogOpen(false)}
              disabled={isWorking}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="neon-button"
              onClick={handleSubmitIssue}
              disabled={isWorking}
            >
              Send issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )

  return (
    <div className="driver-shell relative min-h-screen overflow-hidden bg-[#050207] text-white">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Grotesk:wght@400;500;600;700&display=swap');

        .driver-shell {
          --lip-pink: #ff2f9e;
          --lip-glow: rgba(255, 0, 122, 0.45);
          --lip-border: rgba(255, 92, 170, 0.32);
          font-family: 'Space Grotesk', sans-serif;
        }

        .driver-shell .display-font {
          font-family: 'Bebas Neue', 'Space Grotesk', sans-serif;
          letter-spacing: 0.12em;
        }

        .driver-shell .neon-card {
          background: rgba(8, 6, 14, 0.72);
          border: 1px solid var(--lip-border);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45),
            0 0 40px rgba(255, 0, 122, 0.12);
          backdrop-filter: blur(18px);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        @media (hover: hover) {
          .driver-shell .neon-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 22px 60px rgba(0, 0, 0, 0.5),
              0 0 45px rgba(255, 0, 122, 0.22);
          }
        }

        .driver-shell .neon-panel {
          background: rgba(8, 6, 14, 0.92);
          border: 1px solid var(--lip-border);
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.5),
            0 0 45px rgba(255, 0, 122, 0.18);
          backdrop-filter: blur(22px);
        }

        .driver-shell .neon-chip {
          background: rgba(255, 0, 122, 0.15);
          border: 1px solid rgba(255, 0, 122, 0.4);
          color: #ffd0e7;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        @media (hover: hover) {
          .driver-shell .neon-chip:hover {
            transform: translateY(-1px);
            box-shadow: 0 0 16px rgba(255, 0, 122, 0.35);
          }
        }

        .driver-shell .neon-outline {
          border: 1px solid rgba(255, 0, 122, 0.5);
          color: #ffd0e7;
          background: rgba(8, 6, 14, 0.35);
          transition: transform 0.15s ease, border-color 0.2s ease,
            box-shadow 0.2s ease;
        }

        .driver-shell .neon-outline:active {
          transform: translateY(1px) scale(0.98);
        }

        .driver-shell .neon-button {
          background: linear-gradient(
            135deg,
            #ff2f9e,
            #ff005c 60%,
            #ff67d9 100%
          );
          color: #0b040b;
          box-shadow: 0 12px 24px rgba(255, 0, 122, 0.35),
            0 0 20px rgba(255, 0, 122, 0.35);
          transition: transform 0.15s ease, box-shadow 0.2s ease;
        }

        .driver-shell .neon-button:hover {
          filter: brightness(1.05);
        }

        .driver-shell .neon-button:active {
          transform: translateY(1px) scale(0.98);
        }

        .driver-shell .status-dot {
          box-shadow: 0 0 10px rgba(255, 0, 122, 0.6);
        }

        .driver-shell .neon-field {
          background: rgba(12, 8, 20, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.25);
          color: #ffffff;
          box-shadow: inset 0 0 0 1px rgba(255, 0, 122, 0.12);
        }

        .driver-shell select.neon-field,
        .driver-shell select.neon-field option {
          background: rgba(12, 8, 20, 0.95);
          color: #ffffff;
        }

        .driver-shell .neon-field::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }

        .driver-shell .neon-field:focus {
          border-color: rgba(255, 0, 122, 0.7);
          box-shadow: 0 0 0 2px rgba(255, 0, 122, 0.3);
          outline: none;
        }

        @keyframes glowPulse {
          0%,
          100% {
            box-shadow: 0 0 10px rgba(255, 0, 122, 0.4);
          }
          50% {
            box-shadow: 0 0 20px rgba(255, 0, 122, 0.9);
          }
        }

        .driver-shell .animate-glow {
          animation: glowPulse 2.5s ease-in-out infinite;
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_-10%,_rgba(255,0,122,0.45),_transparent_55%),radial-gradient(circle_at_80%_10%,_rgba(255,120,200,0.3),_transparent_55%),linear-gradient(180deg,_#040107_0%,_#0b0714_45%,_#020104_100%)]"></div>
      <div className="pointer-events-none absolute -top-24 right-10 h-72 w-72 rounded-full bg-[rgba(255,0,122,0.2)] blur-3xl"></div>
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-[rgba(255,90,200,0.18)] blur-[140px]"></div>
      <div className="relative z-10">{content}</div>
    </div>
  )
}
