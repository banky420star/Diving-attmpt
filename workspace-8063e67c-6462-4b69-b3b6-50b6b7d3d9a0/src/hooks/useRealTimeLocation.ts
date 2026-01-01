import { useEffect, useState, useRef } from 'react'

interface DriverLocation {
  driverId: string
  latitude: number
  longitude: number
  status: 'ONLINE' | 'OFFLINE' | 'ON_JOB' | 'BREAK'
  heading?: number
  timestamp: string
  socketId: string
}

interface JobStatusUpdate {
  driverId: string
  orderId: string
  status: string
  timestamp: string
}

export function useRealTimeLocation() {
  const [driverLocations, setDriverLocations] = useState<Map<string, DriverLocation>>(new Map())
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<any>(null)

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
          console.log('🔗 Connected to location service')
          setIsConnected(true)
          
          // Request all driver locations
          socketRef.current.emit('get-all-drivers')
        })

        socketRef.current.on('disconnect', () => {
          console.log('🔌 Disconnected from location service')
          setIsConnected(false)
        })

        // Listen for driver location updates
        socketRef.current.on('driver-location-update', (data: DriverLocation) => {
          setDriverLocations(prev => {
            const newMap = new Map(prev)
            newMap.set(data.driverId, data)
            return newMap
          })
        })

        // Listen for all drivers locations (initial load)
        socketRef.current.on('all-drivers-locations', (drivers: DriverLocation[]) => {
          const newMap = new Map<string, DriverLocation>()
          drivers.forEach(driver => {
            newMap.set(driver.driverId, driver)
          })
          setDriverLocations(newMap)
        })

        // Listen for job status updates
        socketRef.current.on('job-status-update', (data: JobStatusUpdate) => {
          console.log('📦 Job status update:', data)
          // Update driver status based on job
          setDriverLocations(prev => {
            const newMap = new Map(prev)
            const driver = newMap.get(data.driverId)
            if (driver) {
              if (data.status === 'DELIVERED') {
                driver.status = 'ONLINE'
              } else if (data.status === 'ACCEPTED' || data.status === 'PICKED_UP') {
                driver.status = 'ON_JOB'
              }
              newMap.set(data.driverId, driver)
            }
            return newMap
          })
        })

        // Listen for driver disconnections
        socketRef.current.on('driver-disconnected', (data: { driverId: string }) => {
          setDriverLocations(prev => {
            const newMap = new Map(prev)
            const driver = newMap.get(data.driverId)
            if (driver) {
              driver.status = 'OFFLINE'
              newMap.set(data.driverId, driver)
            }
            return newMap
          })
        })

      } catch (error) {
        console.error('❌ Failed to initialize socket:', error)
        setIsConnected(false)
      }
    }

    initSocket()

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [])

  const updateDriverLocation = (driverId: string, location: Partial<DriverLocation>) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('location-update', {
        driverId,
        ...location
      })
    }
  }

  const joinAsDriver = (driverId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('driver-join', driverId)
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

  return {
    driverLocations,
    isConnected,
    updateDriverLocation,
    joinAsDriver,
    acceptJob,
    pickUpOrder,
    deliverOrder
  }
}