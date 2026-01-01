import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/orders - Fetch all orders
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined

    const where = status ? { status: status as any } : {}

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
      createdById
    } = body

    // Validate required fields
    if (!customerName || !customerPhone || !pickupAddress || !deliveryAddress || 
        !pickupLat || !pickupLng || !deliveryLat || !deliveryLng || !orderValue) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Calculate fee if not provided
    const calculatedFee = deliveryFee || calculateDeliveryFee(
      pickupLat, pickupLng, deliveryLat, deliveryLng, orderValue
    )

    // Calculate driver pay if not provided (60% of delivery fee)
    const calculatedDriverPay = driverPay || (calculatedFee * 0.6)

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
        paymentType,
        notes,
        createdById,
        status: 'PENDING'
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
  pickupLat: number, pickupLng: number, 
  deliveryLat: number, deliveryLng: number, 
  orderValue: number
): number {
  // Calculate distance (simplified - in production, use Google Maps API)
  const distance = calculateDistance(pickupLat, pickupLng, deliveryLat, deliveryLng)
  
  // Base fee + distance fee + value-based fee
  const baseFee = 50
  const distanceFee = distance * 10 // R10 per km
  const valueFee = orderValue > 1000 ? 50 : 0 // Extra R50 for orders over R1000
  
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