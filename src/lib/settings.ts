export type ManagerSettings = {
  refreshSeconds: number
  autoAssign: boolean
  driverPayPercent: number
  baseFee: number
  distanceFee: number
  highValueThreshold: number
  highValueFee: number
}

export const DEFAULT_SETTINGS: ManagerSettings = {
  refreshSeconds: 10,
  autoAssign: false,
  driverPayPercent: 60,
  baseFee: 50,
  distanceFee: 10,
  highValueThreshold: 1000,
  highValueFee: 50
}

export const SETTINGS_KEYS = Object.keys(
  DEFAULT_SETTINGS
) as Array<keyof ManagerSettings>

export const parseSettingValue = (value: string) => {
  try {
    return JSON.parse(value) as unknown
  } catch (error) {
    return value
  }
}

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

export const normalizeSettings = (
  input: Partial<ManagerSettings>
): ManagerSettings => {
  return {
    refreshSeconds: clampNumber(
      Number(input.refreshSeconds ?? DEFAULT_SETTINGS.refreshSeconds),
      5,
      120
    ),
    autoAssign: Boolean(input.autoAssign ?? DEFAULT_SETTINGS.autoAssign),
    driverPayPercent: clampNumber(
      Number(input.driverPayPercent ?? DEFAULT_SETTINGS.driverPayPercent),
      0,
      100
    ),
    baseFee: clampNumber(
      Number(input.baseFee ?? DEFAULT_SETTINGS.baseFee),
      0,
      2000
    ),
    distanceFee: clampNumber(
      Number(input.distanceFee ?? DEFAULT_SETTINGS.distanceFee),
      0,
      200
    ),
    highValueThreshold: clampNumber(
      Number(input.highValueThreshold ?? DEFAULT_SETTINGS.highValueThreshold),
      0,
      10000
    ),
    highValueFee: clampNumber(
      Number(input.highValueFee ?? DEFAULT_SETTINGS.highValueFee),
      0,
      2000
    )
  }
}
