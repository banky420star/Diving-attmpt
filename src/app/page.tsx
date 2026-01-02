'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { ManagerLiveMap } from '@/components/manager-live-map'
import { useToast } from '@/hooks/use-toast'
import { DEFAULT_SETTINGS, type ManagerSettings } from '@/lib/settings'
import {
  playNotificationTone,
  requestNotificationPermission,
  sendBrowserNotification
} from '@/lib/notifications'
import {
  Users,
  Package,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  MapPin,
  Navigation,
  Phone,
  Car,
  Plus,
  Settings,
  LogOut,
  Copy,
  Link2,
  Trash2,
  Star,
  XCircle
} from 'lucide-react'

type DriverStatus = 'ONLINE' | 'OFFLINE' | 'ON_JOB' | 'BREAK'
type OrderStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'PICKED_UP'
  | 'EN_ROUTE'
  | 'DELIVERED'
  | 'CANCELLED'
type IssueStatus = 'OPEN' | 'RESOLVED'
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
  phone: string
  status: DriverStatus
  vehicleType: string
  rating: number
  totalEarnings: number
  totalJobs: number
  lastActiveAt?: string | null
  latitude?: number | null
  longitude?: number | null
  isActive?: boolean
  assignedOrders?: DriverAssignedOrder[]
}

interface AssignedDriver {
  id: string
  name: string
  phone: string
  vehicleType: string
  rating: number
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
  actualTime?: number | null
  status: OrderStatus
  assignedDriverId?: string | null
  assignedDriver?: AssignedDriver | null
  acceptedAt?: string | null
  pickedUpAt?: string | null
  deliveredAt?: string | null
  managerRating?: number | null
  createdAt: string
}

interface ClientProfile {
  id: string
  name: string
  phone: string
  pickupAddress: string
  pickupLat: number
  pickupLng: number
  deliveryAddress: string
  deliveryLat: number
  deliveryLng: number
  lastOrderAt: string
  totalOrders: number
}

interface DriverAssignedOrder {
  id: string
  status: OrderStatus
  customerName: string
  deliveryAddress: string
  pickupLat: number
  pickupLng: number
  deliveryLat: number
  deliveryLng: number
  estimatedTime?: number | null
  pickedUpAt?: string | null
  acceptedAt?: string | null
}

interface DriverIssue {
  id: string
  type: IssueType
  status: IssueStatus
  message?: string | null
  createdAt: string
  driver: { id: string; name: string; phone: string }
  order?: { id: string; customerName: string; deliveryAddress: string; status: OrderStatus } | null
}

interface Metrics {
  drivers: {
    total: number
    online: number
    onJob: number
    available: number
  }
  orders: {
    total: number
    today: number
    active: number
  }
  financial: {
    todayRevenue: number
    todayDeliveryFees: number
    todayDriverPayouts: number
    todayProfit: number
    averageMargin: number
    driverEarnings: number
  }
  performance: {
    onTimeRate: number
    averageDeliveryTime: number
  }
}

interface AdminSession {
  id: string
  name: string
  email: string
  phone?: string | null
  created?: boolean
}

interface AssignmentResponse {
  orderId: string
  recommendedDrivers: Array<{ id: string; name: string }>
  totalAvailable: number
}

const defaultOrderForm = {
  customerName: '',
  customerPhone: '',
  pickupAddress: '',
  pickupLat: '',
  pickupLng: '',
  deliveryAddress: '',
  deliveryLat: '',
  deliveryLng: '',
  orderValue: '',
  deliveryFee: '',
  driverPay: '',
  paymentType: 'EFT',
  notes: '',
  assignedDriverId: ''
}

const defaultDriverForm = {
  name: '',
  email: '',
  phone: '',
  vehicleType: 'CAR',
  vehiclePlate: '',
  password: ''
}

export default function Home() {
  const [isHydrated, setIsHydrated] = useState(false)
  useEffect(() => setIsHydrated(true), [])

  const [selectedTab, setSelectedTab] = useState('overview')
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [issues, setIssues] = useState<DriverIssue[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isWorking, setIsWorking] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null)
  const [settings, setSettings] = useState<ManagerSettings>(DEFAULT_SETTINGS)
  const [settingsForm, setSettingsForm] =
    useState<ManagerSettings>(DEFAULT_SETTINGS)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [orderDialogOpen, setOrderDialogOpen] = useState(false)
  const [driverDialogOpen, setDriverDialogOpen] = useState(false)
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [assignDriverId, setAssignDriverId] = useState('')
  const [orderForm, setOrderForm] = useState(defaultOrderForm)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [isGeocoding, setIsGeocoding] = useState({
    pickup: false,
    delivery: false
  })
  const [driverForm, setDriverForm] = useState(defaultDriverForm)
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const liveOrderIdsRef = useRef<Set<string>>(new Set())
  const issueIdsRef = useRef<Set<string>>(new Set())
  const hasLiveOrderSyncRef = useRef(false)
  const hasIssueSyncRef = useRef(false)
  const { toast } = useToast()

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
        setAdminSession(null)
        setMetrics(null)
        setOrders([])
        setDrivers([])
        setIssues([])
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('managerSession')
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

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem('managerSession')
    if (stored) {
      try {
        setAdminSession(JSON.parse(stored) as AdminSession)
      } catch (error) {
        window.localStorage.removeItem('managerSession')
      }
    }
  }, [])

  const loadSettings = useCallback(async () => {
    try {
      const data = await fetchJson<ManagerSettings>('/api/settings')
      setSettings(data)
      setSettingsForm(data)
    } catch (error) {
      toast({
        title: 'Settings unavailable',
        description: 'Using default settings for now.'
      })
    }
  }, [fetchJson, toast])

  const loadDashboard = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      try {
        if (mode === 'initial') {
          setIsLoading(true)
        }

        const [metricsData, ordersData, driversData, issuesData] = await Promise.all([
          fetchJson<Metrics>('/api/metrics'),
          fetchJson<Order[]>('/api/orders'),
          fetchJson<Driver[]>('/api/drivers'),
          fetchJson<DriverIssue[]>('/api/issues?status=all&limit=200')
        ])

        setMetrics(metricsData)
        setOrders(ordersData)
        setDrivers(driversData)
        setIssues(issuesData)
        setLastSyncAt(new Date())
      } catch (error) {
        toast({
          title: 'Unable to load dashboard',
          description: 'Check the server logs and try again.'
        })
      } finally {
        if (mode === 'initial') {
          setIsLoading(false)
        }
      }
    },
    [fetchJson, toast]
  )

  useEffect(() => {
    if (!adminSession) return
    loadSettings()
  }, [adminSession, loadSettings])

  useEffect(() => {
    if (!adminSession) return
    requestNotificationPermission()
  }, [adminSession])

  useEffect(() => {
    if (adminSession) return
    liveOrderIdsRef.current = new Set()
    issueIdsRef.current = new Set()
    hasLiveOrderSyncRef.current = false
    hasIssueSyncRef.current = false
  }, [adminSession])

  useEffect(() => {
    if (!adminSession) return
    loadDashboard('initial')
    const refreshMs = Math.max(5, settings.refreshSeconds) * 1000
    const timer = setInterval(() => {
      loadDashboard('refresh')
    }, refreshMs)

    return () => clearInterval(timer)
  }, [adminSession, loadDashboard, settings.refreshSeconds])

  const formatCurrency = (amount?: number) => {
    if (amount === undefined || amount === null) return '--'
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const formatNumber = (value?: number) => {
    if (value === undefined || value === null) return '--'
    return value.toLocaleString()
  }

  const getIssueLabel = (type: IssueType, message?: string | null) => {
    if (
      type === 'OTHER' &&
      typeof message === 'string' &&
      message.toLowerCase().includes('trip cancelled')
    ) {
      return 'Trip cancelled'
    }
    switch (type) {
      case 'CUSTOMER_NO_RESPONSE':
        return 'Client not responding'
      case 'ADDRESS_ISSUE':
        return 'Address issue'
      case 'VEHICLE_ISSUE':
        return 'Vehicle issue'
      case 'ACCIDENT':
        return 'Accident / incident'
      case 'PAYMENT_DISPUTE':
        return 'Payment dispute'
      default:
        return 'Other'
    }
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

  const getOrderEstimatedMinutes = (order: {
    pickupLat: number
    pickupLng: number
    deliveryLat: number
    deliveryLng: number
    estimatedTime?: number | null
  }) => {
    if (typeof order.estimatedTime === 'number' && order.estimatedTime > 0) {
      return order.estimatedTime
    }
    const distance = calculateDistance(
      order.pickupLat,
      order.pickupLng,
      order.deliveryLat,
      order.deliveryLng
    )
    return Math.max(10, Math.round(distance * 6 + 8))
  }

  const getDeliveryProgress = (order: DriverAssignedOrder) => {
    const startedAtValue = order.pickedUpAt ?? order.acceptedAt
    if (!startedAtValue) return null
    const startedAt = new Date(startedAtValue)
    if (Number.isNaN(startedAt.getTime())) return null
    const estimate = getOrderEstimatedMinutes(order)
    const elapsedMinutes = Math.max(
      0,
      Math.round((Date.now() - startedAt.getTime()) / 60000)
    )
    const etaMinutes = Math.max(0, estimate - elapsedMinutes)
    const progress = Math.min(100, Math.max(0, (elapsedMinutes / estimate) * 100))
    return { etaMinutes, progress }
  }

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'ONLINE':
        return 'bg-emerald-400'
      case 'ON_JOB':
        return 'bg-pink-400'
      case 'OFFLINE':
        return 'bg-white/30'
      case 'BREAK':
        return 'bg-amber-400'
      default:
        return 'bg-white/30'
    }
  }

  const getOrderBadgeClass = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'border-amber-400/50 text-amber-200 bg-amber-500/15'
      case 'ASSIGNED':
        return 'border-sky-400/50 text-sky-200 bg-sky-500/15'
      case 'ACCEPTED':
        return 'border-indigo-400/50 text-indigo-200 bg-indigo-500/15'
      case 'PICKED_UP':
        return 'border-fuchsia-400/50 text-fuchsia-200 bg-fuchsia-500/15'
      case 'EN_ROUTE':
        return 'border-pink-400/50 text-pink-200 bg-pink-500/20'
      case 'DELIVERED':
        return 'border-emerald-400/50 text-emerald-200 bg-emerald-500/15'
      default:
        return 'border-white/20 text-white/70 bg-white/5'
    }
  }

  const formatLastActive = (value?: string | null) => {
    if (!value) return 'No ping yet'
    const lastSeen = new Date(value)
    if (Number.isNaN(lastSeen.getTime())) return 'Unknown'
    const diffMinutes = Math.round((Date.now() - lastSeen.getTime()) / 60000)
    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    const diffHours = Math.round(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return lastSeen.toLocaleDateString('en-ZA', {
      day: '2-digit',
      month: 'short'
    })
  }

  const formatIssueTime = (value: string) => {
    const timestamp = new Date(value)
    if (Number.isNaN(timestamp.getTime())) return '--'
    return timestamp.toLocaleTimeString('en-ZA', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatLocation = (driver: Driver) => {
    if (driver.latitude == null || driver.longitude == null) {
      return 'Location pending'
    }
    return `${driver.latitude.toFixed(4)}, ${driver.longitude.toFixed(4)}`
  }

  const renderRatingStars = (rating: number) => {
    const safeRating = Number.isFinite(rating) ? Math.min(5, Math.max(0, rating)) : 0
    const filledStars = Math.round(safeRating)
    return (
      <div className="flex items-center gap-1" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((value) => (
          <Star
            key={value}
            className={`h-3.5 w-3.5 ${
              value <= filledStars ? 'text-amber-300' : 'text-white/25'
            }`}
            fill={value <= filledStars ? 'currentColor' : 'none'}
          />
        ))}
      </div>
    )
  }

  const todayOrders = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    return orders.filter((order) => {
      const created = new Date(order.createdAt).getTime()
      return Number.isFinite(created) && created >= start.getTime()
    })
  }, [orders])

  const liveOrders = useMemo(
    () =>
      todayOrders.filter((order) =>
        ['PENDING', 'ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'EN_ROUTE'].includes(
          order.status
        )
      ),
    [todayOrders]
  )
  const recentLiveOrders = useMemo(
    () => liveOrders.slice(0, 5),
    [liveOrders]
  )
  const openIssues = useMemo(
    () => issues.filter((issue) => issue.status === 'OPEN'),
    [issues]
  )
  const highlightedIssues = useMemo(
    () => openIssues.slice(0, 4),
    [openIssues]
  )
  const availableDrivers = useMemo(
    () =>
      drivers.filter(
        (driver) => driver.status === 'ONLINE' && driver.isActive !== false
      ),
    [drivers]
  )
  const liveDriverDetails = useMemo(() => {
    return drivers
      .filter((driver) => driver.isActive !== false)
      .map((driver) => {
        const activeOrder = todayOrders.find(
          (order) =>
            order.assignedDriverId === driver.id &&
            ['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'EN_ROUTE'].includes(
              order.status
            )
        )
        return { driver, activeOrder }
      })
  }, [drivers, todayOrders])
  const mapDrivers = useMemo(
    () =>
      drivers.filter(
        (driver) =>
          driver.isActive !== false &&
          Number.isFinite(driver.latitude ?? NaN) &&
          Number.isFinite(driver.longitude ?? NaN)
      ),
    [drivers]
  )
  const mapOrders = useMemo(
    () =>
      todayOrders
        .filter((order) =>
          ['PENDING', 'ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'EN_ROUTE'].includes(
            order.status
          )
        )
        .slice(0, 5),
    [todayOrders]
  )

  const clientDirectory = useMemo(() => {
    const byPhone = new Map<string, ClientProfile>()
    orders.forEach((order) => {
      const phone = order.customerPhone?.trim()
      if (!phone) return
      const existing = byPhone.get(phone)
      const createdAt = order.createdAt
      if (!existing) {
        byPhone.set(phone, {
          id: phone,
          name: order.customerName,
          phone,
          pickupAddress: order.pickupAddress,
          pickupLat: order.pickupLat,
          pickupLng: order.pickupLng,
          deliveryAddress: order.deliveryAddress,
          deliveryLat: order.deliveryLat,
          deliveryLng: order.deliveryLng,
          lastOrderAt: createdAt,
          totalOrders: 1
        })
        return
      }
      const isNewer =
        new Date(createdAt).getTime() >
        new Date(existing.lastOrderAt).getTime()
      byPhone.set(phone, {
        ...existing,
        name: isNewer ? order.customerName : existing.name,
        pickupAddress: isNewer ? order.pickupAddress : existing.pickupAddress,
        pickupLat: isNewer ? order.pickupLat : existing.pickupLat,
        pickupLng: isNewer ? order.pickupLng : existing.pickupLng,
        deliveryAddress: isNewer
          ? order.deliveryAddress
          : existing.deliveryAddress,
        deliveryLat: isNewer ? order.deliveryLat : existing.deliveryLat,
        deliveryLng: isNewer ? order.deliveryLng : existing.deliveryLng,
        lastOrderAt: isNewer ? createdAt : existing.lastOrderAt,
        totalOrders: existing.totalOrders + 1
      })
    })

    return Array.from(byPhone.values()).sort(
      (a, b) =>
        new Date(b.lastOrderAt).getTime() -
        new Date(a.lastOrderAt).getTime()
    )
  }, [orders])

  const issuesByOrderId = useMemo(() => {
    const map = new Map<string, DriverIssue[]>()
    issues.forEach((issue) => {
      const orderId = issue.order?.id
      if (!orderId) return
      const bucket = map.get(orderId) ?? []
      bucket.push(issue)
      map.set(orderId, bucket)
    })
    return map
  }, [issues])

  const driverPayoutSummaries = useMemo(() => {
    const driverMap = new Map(drivers.map((driver) => [driver.id, driver]))
    const summaries = new Map<
      string,
      {
        driver: Driver
        totalPay: number
        trips: Array<{
          id: string
          label: string
          payout: number
          completionMinutes: number | null
          delayMinutes: number | null
          issuesCount: number
          deliveredAt?: string | null
        }>
      }
    >()

    orders
      .filter((order) => order.status === 'DELIVERED' && order.assignedDriverId)
      .forEach((order) => {
        const driverId = order.assignedDriverId as string
        const driver = driverMap.get(driverId)
        if (!driver) return

        const startAt =
          order.acceptedAt ?? order.pickedUpAt ?? order.createdAt ?? null
        const endAt = order.deliveredAt ?? null
        const completionMinutes =
          typeof order.actualTime === 'number' && order.actualTime > 0
            ? order.actualTime
            : startAt && endAt
              ? Math.max(
                  1,
                  Math.round(
                    (new Date(endAt).getTime() - new Date(startAt).getTime()) /
                      60000
                  )
                )
              : null
        const delayMinutes =
          completionMinutes && order.estimatedTime
            ? Math.max(0, completionMinutes - order.estimatedTime)
            : null

        const issuesCount = issuesByOrderId.get(order.id)?.length ?? 0
        const destinationLabel = order.deliveryAddress.split(',')[0]?.trim()
        const tripLabel = destinationLabel
          ? `Trip to ${destinationLabel}`
          : 'Trip'

        const existing = summaries.get(driverId)
        const nextTrip = {
          id: order.id,
          label: tripLabel,
          payout: order.driverPay ?? 0,
          completionMinutes,
          delayMinutes,
          issuesCount,
          deliveredAt: order.deliveredAt
        }

        if (existing) {
          existing.totalPay += order.driverPay ?? 0
          existing.trips.push(nextTrip)
        } else {
          summaries.set(driverId, {
            driver,
            totalPay: order.driverPay ?? 0,
            trips: [nextTrip]
          })
        }
      })

    return Array.from(summaries.values()).map((summary) => ({
      ...summary,
      trips: summary.trips.sort((a, b) => {
        const aTime = a.deliveredAt ? new Date(a.deliveredAt).getTime() : 0
        const bTime = b.deliveredAt ? new Date(b.deliveredAt).getTime() : 0
        return bTime - aTime
      })
    }))
  }, [drivers, orders, issuesByOrderId])

  const driverAnalytics = useMemo(() => {
    const activeStatuses = new Set([
      'PENDING',
      'ASSIGNED',
      'ACCEPTED',
      'PICKED_UP',
      'EN_ROUTE'
    ])
    const issuesByDriver = new Map<string, number>()
    issues.forEach((issue) => {
      const driverId = issue.driver?.id
      if (!driverId) return
      issuesByDriver.set(driverId, (issuesByDriver.get(driverId) ?? 0) + 1)
    })

    const driverMap = new Map(
      drivers.map((driver) => [
        driver.id,
        {
          driver,
          deliveredTrips: 0,
          activeTrips: 0,
          earnings: 0,
          completionTimes: [] as number[],
          onTimeCount: 0,
          onTimeTotal: 0
        }
      ])
    )

    orders.forEach((order) => {
      const driverId = order.assignedDriverId
      if (!driverId) return
      const entry = driverMap.get(driverId)
      if (!entry) return

      if (activeStatuses.has(order.status)) {
        entry.activeTrips += 1
      }

      if (order.status === 'DELIVERED') {
        entry.deliveredTrips += 1
        entry.earnings += order.driverPay ?? 0
        const completionMinutes =
          typeof order.actualTime === 'number' && order.actualTime > 0
            ? order.actualTime
            : order.deliveredAt
              ? Math.max(
                  1,
                  Math.round(
                    (new Date(order.deliveredAt).getTime() -
                      new Date(
                        order.acceptedAt ??
                          order.pickedUpAt ??
                          order.createdAt
                      ).getTime()) /
                      60000
                  )
                )
              : null
        if (completionMinutes) {
          entry.completionTimes.push(completionMinutes)
          if (order.estimatedTime) {
            entry.onTimeTotal += 1
            if (completionMinutes <= order.estimatedTime) {
              entry.onTimeCount += 1
            }
          }
        }
      }
    })

    return Array.from(driverMap.values())
      .map((entry) => {
        const avgDeliveryMinutes = entry.completionTimes.length
          ? Math.round(
              entry.completionTimes.reduce((sum, value) => sum + value, 0) /
                entry.completionTimes.length
            )
          : null
        const onTimeRate = entry.onTimeTotal
          ? Math.round((entry.onTimeCount / entry.onTimeTotal) * 100)
          : null
        return {
          driver: entry.driver,
          deliveredTrips: entry.deliveredTrips,
          activeTrips: entry.activeTrips,
          earnings: entry.earnings,
          avgDeliveryMinutes,
          onTimeRate,
          issuesCount: issuesByDriver.get(entry.driver.id) ?? 0
        }
      })
      .sort((a, b) => b.deliveredTrips - a.deliveredTrips)
  }, [drivers, orders, issues])

  const ratingSummary = useMemo(() => {
    const ratings = orders
      .map((order) => order.managerRating)
      .filter((rating): rating is number => typeof rating === 'number')
    const counts = [0, 0, 0, 0, 0, 0]
    ratings.forEach((rating) => {
      if (rating >= 1 && rating <= 5) {
        counts[rating] += 1
      }
    })
    const total = ratings.length
    const average = total
      ? ratings.reduce((sum, rating) => sum + rating, 0) / total
      : null
    return { average, total, counts }
  }, [orders])

  const applyClientProfile = useCallback((client: ClientProfile) => {
    setOrderForm((prev) => ({
      ...prev,
      customerName: client.name,
      customerPhone: client.phone,
      pickupAddress: client.pickupAddress,
      pickupLat: String(client.pickupLat),
      pickupLng: String(client.pickupLng),
      deliveryAddress: client.deliveryAddress,
      deliveryLat: String(client.deliveryLat),
      deliveryLng: String(client.deliveryLng)
    }))
    setSelectedClientId(client.id)
  }, [])

  const handleOpenOrderDialog = () => {
    setSelectedTab('orders')
    setOrderForm(defaultOrderForm)
    setSelectedClientId('')
    setOrderDialogOpen(true)
  }

  const handleUseClient = (client: ClientProfile) => {
    setSelectedTab('orders')
    setOrderDialogOpen(true)
    applyClientProfile(client)
  }

  const handleOpenDriverDialog = () => {
    setSelectedTab('drivers')
    setDriverDialogOpen(true)
  }

  const handleViewOrder = (order: Order) => {
    setSelectedTab('orders')
    setSelectedOrder(order)
    setAssignDriverId(order.assignedDriverId || '')
    setOrderDetailsOpen(true)
  }

  const handleCallDriver = (phone: string) => {
    if (typeof window !== 'undefined') {
      window.open(`tel:${phone}`)
    }
    toast({
      title: 'Calling driver',
      description: phone
    })
  }

  const handleSettings = () => {
    setSettingsDialogOpen(true)
  }

  const handleLogin = async (event: React.FormEvent) => {
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
      const session = await fetchJson<AdminSession>('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({
          email: loginForm.email.trim(),
          password: loginForm.password.trim()
        })
      })
      setAdminSession(session)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('managerSession', JSON.stringify(session))
      }
      setLoginForm({ email: '', password: '' })
      toast({
        title: session.created ? 'Admin created' : 'Welcome back',
        description: session.name ? `Signed in as ${session.name}.` : 'Signed in.'
      })
    } catch (error) {
      toast({
        title: 'Login failed',
        description: 'Check your credentials and try again.'
      })
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include'
      })
    } catch (error) {
      // Ignore logout failures to ensure UI resets.
    }
    setAdminSession(null)
    setMetrics(null)
    setOrders([])
    setDrivers([])
    setIssues([])
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('managerSession')
    }
    toast({
      title: 'Logged out',
      description: 'Manager session cleared.'
    })
  }

  const handleSaveSettings = async () => {
    try {
      setIsWorking(true)
      const updated = await fetchJson<ManagerSettings>('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: settingsForm })
      })
      setSettings(updated)
      setSettingsForm(updated)
      setSettingsDialogOpen(false)
      toast({
        title: 'Settings updated',
        description: 'Live ops parameters are now synced.'
      })
    } catch (error) {
      toast({
        title: 'Settings failed',
        description: 'Please try again.'
      })
    } finally {
      setIsWorking(false)
    }
  }

  useEffect(() => {
    if (!adminSession) return
    const liveIds = new Set(liveOrders.map((order) => order.id))
    if (!hasLiveOrderSyncRef.current) {
      liveOrderIdsRef.current = liveIds
      hasLiveOrderSyncRef.current = true
      return
    }
    const newOrders = liveOrders.filter(
      (order) => !liveOrderIdsRef.current.has(order.id)
    )
    if (newOrders.length > 0) {
      playNotificationTone('order')
      const message =
        newOrders.length === 1
          ? `${newOrders[0].customerName} · ${newOrders[0].pickupAddress}`
          : `${newOrders.length} new trips ready to assign`
      sendBrowserNotification('New trip available', message)
      toast({
        title: 'New trip available',
        description: message
      })
    }
    liveOrderIdsRef.current = liveIds
  }, [adminSession, liveOrders, toast])

  useEffect(() => {
    if (!adminSession) return
    const issueIds = new Set(openIssues.map((issue) => issue.id))
    if (!hasIssueSyncRef.current) {
      issueIdsRef.current = issueIds
      hasIssueSyncRef.current = true
      return
    }
    const newIssues = openIssues.filter(
      (issue) => !issueIdsRef.current.has(issue.id)
    )
    if (newIssues.length > 0) {
      playNotificationTone('issue')
      const message =
        newIssues.length === 1
          ? `${newIssues[0].driver.name} · ${getIssueLabel(
              newIssues[0].type,
              newIssues[0].message
            )}`
          : `${newIssues.length} new driver issues`
      sendBrowserNotification('Driver issue reported', message)
      const issueId = newIssues[0]?.id
      toast({
        title: 'Driver issue reported',
        description: message,
        action: issueId
          ? {
              label: 'View',
              onClick: () => {
                setSelectedTab('drivers')
                setTimeout(() => {
                  const el = document.querySelector(
                    `[data-issue-id="${issueId}"]`
                  ) as HTMLElement | null
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }, 50)
              }
            }
          : undefined
      })
    }
    issueIdsRef.current = issueIds
  }, [adminSession, openIssues, toast])

  const buildDriverLink = (driverId: string) => {
    if (typeof window === 'undefined') return `/driver?driverId=${driverId}`
    return `${window.location.origin}/driver?driverId=${driverId}`
  }

  const handleOpenDriverApp = (driverId: string) => {
    const url = buildDriverLink(driverId)
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
    toast({
      title: 'Opening driver app',
      description: 'Sharing live driver view.'
    })
  }

  const handleViewIssueOrder = (orderId?: string | null) => {
    if (!orderId) return
    const order = orders.find((item) => item.id === orderId)
    if (!order) {
      toast({
        title: 'Order not loaded',
        description: 'Refresh the dashboard to see the latest order.'
      })
      return
    }
    handleViewOrder(order)
  }

  const handleRemoveDriver = async (driver: Driver) => {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        `Remove ${driver.name}? This disables their login and unassigns active orders.`
      )
      if (!confirmed) return
    }

    try {
      setIsWorking(true)
      const removed = await fetchJson<{
        id: string
        name: string
        unassignedOrders: number
      }>(`/api/drivers/${driver.id}`, {
        method: 'DELETE'
      })
      toast({
        title: 'Driver removed',
        description:
          removed.unassignedOrders > 0
            ? `Unassigned ${removed.unassignedOrders} active order(s).`
            : 'Driver access disabled.'
      })
      await loadDashboard('refresh')
    } catch (error) {
      toast({
        title: 'Remove failed',
        description: 'Please try again.'
      })
    } finally {
      setIsWorking(false)
    }
  }

  const handleCopyDriverLink = async (driverId: string) => {
    const url = buildDriverLink(driverId)
    if (typeof window === 'undefined') return

    const fallbackCopy = () => {
      try {
        const textarea = document.createElement('textarea')
        textarea.value = url
        textarea.setAttribute('readonly', 'true')
        textarea.style.position = 'absolute'
        textarea.style.left = '-9999px'
        document.body.appendChild(textarea)
        textarea.select()
        const copied = document.execCommand('copy')
        document.body.removeChild(textarea)
        return copied
      } catch (error) {
        return false
      }
    }

    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(url)
        toast({
          title: 'Driver link copied',
          description: url
        })
        return
      }
    } catch (error) {
      // Fall back below.
    }

    if (fallbackCopy()) {
      toast({
        title: 'Driver link copied',
        description: url
      })
      return
    }

    window.prompt('Copy driver link', url)
    toast({
      title: 'Copy link',
      description: 'Paste the link into WhatsApp or Notes.'
    })
  }

  const buildWazeLinks = (address: string, lat?: number, lng?: number) => {
    const params =
      lat !== undefined && lng !== undefined
        ? `ll=${lat},${lng}&navigate=yes`
        : `q=${encodeURIComponent(address)}&navigate=yes`
    return {
      app: `waze://?${params}`,
      web: `https://waze.com/ul?${params}`
    }
  }

  const handleOpenWaze = (
    address: string,
    label: string,
    lat?: number,
    lng?: number
  ) => {
    const links = buildWazeLinks(address, lat, lng)
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return
    }
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
    toast({
      title: `Opening ${label} in Waze`,
      description: address
    })
  }

  const handleGeocodeAddress = async (type: 'pickup' | 'delivery') => {
    const address =
      type === 'pickup' ? orderForm.pickupAddress : orderForm.deliveryAddress

    if (!address.trim()) {
      toast({
        title: 'Enter an address',
        description: 'Type the address first, then auto-fill coordinates.'
      })
      return
    }

    try {
      setIsGeocoding((prev) => ({ ...prev, [type]: true }))
      const params = new URLSearchParams({
        q: address.trim(),
        format: 'json',
        limit: '1'
      })
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`
      )

      if (!response.ok) {
        throw new Error('Address lookup failed')
      }

      const results = (await response.json()) as Array<{
        lat: string
        lon: string
        display_name?: string
      }>

      if (!results.length) {
        throw new Error('No matching address found')
      }

      const best = results[0]
      setOrderForm((prev) => ({
        ...prev,
        ...(type === 'pickup'
          ? {
              pickupLat: best.lat,
              pickupLng: best.lon,
              pickupAddress: best.display_name ?? prev.pickupAddress
            }
          : {
              deliveryLat: best.lat,
              deliveryLng: best.lon,
              deliveryAddress: best.display_name ?? prev.deliveryAddress
            })
      }))

      toast({
        title: 'Coordinates filled',
        description: `Updated ${type} latitude and longitude.`
      })
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Unable to find that address.'
      toast({
        title: 'Address lookup failed',
        description: message
      })
    } finally {
      setIsGeocoding((prev) => ({ ...prev, [type]: false }))
    }
  }

  const handleOpenDriverWaze = (driver: Driver) => {
    if (driver.latitude == null || driver.longitude == null) {
      toast({
        title: 'Location pending',
        description: 'Driver has not shared a live location yet.'
      })
      return
    }
    handleOpenWaze(
      formatLocation(driver),
      'driver location',
      driver.latitude,
      driver.longitude
    )
  }

  const handleCreateOrder = async (event: React.FormEvent) => {
    event.preventDefault()

    const manualAssignedDriverId = orderForm.assignedDriverId.trim()
    const payload = {
      customerName: orderForm.customerName.trim(),
      customerPhone: orderForm.customerPhone.trim(),
      pickupAddress: orderForm.pickupAddress.trim(),
      pickupLat: Number(orderForm.pickupLat),
      pickupLng: Number(orderForm.pickupLng),
      deliveryAddress: orderForm.deliveryAddress.trim(),
      deliveryLat: Number(orderForm.deliveryLat),
      deliveryLng: Number(orderForm.deliveryLng),
      orderValue: Number(orderForm.orderValue),
      paymentType: orderForm.paymentType
    } as Record<string, unknown>

    if (!payload.customerName || !payload.customerPhone) {
      toast({
        title: 'Missing details',
        description: 'Customer name and phone are required.'
      })
      return
    }

    if (
      Number.isNaN(payload.pickupLat) ||
      Number.isNaN(payload.pickupLng) ||
      Number.isNaN(payload.deliveryLat) ||
      Number.isNaN(payload.deliveryLng)
    ) {
      toast({
        title: 'Invalid coordinates',
        description: 'Enter pickup and delivery lat/lng.'
      })
      return
    }

    if (Number.isNaN(payload.orderValue)) {
      toast({
        title: 'Missing order value',
        description: 'Enter the order total.'
      })
      return
    }

    const deliveryFeeValue = Number(orderForm.deliveryFee)
    if (!orderForm.deliveryFee.trim() || Number.isNaN(deliveryFeeValue)) {
      toast({
        title: 'Trip price required',
        description: 'Enter the delivery fee for this trip.'
      })
      return
    }

    payload.deliveryFee = deliveryFeeValue

    if (orderForm.driverPay) {
      payload.driverPay = Number(orderForm.driverPay)
    }

    if (orderForm.notes.trim()) {
      payload.notes = orderForm.notes.trim()
    }
    if (manualAssignedDriverId) {
      payload.assignedDriverId = manualAssignedDriverId
      payload.status = 'ASSIGNED'
    }

    try {
      setIsWorking(true)
      const createdOrder = await fetchJson<Order>('/api/orders', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      if (settings.autoAssign && !manualAssignedDriverId) {
        try {
          const assignment = await fetchJson<AssignmentResponse>('/api/assign', {
            method: 'POST',
            body: JSON.stringify({ orderId: createdOrder.id, notifyCount: 1 })
          })
          const candidate = assignment.recommendedDrivers[0]
          if (candidate) {
            await fetchJson<Order>(`/api/orders/${createdOrder.id}`, {
              method: 'PUT',
              body: JSON.stringify({
                status: 'ASSIGNED',
                assignedDriverId: candidate.id
              })
            })
          }
        } catch (error) {
          toast({
            title: 'Auto-assign failed',
            description: 'Order created but not assigned.'
          })
        }
      }
      toast({
        title: 'Order created',
        description: 'Drivers can now see this request.'
      })
      setOrderDialogOpen(false)
      setOrderForm(defaultOrderForm)
      await loadDashboard('refresh')
    } catch (error) {
      toast({
        title: 'Order failed',
        description: 'Please check the details and try again.'
      })
    } finally {
      setIsWorking(false)
    }
  }

  const handleCreateDriver = async (event: React.FormEvent) => {
    event.preventDefault()

    const payload = {
      name: driverForm.name.trim(),
      email: driverForm.email.trim(),
      phone: driverForm.phone.trim(),
      vehicleType: driverForm.vehicleType,
      vehiclePlate: driverForm.vehiclePlate.trim() || undefined,
      password: driverForm.password.trim()
    }

    if (!payload.name || !payload.email || !payload.phone || !payload.password) {
      toast({
        title: 'Missing details',
        description: 'Name, email, phone, and password are required.'
      })
      return
    }

    try {
      setIsWorking(true)
      await fetchJson<Driver>('/api/drivers', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      toast({
        title: 'Driver added',
        description: `${payload.name} is ready to log in.`
      })
      setDriverDialogOpen(false)
      setDriverForm(defaultDriverForm)
      await loadDashboard('refresh')
    } catch (error) {
      toast({
        title: 'Driver create failed',
        description: 'Check the email and try again.'
      })
    } finally {
      setIsWorking(false)
    }
  }

  const handleAssignDriver = async () => {
    if (!selectedOrder || !assignDriverId) {
      toast({
        title: 'Choose a driver',
        description: 'Select a driver to assign this order.'
      })
      return
    }

    try {
      setIsWorking(true)
      await fetchJson<Order>(`/api/orders/${selectedOrder.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'ASSIGNED',
          assignedDriverId: assignDriverId
        })
      })
      try {
        playNotificationTone('accept')
      } catch {}
      toast({
        title: 'Driver assigned',
        description: 'The driver app will receive this job.'
      })
      setOrderDetailsOpen(false)
      setSelectedOrder(null)
      await loadDashboard('refresh')
    } catch (error) {
      toast({
        title: 'Assignment failed',
        description: 'Please try again.'
      })
    } finally {
      setIsWorking(false)
    }
  }

  const handleCancelOrder = async () => {
    if (!selectedOrder) return
    if (['DELIVERED', 'CANCELLED'].includes(selectedOrder.status)) {
      toast({
        title: 'Order closed',
        description: 'Completed orders cannot be cancelled.'
      })
      return
    }
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        'Cancel this order? The driver will be notified.'
      )
      if (!confirmed) return
    }
    try {
      setIsWorking(true)
      await fetchJson<Order>(`/api/orders/${selectedOrder.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'CANCELLED'
        })
      })
      try {
        playNotificationTone('decline')
      } catch {}
      toast({
        title: 'Order cancelled',
        description: 'The trip has been closed.'
      })
      setOrderDetailsOpen(false)
      setSelectedOrder(null)
      await loadDashboard('refresh')
    } catch (error) {
      toast({
        title: 'Cancel failed',
        description: 'Please try again.'
      })
    } finally {
      setIsWorking(false)
    }
  }

  const handleRateDriver = async (order: Order, rating: number) => {
    if (!order.assignedDriverId) return
    if (order.status !== 'DELIVERED') {
      toast({
        title: 'Complete the delivery first',
        description: 'Driver ratings are only for delivered orders.'
      })
      return
    }
    try {
      setIsWorking(true)
      const updated = await fetchJson<Order>(`/api/orders/${order.id}`, {
        method: 'PUT',
        body: JSON.stringify({ managerRating: rating })
      })
      setOrders((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      )
      if (selectedOrder?.id === updated.id) {
        setSelectedOrder(updated)
      }
      toast({
        title: 'Driver rated',
        description: `Rating saved: ${rating} star${rating === 1 ? '' : 's'}.`
      })
      await loadDashboard('refresh')
    } catch (error) {
      toast({
        title: 'Rating failed',
        description: 'Please try again.'
      })
    } finally {
      setIsWorking(false)
    }
  }

  const handleResolveIssue = async (issueId: string) => {
    try {
      setIsWorking(true)
      await fetchJson<DriverIssue>(`/api/issues/${issueId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'RESOLVED' })
      })
      toast({
        title: 'Issue resolved',
        description: 'Dispatch log updated.'
      })
      await loadDashboard('refresh')
    } catch (error) {
      toast({
        title: 'Resolve failed',
        description: 'Please try again.'
      })
    } finally {
      setIsWorking(false)
    }
  }

  const loginContent = (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="neon-card w-full max-w-md text-white">
        <CardHeader className="flex flex-col gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-4">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-pink-400/40 bg-black/40 p-2 shadow-[0_0_24px_rgba(255,0,122,0.35)]">
              <img
                src="/logo.svg"
                alt="Grilled Inc logo"
                className="h-full w-full object-contain drop-shadow-[0_0_18px_rgba(255,0,122,0.5)]"
              />
            </div>
            <div>
              <p className="display-font text-3xl text-pink-200">
                Grilled Inc
              </p>
              <p className="text-xs uppercase tracking-[0.4em] text-white/50">
                Manager OS 26
              </p>
            </div>
          </div>
          <p className="text-sm text-white/60">
            Sign in to manage live orders, drivers, and dispatch.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          <form onSubmit={handleLogin} className="space-y-4">
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
                placeholder="manager@grilled.co.za"
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
            The first two unique logins create manager accounts automatically.
          </p>
        </CardContent>
      </Card>
    </div>
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

        .neon-card {
          background: rgba(8, 6, 14, 0.72);
          border: 1px solid var(--lip-border);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45),
            0 0 40px rgba(255, 0, 122, 0.12);
          backdrop-filter: blur(18px);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        @media (hover: hover) {
          .neon-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 22px 60px rgba(0, 0, 0, 0.5),
              0 0 45px rgba(255, 0, 122, 0.22);
          }
        }

        .neon-panel {
          background: rgba(8, 6, 14, 0.92);
          border: 1px solid var(--lip-border);
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.5),
            0 0 45px rgba(255, 0, 122, 0.18);
          backdrop-filter: blur(22px);
        }

        .neon-nav {
          background: rgba(8, 6, 14, 0.9);
          border: 1px solid var(--lip-border);
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45),
            0 0 35px rgba(255, 0, 122, 0.2);
          backdrop-filter: blur(20px);
        }

        .neon-chip {
          background: rgba(255, 0, 122, 0.15);
          border: 1px solid rgba(255, 0, 122, 0.4);
          color: #ffd0e7;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        @media (hover: hover) {
          .neon-chip:hover {
            transform: translateY(-1px);
            box-shadow: 0 0 16px rgba(255, 0, 122, 0.35);
          }
        }

        .neon-outline {
          border: 1px solid rgba(255, 0, 122, 0.5);
          color: #ffd0e7;
          background: rgba(8, 6, 14, 0.35);
          transition: transform 0.15s ease, border-color 0.2s ease,
            box-shadow 0.2s ease;
        }

        .neon-outline:active {
          transform: translateY(1px) scale(0.98);
        }

        .neon-button {
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

        .neon-button:hover {
          filter: brightness(1.05);
        }

        .neon-button:active {
          transform: translateY(1px) scale(0.98);
        }

        .status-dot {
          box-shadow: 0 0 10px rgba(255, 0, 122, 0.6);
        }

        .neon-field {
          background: rgba(12, 8, 20, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.25);
          color: #ffffff;
          box-shadow: inset 0 0 0 1px rgba(255, 0, 122, 0.12);
        }

        .neon-field::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }

        .neon-field:focus {
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

        .animate-glow {
          animation: glowPulse 2.5s ease-in-out infinite;
        }

        .issue-flash {
          animation: issuePulse 2.1s ease-in-out infinite;
        }

        @keyframes issuePulse {
          0%,
          100% {
            box-shadow: 0 0 18px rgba(251, 191, 36, 0.25),
              0 0 32px rgba(255, 0, 122, 0.2);
          }
          50% {
            box-shadow: 0 0 30px rgba(251, 191, 36, 0.5),
              0 0 45px rgba(255, 0, 122, 0.35);
          }
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_-10%,_rgba(255,0,122,0.45),_transparent_55%),radial-gradient(circle_at_80%_10%,_rgba(255,120,200,0.3),_transparent_55%),linear-gradient(180deg,_#040107_0%,_#0b0714_45%,_#020104_100%)]"></div>
      <div className="pointer-events-none absolute -top-24 right-10 h-72 w-72 rounded-full bg-[rgba(255,0,122,0.2)] blur-3xl"></div>
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-[rgba(255,90,200,0.18)] blur-[140px]"></div>

      <div className="relative z-10">
        {adminSession ? (
          <Tabs
            value={selectedTab}
            onValueChange={setSelectedTab}
            className="space-y-6"
          >
            <div className="sticky top-0 z-40 hidden lg:block">
              <div className="border-b border-white/10 bg-[#050207]/85 backdrop-blur">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-pink-400/40 bg-black/40 p-1.5 shadow-[0_0_20px_rgba(255,0,122,0.35)]">
                      <img
                        src="/logo.svg"
                        alt="Grilled Inc"
                        className="h-full w-full object-contain drop-shadow-[0_0_12px_rgba(255,0,122,0.5)]"
                      />
                    </div>
                    <div className="hidden xl:block">
                      <p className="display-font text-lg text-pink-200">
                        Grilled Inc
                      </p>
                      <p className="text-[0.55rem] uppercase tracking-[0.3em] text-white/40">
                        Manager OS 26
                      </p>
                    </div>
                  </div>

                  <TabsList className="neon-nav flex items-center gap-1 rounded-full p-1">
                    <TabsTrigger
                      value="overview"
                      onClick={() => setSelectedTab('overview')}
                      className="flex items-center gap-2 rounded-full border border-pink-500/30 bg-white/5 px-3 py-1 text-[0.55rem] uppercase tracking-[0.2em] text-white/70 transition data-[state=active]:border-transparent data-[state=active]:bg-[linear-gradient(135deg,_#ff2f9e,_#ff005c_60%,_#ff67d9_100%)] data-[state=active]:text-[#0b040b]"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      Overview
                    </TabsTrigger>
                    <TabsTrigger
                      value="orders"
                      onClick={() => setSelectedTab('orders')}
                      className="flex items-center gap-2 rounded-full border border-pink-500/30 bg-white/5 px-3 py-1 text-[0.55rem] uppercase tracking-[0.2em] text-white/70 transition data-[state=active]:border-transparent data-[state=active]:bg-[linear-gradient(135deg,_#ff2f9e,_#ff005c_60%,_#ff67d9_100%)] data-[state=active]:text-[#0b040b]"
                    >
                      <Package className="h-3.5 w-3.5" />
                      Orders
                      {ratingSummary.total > 0 && (
                        <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[0.5rem] text-white/70">
                          <Star className="h-3 w-3 text-amber-300" />
                          {ratingSummary.average?.toFixed(1)}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger
                      value="drivers"
                      onClick={() => setSelectedTab('drivers')}
                      className="flex items-center gap-2 rounded-full border border-pink-500/30 bg-white/5 px-3 py-1 text-[0.55rem] uppercase tracking-[0.2em] text-white/70 transition data-[state=active]:border-transparent data-[state=active]:bg-[linear-gradient(135deg,_#ff2f9e,_#ff005c_60%,_#ff67d9_100%)] data-[state=active]:text-[#0b040b]"
                    >
                      <Users className="h-3.5 w-3.5" />
                      Drivers
                    </TabsTrigger>
                    <TabsTrigger
                      value="earnings"
                      onClick={() => setSelectedTab('earnings')}
                      className="flex items-center gap-2 rounded-full border border-pink-500/30 bg-white/5 px-3 py-1 text-[0.55rem] uppercase tracking-[0.2em] text-white/70 transition data-[state=active]:border-transparent data-[state=active]:bg-[linear-gradient(135deg,_#ff2f9e,_#ff005c_60%,_#ff67d9_100%)] data-[state=active]:text-[#0b040b]"
                    >
                      <DollarSign className="h-3.5 w-3.5" />
                      Earnings
                    </TabsTrigger>
                    <TabsTrigger
                      value="analytics"
                      onClick={() => setSelectedTab('analytics')}
                      className="flex items-center gap-2 rounded-full border border-pink-500/30 bg-white/5 px-3 py-1 text-[0.55rem] uppercase tracking-[0.2em] text-white/70 transition data-[state=active]:border-transparent data-[state=active]:bg-[linear-gradient(135deg,_#ff2f9e,_#ff005c_60%,_#ff67d9_100%)] data-[state=active]:text-[#0b040b]"
                    >
                      <TrendingUp className="h-3.5 w-3.5" />
                      Analytics
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex items-center gap-2">
                    <div className="hidden xl:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.55rem] uppercase tracking-[0.2em] text-white/60">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isLoading ? 'bg-white/40' : 'bg-emerald-400'
                        }`}
                      ></span>
                      {isLoading ? 'Syncing' : 'Live'}
                    </div>
                    <Badge
                      className="hidden 2xl:inline-flex uppercase tracking-[0.2em]"
                      variant="outline"
                    >
                      {adminSession?.name ?? 'Admin'}
                    </Badge>
                    <Button
                      className="neon-outline h-8 px-3"
                      variant="outline"
                      size="sm"
                      onClick={handleSettings}
                      type="button"
                    >
                      <Settings className="h-4 w-4" />
                      <span className="ml-2 hidden xl:inline">Settings</span>
                    </Button>
                    <Button
                      className="neon-outline h-8 px-3"
                      variant="outline"
                      size="sm"
                      onClick={handleLogout}
                      type="button"
                    >
                      <LogOut className="h-4 w-4" />
                      <span className="ml-2 hidden xl:inline">Logout</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <header className="px-4 pb-8 pt-8">
              <div className="mx-auto max-w-7xl space-y-5">
                <div className="flex flex-col gap-4 rounded-[28px] border border-white/10 bg-black/40 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-pink-400/40 bg-black/40 p-2 shadow-[0_0_30px_rgba(255,0,122,0.35)]">
                      <img
                        src="/logo.svg"
                        alt="Grilled Inc logo"
                        className="h-full w-full object-contain drop-shadow-[0_0_18px_rgba(255,0,122,0.5)]"
                      />
                    </div>
                    <div>
                      <p className="display-font text-3xl text-pink-200 sm:text-4xl">
                        Grilled Inc
                      </p>
                      <p className="text-xs uppercase tracking-[0.4em] text-white/50">
                        Manager OS 26
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 lg:hidden">
                    <Badge
                      className="neon-chip w-full uppercase tracking-[0.2em] sm:w-auto"
                      variant="outline"
                    >
                      {adminSession?.name ?? 'Admin'}
                    </Badge>
                    <Button
                      className="neon-outline w-full sm:w-auto"
                      variant="outline"
                      size="sm"
                      onClick={handleSettings}
                      type="button"
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </Button>
                    <Button
                      className="neon-outline w-full sm:w-auto"
                      variant="outline"
                      size="sm"
                      onClick={handleLogout}
                      type="button"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <div className="neon-card flex items-center justify-between px-4 py-3 text-white">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                        Dashboard sync
                      </p>
                      <p className="text-lg font-semibold text-white">
                        {isLoading ? 'Loading' : 'Live'}
                      </p>
                      <p className="text-[0.65rem] uppercase tracking-[0.3em] text-white/40">
                        {lastSyncAt
                          ? `Last sync ${lastSyncAt.toLocaleTimeString('en-ZA', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}`
                          : 'Waiting for data'}
                      </p>
                    </div>
                    <span
                      className={`status-dot h-3 w-3 rounded-full ${
                        isLoading ? 'bg-white/40' : 'bg-emerald-400'
                      }`}
                    ></span>
                  </div>
                  <div className="neon-card px-4 py-3 text-white">
                    <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                      Signed in
                    </p>
                    <p className="text-base font-semibold text-white">
                      {adminSession?.email ?? '--'}
                    </p>
                    <p className="text-[0.65rem] uppercase tracking-[0.3em] text-white/40">
                      Manager access enabled
                    </p>
                  </div>
                  <div className="neon-card px-4 py-3 text-white">
                    <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                      Ops cadence
                    </p>
                    <p className="text-base font-semibold text-white">
                      Every {settings.refreshSeconds}s
                    </p>
                    <p className="text-[0.65rem] uppercase tracking-[0.3em] text-white/40">
                      {settings.autoAssign ? 'Auto-dispatch on' : 'Manual dispatch'}
                    </p>
                  </div>
                </div>

                <nav
                  className="mx-auto max-w-7xl lg:hidden"
                  aria-label="Manager navigation"
                >
                  <TabsList className="neon-nav flex w-full flex-wrap items-center gap-2 rounded-[32px] p-2">
                    <TabsTrigger
                      value="overview"
                      onClick={() => setSelectedTab('overview')}
                      className="flex items-center justify-center gap-2 rounded-full border border-pink-500/30 bg-white/5 px-4 py-2 text-[0.6rem] uppercase tracking-[0.2em] text-white/60 transition sm:text-xs sm:tracking-[0.3em] data-[state=active]:border-transparent data-[state=active]:bg-[linear-gradient(135deg,_#ff2f9e,_#ff005c_60%,_#ff67d9_100%)] data-[state=active]:text-[#0b040b] data-[state=active]:shadow-[0_0_18px_rgba(255,0,122,0.45)]"
                    >
                      <MapPin className="h-4 w-4" />
                      Overview
                    </TabsTrigger>
                    <TabsTrigger
                      value="orders"
                      onClick={() => setSelectedTab('orders')}
                      className="flex items-center justify-center gap-2 rounded-full border border-pink-500/30 bg-white/5 px-4 py-2 text-[0.6rem] uppercase tracking-[0.2em] text-white/60 transition sm:text-xs sm:tracking-[0.3em] data-[state=active]:border-transparent data-[state=active]:bg-[linear-gradient(135deg,_#ff2f9e,_#ff005c_60%,_#ff67d9_100%)] data-[state=active]:text-[#0b040b] data-[state=active]:shadow-[0_0_18px_rgba(255,0,122,0.45)]"
                    >
                      <Package className="h-4 w-4" />
                      Orders
                      {ratingSummary.total > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[0.55rem] text-white/70">
                          <Star className="h-3 w-3 text-amber-300" />
                          {ratingSummary.average?.toFixed(1)}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger
                      value="drivers"
                      onClick={() => setSelectedTab('drivers')}
                      className="flex items-center justify-center gap-2 rounded-full border border-pink-500/30 bg-white/5 px-4 py-2 text-[0.6rem] uppercase tracking-[0.2em] text-white/60 transition sm:text-xs sm:tracking-[0.3em] data-[state=active]:border-transparent data-[state=active]:bg-[linear-gradient(135deg,_#ff2f9e,_#ff005c_60%,_#ff67d9_100%)] data-[state=active]:text-[#0b040b] data-[state=active]:shadow-[0_0_18px_rgba(255,0,122,0.45)]"
                    >
                      <Users className="h-4 w-4" />
                      Drivers
                    </TabsTrigger>
                    <TabsTrigger
                      value="earnings"
                      onClick={() => setSelectedTab('earnings')}
                      className="flex items-center justify-center gap-2 rounded-full border border-pink-500/30 bg-white/5 px-4 py-2 text-[0.6rem] uppercase tracking-[0.2em] text-white/60 transition sm:text-xs sm:tracking-[0.3em] data-[state=active]:border-transparent data-[state=active]:bg-[linear-gradient(135deg,_#ff2f9e,_#ff005c_60%,_#ff67d9_100%)] data-[state=active]:text-[#0b040b] data-[state=active]:shadow-[0_0_18px_rgba(255,0,122,0.45)]"
                    >
                      <DollarSign className="h-4 w-4" />
                      Earnings
                    </TabsTrigger>
                    <TabsTrigger
                      value="analytics"
                      onClick={() => setSelectedTab('analytics')}
                      className="flex items-center justify-center gap-2 rounded-full border border-pink-500/30 bg-white/5 px-4 py-2 text-[0.6rem] uppercase tracking-[0.2em] text-white/60 transition sm:text-xs sm:tracking-[0.3em] data-[state=active]:border-transparent data-[state=active]:bg-[linear-gradient(135deg,_#ff2f9e,_#ff005c_60%,_#ff67d9_100%)] data-[state=active]:text-[#0b040b] data-[state=active]:shadow-[0_0_18px_rgba(255,0,122,0.45)]"
                    >
                      <TrendingUp className="h-4 w-4" />
                      Analytics
                    </TabsTrigger>
                  </TabsList>
                </nav>
              </div>
            </header>

        <main className="mx-auto max-w-7xl space-y-6 px-4 pb-12">
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="neon-card text-white">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs uppercase tracking-[0.3em] text-white/60">
                      Drivers Online
                    </CardTitle>
                    <Users className="h-4 w-4 text-pink-200" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-semibold text-white">
                      {metrics
                        ? `${metrics.drivers.online}/${metrics.drivers.total}`
                        : '--'}
                    </div>
                    <p className="text-xs text-white/50">Active now</p>
                  </CardContent>
                </Card>

                <Card className="neon-card text-white">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs uppercase tracking-[0.3em] text-white/60">
                      Active Deliveries
                    </CardTitle>
                    <Package className="h-4 w-4 text-pink-200" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-semibold text-white">
                      {formatNumber(metrics?.orders.active)}
                    </div>
                    <p className="text-xs text-white/50">In progress</p>
                  </CardContent>
                </Card>

                <Card className="neon-card text-white">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs uppercase tracking-[0.3em] text-white/60">
                      Today Revenue
                    </CardTitle>
                    <DollarSign className="h-4 w-4 text-pink-200" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-semibold text-white">
                      {formatCurrency(metrics?.financial.todayRevenue)}
                    </div>
                    <p className="text-xs text-white/50">Gross revenue</p>
                  </CardContent>
                </Card>

                <Card className="neon-card text-white">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs uppercase tracking-[0.3em] text-white/60">
                      Today Profit
                    </CardTitle>
                    <TrendingUp className="h-4 w-4 text-pink-200" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-semibold text-white">
                      {formatCurrency(metrics?.financial.todayProfit)}
                    </div>
                    <p className="text-xs text-white/50">
                      {metrics ? `${metrics.financial.averageMargin}% margin` : '--'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Card className="neon-card text-white">
                  <CardHeader className="flex flex-col gap-4 border-b border-white/10 pb-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <CardTitle className="display-font text-xl sm:text-2xl text-pink-100">
                        Fleet Pulse
                      </CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        className="neon-outline"
                        onClick={() => setSelectedTab('drivers')}
                      >
                        View drivers
                      </Button>
                    </div>
                    <p className="text-sm text-white/60">
                      Live pings from Driver OS 26 sessions.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                          Live map
                        </p>
                        <p className="text-xs text-white/50">
                          {mapDrivers.length} driver signal
                          {mapDrivers.length === 1 ? '' : 's'} ·{' '}
                          {mapOrders.length} active order
                          {mapOrders.length === 1 ? '' : 's'}
                        </p>
                      </div>
                      <div className="relative mt-4 h-[25vh] min-h-[220px] overflow-hidden rounded-2xl border border-white/10 bg-black/30 lg:h-[35vh] lg:min-h-[320px] xl:h-[40vh]">
                        <ManagerLiveMap drivers={mapDrivers} orders={mapOrders} />
                        {mapDrivers.length === 0 && mapOrders.length === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                            <div className="rounded-2xl border border-dashed border-white/10 bg-black/60 px-6 py-5 text-center">
                              <MapPin className="mx-auto mb-3 h-10 w-10 text-pink-200" />
                              <p className="text-white/70">
                                Waiting for live pings
                              </p>
                              <p className="text-sm text-white/50">
                                Drivers share location whenever the app is open.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {liveDriverDetails.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                        <MapPin className="mx-auto mb-3 h-10 w-10 text-pink-200" />
                        <p className="text-white/70">No live telemetry yet</p>
                        <p className="text-sm text-white/50">
                          Drivers appear here as soon as they share location.
                        </p>
                      </div>
                    ) : (
                      liveDriverDetails.map(({ driver, activeOrder }) => (
                        <div
                          key={driver.id}
                          className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition hover:-translate-y-0.5 hover:border-pink-400/40 hover:bg-white/10"
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedTab('drivers')}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              setSelectedTab('drivers')
                            }
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`status-dot h-3 w-3 rounded-full ${getStatusDot(
                                driver.status
                              )}`}
                            ></span>
                            <div>
                              <p className="text-sm font-semibold text-white">
                                {driver.name}
                              </p>
                              <p className="text-xs text-white/50">
                                {driver.vehicleType} - {driver.phone}
                              </p>
                              <div className="mt-1 flex items-center gap-2 text-xs text-white/60">
                                {renderRatingStars(driver.rating)}
                                <span>{driver.rating.toFixed(1)}</span>
                              </div>
                              <p className="text-xs text-white/60">
                                {activeOrder
                                  ? `Route: ${activeOrder.pickupAddress} → ${activeOrder.deliveryAddress} (${activeOrder.status
                                      .replace('_', ' ')
                                      .toLowerCase()})`
                                  : 'No active trip'}
                              </p>
                            </div>
                          </div>
                          <div className="w-full text-left text-xs text-white/50 sm:w-auto sm:text-right">
                            <p className="uppercase tracking-[0.2em] text-white/60">
                              {driver.status.replace('_', ' ')}
                            </p>
                            <p>{formatLastActive(driver.lastActiveAt)}</p>
                            <p>{formatLocation(driver)}</p>
                          </div>
                        </div>
                      ))
                    )}
                    <div className="pt-2 text-xs uppercase tracking-[0.2em] text-white/60">
                      Status legend
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.2em] text-white/60">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
                        Available
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-pink-400 shadow-[0_0_10px_rgba(255,0,122,0.5)]"></span>
                        On job
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-white/40 shadow-[0_0_10px_rgba(255,255,255,0.35)]"></span>
                        Offline
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  <Card className="neon-card text-white">
                    <CardHeader className="flex flex-col gap-4 border-b border-white/10 pb-4">
                      <CardTitle className="display-font text-xl sm:text-2xl text-pink-100">
                        Live Orders
                      </CardTitle>
                      <Button className="neon-button w-fit" onClick={handleOpenOrderDialog}>
                        <Plus className="h-4 w-4" />
                        New order
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {recentLiveOrders.length === 0 ? (
                        <p className="text-sm text-white/60">
                          No live orders yet. Create or dispatch a delivery.
                        </p>
                      ) : (
                        recentLiveOrders.map((order) => (
                          <div
                            key={order.id}
                            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:-translate-y-0.5 hover:border-pink-400/40 hover:bg-white/10"
                          >
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="break-words font-medium text-white">
                                  {order.customerName}
                                </p>
                                <Badge
                                  className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] ${getOrderBadgeClass(
                                    order.status
                                  )}`}
                                  variant="outline"
                                >
                                  {order.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-white/60">
                                {order.paymentType === 'CASH'
                                  ? `${formatCurrency(order.orderValue)} cash + ${formatCurrency(
                                      order.deliveryFee
                                    )} delivery`
                                  : `${formatCurrency(order.deliveryFee)} delivery · EFT`}
                              </p>
                              {order.assignedDriver?.name && (
                                <p className="text-xs text-white/40">
                                  Driver: {order.assignedDriver.name}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="neon-outline w-full sm:w-auto"
                              onClick={() => handleViewOrder(order)}
                            >
                              View
                            </Button>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <Card
                    className={`neon-card text-white ${
                      openIssues.length > 0 ? 'issue-flash' : ''
                    }`}
                  >
                    <CardHeader className="flex flex-col gap-4 border-b border-white/10 pb-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <CardTitle className="display-font text-xl sm:text-2xl text-pink-100">
                          Issue Notifications
                        </CardTitle>
                        <Badge className="neon-chip uppercase tracking-[0.2em]" variant="outline">
                          {openIssues.length} open
                        </Badge>
                      </div>
                      <p className="text-sm text-white/60">
                        Alerts from driver reports and cancelled trips.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {openIssues.length === 0 ? (
                        <p className="text-sm text-white/60">
                          No active issues right now.
                        </p>
                      ) : (
                        highlightedIssues.map((issue) => (
                          <div
                            key={issue.id}
                            className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-white/90 shadow-[0_0_20px_rgba(251,191,36,0.2)] transition hover:-translate-y-0.5 hover:border-amber-300/60"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-white">
                                  {issue.driver.name}
                                </p>
                                <p className="text-xs text-white/70">
                                  {getIssueLabel(issue.type, issue.message)}
                                </p>
                              </div>
                              <Badge
                                className="rounded-full border-amber-400/70 bg-amber-500/20 px-3 py-1 text-[0.55rem] uppercase tracking-[0.3em] text-amber-100"
                                variant="outline"
                              >
                                {issue.status}
                              </Badge>
                            </div>
                            {issue.order && (
                              <p className="mt-2 text-xs text-white/70">
                                Order: {issue.order.customerName} ·{' '}
                                {issue.order.deliveryAddress}
                              </p>
                            )}
                            {issue.message && (
                              <p className="mt-2 text-xs text-white/70">
                                Note: {issue.message}
                              </p>
                            )}
                            <div className="mt-3 flex flex-wrap items-center gap-3 text-[0.6rem] uppercase tracking-[0.3em] text-white/60">
                              <span>{formatIssueTime(issue.createdAt)}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-auto p-0 text-xs text-white/70 hover:text-white"
                                onClick={() => handleCallDriver(issue.driver.phone)}
                              >
                                <Phone className="mr-1 h-3 w-3" />
                                Call driver
                              </Button>
                              {issue.order?.id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-0 text-xs text-white/70 hover:text-white"
                                  onClick={() => handleViewIssueOrder(issue.order?.id)}
                                >
                                  <Navigation className="mr-1 h-3 w-3" />
                                  View order
                                </Button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                      {openIssues.length > highlightedIssues.length && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="neon-outline w-full"
                          onClick={() => setSelectedTab('drivers')}
                        >
                          View all issues
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="orders" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Card className="neon-card text-white">
                  <CardHeader className="flex flex-col gap-4 border-b border-white/10 pb-4">
                    <CardTitle className="display-font text-xl sm:text-2xl text-pink-100">
                      Order Management
                    </CardTitle>
                    <Button className="neon-button w-fit" onClick={handleOpenOrderDialog}>
                      <Plus className="h-4 w-4" />
                      Create new order
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {orders.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                        <Package className="mx-auto mb-4 h-12 w-12 text-pink-200" />
                        <p className="text-white/70">No orders yet</p>
                        <p className="text-sm text-white/50">
                          Create, assign, and track deliveries
                        </p>
                      </div>
                    ) : (
                      orders.map((order) => (
                        <div
                          key={order.id}
                          className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"
                        >
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="break-words font-medium text-white">
                                {order.customerName}
                              </p>
                              <Badge
                                className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] ${getOrderBadgeClass(
                                  order.status
                                )}`}
                                variant="outline"
                              >
                                {order.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-white/60">
                              {order.paymentType === 'CASH'
                                ? `${formatCurrency(order.orderValue)} cash + ${formatCurrency(
                                    order.deliveryFee
                                  )} delivery`
                                : `${formatCurrency(order.deliveryFee)} delivery · EFT`}
                            </p>
                            <p className="text-xs text-white/40">
                              {order.assignedDriver?.name
                                ? `Driver: ${order.assignedDriver.name}`
                                : 'Unassigned'}
                            </p>
                            {order.status === 'DELIVERED' &&
                              order.assignedDriverId && (
                                <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
                                  <span>Rate driver</span>
                                  <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map((value) => (
                                      <button
                                        key={value}
                                        type="button"
                                        className="rounded-full border border-white/10 bg-black/40 p-1.5 transition hover:border-pink-400/60 hover:bg-pink-500/10"
                                        onClick={() =>
                                          handleRateDriver(order, value)
                                        }
                                        disabled={isWorking}
                                        aria-label={`Rate ${value} stars`}
                                      >
                                        <Star
                                          className={`h-3.5 w-3.5 ${
                                            order.managerRating &&
                                            value <= order.managerRating
                                              ? 'text-amber-300'
                                              : 'text-white/30'
                                          }`}
                                          fill={
                                            order.managerRating &&
                                            value <= order.managerRating
                                              ? 'currentColor'
                                              : 'none'
                                          }
                                        />
                                      </button>
                                    ))}
                                  </div>
                                  <span className="text-xs text-white/50">
                                    {order.managerRating
                                      ? `${order.managerRating} / 5`
                                      : 'Not rated'}
                                  </span>
                                </div>
                              )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="neon-outline w-full sm:w-auto"
                            onClick={() => handleViewOrder(order)}
                          >
                            View
                          </Button>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  <Card className="neon-card text-white">
                    <CardHeader className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                      <CardTitle className="display-font text-lg text-pink-100">
                        Client list
                      </CardTitle>
                      <Badge className="neon-chip uppercase tracking-[0.2em]" variant="outline">
                        {clientDirectory.length} total
                      </Badge>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {clientDirectory.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
                          <Users className="mx-auto mb-3 h-10 w-10 text-pink-200" />
                          <p className="text-white/70">No repeat clients yet</p>
                          <p className="text-xs text-white/50">
                            Repeat customers appear here after orders are created.
                          </p>
                        </div>
                      ) : (
                        clientDirectory.slice(0, 6).map((client) => (
                          <div
                            key={client.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white">
                                {client.name}
                              </p>
                              <p className="text-xs text-white/50">
                                {client.phone} · {client.totalOrders} orders
                              </p>
                              <p className="text-xs text-white/40">
                                Last: {new Date(client.lastOrderAt).toLocaleDateString('en-ZA')}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="neon-outline"
                              onClick={() => handleUseClient(client)}
                            >
                              Use
                            </Button>
                          </div>
                        ))
                      )}
                      {clientDirectory.length > 6 && (
                        <p className="text-xs text-white/50">
                          +{clientDirectory.length - 6} more clients available
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="neon-card text-white">
                    <CardHeader className="border-b border-white/10 pb-4">
                      <CardTitle className="display-font text-lg text-pink-100">
                        Driver rating
                      </CardTitle>
                      <p className="text-xs text-white/50">
                        Manager ratings update driver scores automatically.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {ratingSummary.total === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
                          <Star className="mx-auto mb-3 h-10 w-10 text-pink-200" />
                          <p className="text-white/70">No ratings yet</p>
                          <p className="text-xs text-white/50">
                            Rate delivered orders to build the score.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Star className="h-5 w-5 text-amber-300" />
                              <span className="text-xl font-semibold text-white">
                                {ratingSummary.average?.toFixed(1)}
                              </span>
                            </div>
                            <span className="text-xs text-white/50">
                              {ratingSummary.total} ratings
                            </span>
                          </div>
                          <div className="space-y-2">
                            {[5, 4, 3, 2, 1].map((starValue) => {
                              const count = ratingSummary.counts[starValue]
                              const ratio = ratingSummary.total
                                ? (count / ratingSummary.total) * 100
                                : 0
                              return (
                                <div
                                  key={starValue}
                                  className="flex items-center gap-3 text-xs text-white/60"
                                >
                                  <span className="w-8 text-white/70">
                                    {starValue}★
                                  </span>
                                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                                    <div
                                      className="h-full rounded-full bg-pink-400"
                                      style={{ width: `${ratio}%` }}
                                    ></div>
                                  </div>
                                  <span className="w-6 text-right text-white/50">
                                    {count}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="drivers" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <Card className="neon-card text-white">
                  <CardHeader className="flex flex-col gap-4 border-b border-white/10 pb-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <CardTitle className="display-font text-xl sm:text-2xl text-pink-100">
                        Driver Issues
                      </CardTitle>
                      <Badge className="neon-chip uppercase tracking-[0.2em]" variant="outline">
                        {openIssues.length} open
                      </Badge>
                    </div>
                    <p className="text-sm text-white/60">
                      Reports from drivers show up here in real time.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {openIssues.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                        <AlertCircle className="mx-auto mb-3 h-10 w-10 text-pink-200" />
                        <p className="text-white/70">No active issues</p>
                        <p className="text-sm text-white/50">
                          Driver reports will appear here immediately.
                        </p>
                      </div>
                    ) : (
                      openIssues.map((issue) => (
                        <div
                          key={issue.id}
                          className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:-translate-y-0.5 hover:border-pink-400/40"
                          data-issue-id={issue.id}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">
                                {issue.driver.name}
                              </p>
                              <p className="text-xs text-white/50">
                                {getIssueLabel(issue.type, issue.message)}
                              </p>
                            </div>
                            <Badge
                              className={`rounded-full px-3 py-1 text-[0.55rem] uppercase tracking-[0.3em] ${
                                issue.status === 'OPEN'
                                  ? 'border-amber-400/60 text-amber-200 bg-amber-500/15'
                                  : 'border-emerald-400/60 text-emerald-200 bg-emerald-500/15'
                              }`}
                              variant="outline"
                            >
                              {issue.status}
                            </Badge>
                          </div>
                          {issue.order && (
                            <p className="mt-2 text-xs text-white/60">
                              Order: {issue.order.customerName} ·{' '}
                              {issue.order.deliveryAddress}
                            </p>
                          )}
                          {issue.message && (
                            <p className="mt-2 text-xs text-white/60">
                              Note: {issue.message}
                            </p>
                          )}
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-[0.6rem] uppercase tracking-[0.3em] text-white/50">
                            <span>{formatIssueTime(issue.createdAt)}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-0 text-xs text-white/60 hover:text-white"
                              onClick={() => handleCallDriver(issue.driver.phone)}
                            >
                              <Phone className="mr-1 h-3 w-3" />
                              Call driver
                            </Button>
                            {issue.order?.id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-auto p-0 text-xs text-white/60 hover:text-white"
                                onClick={() => handleViewIssueOrder(issue.order?.id)}
                              >
                                <Package className="mr-1 h-3 w-3" />
                                View order
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-0 text-xs text-white/60 hover:text-white"
                              onClick={() => handleResolveIssue(issue.id)}
                            >
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Resolve
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className="neon-card text-white">
                  <CardHeader className="flex flex-col gap-4 border-b border-white/10 pb-4">
                    <CardTitle className="display-font text-xl sm:text-2xl text-pink-100">
                      Driver Management
                    </CardTitle>
                    <Button className="neon-button w-fit" onClick={handleOpenDriverDialog}>
                      <Plus className="h-4 w-4" />
                      Add driver
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {drivers.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                        <Users className="mx-auto mb-4 h-12 w-12 text-pink-200" />
                        <p className="text-white/70">No drivers registered</p>
                        <p className="text-sm text-white/50">
                          Add drivers to start delivery ops
                        </p>
                      </div>
                    ) : (
                      drivers.map((driver) => {
                        const activeDelivery = driver.assignedOrders?.find(
                          (order) =>
                            order.status === 'PICKED_UP' ||
                            order.status === 'EN_ROUTE'
                        )
                        const deliveryProgress = activeDelivery
                          ? getDeliveryProgress(activeDelivery)
                          : null

                        return (
                          <div
                            key={driver.id}
                            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"
                          >
                            <div className="min-w-0 flex flex-1 items-center gap-4">
                              <div
                                className={`status-dot h-3 w-3 rounded-full ${getStatusDot(
                                  driver.status
                                )} ${driver.status === 'ONLINE' ? 'animate-glow' : ''}`}
                              ></div>
                              <div className="min-w-0 flex-1">
                                <p className="break-words font-medium text-white">
                                  {driver.name}
                                </p>
                                <div className="flex flex-wrap items-center gap-4 text-sm text-white/60">
                                  <span className="flex items-center">
                                    <Car className="mr-1 h-3 w-3" />
                                    {driver.vehicleType}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-0 text-xs text-white/60 hover:text-white"
                                    onClick={() => handleCallDriver(driver.phone)}
                                  >
                                    <Phone className="mr-1 h-3 w-3" />
                                    Contact
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-0 text-xs text-white/60 hover:text-white"
                                    onClick={() => handleOpenDriverApp(driver.id)}
                                  >
                                    <Link2 className="mr-1 h-3 w-3" />
                                    Open app
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-0 text-xs text-white/60 hover:text-white"
                                    onClick={() => handleCopyDriverLink(driver.id)}
                                  >
                                    <Copy className="mr-1 h-3 w-3" />
                                    Copy link
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-0 text-xs text-white/60 hover:text-white"
                                    onClick={() => handleOpenDriverWaze(driver)}
                                  >
                                    <Navigation className="mr-1 h-3 w-3" />
                                    Waze
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-0 text-xs text-white/60 hover:text-white"
                                    onClick={() => handleRemoveDriver(driver)}
                                    disabled={isWorking}
                                  >
                                    <Trash2 className="mr-1 h-3 w-3" />
                                    Remove
                                  </Button>
                                  <div className="flex items-center gap-2">
                                    {renderRatingStars(driver.rating)}
                                    <span>{driver.rating.toFixed(1)}</span>
                                  </div>
                                </div>
                                {activeDelivery && (
                                  <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3">
                                    <div className="flex flex-wrap items-center justify-between text-xs uppercase tracking-[0.3em] text-white/50">
                                      <span>To destination</span>
                                      <span>
                                        {deliveryProgress
                                          ? `${deliveryProgress.etaMinutes} min left`
                                          : 'ETA syncing'}
                                      </span>
                                    </div>
                                    <div className="mt-2 h-2 w-full rounded-full bg-white/10">
                                      <div
                                        className="h-full rounded-full bg-gradient-to-r from-pink-400 via-fuchsia-400 to-rose-300"
                                        style={{
                                          width: `${deliveryProgress?.progress ?? 0}%`
                                        }}
                                      ></div>
                                    </div>
                                    <p className="mt-2 text-xs text-white/50">
                                      {activeDelivery.deliveryAddress}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="w-full text-left sm:w-auto sm:text-right">
                              <p className="font-medium text-white">
                                {formatCurrency(driver.totalEarnings)}
                              </p>
                              <p className="text-sm text-white/50">
                                {driver.totalJobs} jobs
                              </p>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="earnings" className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card className="neon-card text-white">
                  <CardHeader>
                    <CardTitle className="text-xs uppercase tracking-[0.3em] text-white/60">
                      Total Revenue
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-semibold text-white">
                      {formatCurrency(metrics?.financial.todayRevenue)}
                    </div>
                    <p className="text-xs text-white/50">Today</p>
                  </CardContent>
                </Card>
                <Card className="neon-card text-white">
                  <CardHeader>
                    <CardTitle className="text-xs uppercase tracking-[0.3em] text-white/60">
                      Driver Payouts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-semibold text-white">
                      {formatCurrency(metrics?.financial.todayDriverPayouts)}
                    </div>
                    <p className="text-xs text-white/50">Today</p>
                  </CardContent>
                </Card>
                <Card className="neon-card text-white">
                  <CardHeader>
                    <CardTitle className="text-xs uppercase tracking-[0.3em] text-white/60">
                      Net Profit
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-semibold text-pink-100">
                      {formatCurrency(metrics?.financial.todayProfit)}
                    </div>
                    <p className="text-xs text-white/50">
                      {metrics ? `${metrics.financial.averageMargin}% margin` : '--'}
                    </p>
                  </CardContent>
                </Card>
              </div>
              <Card className="neon-card text-white">
                <CardHeader className="border-b border-white/10 pb-4">
                  <CardTitle className="display-font text-xl sm:text-2xl text-pink-100">
                    Driver payouts
                  </CardTitle>
                  <p className="text-sm text-white/60">
                    Trip breakdowns with payout, issues, delays, and completion time.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {driverPayoutSummaries.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                      <DollarSign className="mx-auto mb-3 h-10 w-10 text-pink-200" />
                      <p className="text-white/70">No delivered trips yet</p>
                      <p className="text-sm text-white/50">
                        Delivered orders will appear here per driver.
                      </p>
                    </div>
                  ) : (
                    driverPayoutSummaries.map((summary) => (
                      <div
                        key={summary.driver.id}
                        className="rounded-2xl border border-white/10 bg-white/5 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div>
                            <p className="text-lg font-semibold text-white">
                              {summary.driver.name}
                            </p>
                            <p className="text-xs text-white/50">
                              {summary.driver.phone} · Rating{' '}
                              {summary.driver.rating.toFixed(1)}
                            </p>
                          </div>
                          <div className="text-right text-sm text-white/60">
                            <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                              Total payout
                            </p>
                            <p className="text-xl font-semibold text-white">
                              {formatCurrency(summary.totalPay)}
                            </p>
                            <p className="text-xs text-white/50">
                              {summary.trips.length} trip
                              {summary.trips.length === 1 ? '' : 's'}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 space-y-2">
                          {summary.trips.slice(0, 6).map((trip) => (
                            <div
                              key={trip.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-white/70"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-white">
                                  {trip.label}
                                </p>
                                <p className="text-[0.65rem] text-white/50">
                                  {trip.deliveredAt
                                    ? new Date(trip.deliveredAt).toLocaleString(
                                        'en-ZA',
                                        {
                                          month: 'short',
                                          day: '2-digit',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        }
                                      )
                                    : 'Delivered'}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-[0.65rem] text-white/60">
                                <span>{formatCurrency(trip.payout)}</span>
                                <span>
                                  {trip.completionMinutes
                                    ? `${trip.completionMinutes} min`
                                    : 'Time --'}
                                </span>
                                <span>
                                  {trip.delayMinutes && trip.delayMinutes > 0
                                    ? `Delay +${trip.delayMinutes}m`
                                    : 'On time'}
                                </span>
                                <span>
                                  {trip.issuesCount > 0
                                    ? `${trip.issuesCount} issue${
                                        trip.issuesCount === 1 ? '' : 's'
                                      }`
                                    : 'No issues'}
                                </span>
                              </div>
                            </div>
                          ))}
                          {summary.trips.length > 6 && (
                            <p className="text-xs text-white/50">
                              +{summary.trips.length - 6} more trips for this driver
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <Card className="neon-card text-white">
                <CardHeader>
                  <CardTitle className="display-font text-xl sm:text-2xl text-pink-100">
                    Analytics snapshot
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-[0.6rem] uppercase tracking-[0.3em] text-white/50">
                        On-time rate
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {metrics ? `${metrics.performance.onTimeRate}%` : '--'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-[0.6rem] uppercase tracking-[0.3em] text-white/50">
                        Avg delivery
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {metrics
                          ? `${metrics.performance.averageDeliveryTime} min`
                          : '--'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-[0.6rem] uppercase tracking-[0.3em] text-white/50">
                        Orders today
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {formatNumber(metrics?.orders.today)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-[0.6rem] uppercase tracking-[0.3em] text-white/50">
                        Active orders
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {formatNumber(metrics?.orders.active)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-[0.6rem] uppercase tracking-[0.3em] text-white/50">
                        Drivers online
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {metrics
                          ? `${metrics.drivers.online}/${metrics.drivers.total}`
                          : '--'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-[0.6rem] uppercase tracking-[0.3em] text-white/50">
                        Margin
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {metrics ? `${metrics.financial.averageMargin}%` : '--'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="neon-card text-white">
                <CardHeader className="border-b border-white/10 pb-4">
                  <CardTitle className="display-font text-xl sm:text-2xl text-pink-100">
                    Driver analytics
                  </CardTitle>
                  <p className="text-sm text-white/60">
                    Per-driver performance, earnings, and issue counts.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {driverAnalytics.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                      <Users className="mx-auto mb-3 h-10 w-10 text-pink-200" />
                      <p className="text-white/70">No driver analytics yet</p>
                      <p className="text-sm text-white/50">
                        Analytics will appear once deliveries are completed.
                      </p>
                    </div>
                  ) : (
                    driverAnalytics.map((entry) => (
                      <div
                        key={entry.driver.id}
                        className="rounded-2xl border border-white/10 bg-white/5 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div>
                            <p className="text-lg font-semibold text-white">
                              {entry.driver.name}
                            </p>
                            <div className="mt-1 flex items-center gap-2 text-xs text-white/60">
                              {renderRatingStars(entry.driver.rating)}
                              <span>{entry.driver.rating.toFixed(1)}</span>
                            </div>
                          </div>
                          <div className="text-right text-xs text-white/50">
                            <p className="uppercase tracking-[0.3em] text-white/50">
                              Earnings
                            </p>
                            <p className="text-lg font-semibold text-white">
                              {formatCurrency(entry.earnings)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 text-xs text-white/60 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                            <p className="text-[0.6rem] uppercase tracking-[0.3em] text-white/50">
                              Trips
                            </p>
                            <p className="mt-2 text-sm font-semibold text-white">
                              {entry.deliveredTrips} delivered
                            </p>
                            <p className="text-xs text-white/50">
                              {entry.activeTrips} active
                            </p>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                            <p className="text-[0.6rem] uppercase tracking-[0.3em] text-white/50">
                              Avg time
                            </p>
                            <p className="mt-2 text-sm font-semibold text-white">
                              {entry.avgDeliveryMinutes
                                ? `${entry.avgDeliveryMinutes} min`
                                : '--'}
                            </p>
                            <p className="text-xs text-white/50">
                              On-time{' '}
                              {entry.onTimeRate !== null
                                ? `${entry.onTimeRate}%`
                                : '--'}
                            </p>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                            <p className="text-[0.6rem] uppercase tracking-[0.3em] text-white/50">
                              Issues
                            </p>
                            <p className="mt-2 text-sm font-semibold text-white">
                              {entry.issuesCount}
                            </p>
                            <p className="text-xs text-white/50">
                              Logged incidents
                            </p>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                            <p className="text-[0.6rem] uppercase tracking-[0.3em] text-white/50">
                              Status
                            </p>
                            <p className="mt-2 text-sm font-semibold text-white">
                              {entry.driver.status.replace('_', ' ')}
                            </p>
                            <p className="text-xs text-white/50">
                              {entry.driver.totalJobs} lifetime trips
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
        </main>
          </Tabs>
        ) : (
          loginContent
        )}
      </div>

      {adminSession && (
        <>
          <Dialog
            open={settingsDialogOpen}
            onOpenChange={setSettingsDialogOpen}
          >
            <DialogContent className="neon-panel border border-pink-500/40 text-white">
              <DialogHeader>
                <DialogTitle className="display-font text-xl sm:text-2xl text-pink-100">
                  Manager settings
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Auto-assign new orders
                    </p>
                    <p className="text-xs text-white/50">
                      Dispatches the nearest available driver on create.
                    </p>
                  </div>
                  <Switch
                    checked={settingsForm.autoAssign}
                    onCheckedChange={(checked) =>
                      setSettingsForm((prev) => ({
                        ...prev,
                        autoAssign: checked
                      }))
                    }
                    className="border border-white/20 bg-white/10 data-[state=checked]:bg-pink-300 data-[state=checked]:border-pink-200"
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-white/70">Refresh interval (sec)</Label>
                    <Input
                      className="neon-field"
                      type="number"
                      min="5"
                      max="120"
                      value={settingsForm.refreshSeconds}
                      onChange={(event) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          refreshSeconds: Number(event.target.value)
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/70">Driver pay (%)</Label>
                    <Input
                      className="neon-field"
                      type="number"
                      min="0"
                      max="100"
                      value={settingsForm.driverPayPercent}
                      onChange={(event) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          driverPayPercent: Number(event.target.value)
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-white/70">Base fee (R)</Label>
                    <Input
                      className="neon-field"
                      type="number"
                      min="0"
                      value={settingsForm.baseFee}
                      onChange={(event) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          baseFee: Number(event.target.value)
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/70">Distance fee (R/km)</Label>
                    <Input
                      className="neon-field"
                      type="number"
                      min="0"
                      value={settingsForm.distanceFee}
                      onChange={(event) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          distanceFee: Number(event.target.value)
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-white/70">High value threshold (R)</Label>
                    <Input
                      className="neon-field"
                      type="number"
                      min="0"
                      value={settingsForm.highValueThreshold}
                      onChange={(event) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          highValueThreshold: Number(event.target.value)
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/70">High value fee (R)</Label>
                    <Input
                      className="neon-field"
                      type="number"
                      min="0"
                      value={settingsForm.highValueFee}
                      onChange={(event) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          highValueFee: Number(event.target.value)
                        }))
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    className="neon-outline"
                    onClick={() => setSettingsDialogOpen(false)}
                    disabled={isWorking}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    className="neon-button"
                    onClick={handleSaveSettings}
                    disabled={isWorking}
                  >
                    Save settings
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
            <DialogContent className="neon-panel border border-pink-500/40 text-white">
              <DialogHeader>
                <DialogTitle className="display-font text-xl sm:text-2xl text-pink-100">
                  Create order
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateOrder} className="space-y-4">
                {clientDirectory.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-white/70">Repeat client</Label>
                    <select
                      className="neon-field h-9 w-full rounded-md px-3 text-sm"
                      value={selectedClientId}
                      onChange={(event) => {
                        const client = clientDirectory.find(
                          (item) => item.id === event.target.value
                        )
                        if (client) {
                          applyClientProfile(client)
                        } else {
                          setSelectedClientId('')
                        }
                      }}
                    >
                      <option value="">Select a client</option>
                      {clientDirectory.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name} · {client.phone}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-white/50">
                      Selecting a client fills their latest address details.
                    </p>
                  </div>
                )}
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                  <Label className="text-white/70">Customer name</Label>
                  <Input
                    className="neon-field"
                    name="customerName"
                    autoComplete="name"
                    value={orderForm.customerName}
                    onChange={(event) =>
                      setOrderForm((prev) => ({
                        ...prev,
                        customerName: event.target.value
                      }))
                    }
                    placeholder="Customer name"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70">Customer phone</Label>
                  <Input
                    className="neon-field"
                    name="customerPhone"
                    autoComplete="tel"
                    value={orderForm.customerPhone}
                    onChange={(event) =>
                      setOrderForm((prev) => ({
                        ...prev,
                        customerPhone: event.target.value
                      }))
                    }
                    placeholder="+27..."
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Pickup address</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    className="neon-field flex-1"
                    name="pickupAddress"
                    autoComplete="street-address"
                    value={orderForm.pickupAddress}
                    onChange={(event) =>
                      setOrderForm((prev) => ({
                        ...prev,
                        pickupAddress: event.target.value
                      }))
                    }
                    onBlur={(event) =>
                      setOrderForm((prev) => ({
                        ...prev,
                        pickupAddress: event.target.value
                      }))
                    }
                    placeholder="Pickup address"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="neon-outline"
                    onClick={() => handleGeocodeAddress('pickup')}
                    disabled={isGeocoding.pickup}
                  >
                    {isGeocoding.pickup ? 'Finding...' : 'Auto coords'}
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-white/70">Pickup latitude</Label>
                  <Input
                    className="neon-field"
                    name="pickupLat"
                    inputMode="decimal"
                    value={orderForm.pickupLat}
                    onChange={(event) =>
                      setOrderForm((prev) => ({
                        ...prev,
                        pickupLat: event.target.value
                        }))
                      }
                      placeholder="-33.9249"
                    />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70">Pickup longitude</Label>
                  <Input
                    className="neon-field"
                    name="pickupLng"
                    inputMode="decimal"
                    value={orderForm.pickupLng}
                    onChange={(event) =>
                      setOrderForm((prev) => ({
                        ...prev,
                        pickupLng: event.target.value
                        }))
                      }
                      placeholder="18.4241"
                    />
                  </div>
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Delivery address</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    className="neon-field flex-1"
                    name="deliveryAddress"
                    autoComplete="street-address"
                    value={orderForm.deliveryAddress}
                    onChange={(event) =>
                      setOrderForm((prev) => ({
                        ...prev,
                        deliveryAddress: event.target.value
                      }))
                    }
                    onBlur={(event) =>
                      setOrderForm((prev) => ({
                        ...prev,
                        deliveryAddress: event.target.value
                      }))
                    }
                    placeholder="Delivery address"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="neon-outline"
                    onClick={() => handleGeocodeAddress('delivery')}
                    disabled={isGeocoding.delivery}
                  >
                    {isGeocoding.delivery ? 'Finding...' : 'Auto coords'}
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-white/70">Delivery latitude</Label>
                  <Input
                    className="neon-field"
                    name="deliveryLat"
                    inputMode="decimal"
                    value={orderForm.deliveryLat}
                    onChange={(event) =>
                      setOrderForm((prev) => ({
                        ...prev,
                        deliveryLat: event.target.value
                        }))
                      }
                      placeholder="-33.9166"
                    />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70">Delivery longitude</Label>
                  <Input
                    className="neon-field"
                    name="deliveryLng"
                    inputMode="decimal"
                    value={orderForm.deliveryLng}
                    onChange={(event) =>
                      setOrderForm((prev) => ({
                        ...prev,
                        deliveryLng: event.target.value
                        }))
                      }
                      placeholder="18.4017"
                    />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-white/70">Order value</Label>
                    <Input
                      className="neon-field"
                      name="orderValue"
                      inputMode="decimal"
                      value={orderForm.orderValue}
                      onChange={(event) =>
                        setOrderForm((prev) => ({
                          ...prev,
                          orderValue: event.target.value
                        }))
                      }
                      placeholder="850"
                    />
                  </div>
                  <div className="space-y-2">
                <Label className="text-white/70">Trip price (delivery fee)</Label>
                <Input
                  className="neon-field"
                  name="deliveryFee"
                  inputMode="decimal"
                  value={orderForm.deliveryFee}
                  onChange={(event) =>
                    setOrderForm((prev) => ({
                      ...prev,
                      deliveryFee: event.target.value
                    }))
                  }
                  placeholder="120"
                />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-white/70">Driver pay (optional)</Label>
                    <Input
                      className="neon-field"
                      name="driverPay"
                      inputMode="decimal"
                      value={orderForm.driverPay}
                      onChange={(event) =>
                        setOrderForm((prev) => ({
                          ...prev,
                          driverPay: event.target.value
                        }))
                      }
                      placeholder="72"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/70">Payment type</Label>
                    <select
                      className="neon-field h-9 w-full rounded-md px-3 text-sm"
                      name="paymentType"
                      value={orderForm.paymentType}
                      onChange={(event) =>
                        setOrderForm((prev) => ({
                          ...prev,
                          paymentType: event.target.value
                        }))
                      }
                    >
                      <option value="EFT">EFT</option>
                      <option value="CASH">CASH</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70">
                    Assign driver now (optional)
                  </Label>
                  <select
                    className="neon-field h-9 w-full rounded-md px-3 text-sm"
                    name="assignedDriverId"
                    value={orderForm.assignedDriverId}
                    onChange={(event) =>
                      setOrderForm((prev) => ({
                        ...prev,
                        assignedDriverId: event.target.value
                      }))
                    }
                  >
                    <option value="">Leave unassigned</option>
                    {drivers
                      .filter((driver) => driver.isActive !== false)
                      .map((driver) => (
                        <option key={driver.id} value={driver.id}>
                          {driver.name} · {driver.status.toLowerCase()}
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-white/50">
                    Assigned drivers receive the trip immediately and can accept
                    or decline.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70">Notes (optional)</Label>
                  <Input
                    className="neon-field"
                    name="notes"
                    value={orderForm.notes}
                    onChange={(event) =>
                      setOrderForm((prev) => ({
                        ...prev,
                        notes: event.target.value
                      }))
                    }
                    placeholder="Add delivery notes"
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    className="neon-outline"
                    onClick={() => setOrderDialogOpen(false)}
                    disabled={isWorking}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="neon-button"
                    disabled={isWorking}
                  >
                    Create order
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

      <Dialog open={driverDialogOpen} onOpenChange={setDriverDialogOpen}>
        <DialogContent className="neon-panel border border-pink-500/40 text-white">
          <DialogHeader>
            <DialogTitle className="display-font text-xl sm:text-2xl text-pink-100">
              Add driver
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateDriver} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-white/70">Name</Label>
                <Input
                  className="neon-field"
                  value={driverForm.name}
                  onChange={(event) =>
                    setDriverForm((prev) => ({
                      ...prev,
                      name: event.target.value
                    }))
                  }
                  placeholder="Driver name"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Phone</Label>
                <Input
                  className="neon-field"
                  value={driverForm.phone}
                  onChange={(event) =>
                    setDriverForm((prev) => ({
                      ...prev,
                      phone: event.target.value
                    }))
                  }
                  placeholder="+27..."
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-white/70">Email</Label>
                <Input
                  className="neon-field"
                  value={driverForm.email}
                  onChange={(event) =>
                    setDriverForm((prev) => ({
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
                  value={driverForm.password}
                  onChange={(event) =>
                    setDriverForm((prev) => ({
                      ...prev,
                      password: event.target.value
                    }))
                  }
                  placeholder="Set password"
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-white/70">Vehicle type</Label>
                <select
                  className="neon-field h-9 w-full rounded-md px-3 text-sm"
                  value={driverForm.vehicleType}
                  onChange={(event) =>
                    setDriverForm((prev) => ({
                      ...prev,
                      vehicleType: event.target.value
                    }))
                  }
                >
                  <option value="CAR">CAR</option>
                  <option value="MOTORBIKE">MOTORBIKE</option>
                  <option value="VAN">VAN</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Vehicle plate</Label>
                <Input
                  className="neon-field"
                  value={driverForm.vehiclePlate}
                  onChange={(event) =>
                    setDriverForm((prev) => ({
                      ...prev,
                      vehiclePlate: event.target.value
                    }))
                  }
                  placeholder="CA 12345"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="neon-outline"
                onClick={() => setDriverDialogOpen(false)}
                disabled={isWorking}
              >
                Cancel
              </Button>
              <Button type="submit" className="neon-button" disabled={isWorking}>
                Add driver
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={orderDetailsOpen}
        onOpenChange={(open) => {
          setOrderDetailsOpen(open)
          if (!open) {
            setSelectedOrder(null)
          }
        }}
      >
        <DialogContent className="neon-panel border border-pink-500/40 text-white">
          <DialogHeader>
            <DialogTitle className="display-font text-xl sm:text-2xl text-pink-100">
              Order details
            </DialogTitle>
          </DialogHeader>
          {selectedOrder ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                  Customer
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {selectedOrder.customerName}
                </p>
                <p className="text-sm text-white/60">
                  {selectedOrder.customerPhone}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                    Pickup
                  </p>
                  <p className="mt-2 text-sm text-white/70">
                    {selectedOrder.pickupAddress}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="neon-outline"
                      onClick={() =>
                        handleOpenWaze(
                          selectedOrder.pickupAddress,
                          'pickup',
                          selectedOrder.pickupLat,
                          selectedOrder.pickupLng
                        )
                      }
                    >
                      <Navigation className="h-4 w-4" />
                      Waze pickup
                    </Button>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                    Drop-off
                  </p>
                  <p className="mt-2 text-sm text-white/70">
                    {selectedOrder.deliveryAddress}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="neon-outline"
                      onClick={() =>
                        handleOpenWaze(
                          selectedOrder.deliveryAddress,
                          'drop-off',
                          selectedOrder.deliveryLat,
                          selectedOrder.deliveryLng
                        )
                      }
                    >
                      <Navigation className="h-4 w-4" />
                      Waze drop-off
                    </Button>
                  </div>
                </div>
              </div>
              {selectedOrder.paymentType === 'CASH' && (
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-white/60">
                  <span>Order value (cash)</span>
                  <span>{formatCurrency(selectedOrder.orderValue)}</span>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-white/60">
                <span>Delivery fee</span>
                <span>{formatCurrency(selectedOrder.deliveryFee)}</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-white/60">
                <span>Status</span>
                <Badge
                  className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] ${getOrderBadgeClass(
                    selectedOrder.status
                  )}`}
                  variant="outline"
                >
                  {selectedOrder.status}
                </Badge>
              </div>
                      {selectedOrder.assignedDriverId &&
                        selectedOrder.status === 'DELIVERED' && (
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                              Driver rating
                            </p>
                    <p className="mt-2 text-sm text-white/70">
                      Rate {selectedOrder.assignedDriver?.name ?? 'driver'} for
                      this trip.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          type="button"
                          className="rounded-full border border-white/10 bg-black/40 p-2 transition hover:border-pink-400/60 hover:bg-pink-500/10"
                          onClick={() => handleRateDriver(selectedOrder, value)}
                          disabled={isWorking}
                          aria-label={`Rate ${value} stars`}
                        >
                          <Star
                            className={`h-4 w-4 ${
                              selectedOrder.managerRating &&
                              value <= selectedOrder.managerRating
                                ? 'text-amber-300'
                                : 'text-white/30'
                            }`}
                            fill={
                              selectedOrder.managerRating &&
                              value <= selectedOrder.managerRating
                                ? 'currentColor'
                                : 'none'
                            }
                          />
                        </button>
                      ))}
                      <span className="text-xs text-white/50">
                        {selectedOrder.managerRating
                          ? `${selectedOrder.managerRating} / 5`
                          : 'Not rated yet'}
                      </span>
                    </div>
                  </div>
                )}
              <div className="space-y-2">
                <Label className="text-white/70">Assign driver</Label>
                <select
                  className="neon-field h-9 w-full rounded-md px-3 text-sm"
                  value={assignDriverId}
                  onChange={(event) => setAssignDriverId(event.target.value)}
                >
                  <option value="">Select driver</option>
                  {availableDrivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name} ({driver.vehicleType})
                    </option>
                  ))}
                </select>
                {availableDrivers.length === 0 && (
                  <p className="text-xs text-white/50">
                    No online drivers available.
                  </p>
                )}
              </div>
              {selectedOrder.assignedDriverId && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="neon-outline"
                    onClick={() =>
                      handleOpenDriverApp(selectedOrder.assignedDriverId!)
                    }
                  >
                    <Link2 className="h-4 w-4" />
                    Open driver app
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="neon-outline"
                    onClick={() =>
                      handleCopyDriverLink(selectedOrder.assignedDriverId!)
                    }
                  >
                    <Copy className="h-4 w-4" />
                    Copy driver link
                  </Button>
                </div>
              )}
              <DialogFooter>
                {selectedOrder &&
                  !['DELIVERED', 'CANCELLED'].includes(selectedOrder.status) && (
                    <Button
                      type="button"
                      variant="outline"
                      className="neon-outline border-red-400/60 text-red-200 hover:border-red-300 hover:text-red-100"
                      onClick={handleCancelOrder}
                      disabled={isWorking}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Cancel order
                    </Button>
                  )}
                <Button
                  type="button"
                  variant="outline"
                  className="neon-outline"
                  onClick={() => setOrderDetailsOpen(false)}
                  disabled={isWorking}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  className="neon-button"
                  onClick={handleAssignDriver}
                  disabled={
                    isWorking ||
                    !selectedOrder ||
                    ['DELIVERED', 'CANCELLED'].includes(selectedOrder.status)
                  }
                >
                  Assign driver
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <p className="text-sm text-white/60">Order not available.</p>
          )}
        </DialogContent>
      </Dialog>
        </>
      )}
    </div>
  )
}
