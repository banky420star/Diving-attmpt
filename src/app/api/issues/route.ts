import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthError, requireAuth } from '@/lib/auth'

const ISSUE_TYPES = new Set([
  'CUSTOMER_NO_RESPONSE',
  'ADDRESS_ISSUE',
  'VEHICLE_ISSUE',
  'ACCIDENT',
  'PAYMENT_DISPUTE',
  'OTHER'
])

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
    const statusParam = searchParams.get('status')
    const status =
      statusParam && statusParam.toLowerCase() !== 'all'
        ? statusParam
        : null
    const limit = Number(searchParams.get('limit') ?? 25)

    const issues = await db.driverIssue.findMany({
      where: status ? { status: status as any } : undefined,
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        },
        order: {
          select: {
            id: true,
            customerName: true,
            deliveryAddress: true,
            status: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: Number.isFinite(limit) ? limit : 25
    })

    return NextResponse.json({ success: true, data: issues })
  } catch (error) {
    console.error('Error fetching driver issues:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch issues' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request, ['driver'])
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
    const type = String(body?.type ?? '').trim()
    const message = String(body?.message ?? '').trim()
    const orderId = body?.orderId ? String(body.orderId) : null

    if (!ISSUE_TYPES.has(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid issue type' },
        { status: 400 }
      )
    }

    const issue = await db.driverIssue.create({
      data: {
        driverId: session.sub,
        orderId,
        type: type as any,
        message: message.length > 0 ? message : null,
        status: 'OPEN'
      },
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        },
        order: {
          select: {
            id: true,
            customerName: true,
            deliveryAddress: true,
            status: true
          }
        }
      }
    })

    return NextResponse.json({ success: true, data: issue })
  } catch (error) {
    console.error('Error creating driver issue:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to report issue' },
      { status: 500 }
    )
  }
}
