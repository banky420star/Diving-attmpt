'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Package, 
  DollarSign, 
  Clock, 
  MapPin, 
  Phone,
  Car,
  Navigation,
  Star,
  Zap,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  Settings,
  Bell,
  MessageSquare,
  TrendingUp,
  Target,
  Award,
  Eye,
  Share2
} from 'lucide-react'
import { useRealTimeLocation } from '@/hooks/useRealTimeLocation'

interface Job {
  id: string
  customerName: string
  customerPhone: string
  pickupAddress: string
  deliveryAddress: string
  orderValue: number
  deliveryFee: number
  driverPay: number
  paymentType: 'EFT' | 'CASH'
  status: string
  pickupLat: number
  pickupLng: number
  deliveryLat: number
  deliveryLng: number
  estimatedTime: string
  createdAt: string
}

interface Driver {
  id: string
  name: string
  email: string
  phone: string
  vehicleType: 'CAR' | 'MOTORBIKE' | 'VAN'
  vehiclePlate?: string
  status: 'ONLINE' | 'OFFLINE' | 'ON_JOB' | 'BREAK'
  rating: number
  totalJobs: number
  totalEarnings: number
  lastActiveAt: string
}

export default function DriverApp() {
  const [driver, setDriver] = useState<Driver | null>(null)
  const [currentJob, setCurrentJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [showJobDetails, setShowJobDetails] = useState(false)
  const [earningsToday, setEarningsToday] = useState(0)
  const [jobsCompleted, setJobsCompleted] = useState(0)

  // Real-time location hook for driver
  const { 
    isConnected, 
    connectionStatus, 
    updateLocation,
    updateJobStatus,
    acceptJob,
    startJob,
    completeJob,
    currentLocation,
    nearbyJobs,
    adminMessages
  } = useRealTimeLocation(false)

  // Fetch driver data on mount
  useEffect(() => {
    fetchDriverData()
    const interval = setInterval(fetchDriverData, 30000) // Update every 30 seconds
    return () => clearInterval(interval)
  }, [])

  // Update earnings and job count when jobs change
  useEffect(() => {
    if (nearbyJobs.length > 0) {
      const todayJobs = nearbyJobs.filter(job => 
        new Date(job.createdAt).toDateString() === new Date().toDateString()
      )
      const completedJobs = todayJobs.filter(job => job.status === 'DELIVERED')
      const todayEarnings = completedJobs.reduce((total, job) => total + job.driverPay, 0)
      
      setJobsCompleted(completedJobs.length)
      setEarningsToday(todayEarnings)
    }
  }, [nearbyJobs])

  const fetchDriverData = async () => {
    try {
      // Mock driver data - in production, this would come from auth/API
      const mockDriver: Driver = {
        id: 'driver-1',
        name: 'John Driver',
        email: 'john@grilled.ink',
        phone: '+27 83 123 4567',
        vehicleType: 'CAR',
        vehiclePlate: 'CA 123-456',
        status: 'ONLINE',
        rating: 4.8,
        totalJobs: 156,
        totalEarnings: 12450,
        lastActiveAt: new Date().toISOString()
      }
      setDriver(mockDriver)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching driver data:', error)
      setLoading(false)
    }
  }

  const handleAcceptJob = (jobId: string) => {
    acceptJob(jobId)
    const job = nearbyJobs.find(j => j.id === jobId)
    if (job) {
      setCurrentJob(job)
      setShowJobDetails(true)
    }
  }

  const handleStartJob = () => {
    if (currentJob) {
      startJob(currentJob.id)
    }
  }

  const handleCompleteJob = () => {
    if (currentJob) {
      completeJob(currentJob.id)
      setShowJobDetails(false)
      setCurrentJob(null)
    }
  }

  const handleStatusUpdate = (newStatus: string) => {
    if (currentJob) {
      updateJobStatus(currentJob.id, newStatus)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ONLINE': return 'bg-gradient-to-r from-green-400 to-emerald-500'
      case 'ON_JOB': return 'bg-gradient-to-r from-yellow-400 to-orange-500'
      case 'OFFLINE': return 'bg-gradient-to-r from-gray-400 to-gray-500'
      case 'BREAK': return 'bg-gradient-to-r from-orange-400 to-red-500'
      default: return 'bg-gradient-to-r from-gray-400 to-gray-500'
    }
  }

  const getJobStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-gradient-to-r from-yellow-400 to-orange-500'
      case 'ASSIGNED': return 'bg-gradient-to-r from-blue-400 to-indigo-500'
      case 'ACCEPTED': return 'bg-gradient-to-r from-indigo-400 to-purple-500'
      case 'PICKED_UP': return 'bg-gradient-to-r from-purple-400 to-pink-500'
      case 'EN_ROUTE': return 'bg-gradient-to-r from-orange-400 to-red-500'
      case 'DELIVERED': return 'bg-gradient-to-r from-green-400 to-emerald-500'
      default: return 'bg-gradient-to-r from-gray-400 to-gray-500'
    }
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
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
            <div className="absolute inset-0 w-20 h-20 border-4 border-transparent border-t-purple-500 rounded-full animate-spin"></div>
          </div>
          <p className="text-white/80 mt-6 text-lg font-medium">Loading Driver Dashboard...</p>
          <p className="text-white/60 text-sm mt-2">Preparing your workspace</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      {/* Connection Status */}
      <div className="fixed top-4 right-4 z-50">
        <div className={`px-3 py-2 rounded-full backdrop-blur-xl border ${
          connectionStatus === 'connected' ? 'bg-green-500/20 border-green-400/50' :
          connectionStatus === 'connecting' ? 'bg-yellow-500/20 border-yellow-400/50' :
          'bg-red-500/20 border-red-400/50'
        }`}>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-400' :
              connectionStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' :
              'bg-red-400'
            }`}></div>
            <span className="text-white text-sm font-medium">
              {connectionStatus === 'connected' ? 'Connected' :
               connectionStatus === 'connecting' ? 'Connecting...' :
               'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>

      {/* Header */}
      <header className="relative border-b border-white/10 backdrop-blur-xl bg-white/5">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="relative group">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center transform transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
                  <Car className="w-7 h-7 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Driver Dashboard</h1>
                <p className="text-white/70 text-sm font-medium">Grilled.ink Driver Portal</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                <Bell className="w-4 h-4 mr-2" />
                Notifications
              </Button>
              <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative container mx-auto px-6 py-8 pb-24">
        {/* Driver Info Card */}
        <div className="modern-card p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{driver?.name}</h2>
                <p className="text-white/70 text-sm">{driver?.email}</p>
                <p className="text-white/60 text-sm">{driver?.phone}</p>
              </div>
            </div>
            <div className="text-right">
              <Badge className={`${getStatusColor(driver?.status || 'OFFLINE')} text-white border-0 px-3 py-1 rounded-full`}>
                {driver?.status}
              </Badge>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="w-3 h-3 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full mx-auto mb-2"></div>
              <p className="text-white/80 text-sm font-medium">Rating</p>
              <p className="text-white text-lg font-bold">⭐ {driver?.rating}</p>
            </div>
            <div className="text-center">
              <div className="w-3 h-3 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full mx-auto mb-2"></div>
              <p className="text-white/80 text-sm font-medium">Jobs</p>
              <p className="text-white text-lg font-bold">{driver?.totalJobs}</p>
            </div>
            <div className="text-center">
              <div className="w-3 h-3 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full mx-auto mb-2"></div>
              <p className="text-white/80 text-sm font-medium">Earnings</p>
              <p className="text-white text-lg font-bold">{formatCurrency(driver?.totalEarnings || 0)}</p>
            </div>
            <div className="text-center">
              <div className="w-3 h-3 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full mx-auto mb-2"></div>
              <p className="text-white/80 text-sm font-medium">Vehicle</p>
              <p className="text-white text-lg font-bold">{driver?.vehicleType}</p>
            </div>
          </div>
        </div>

        {/* Today's Performance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="modern-card p-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              Today's Performance
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-white/70 text-sm">Jobs Completed</span>
                <span className="text-white text-lg font-bold">{jobsCompleted}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/70 text-sm">Today's Earnings</span>
                <span className="text-white text-lg font-bold">{formatCurrency(earningsToday)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/70 text-sm">Average per Job</span>
                <span className="text-white text-lg font-bold">
                  {jobsCompleted > 0 ? formatCurrency(earningsToday / jobsCompleted) : formatCurrency(0)}
                </span>
              </div>
            </div>
          </div>

          <div className="modern-card p-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center">
              <Target className="w-5 h-5 mr-2" />
              Current Location
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-white/70 text-sm">Status</span>
                <Badge className={`${getStatusColor(driver?.status || 'OFFLINE')} text-white border-0 px-2 py-1 rounded-full text-xs`}>
                  {driver?.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-white/70 text-sm">Last Active</span>
                <span className="text-white/80 text-sm">
                  {driver?.lastActiveAt ? new Date(driver.lastActiveAt).toLocaleTimeString() : 'Never'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/70 text-sm">Vehicle</span>
                <span className="text-white/80 text-sm">{driver?.vehicleType} • {driver?.vehiclePlate}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Current Job */}
        {currentJob && (
          <div className="modern-card p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center">
                <Package className="w-5 h-5 mr-2" />
                Current Job
              </h3>
              <Button 
                onClick={() => setShowJobDetails(!showJobDetails)}
                size="sm" 
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <Eye className="w-4 h-4 mr-2" />
                {showJobDetails ? 'Hide' : 'Show'} Details
              </Button>
            </div>
            
            {showJobDetails && (
              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white/70 text-sm">Customer</Label>
                    <p className="text-white font-medium">{currentJob.customerName}</p>
                  </div>
                  <div>
                    <Label className="text-white/70 text-sm">Phone</Label>
                    <p className="text-white font-medium">{currentJob.customerPhone}</p>
                  </div>
                  <div>
                    <Label className="text-white/70 text-sm">Pickup</Label>
                    <p className="text-white font-medium">{currentJob.pickupAddress}</p>
                  </div>
                  <div>
                    <Label className="text-white/70 text-sm">Delivery</Label>
                    <p className="text-white font-medium">{currentJob.deliveryAddress}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="text-center">
                    <Label className="text-white/70 text-sm">Order Value</Label>
                    <p className="text-white font-bold text-lg">{formatCurrency(currentJob.orderValue)}</p>
                  </div>
                  <div className="text-center">
                    <Label className="text-white/70 text-sm">Delivery Fee</Label>
                    <p className="text-white font-bold text-lg">{formatCurrency(currentJob.deliveryFee)}</p>
                  </div>
                  <div className="text-center">
                    <Label className="text-white/70 text-sm">Your Pay</Label>
                    <p className="text-white font-bold text-lg text-green-400">{formatCurrency(currentJob.driverPay)}</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex space-x-4">
              {currentJob.status === 'ASSIGNED' && (
                <Button 
                  onClick={() => handleAcceptJob(currentJob.id)}
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white border-0"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Accept Job
                </Button>
              )}
              
              {currentJob.status === 'ACCEPTED' && (
                <Button 
                  onClick={handleStartJob}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white border-0"
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  Start Navigation
                </Button>
              )}
              
              {(currentJob.status === 'PICKED_UP' || currentJob.status === 'EN_ROUTE') && (
                <Button 
                  onClick={handleCompleteJob}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white border-0"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Complete Delivery
                </Button>
              )}
              
              <Button 
                onClick={() => handleStatusUpdate('BREAK')}
                variant="outline" 
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                Take Break
              </Button>
            </div>
          </div>
        )}

        {/* Available Jobs */}
        <div className="modern-card p-6">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center">
            <Zap className="w-5 h-5 mr-2" />
            Available Jobs ({nearbyJobs.length})
          </h3>
          
          <div className="space-y-4 max-h-96 overflow-y-auto modern-scrollbar">
            {nearbyJobs.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 mx-auto mb-4 text-white/40" />
                <p className="text-white/60 font-medium">No available jobs</p>
                <p className="text-white/40 text-sm">Check back later for new delivery opportunities</p>
              </div>
            ) : (
              nearbyJobs.map((job) => (
                <div key={job.id} className="modern-card p-4 hover:scale-[1.02] transition-all duration-200 cursor-pointer group">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <p className="font-semibold text-white">{job.customerName}</p>
                          <Badge className={`${getJobStatusColor(job.status)} text-white text-xs border-0 px-2 py-1 rounded-full`}>
                            {job.status}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-white/70 text-xs">
                            <Phone className="w-3 h-3 inline mr-1" />
                            {job.customerPhone}
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <span className="text-white/60 text-xs">Pickup:</span>
                          <span className="text-white/80 text-xs font-medium truncate">{job.pickupAddress}</span>
                        </div>
                        <div>
                          <span className="text-white/60 text-xs">Dropoff:</span>
                          <span className="text-white/80 text-xs font-medium truncate">{job.deliveryAddress}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <span className="text-white/70 text-sm">
                            <DollarSign className="w-3 h-3 inline mr-1" />
                            {formatCurrency(job.orderValue)}
                          </span>
                          <span className="text-white/70 text-sm">
                            <Award className="w-3 h-3 inline mr-1" />
                            {formatCurrency(job.driverPay)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-white/60 text-xs">{job.estimatedTime}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2 ml-4">
                      {job.status === 'ASSIGNED' && (
                        <Button 
                          onClick={() => handleAcceptJob(job.id)}
                          size="sm" 
                          className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border-0"
                        >
                          <CheckCircle className="w-3 h-3" />
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                      >
                        <Eye className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      <style jsx>{`
        .modern-card {
          @apply bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6;
          @apply transition-all duration-300;
        }
        
        .modern-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        
        .modern-scrollbar::-webkit-scrollbar-track {
          @apply bg-white/10 rounded-full;
        }
        
        .modern-scrollbar::-webkit-scrollbar-thumb {
          @apply bg-white/20 rounded-full;
        }
      `}</style>
    </div>
  )
}