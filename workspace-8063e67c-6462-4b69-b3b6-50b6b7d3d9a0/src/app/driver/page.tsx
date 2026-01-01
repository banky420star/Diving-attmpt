'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { 
  MapPin, 
  DollarSign, 
  Clock, 
  Package, 
  Phone, 
  Star,
  Navigation,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp
} from 'lucide-react'

interface Driver {
  id: string
  name: string
  status: 'ONLINE' | 'OFFLINE' | 'ON_JOB' | 'BREAK'
  totalEarnings: number
  rating: number
  totalJobs: number
}

interface Order {
  id: string
  customerName: string
  pickupAddress: string
  deliveryAddress: string
  orderValue: number
  deliveryFee: number
  driverPay: number
  estimatedTime: number
  distance?: number
}

export default function DriverApp() {
  const [driver, setDriver] = useState<Driver | null>(null)
  const [availableOrders, setAvailableOrders] = useState<Order[]>([])
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [currentStatus, setCurrentStatus] = useState<'ONLINE' | 'OFFLINE' | 'BREAK'>('OFFLINE')
  const [loading, setLoading] = useState(true)
  const [jobAlert, setJobAlert] = useState<Order | null>(null)

  // Simulate driver data (in real app, this would come from auth/API)
  useEffect(() => {
    // Mock driver data
    setDriver({
      id: '1',
      name: 'John Smith',
      status: currentStatus,
      totalEarnings: 1250,
      rating: 4.8,
      totalJobs: 47
    })
    setLoading(false)

    // Simulate job alerts when online
    if (currentStatus === 'ONLINE') {
      const timer = setTimeout(() => {
        setJobAlert({
          id: '123',
          customerName: 'Alice Brown',
          pickupAddress: '123 Main Street, Cape Town',
          deliveryAddress: '456 Oak Avenue, Cape Town',
          orderValue: 850,
          deliveryFee: 120,
          driverPay: 72,
          estimatedTime: 25,
          distance: 3.2
        })
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [currentStatus])

  const handleStatusChange = (newStatus: 'ONLINE' | 'OFFLINE' | 'BREAK') => {
    setCurrentStatus(newStatus)
    if (driver) {
      setDriver({ ...driver, status: newStatus })
    }
  }

  const handleAcceptJob = (order: Order) => {
    setActiveOrder(order)
    setJobAlert(null)
    if (driver) {
      setDriver({ ...driver, status: 'ON_JOB' })
    }
  }

  const handleRejectJob = () => {
    setJobAlert(null)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading driver app...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Job Alert Modal */}
      {jobAlert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md animate-pulse">
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <AlertCircle className="w-5 h-5 mr-2 text-orange-500" />
                New Job Alert!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                <p className="font-medium text-orange-900 dark:text-orange-100">
                  {formatCurrency(jobAlert.driverPay)} earnings
                </p>
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  {jobAlert.distance} km • {jobAlert.estimatedTime} min
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-start space-x-2">
                  <Package className="w-4 h-4 mt-0.5 text-slate-500" />
                  <div>
                    <p className="font-medium">{jobAlert.customerName}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Order: {formatCurrency(jobAlert.orderValue)}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-2">
                  <MapPin className="w-4 h-4 mt-0.5 text-slate-500" />
                  <div>
                    <p className="text-sm font-medium">Pickup:</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{jobAlert.pickupAddress}</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-2">
                  <Navigation className="w-4 h-4 mt-0.5 text-slate-500" />
                  <div>
                    <p className="text-sm font-medium">Delivery:</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{jobAlert.deliveryAddress}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <Button 
                  onClick={() => handleAcceptJob(jobAlert)}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Accept Job
                </Button>
                <Button 
                  onClick={handleRejectJob}
                  variant="outline"
                  className="flex-1"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Decline
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm dark:bg-slate-900/80">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Grilled.ink Driver</h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {driver?.name} • ⭐ {driver?.rating}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {formatCurrency(driver?.totalEarnings || 0)}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Today's earnings</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Status Toggle */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${
                  currentStatus === 'ONLINE' ? 'bg-green-500' :
                  currentStatus === 'ON_JOB' ? 'bg-yellow-500' :
                  currentStatus === 'BREAK' ? 'bg-orange-500' : 'bg-red-500'
                }`}></div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {currentStatus === 'ONLINE' ? 'Available for jobs' :
                     currentStatus === 'ON_JOB' ? 'Currently on job' :
                     currentStatus === 'BREAK' ? 'On break' : 'Offline'}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {currentStatus === 'ONLINE' ? 'Waiting for job requests...' :
                     currentStatus === 'ON_JOB' ? 'Complete current job to go online' :
                     currentStatus === 'BREAK' ? 'Taking a short break' : 'Not accepting jobs'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-slate-600 dark:text-slate-400">Offline</span>
                <Switch
                  checked={currentStatus !== 'OFFLINE'}
                  onCheckedChange={(checked) => 
                    handleStatusChange(checked ? 'ONLINE' : 'OFFLINE')
                  }
                  disabled={currentStatus === 'ON_JOB'}
                />
                <span className="text-sm text-slate-600 dark:text-slate-400">Online</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Order or Waiting */}
        {activeOrder ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Package className="w-5 h-5 mr-2" />
                Active Delivery
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="font-medium text-blue-900 dark:text-blue-100">Step 1: Pickup</p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      {activeOrder.pickupAddress}
                    </p>
                    <Button size="sm" className="mt-2 w-full">
                      <Navigation className="w-4 h-4 mr-2" />
                      Navigate to Pickup
                    </Button>
                  </div>
                  
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="font-medium text-green-900 dark:text-green-100">Step 2: Delivery</p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      {activeOrder.deliveryAddress}
                    </p>
                    <Button size="sm" variant="outline" className="mt-2 w-full" disabled>
                      <Navigation className="w-4 h-4 mr-2" />
                      Navigate to Delivery
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="font-medium text-slate-900 dark:text-white">Customer</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {activeOrder.customerName}
                    </p>
                    <Button size="sm" variant="outline" className="mt-2">
                      <Phone className="w-4 h-4 mr-2" />
                      Call Customer
                    </Button>
                  </div>
                  
                  <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <p className="font-medium text-orange-900 dark:text-orange-100">Earnings</p>
                    <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                      {formatCurrency(activeOrder.driverPay)}
                    </p>
                    <p className="text-sm text-orange-700 dark:text-orange-300">
                      {activeOrder.distance} km • {activeOrder.estimatedTime} min
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <Button className="flex-1 bg-green-600 hover:bg-green-700">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark as Picked Up
                </Button>
                <Button variant="outline">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Report Issue
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="w-16 h-16 mx-auto mb-4 text-slate-400" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                {currentStatus === 'ONLINE' ? 'Waiting for job requests...' : 'Go online to receive jobs'}
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                {currentStatus === 'ONLINE' 
                  ? 'You\'ll receive notifications when new orders are available in your area.'
                  : 'Toggle your status to online to start receiving delivery requests.'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <DollarSign className="w-6 h-6 mx-auto mb-2 text-green-600" />
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(driver?.totalEarnings || 0)}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">Today</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <Package className="w-6 h-6 mx-auto mb-2 text-blue-600" />
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {driver?.totalJobs || 0}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">Total Jobs</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <Star className="w-6 h-6 mx-auto mb-2 text-yellow-600" />
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {driver?.rating || 0}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">Rating</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="w-6 h-6 mx-auto mb-2 text-purple-600" />
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {formatCurrency((driver?.totalEarnings || 0) * 7)}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">This Week</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}