import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthError, requireAuth } from '@/lib/auth'

const ISSUE_STATUSES = new Set(['OPEN', 'RESOLVED'])

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const status = String(body?.status ?? 'RESOLVED').trim().toUpperCase()

    if (!ISSUE_STATUSES.has(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid issue status' },
        { status: 400 }
      )
    }

    const issue = await db.driverIssue.update({
      where: { id },
      data: {
        status: status as any,
        resolvedAt: status === 'RESOLVED' ? new Date() : null
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
    console.error('Error updating driver issue:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update issue' },
      { status: 500 }
    )
  }
}
