import { Server } from 'socket.io'
import { createServer } from 'http'
import cors from 'cors'

const HTTP_PORT = 3001
const server = createServer()
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
})

// Store driver locations and connections
const driverLocations = new Map()
const driverConnections = new Map()

console.log(`🚀 Location Service starting on port ${HTTP_PORT}`)

io.on('connection', (socket) => {
  console.log(`📱 Driver connected: ${socket.id}`)

  // Driver joins with their ID
  socket.on('driver-join', (driverId) => {
    socket.join(`driver-${driverId}`)
    driverConnections.set(driverId, socket.id)
    console.log(`👨‍✈️ Driver ${driverId} joined session`)
  })

  // Driver updates location
  socket.on('location-update', (data) => {
    const { driverId, latitude, longitude, status, heading } = data
    
    // Update driver location
    driverLocations.set(driverId, {
      latitude,
      longitude,
      status,
      heading,
      timestamp: new Date().toISOString(),
      socketId: socket.id
    })

    // Broadcast to admin dashboard
    socket.broadcast.emit('driver-location-update', {
      driverId,
      latitude,
      longitude,
      status,
      heading,
      timestamp: new Date().toISOString()
    })

    console.log(`📍 Driver ${driverId} location updated: ${latitude}, ${longitude}`)
  })

  // Driver accepts job
  socket.on('job-accepted', (data) => {
    const { driverId, orderId } = data
    
    // Update driver status
    const location = driverLocations.get(driverId)
    if (location) {
      location.status = 'ON_JOB'
      driverLocations.set(driverId, location)
    }

    // Notify admin dashboard
    socket.broadcast.emit('job-status-update', {
      driverId,
      orderId,
      status: 'ACCEPTED',
      timestamp: new Date().toISOString()
    })

    console.log(`✅ Driver ${driverId} accepted job ${orderId}`)
  })

  // Driver picks up order
  socket.on('order-picked-up', (data) => {
    const { driverId, orderId } = data
    
    // Notify admin dashboard
    socket.broadcast.emit('job-status-update', {
      driverId,
      orderId,
      status: 'PICKED_UP',
      timestamp: new Date().toISOString()
    })

    console.log(`📦 Driver ${driverId} picked up order ${orderId}`)
  })

  // Driver delivers order
  socket.on('order-delivered', (data) => {
    const { driverId, orderId } = data
    
    // Update driver status back to online
    const location = driverLocations.get(driverId)
    if (location) {
      location.status = 'ONLINE'
      driverLocations.set(driverId, location)
    }

    // Notify admin dashboard
    socket.broadcast.emit('job-status-update', {
      driverId,
      orderId,
      status: 'DELIVERED',
      timestamp: new Date().toISOString()
    })

    console.log(`✨ Driver ${driverId} delivered order ${orderId}`)
  })

  // Admin requests all driver locations
  socket.on('get-all-drivers', () => {
    const drivers = Array.from(driverLocations.entries()).map(([driverId, data]) => ({
      driverId,
      ...data
    }))
    
    socket.emit('all-drivers-locations', drivers)
  })

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`📱 Driver disconnected: ${socket.id}`)
    
    // Find and remove driver from connections
    for (const [driverId, socketId] of driverConnections.entries()) {
      if (socketId === socket.id) {
        driverConnections.delete(driverId)
        
        // Mark driver as offline
        const location = driverLocations.get(driverId)
        if (location) {
          location.status = 'OFFLINE'
          location.lastSeen = new Date().toISOString()
          driverLocations.set(driverId, location)
        }

        // Notify admin dashboard
        socket.broadcast.emit('driver-disconnected', {
          driverId,
          timestamp: new Date().toISOString()
        })
        
        break
      }
    }
  })
})

// Health check endpoint
server.on('request', (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'healthy',
      activeDrivers: driverConnections.size,
      trackedDrivers: driverLocations.size,
      timestamp: new Date().toISOString()
    }))
    return
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
})

server.listen(HTTP_PORT, () => {
  console.log(`🌐 Location Service running on http://localhost:${HTTP_PORT}`)
  console.log(`📊 Health check: http://localhost:${HTTP_PORT}/health`)
  console.log(`🔗 WebSocket endpoint: ws://localhost:${HTTP_PORT}`)
})