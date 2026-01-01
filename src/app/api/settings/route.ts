import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthError, requireAuth } from '@/lib/auth'
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEYS,
  normalizeSettings,
  parseSettingValue
} from '@/lib/settings'

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
    const records = await db.adminSetting.findMany({
      where: {
        key: { in: SETTINGS_KEYS }
      }
    })

    const parsed = records.reduce<Record<string, unknown>>((acc, record) => {
      acc[record.key] = parseSettingValue(record.value)
      return acc
    }, {})

    const settings = normalizeSettings(parsed as Partial<typeof DEFAULT_SETTINGS>)

    return NextResponse.json({ success: true, data: settings })
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
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
    const settingsInput = body?.settings as Partial<typeof DEFAULT_SETTINGS>

    if (!settingsInput) {
      return NextResponse.json(
        { success: false, error: 'Settings payload is required' },
        { status: 400 }
      )
    }

    const settings = normalizeSettings(settingsInput)

    await db.$transaction(
      SETTINGS_KEYS.map((key) =>
        db.adminSetting.upsert({
          where: { key },
          update: { value: JSON.stringify(settings[key]) },
          create: { key, value: JSON.stringify(settings[key]) }
        })
      )
    )

    return NextResponse.json({ success: true, data: settings })
  } catch (error) {
    console.error('Error updating settings:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}
