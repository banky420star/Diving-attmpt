export type NotificationTone = 'order' | 'issue' | 'accept' | 'decline'

const getToneFrequency = (tone: NotificationTone) => {
  switch (tone) {
    case 'issue':
      return 660
    case 'accept':
      return 1040
    case 'decline':
      return 440
    default:
      return 880
  }
}

export const playNotificationTone = (tone: NotificationTone) => {
  if (typeof window === 'undefined') return
  const AudioContext =
    window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContext) return

  try {
    const context = new AudioContext()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = getToneFrequency(tone)
    gain.gain.value = 0.08
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.25)
    oscillator.onended = () => {
      context.close().catch(() => {})
    }
  } catch {
    // Ignore audio failures.
  }
}

export const requestNotificationPermission = async () => {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'default') return
  try {
    await Notification.requestPermission()
  } catch {
    // Ignore permission errors.
  }
}

export const sendBrowserNotification = (title: string, body: string) => {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    new Notification(title, {
      body,
      icon: '/logo.svg'
    })
  } catch {
    // Ignore notification errors.
  }
}
