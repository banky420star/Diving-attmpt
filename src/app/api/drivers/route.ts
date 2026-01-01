import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthError, hashPassword, requireAuth } from '@/lib/auth'

// GET /api/drivers - Fetch all drivers
export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request, ['manager'])
    const authError = getAuthError(auth.error)
    if (authError) {
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.status }
      )
    }
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const available = searchParams.get('available')
    const includeInactive = searchParams.get('includeInactive') === 'true'

    let where: any = includeInactive ? {} : { isActive: true }

    if (status) {
      where.status = status as any
    }

    if (available === 'true') {
      where.status = 'ONLINE'
    }

    const drivers = await db.driver.findMany({
      where,
      include: {
        assignedOrders: {
          where: {
            status: {
              in: ['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'EN_ROUTE']
            }
          },
          select: {
            id: true,
            status: true,
            customerName: true,
            deliveryAddress: true,
            pickupLat: true,
            pickupLng: true,
            deliveryLat: true,
            deliveryLng: true,
            estimatedTime: true,
            pickedUpAt: true,
            acceptedAt: true
          }
        },
        _count: {
          select: {
            assignedOrders: {
              where: {
                status: {
                  in: ['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'EN_ROUTE']
                }
              }
            }
          }
        }
      },
      orderBy: {
        lastActiveAt: 'desc'
      }
    })

    return NextResponse.json({ success: true, data: drivers })
  } catch (error) {
    console.error('Error fetching drivers:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch drivers' },
      { status: 500 }
    )
  }
}

// POST /api/drivers - Create a new driver
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
    const body = await request.json()
    const {
      name,
      email,
      phone,
      vehicleType = 'CAR',
      vehiclePlate,
      password
    } = body

    // Validate required fields
    if (!name || !email || !phone || !password) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if driver already exists
    const existingDriver = await db.driver.findUnique({
      where: { email }
    })

    if (existingDriver) {
      return NextResponse.json(
        { success: false, error: 'Driver with this email already exists' },
        { status: 400 }
      )
    }

    const hashedPassword = await hashPassword(password)

    const driver = await db.driver.create({
      data: {
        name,
        email,
        phone,
        vehicleType,
        vehiclePlate,
        password: hashedPassword,
        status: 'OFFLINE'
      }
    })

    // Remove password from response
    const { password: _, ...driverWithoutPassword } = driver

    return NextResponse.json({ success: true, data: driverWithoutPassword })
  } catch (error) {
    console.error('Error creating driver:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create driver' },
      { status: 500 }
    )
  }
}
