import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthError, requireAuth } from '@/lib/auth'
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEYS,
  normalizeSettings,
  parseSettingValue,
  type ManagerSettings
} from '@/lib/settings'

// GET /api/orders - Fetch all orders
export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request, ['manager', 'driver'])
    const authError = getAuthError(auth.error)
    if (authError) {
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.status }
      )
    }
    const session = auth.session
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined

    const where: Record<string, unknown> = status ? { status: status as any } : {}
    if (session.role === 'driver') {
      if (status === 'PENDING') {
        where.assignedDriverId = null
      } else if (status) {
        where.assignedDriverId = session.sub
      } else {
        where.assignedDriverId = session.sub
      }
    }

    const orders = await db.order.findMany({
      where,
      include: {
        assignedDriver: {
          select: {
            id: true,
            name: true,
            phone: true,
            vehicleType: true,
            rating: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    })

    return NextResponse.json({ success: true, data: orders })
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}

// POST /api/orders - Create a new order
export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request, ['manager'])
    const authError = getAuthError(auth.error)
    if (authError) {
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.status }
      )
    }
    const session = auth.session
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    const body = await request.json()
    const {
      customerName,
      customerPhone,
      pickupAddress,
      pickupLat,
      pickupLng,
      deliveryAddress,
      deliveryLat,
      deliveryLng,
      orderValue,
      deliveryFee,
      driverPay,
      paymentType = 'EFT',
      notes,
      createdById,
      assignedDriverId
    } = body

    // Validate required fields
    if (
      !customerName ||
      !customerPhone ||
      !pickupAddress ||
      !deliveryAddress ||
      pickupLat === undefined ||
      pickupLng === undefined ||
      deliveryLat === undefined ||
      deliveryLng === undefined ||
      orderValue === undefined
    ) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const normalizedAssignedDriverId =
      typeof assignedDriverId === 'string' ? assignedDriverId.trim() : ''

    if (normalizedAssignedDriverId) {
      const driver = await db.driver.findUnique({
        where: { id: normalizedAssignedDriverId },
        select: { id: true, isActive: true }
      })
      if (!driver || driver.isActive === false) {
        return NextResponse.json(
          { success: false, error: 'Assigned driver not available' },
          { status: 400 }
        )
      }
    }

    const distance = calculateDistance(
      pickupLat,
      pickupLng,
      deliveryLat,
      deliveryLng
    )

    const settings = await getManagerSettings()

    // Calculate fee if not provided
    const calculatedFee =
      deliveryFee ?? calculateDeliveryFee(distance, orderValue, settings)

    // Calculate driver pay if not provided
    const calculatedDriverPay =
      driverPay ?? calculatedFee * (settings.driverPayPercent / 100)

    const estimatedTime = Math.max(10, Math.round(distance * 6 + 8))

    const order = await db.order.create({
      data: {
        customerName,
        customerPhone,
        pickupAddress,
        pickupLat,
        pickupLng,
        deliveryAddress,
        deliveryLat,
        deliveryLng,
        orderValue,
        deliveryFee: calculatedFee,
        driverPay: calculatedDriverPay,
        estimatedTime,
        paymentType,
        notes,
        createdById: session.sub,
        status: normalizedAssignedDriverId ? 'ASSIGNED' : 'PENDING',
        assignedDriverId: normalizedAssignedDriverId || null
      },
      include: {
        assignedDriver: true,
        createdBy: true
      }
    })

    return NextResponse.json({ success: true, data: order })
  } catch (error) {
    console.error('Error creating order:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create order' },
      { status: 500 }
    )
  }
}

// Helper function to calculate delivery fee
function calculateDeliveryFee(
  distance: number,
  orderValue: number,
  settings: ManagerSettings
): number {
  // Base fee + distance fee + value-based fee
  const baseFee = settings.baseFee
  const distanceFee = distance * settings.distanceFee
  const valueFee =
    orderValue > settings.highValueThreshold ? settings.highValueFee : 0
  
  return baseFee + distanceFee + valueFee
}

// Helper function to calculate distance between two points
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

async function getManagerSettings(): Promise<ManagerSettings> {
  const records = await db.adminSetting.findMany({
    where: {
      key: { in: SETTINGS_KEYS }
    }
  })

  const parsed = records.reduce<Record<string, unknown>>((acc, record) => {
    acc[record.key] = parseSettingValue(record.value)
    return acc
  }, {})

  return normalizeSettings(parsed as Partial<typeof DEFAULT_SETTINGS>)
}
