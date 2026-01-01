import { Server } from 'socket.io'
import { createServer } from 'http'
import cors from 'cors'

const HTTP_PORT = 3002
const server = createServer()
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
})

// Store tracking data
const trackingData = new Map()

console.log(`📍 Grilled.ink Location Tracking Service starting on port ${HTTP_PORT}`)

io.on('connection', (socket) => {
  console.log(`📱 Client connected: ${socket.id}`)

  // Driver shares location with customer
  socket.on('share-location', (data) => {
    const { driverId, customerPhone, customerName, latitude, longitude } = data
    
    // Store tracking data
    trackingData.set(driverId, {
      customerPhone,
      customerName,
      latitude,
      longitude,
      timestamp: new Date().toISOString(),
      sharedAt: new Date().toISOString()
    })

    console.log(`🔗 Location shared for driver ${driverId} with customer ${customerName}`)
  })

    // Customer requests tracking info
    socket.on('get-tracking', (data) => {
      const { driverId, orderId } = data
      
      const tracking = trackingData.get(driverId)
      if (tracking) {
        socket.emit('tracking-info', {
          driverId,
          orderId,
          tracking
        })
      } else {
        socket.emit('tracking-error', {
          driverId,
          orderId,
          error: 'Tracking not found'
        })
      }
    })

    // Driver updates location
    socket.on('update-location', (data) => {
      const { driverId, latitude, longitude } = data
      
      const tracking = trackingData.get(driverId)
      if (tracking) {
        tracking.latitude = latitude
        tracking.longitude = longitude
        tracking.timestamp = new Date().toISOString()
        
        trackingData.set(driverId, tracking)
        
        // Notify admin about location update
        io.emit('location-update', {
          driverId,
          latitude,
          longitude,
          timestamp: new Date().toISOString()
        })
        
        console.log(`📍 Driver ${driverId} location updated: ${latitude}, ${longitude}`)
      }
    }
  })

    // Customer requests tracking link
    socket.on('get-tracking-link', (data) => {
      const { driverId, orderId } = data
      
      const tracking = trackingData.get(driverId)
      if (tracking) {
        const trackingLink = `https://grilled.ink/track/${driverId}`
        
        socket.emit('tracking-link', {
          driverId,
          orderId,
          trackingLink,
          customerPhone,
          customerName
          tracking: {
            latitude,
            longitude,
            timestamp: tracking.timestamp
            sharedAt: tracking.sharedAt
          }
        })
        
        console.log(`🔗 Tracking link sent for driver ${driverId} for order ${orderId}`)
      } else {
        socket.emit('tracking-error', {
          driverId,
          orderId,
          error: 'Tracking not found'
        })
      }
    })

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`📱 Client disconnected: ${socket.id}`)
    })
  })
})

// Health check endpoint
server.on('request', (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'healthy',
      activeTracking: trackingData.size,
      timestamp: new Date().toISOString()
    }))
    return
  }
  }
  
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    })
    res.end()
    return
  }
  }
})

server.listen(HTTP_PORT, () => {
  console.log(`🌐 Grilled.ink Location Tracking Service running on http://localhost:${HTTP_PORT}`)
  console.log(`📊 Health check: http://localhost:${HTTP_PORT}/health`)
  console.log(`🔗 WebSocket endpoint: ws://localhost:${HTTP_PORT}`)
})