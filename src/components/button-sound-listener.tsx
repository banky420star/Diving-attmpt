'use client'

import { useEffect } from 'react'

import {
  playButtonClickSound,
  playNotificationTone,
  type NotificationTone
} from '@/lib/notifications'

const SOUND_VALUES = new Set<NotificationTone>([
  'order',
  'issue',
  'accept',
  'decline'
])

export function ButtonSoundListener() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      const button = target.closest('button, [role="button"]')
      if (!button) return
      if (button.getAttribute('aria-disabled') === 'true') return
      if (button instanceof HTMLButtonElement && button.disabled) return

      const sound = button.getAttribute('data-sound')
      if (sound === 'none') return
      if (sound && SOUND_VALUES.has(sound as NotificationTone)) {
        playNotificationTone(sound as NotificationTone)
        return
      }
      playButtonClickSound()
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  return null
}
