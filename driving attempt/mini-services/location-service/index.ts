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
const adminConnections = new Set()

console.log(`🚀 Grilled.ink Location Service starting on port ${HTTP_PORT}`)

io.on('connection', (socket) => {
  console.log(`📱 Client connected: ${socket.id}`)

  // Admin joins
  socket.on('admin-join', () => {
    adminConnections.add(socket.id)
    socket.join('admin-room')
    console.log('👨‍💼 Admin joined dashboard')
    
    // Send current driver locations to new admin
    const drivers = Array.from(driverLocations.entries()).map(([driverId, data]) => ({
      driverId,
      ...data
    }))
    socket.emit('all-drivers-locations', drivers)
  })

  // Driver joins with their ID
  socket.on('driver-join', (driverId) => {
    socket.join(`driver-${driverId}`)
    driverConnections.set(driverId, socket.id)
    console.log(`👨‍✈️ Driver ${driverId} joined session`)
    
    // Notify all admins about new driver
    const driverData = driverLocations.get(driverId)
    if (driverData) {
      io.to('admin-room').emit('driver-connected', {
        driverId,
        ...driverData
      })
    }
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

    // Broadcast to all admin dashboards
    io.to('admin-room').emit('driver-location-update', {
      driverId,
      latitude,
      longitude,
      status,
      heading,
      timestamp: new Date().toISOString()
    })

    console.log(`📍 Driver ${driverId} location updated: ${latitude}, ${longitude}`)
  })

  // Driver status change (online/offline/break)
  socket.on('status-change', (data) => {
    const { driverId, status } = data
    
    // Update driver status
    const location = driverLocations.get(driverId)
    if (location) {
      location.status = status
      location.timestamp = new Date().toISOString()
      driverLocations.set(driverId, location)
    }

    // Notify all admin dashboards
    io.to('admin-room').emit('driver-status-change', {
      driverId,
      status,
      timestamp: new Date().toISOString()
    })

    console.log(`🔄 Driver ${driverId} status changed to: ${status}`)
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

    // Notify admin dashboards
    io.to('admin-room').emit('job-status-update', {
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
    
    // Notify admin dashboards
    io.to('admin-room').emit('job-status-update', {
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

    // Notify admin dashboards
    io.to('admin-room').emit('job-status-update', {
      driverId,
      orderId,
      status: 'DELIVERED',
      timestamp: new Date().toISOString()
    })

    console.log(`✨ Driver ${driverId} delivered order ${orderId}`)
  })

  // Driver sends ping (heartbeat)
  socket.on('driver-ping', (data) => {
    const { driverId, status, location } = data
    
    // Update driver location and status
    driverLocations.set(driverId, {
      latitude: location?.latitude,
      longitude: location?.longitude,
      status,
      lastPing: new Date().toISOString(),
      socketId: socket.id
    })

    // Echo ping back to driver
    socket.emit('ping-ack', {
      timestamp: new Date().toISOString(),
      serverTime: Date.now()
    })

    // Notify admin dashboards of driver activity
    io.to('admin-room').emit('driver-ping-received', {
      driverId,
      status,
      location,
      timestamp: new Date().toISOString()
    })

    console.log(`📡 Ping from driver ${driverId}: ${status}`)
  })

  // Admin requests all driver locations
  socket.on('get-all-drivers', () => {
    const drivers = Array.from(driverLocations.entries()).map(([driverId, data]) => ({
      driverId,
      ...data
    }))
    
    socket.emit('all-drivers-locations', drivers)
  })

  // Admin sends message to driver
  socket.on('admin-message', (data) => {
    const { driverId, message, type } = data
    
    // Send to specific driver
    io.to(`driver-${driverId}`).emit('admin-message', {
      message,
      type,
      timestamp: new Date().toISOString(),
      fromAdmin: true
    })

    console.log(`💬 Admin message to driver ${driverId}: ${message}`)
  })

  // Admin shares driver location with client
  socket.on('share-location', (data) => {
    const { driverId, customerPhone, customerName } = data
    
    const location = driverLocations.get(driverId)
    if (location && location.latitude && location.longitude) {
      // Generate tracking link
      const trackingLink = `https://grilled.ink/track/${driverId}?lat=${location.latitude}&lng=${location.longitude}`
      
      // Notify admin that location was shared
      socket.emit('location-shared', {
        driverId,
        customerPhone,
        customerName,
        trackingLink,
        location,
        timestamp: new Date().toISOString()
      })

      console.log(`🔗 Location shared for driver ${driverId} with customer ${customerName}`)
    }
  })

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`📱 Client disconnected: ${socket.id}`)
    
    // Remove from admin connections
    if (adminConnections.has(socket.id)) {
      adminConnections.delete(socket.id)
      console.log('👨‍💼 Admin disconnected')
      return
    }
    
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

        // Notify admin dashboards
        io.to('admin-room').emit('driver-disconnected', {
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
      adminConnections: adminConnections.size,
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
  console.log(`🌐 Grilled.ink Location Service running on http://localhost:${HTTP_PORT}`)
  console.log(`📊 Health check: http://localhost:${HTTP_PORT}/health`)
  console.log(`🔗 WebSocket endpoint: ws://localhost:${HTTP_PORT}`)
  console.log(`👨‍💼 Admin room: admin-room`)
  console.log(`👨‍✈️ Driver rooms: driver-{driverId}`)
})