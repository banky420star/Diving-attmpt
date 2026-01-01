import { useEffect, useState, useRef } from 'react'

interface DriverLocation {
  driverId: string
  latitude: number
  longitude: number
  status: 'ONLINE' | 'OFFLINE' | 'ON_JOB' | 'BREAK'
  heading?: number
  timestamp: string
  socketId: string
  lastPing?: string
  lastSeen?: string
}

interface JobStatusUpdate {
  driverId: string
  orderId: string
  status: string
  timestamp: string
}

interface AdminMessage {
  message: string
  type: 'info' | 'warning' | 'urgent'
  timestamp: string
  fromAdmin: boolean
}

interface LocationShareData {
  driverId: string
  customerPhone: string
  customerName: string
  trackingLink: string
  location: {
    latitude: number
    longitude: number
  }
  timestamp: string
}

export function useRealTimeLocation(isAdmin: boolean = false, driverId?: string) {
  const [driverLocations, setDriverLocations] = useState<Map<string, DriverLocation>>(new Map())
  const [isConnected, setIsConnected] = useState(false)
  const [adminMessages, setAdminMessages] = useState<AdminMessage[]>([])
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [pingStatus, setPingStatus] = useState<'good' | 'poor' | 'lost'>('good')
  const socketRef = useRef<any>(null)
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Initialize Socket.IO connection
    const initSocket = async () => {
      try {
        // Dynamic import to avoid SSR issues
        const { io } = await import('socket.io-client')
        
        socketRef.current = io('/?XTransformPort=3001', {
          transports: ['websocket', 'polling']
        })

        socketRef.current.on('connect', () => {
          console.log('🔗 Connected to Grilled.ink location service')
          setIsConnected(true)
          setConnectionStatus('connected')
          
          if (isAdmin) {
            // Admin joins admin room
            socketRef.current.emit('admin-join')
          } else if (driverId) {
            // Driver joins with their ID
            socketRef.current.emit('driver-join', driverId)
          }
        })

        socketRef.current.on('disconnect', () => {
          console.log('🔌 Disconnected from location service')
          setIsConnected(false)
          setConnectionStatus('disconnected')
          if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current)
          }
        })

        if (isAdmin) {
          // Admin-specific listeners
          socketRef.current.on('driver-location-update', (data: DriverLocation) => {
            setDriverLocations(prev => {
              const newMap = new Map(prev)
              newMap.set(data.driverId, data)
              return newMap
            })
          })

          socketRef.current.on('all-drivers-locations', (drivers: DriverLocation[]) => {
            const newMap = new Map<string, DriverLocation>()
            drivers.forEach(driver => {
              newMap.set(driver.driverId, driver)
            })
            setDriverLocations(newMap)
          })

          socketRef.current.on('driver-status-change', (data: { driverId: string, status: string, timestamp: string }) => {
            setDriverLocations(prev => {
              const newMap = new Map(prev)
              const driver = newMap.get(data.driverId)
              if (driver) {
                driver.status = data.status as any
                driver.timestamp = data.timestamp
                newMap.set(data.driverId, driver)
              }
              return newMap
            })
          })

          socketRef.current.on('driver-connected', (data: DriverLocation) => {
            setDriverLocations(prev => {
              const newMap = new Map(prev)
              newMap.set(data.driverId, data)
              return newMap
            })
          })

          socketRef.current.on('driver-disconnected', (data: { driverId: string, timestamp: string }) => {
            setDriverLocations(prev => {
              const newMap = new Map(prev)
              const driver = newMap.get(data.driverId)
              if (driver) {
                driver.status = 'OFFLINE'
                driver.lastSeen = data.timestamp
                newMap.set(data.driverId, driver)
              }
              return newMap
            })
          })

          socketRef.current.on('driver-ping-received', (data: { driverId: string, status: string, timestamp: string }) => {
            setDriverLocations(prev => {
              const newMap = new Map(prev)
              const driver = newMap.get(data.driverId)
              if (driver) {
                driver.lastPing = data.timestamp
                driver.status = data.status as any
                newMap.set(data.driverId, driver)
              }
              return newMap
            })
          })

          socketRef.current.on('location-shared', (data: LocationShareData) => {
            console.log('🔗 Location shared with customer:', data)
            // Handle location sharing success
          })

        } else if (driverId) {
          // Driver-specific listeners
          socketRef.current.on('admin-message', (data: AdminMessage) => {
            setAdminMessages(prev => [...prev, data])
            
            // Auto-remove message after 10 seconds
            setTimeout(() => {
              setAdminMessages(prev => prev.filter(msg => msg.timestamp !== data.timestamp))
            }, 10000)
          })

          socketRef.current.on('ping-ack', (data: { timestamp: string, serverTime: number }) => {
            const latency = Date.now() - data.serverTime
            setPingStatus(latency < 1000 ? 'good' : latency < 3000 ? 'poor' : 'lost')
          })
        }

      } catch (error) {
        console.error('❌ Failed to initialize socket:', error)
        setIsConnected(false)
        setConnectionStatus('disconnected')
      }
    }

    initSocket()

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
      }
    }
  }, [isAdmin, driverId])

  // Driver ping interval
  useEffect(() => {
    if (!isAdmin && driverId && isConnected && socketRef.current) {
      pingIntervalRef.current = setInterval(() => {
        // Get current location (in real app, this would use GPS)
        navigator.geolocation.getCurrentPosition(
          (position) => {
            socketRef.current.emit('driver-ping', {
              driverId,
              status: connectionStatus === 'connected' ? 'ONLINE' : 'OFFLINE',
              location: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
              }
            })
          },
          (error) => {
            console.error('GPS error:', error)
            // Send ping without location
            socketRef.current.emit('driver-ping', {
              driverId,
              status: connectionStatus === 'connected' ? 'ONLINE' : 'OFFLINE'
            })
          }
        )
      }, 10000) // Ping every 10 seconds
    }

    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
      }
    }
  }, [isAdmin, driverId, isConnected, connectionStatus])

  const updateDriverLocation = (driverId: string, location: Partial<DriverLocation>) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('location-update', {
        driverId,
        ...location
      })
    }
  }

  const updateDriverStatus = (driverId: string, status: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('status-change', {
        driverId,
        status
      })
    }
  }

  const joinAsDriver = (driverId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('driver-join', driverId)
    }
  }

  const joinAsAdmin = () => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('admin-join')
    }
  }

  const acceptJob = (driverId: string, orderId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('job-accepted', { driverId, orderId })
    }
  }

  const pickUpOrder = (driverId: string, orderId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('order-picked-up', { driverId, orderId })
    }
  }

  const deliverOrder = (driverId: string, orderId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('order-delivered', { driverId, orderId })
    }
  }

  const sendAdminMessage = (driverId: string, message: string, type: 'info' | 'warning' | 'urgent' = 'info') => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('admin-message', {
        driverId,
        message,
        type
      })
    }
  }

  const shareDriverLocation = (driverId: string, customerPhone: string, customerName: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('share-location', {
        driverId,
        customerPhone,
        customerName
      })
    }
  }

  const getAllDrivers = () => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('get-all-drivers')
    }
  }

  return {
    driverLocations,
    isConnected,
    connectionStatus,
    pingStatus,
    adminMessages,
    updateDriverLocation,
    updateDriverStatus,
    joinAsDriver,
    joinAsAdmin,
    acceptJob,
    pickUpOrder,
    deliverOrder,
    sendAdminMessage,
    shareDriverLocation,
    getAllDrivers
  }
}