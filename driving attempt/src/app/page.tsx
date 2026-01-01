'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { io, Socket } from 'socket.io-client'
import { 
  MapPin, 
  Package, 
  Users, 
  TrendingUp, 
  Settings, 
  Bell,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Phone,
  Mail,
  Navigation,
  Clock,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Truck,
  User,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  Zap,
  Globe,
  MessageSquare,
  Share2,
  Eye,
  Edit,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  ChevronRight,
  Star,
  Award,
  Target,
  ArrowUp,
  ArrowDown,
  Menu,
  X,
  Home,
  FileText,
  HelpCircle,
  LogOut
} from 'lucide-react'

interface Driver {
  id: string
  name: string
  email: string
  phone: string
  status: 'online' | 'offline' | 'busy'
  location?: { lat: number; lng: number }
  currentJob?: string
  earnings: number
  rating: number
  completedJobs: number
  vehicleType?: string
  plateNumber?: string
}

interface Order {
  id: string
  customerName: string
  customerPhone: string
  customerEmail: string
  pickupAddress: string
  deliveryAddress: string
  status: 'pending' | 'assigned' | 'accepted' | 'picked_up' | 'delivered'
  assignedDriver?: string
  earnings: number
  priority: 'low' | 'medium' | 'high'
  createdAt: string
  estimatedDelivery?: string
  specialInstructions?: string
}

interface SystemStats {
  totalOrders: number
  activeDrivers: number
  revenue: number
  avgDeliveryTime: number
  completionRate: number
}

export default function ModernAdminDashboard() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<SystemStats>({
    totalOrders: 0,
    activeDrivers: 0,
    revenue: 0,
    avgDeliveryTime: 0,
    completionRate: 0
  })
  
  // UI State
  const [activeTab, setActiveTab] = useState('overview')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)
  const [showNewOrderModal, setShowNewOrderModal] = useState(false)
  const [showDriverModal, setShowDriverModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  
  // Form States
  const [newOrder, setNewOrder] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    pickupAddress: '',
    deliveryAddress: '',
    priority: 'medium' as const,
    specialInstructions: ''
  })
  
  const [newDriver, setNewDriver] = useState({
    name: '',
    email: '',
    phone: '',
    vehicleType: '',
    plateNumber: ''
  })

  // Initialize Socket Connection
  useEffect(() => {
    const newSocket = io('http://localhost:3001')
    
    newSocket.on('connect', () => {
      setConnected(true)
      console.log('Connected to location service')
    })
    
    newSocket.on('disconnect', () => {
      setConnected(false)
      console.log('Disconnected from location service')
    })
    
    newSocket.on('driverUpdate', (data: Driver) => {
      setDrivers(prev => prev.map(d => d.id === data.id ? data : d))
    })
    
    newSocket.on('orderUpdate', (data: Order) => {
      setOrders(prev => prev.map(o => o.id === data.id ? data : o))
    })
    
    newSocket.on('newOrder', (order: Order) => {
      setOrders(prev => [order, ...prev])
      addNotification({
        type: 'success',
        title: 'New Order Received',
        message: `Order from ${order.customerName}`
      })
    })
    
    newSocket.on('driverStatusChange', (data: { driverId: string; status: string }) => {
      setDrivers(prev => prev.map(d => 
        d.id === data.driverId ? { ...d, status: data.status as any } : d
      ))
    })
    
    setSocket(newSocket)
    
    // Fetch initial data
    fetchInitialData()
    
    return () => {
      newSocket.close()
    }
  }, [])

  const fetchInitialData = async () => {
    try {
      // Mock data for now
      const mockDrivers: Driver[] = [
        {
          id: '1',
          name: 'Alex Johnson',
          email: 'alex@example.com',
          phone: '+1234567890',
          status: 'online',
          location: { lat: 40.7128, lng: -74.0060 },
          earnings: 245.50,
          rating: 4.8,
          completedJobs: 23,
          vehicleType: 'Motorcycle',
          plateNumber: 'ABC-123'
        },
        {
          id: '2',
          name: 'Sarah Chen',
          email: 'sarah@example.com',
          phone: '+1234567891',
          status: 'busy',
          location: { lat: 40.7580, lng: -73.9855 },
          currentJob: 'ORD-002',
          earnings: 189.25,
          rating: 4.9,
          completedJobs: 31,
          vehicleType: 'Van',
          plateNumber: 'XYZ-789'
        }
      ]
      
      const mockOrders: Order[] = [
        {
          id: 'ORD-001',
          customerName: 'John Smith',
          customerPhone: '+1234567890',
          customerEmail: 'john@example.com',
          pickupAddress: '123 Main St, New York, NY',
          deliveryAddress: '456 Oak Ave, New York, NY',
          status: 'assigned',
          assignedDriver: 'Alex Johnson',
          earnings: 15.99,
          priority: 'high',
          createdAt: new Date().toISOString(),
          estimatedDelivery: '30 mins'
        },
        {
          id: 'ORD-002',
          customerName: 'Emily Davis',
          customerPhone: '+1234567891',
          customerEmail: 'emily@example.com',
          pickupAddress: '789 Pine St, New York, NY',
          deliveryAddress: '321 Elm St, New York, NY',
          status: 'picked_up',
          assignedDriver: 'Sarah Chen',
          earnings: 22.50,
          priority: 'medium',
          createdAt: new Date().toISOString(),
          estimatedDelivery: '15 mins'
        }
      ]
      
      setDrivers(mockDrivers)
      setOrders(mockOrders)
      setStats({
        totalOrders: mockOrders.length,
        activeDrivers: mockDrivers.filter(d => d.status === 'online').length,
        revenue: mockOrders.reduce((sum, o) => sum + o.earnings, 0),
        avgDeliveryTime: 28,
        completionRate: 96.5
      })
    } catch (error) {
      console.error('Error fetching initial data:', error)
    }
  }

  const addNotification = (notification: any) => {
    setNotifications(prev => [notification, ...prev.slice(0, 4)])
  }

  const handleCreateOrder = () => {
    if (!newOrder.customerName || !newOrder.pickupAddress || !newOrder.deliveryAddress) {
      addNotification({
        type: 'error',
        title: 'Missing Information',
        message: 'Please fill in all required fields'
      })
      return
    }
    
    const order: Order = {
      id: `ORD-${Date.now()}`,
      ...newOrder,
      status: 'pending',
      earnings: Math.random() * 30 + 10,
      createdAt: new Date().toISOString()
    }
    
    socket?.emit('createOrder', order)
    setOrders(prev => [order, ...prev])
    setShowNewOrderModal(false)
    setNewOrder({
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      pickupAddress: '',
      deliveryAddress: '',
      priority: 'medium',
      specialInstructions: ''
    })
    
    addNotification({
      type: 'success',
      title: 'Order Created',
      message: `Order ${order.id} has been created successfully`
    })
  }

  const handleCreateDriver = () => {
    if (!newDriver.name || !newDriver.email || !newDriver.phone) {
      addNotification({
        type: 'error',
        title: 'Missing Information',
        message: 'Please fill in all required fields'
      })
      return
    }
    
    const driver: Driver = {
      id: `DRV-${Date.now()}`,
      ...newDriver,
      status: 'offline',
      earnings: 0,
      rating: 5.0,
      completedJobs: 0
    }
    
    setDrivers(prev => [...prev, driver])
    setShowDriverModal(false)
    setNewDriver({
      name: '',
      email: '',
      phone: '',
      vehicleType: '',
      plateNumber: ''
    })
    
    addNotification({
      type: 'success',
      title: 'Driver Added',
      message: `${driver.name} has been added to the fleet`
    })
  }

  const handleAssignOrder = (orderId: string, driverId: string) => {
    socket?.emit('assignOrder', { orderId, driverId })
    setOrders(prev => prev.map(o => 
      o.id === orderId ? { ...o, assignedDriver: driverId, status: 'assigned' } : o
    ))
    
    addNotification({
      type: 'info',
      title: 'Order Assigned',
      message: `Order ${orderId} has been assigned to driver`
    })
  }

  const handleShareLocation = (driverId: string) => {
    const driver = drivers.find(d => d.id === driverId)
    if (!driver || !driver.location) return
    
    const trackingLink = `https://grilled.ink/track/${driverId}`
    navigator.clipboard.writeText(trackingLink)
    
    addNotification({
      type: 'success',
      title: 'Location Shared',
      message: 'Tracking link copied to clipboard'
    })
  }

  const handlePingDriver = (driverId: string) => {
    socket?.emit('pingDriver', driverId)
    addNotification({
      type: 'info',
      title: 'Ping Sent',
      message: 'Driver has been notified'
    })
  }

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'drivers', label: 'Drivers', icon: Users },
    { id: 'orders', label: 'Orders', icon: Package },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings }
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-500 bg-green-50 border-green-200'
      case 'offline': return 'text-gray-500 bg-gray-50 border-gray-200'
      case 'busy': return 'text-yellow-500 bg-yellow-50 border-yellow-200'
      case 'delivered': return 'text-green-500 bg-green-50 border-green-200'
      case 'picked_up': return 'text-blue-500 bg-blue-50 border-blue-200'
      case 'assigned': return 'text-purple-500 bg-purple-50 border-purple-200'
      case 'pending': return 'text-orange-500 bg-orange-50 border-orange-200'
      default: return 'text-gray-500 bg-gray-50 border-gray-200'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200 sticky top-0 z-50">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Grilled.ink Admin</h1>
                <p className="text-sm text-gray-500">Delivery Management System</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search orders, drivers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                />
              </div>
              
              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Bell className="w-5 h-5 text-gray-600" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {notifications.length}
                    </span>
                  )}
                </button>
                
                <AnimatePresence>
                  {showNotifications && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
                    >
                      <div className="p-4 border-b border-gray-100">
                        <h3 className="font-semibold text-gray-900">Notifications</h3>
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {notifications.map((notification, index) => (
                          <div key={index} className="p-4 border-b border-gray-50 hover:bg-gray-50">
                            <div className="flex items-start space-x-3">
                              <div className={`p-1 rounded-full ${
                                notification.type === 'success' ? 'bg-green-100' :
                                notification.type === 'error' ? 'bg-red-100' :
                                'bg-blue-100'
                              }`}>
                                {notification.type === 'success' ? <CheckCircle className="w-4 h-4 text-green-600" /> :
                                 notification.type === 'error' ? <AlertCircle className="w-4 h-4 text-red-600" /> :
                                 <Bell className="w-4 h-4 text-blue-600" />}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{notification.title}</p>
                                <p className="text-sm text-gray-500">{notification.message}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              {/* Connection Status */}
              <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-lg">
                <div className={`w-2 h-2 rounded-full ${
                  connected ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <span className="text-sm text-gray-600">
                  {connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 bg-white/50 backdrop-blur-xl border-r border-gray-200 min-h-screen`}>
          <nav className="p-4 space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
                  activeTab === item.id
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
                {activeTab === item.id && (
                  <ChevronRight className="w-4 h-4 ml-auto" />
                )}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Stats Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-200 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Total Orders</p>
                          <p className="text-3xl font-bold text-gray-900">{stats.totalOrders}</p>
                          <p className="text-sm text-green-600 flex items-center mt-1">
                            <ArrowUp className="w-4 h-4 mr-1" />
                            12% from yesterday
                          </p>
                        </div>
                        <div className="p-3 bg-blue-100 rounded-xl">
                          <Package className="w-6 h-6 text-blue-600" />
                        </div>
                      </div>
                    </motion.div>
                    
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-200 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Active Drivers</p>
                          <p className="text-3xl font-bold text-gray-900">{stats.activeDrivers}</p>
                          <p className="text-sm text-green-600 flex items-center mt-1">
                            <ArrowUp className="w-4 h-4 mr-1" />
                            8% from last week
                          </p>
                        </div>
                        <div className="p-3 bg-green-100 rounded-xl">
                          <Users className="w-6 h-6 text-green-600" />
                        </div>
                      </div>
                    </motion.div>
                    
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-200 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Revenue</p>
                          <p className="text-3xl font-bold text-gray-900">${stats.revenue.toFixed(2)}</p>
                          <p className="text-sm text-green-600 flex items-center mt-1">
                            <ArrowUp className="w-4 h-4 mr-1" />
                            23% from last month
                          </p>
                        </div>
                        <div className="p-3 bg-purple-100 rounded-xl">
                          <DollarSign className="w-6 h-6 text-purple-600" />
                        </div>
                      </div>
                    </motion.div>
                    
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-200 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Completion Rate</p>
                          <p className="text-3xl font-bold text-gray-900">{stats.completionRate}%</p>
                          <p className="text-sm text-green-600 flex items-center mt-1">
                            <ArrowUp className="w-4 h-4 mr-1" />
                            2% improvement
                          </p>
                        </div>
                        <div className="p-3 bg-orange-100 rounded-xl">
                          <Target className="w-6 h-6 text-orange-600" />
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  {/* Quick Actions */}
                  <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-200 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <button
                        onClick={() => setShowNewOrderModal(true)}
                        className="flex items-center space-x-3 p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg"
                      >
                        <Plus className="w-5 h-5" />
                        <span className="font-medium">New Order</span>
                      </button>
                      <button
                        onClick={() => setShowDriverModal(true)}
                        className="flex items-center space-x-3 p-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all shadow-lg"
                      >
                        <User className="w-5 h-5" />
                        <span className="font-medium">Add Driver</span>
                      </button>
                      <button className="flex items-center space-x-3 p-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg">
                        <BarChart3 className="w-5 h-5" />
                        <span className="font-medium">Analytics</span>
                      </button>
                      <button className="flex items-center space-x-3 p-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg">
                        <MessageSquare className="w-5 h-5" />
                        <span className="font-medium">Messages</span>
                      </button>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-200 shadow-sm">
                      <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Orders</h2>
                      <div className="space-y-3">
                        {orders.slice(0, 5).map((order) => (
                          <div key={order.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                            <div className="flex items-center space-x-3">
                              <div className={`p-2 rounded-lg ${getStatusColor(order.status)}`}>
                                <Package className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{order.id}</p>
                                <p className="text-sm text-gray-500">{order.customerName}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-gray-900">${order.earnings.toFixed(2)}</p>
                              <p className="text-sm text-gray-500">{order.status}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-200 shadow-sm">
                      <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Drivers</h2>
                      <div className="space-y-3">
                        {drivers.filter(d => d.status === 'online' || d.status === 'busy').map((driver) => (
                          <div key={driver.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                            <div className="flex items-center space-x-3">
                              <div className={`p-2 rounded-lg ${getStatusColor(driver.status)}`}>
                                <Truck className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{driver.name}</p>
                                <p className="text-sm text-gray-500">{driver.vehicleType}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-gray-900">${driver.earnings.toFixed(2)}</p>
                              <p className="text-sm text-gray-500">{driver.completedJobs} jobs</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'drivers' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900">Drivers</h2>
                    <button
                      onClick={() => setShowDriverModal(true)}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Driver</span>
                    </button>
                  </div>
                  
                  <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Earnings</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jobs</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {drivers.map((driver) => (
                            <tr key={driver.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4">
                                <div>
                                  <p className="font-medium text-gray-900">{driver.name}</p>
                                  <p className="text-sm text-gray-500">{driver.email}</p>
                                  <p className="text-sm text-gray-500">{driver.phone}</p>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(driver.status)}`}>
                                  {driver.status}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div>
                                  <p className="text-sm text-gray-900">{driver.vehicleType}</p>
                                  <p className="text-sm text-gray-500">{driver.plateNumber}</p>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <p className="font-medium text-gray-900">${driver.earnings.toFixed(2)}</p>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center">
                                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                                  <span className="ml-1 text-sm text-gray-900">{driver.rating}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-sm text-gray-900">{driver.completedJobs}</p>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => handlePingDriver(driver.id)}
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                  >
                                    <Navigation className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleShareLocation(driver.id)}
                                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                                  >
                                    <Share2 className="w-4 h-4" />
                                  </button>
                                  <button className="p-1 text-gray-600 hover:bg-gray-50 rounded">
                                    <MoreVertical className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'orders' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900">Orders</h2>
                    <button
                      onClick={() => setShowNewOrderModal(true)}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>New Order</span>
                    </button>
                  </div>
                  
                  <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pickup</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delivery</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Earnings</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {orders.map((order) => (
                            <tr key={order.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4">
                                <div>
                                  <p className="font-medium text-gray-900">{order.id}</p>
                                  <p className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</p>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div>
                                  <p className="font-medium text-gray-900">{order.customerName}</p>
                                  <p className="text-sm text-gray-500">{order.customerPhone}</p>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-sm text-gray-900 truncate max-w-xs">{order.pickupAddress}</p>
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-sm text-gray-900 truncate max-w-xs">{order.deliveryAddress}</p>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                  {order.status}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                {order.assignedDriver ? (
                                  <span className="text-sm text-gray-900">{order.assignedDriver}</span>
                                ) : (
                                  <select
                                    onChange={(e) => handleAssignOrder(order.id, e.target.value)}
                                    className="text-sm border border-gray-300 rounded px-2 py-1"
                                    defaultValue=""
                                  >
                                    <option value="">Assign Driver</option>
                                    {drivers.filter(d => d.status === 'online').map(driver => (
                                      <option key={driver.id} value={driver.id}>{driver.name}</option>
                                    ))}
                                  </select>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <p className="font-medium text-gray-900">${order.earnings.toFixed(2)}</p>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center space-x-2">
                                  <button className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button className="p-1 text-green-600 hover:bg-green-50 rounded">
                                    <Share2 className="w-4 h-4" />
                                  </button>
                                  <button className="p-1 text-gray-600 hover:bg-gray-50 rounded">
                                    <MoreVertical className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'analytics' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-gray-900">Analytics</h2>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-200 shadow-sm">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Overview</h3>
                      <div className="h-64 flex items-center justify-center bg-gray-50 rounded-xl">
                        <BarChart3 className="w-16 h-16 text-gray-400" />
                      </div>
                    </div>
                    
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-200 shadow-sm">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Distribution</h3>
                      <div className="h-64 flex items-center justify-center bg-gray-50 rounded-xl">
                        <PieChart className="w-16 h-16 text-gray-400" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
                  
                  <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">System Settings</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">Real-time Tracking</p>
                          <p className="text-sm text-gray-500">Enable real-time driver location tracking</p>
                        </div>
                        <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-500">
                          <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6" />
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">Email Notifications</p>
                          <p className="text-sm text-gray-500">Send email notifications for new orders</p>
                        </div>
                        <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300">
                          <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-1" />
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">Auto-assign Orders</p>
                          <p className="text-sm text-gray-500">Automatically assign orders to nearest driver</p>
                        </div>
                        <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300">
                          <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-1" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* New Order Modal */}
      <AnimatePresence>
        {showNewOrderModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowNewOrderModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Order</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
                  <input
                    type="text"
                    value={newOrder.customerName}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, customerName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="John Smith"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Phone</label>
                  <input
                    type="tel"
                    value={newOrder.customerPhone}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, customerPhone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+1 234 567 890"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Email</label>
                  <input
                    type="email"
                    value={newOrder.customerEmail}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, customerEmail: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="john@example.com"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Address *</label>
                  <input
                    type="text"
                    value={newOrder.pickupAddress}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, pickupAddress: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="123 Main St, New York, NY"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Address *</label>
                  <input
                    type="text"
                    value={newOrder.deliveryAddress}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, deliveryAddress: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="456 Oak Ave, New York, NY"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={newOrder.priority}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, priority: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Special Instructions</label>
                  <textarea
                    value={newOrder.specialInstructions}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, specialInstructions: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Any special delivery instructions..."
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowNewOrderModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateOrder}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Create Order
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Driver Modal */}
      <AnimatePresence>
        {showDriverModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowDriverModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Driver</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={newDriver.name}
                    onChange={(e) => setNewDriver(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="John Smith"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    value={newDriver.email}
                    onChange={(e) => setNewDriver(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="john@example.com"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    value={newDriver.phone}
                    onChange={(e) => setNewDriver(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+1 234 567 890"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
                  <select
                    value={newDriver.vehicleType}
                    onChange={(e) => setNewDriver(prev => ({ ...prev, vehicleType: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select vehicle type</option>
                    <option value="Motorcycle">Motorcycle</option>
                    <option value="Car">Car</option>
                    <option value="Van">Van</option>
                    <option value="Truck">Truck</option>
                    <option value="Bicycle">Bicycle</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">License Plate</label>
                  <input
                    type="text"
                    value={newDriver.plateNumber}
                    onChange={(e) => setNewDriver(prev => ({ ...prev, plateNumber: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="ABC-123"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowDriverModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateDriver}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  Add Driver
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}