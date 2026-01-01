'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Users, 
  Package, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  MapPin, 
  Phone,
  Car,
  AlertCircle,
  Plus,
  Settings
} from 'lucide-react'

// Mock data for demonstration
const mockDrivers = [
  { id: '1', name: 'John Smith', status: 'ONLINE', vehicle: 'CAR', rating: 4.8, earnings: 1250 },
  { id: '2', name: 'Maria Garcia', status: 'ON_JOB', vehicle: 'MOTORBIKE', rating: 4.9, earnings: 980 },
  { id: '3', name: 'David Chen', status: 'OFFLINE', vehicle: 'CAR', rating: 4.7, earnings: 2100 },
  { id: '4', name: 'Sarah Johnson', status: 'ONLINE', vehicle: 'VAN', rating: 4.9, earnings: 1560 },
]

const mockOrders = [
  { id: '1', customer: 'Alice Brown', status: 'EN_ROUTE', value: 850, fee: 120, driver: 'Maria Garcia' },
  { id: '2', customer: 'Bob Wilson', status: 'PICKED_UP', value: 1200, fee: 150, driver: 'John Smith' },
  { id: '3', customer: 'Carol Davis', status: 'PENDING', value: 950, fee: 130, driver: null },
]

const mockMetrics = {
  driversOnline: 3,
  totalDrivers: 4,
  activeDeliveries: 2,
  todayRevenue: 15420,
  todayProfit: 6420,
  averageMargin: 41.6,
  onTimeRate: 94.2,
}

export default function Home() {
  const [selectedTab, setSelectedTab] = useState('overview')

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ONLINE': return 'bg-green-500'
      case 'ON_JOB': return 'bg-yellow-500'
      case 'OFFLINE': return 'bg-red-500'
      case 'BREAK': return 'bg-orange-500'
      default: return 'bg-gray-500'
    }
  }

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-500'
      case 'ASSIGNED': return 'bg-blue-500'
      case 'ACCEPTED': return 'bg-indigo-500'
      case 'PICKED_UP': return 'bg-purple-500'
      case 'EN_ROUTE': return 'bg-orange-500'
      case 'DELIVERED': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
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
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Grilled.ink</h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">Personal Delivery Management System</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
              <div className="text-right">
                <p className="text-sm font-medium text-slate-900 dark:text-white">Welcome back, Banky</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Admin Dashboard</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="drivers">Drivers</TabsTrigger>
            <TabsTrigger value="earnings">Earnings</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Drivers Online</CardTitle>
                  <Users className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {mockMetrics.driversOnline}/{mockMetrics.totalDrivers}
                  </div>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Active now
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Deliveries</CardTitle>
                  <Package className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                    {mockMetrics.activeDeliveries}
                  </div>
                  <p className="text-xs text-green-700 dark:text-green-300">
                    In progress
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                    R{mockMetrics.todayRevenue.toLocaleString()}
                  </div>
                  <p className="text-xs text-purple-700 dark:text-purple-300">
                    Gross revenue
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Today's Profit</CardTitle>
                  <TrendingUp className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                    R{mockMetrics.todayProfit.toLocaleString()}
                  </div>
                  <p className="text-xs text-orange-700 dark:text-orange-300">
                    {mockMetrics.averageMargin}% margin
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Fleet Map and Recent Orders */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Fleet Map */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MapPin className="w-5 h-5 mr-2" />
                    Live Fleet Map
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <MapPin className="w-12 h-12 mx-auto mb-2 text-slate-400" />
                      <p className="text-slate-600 dark:text-slate-400">Interactive map view</p>
                      <p className="text-sm text-slate-500 dark:text-slate-500">Real-time driver locations</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center">
                        <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                        Available
                      </span>
                      <span className="flex items-center">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                        On Job
                      </span>
                      <span className="flex items-center">
                        <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                        Offline
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Orders */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center">
                      <Package className="w-5 h-5 mr-2" />
                      Recent Orders
                    </span>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      New Order
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockOrders.map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <p className="font-medium text-slate-900 dark:text-white">{order.customer}</p>
                            <Badge className={`${getOrderStatusColor(order.status)} text-white`}>
                              {order.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            R{order.value} + R{order.fee} delivery
                          </p>
                          {order.driver && (
                            <p className="text-xs text-slate-500 dark:text-slate-500">
                              Driver: {order.driver}
                            </p>
                          )}
                        </div>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Order Management</span>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Order
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Package className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                  <p className="text-slate-600 dark:text-slate-400">Order management interface</p>
                  <p className="text-sm text-slate-500 dark:text-slate-500">Create, assign, and track deliveries</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Drivers Tab */}
          <TabsContent value="drivers" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Driver Management</span>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Driver
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockDrivers.map((driver) => (
                    <div key={driver.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(driver.status)}`}></div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{driver.name}</p>
                          <div className="flex items-center space-x-4 text-sm text-slate-600 dark:text-slate-400">
                            <span className="flex items-center">
                              <Car className="w-3 h-3 mr-1" />
                              {driver.vehicle}
                            </span>
                            <span className="flex items-center">
                              <Phone className="w-3 h-3 mr-1" />
                              Contact
                            </span>
                            <span>⭐ {driver.rating}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-slate-900 dark:text-white">R{driver.earnings}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Today</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Earnings Tab */}
          <TabsContent value="earnings" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">R15,420</div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Today</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Driver Payouts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">R9,000</div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Pending</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">R6,420</div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">41.6% margin</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Analytics & Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <TrendingUp className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                  <p className="text-slate-600 dark:text-slate-400">Advanced analytics dashboard</p>
                  <p className="text-sm text-slate-500 dark:text-slate-500">Revenue trends, driver performance, and insights</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}