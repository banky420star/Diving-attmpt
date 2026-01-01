/* eslint-disable */

'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Navigation, 
  MapPin, 
  Phone, 
  Share2,
  ExternalLink,
  Maximize2
} from 'lucide-react'

interface NavigationProps {
  origin: {
    lat: number
    lng: number
  }
  destination: {
    lat: number
    lng: number
    address?: string
  }
  onArrival?: () => void
  className?: string
}

interface MapProps {
  center: {
    lat: number
    lng: number
  }
  markers?: {
    driverId: string
    status: 'ONLINE' | 'OFFLINE' | 'ON_JOB' | 'BREAK'
    name: string
    rating: number
    vehicleType: 'CAR' | 'MOTORBIKE' | 'VAN'
    lastSeen?: string
  }[]
  zoom?: number
  height?: string
  className?: string
}

interface DriverLocation {
  driverId: string
  latitude: number
  longitude: number
  status: 'ONLINE' | 'OFFLINE' | 'ON_JOB' | 'BREAK'
  lastPing?: string
  timestamp: string
}

export function Navigation({ 
  origin, 
  destination, 
  onArrival, 
  className = '' 
}: NavigationProps) {
  const [isNavigating, setIsNavigating] = useState(false)
  const [route, setRoute] = useState<any>(null)
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null)
  const [currentStep, setCurrentStep] = useState<'pickup' | 'delivery'>('pickup')
  const [isExpanded, setIsExpanded] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)

  // Get directions from Google Maps API
  const getDirections = async () => {
    if (!origin || !destination) return

    const service = new google.maps.DirectionsService()
    service.setQuery({
      origin: `${origin.lat},${origin.lng}`,
      destination: `${destination.lat},${destination.lng}`,
      travelMode: google.maps.TravelMode.DRIVING
    })

    return new Promise((resolve, reject) => {
      service.route((result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
          const route = result.routes[0]
          const legs = route.legs
          
          // Calculate total distance and time
          let totalDistance = 0
          let totalTime = 0
          let currentDistance = 0
          let currentTime = 0
          
          legs.forEach((leg, index) => {
            totalDistance += leg.distance?.value || 0
            totalTime += leg.duration?.value || 0
            
            if (index === legs.length - 1) {
              currentDistance += leg.distance?.value || 0
            }
          })

          resolve({
            route,
            legs,
            totalDistance,
            totalTime,
            currentDistance,
            currentTime,
            estimatedTime: Math.ceil(totalTime / 60), // Convert to minutes
            polyline: route.overview_path
          })
        } else {
          reject(new Error('Failed to get directions'))
        }
      })
    })
  }

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || !window.google) {
      return
    }

    const mapOptions = {
      zoom: 15,
      center: origin,
      mapTypeControl: true,
      styles: [
        {
          featureType: 'roadmap',
          elementType: 'labels',
          stylers: [
            {
              featureType: 'roadmap',
              elementType: 'geometry',
              stylers: [
                {
                  color: '#3b82f6',
                  weight: 500
                }
              ]
            }
          ]
        }
      ]
    }

    const map = new google.maps.Map(mapRef.current, mapOptions)
    
    // Add click listener to expand/collapse
    google.maps.event.addListener(map, 'click', () => {
      setIsExpanded(!isExpanded)
    })

    return () => {
      google.maps.event.clearListeners(map, 'click')
    }
  }, [origin, destination, isExpanded])

  const handleStartNavigation = async () => {
    if (!origin || !destination) return

    setIsNavigating(true)
    setCurrentStep('pickup')
    
    try {
      const directions = await getDirections()
      setRoute(directions)
      setEstimatedTime(directions.estimatedTime)
      
      if (onArrival) {
        onArrival(directions.estimatedTime)
      }
    } catch (error) {
      console.error('Navigation error:', error)
      setIsNavigating(false)
    }
  }

  const handleStepComplete = () => {
    if (currentStep === 'pickup') {
      setCurrentStep('delivery')
    } else if (currentStep === 'delivery') {
      // Navigation complete
      setIsNavigating(false)
      setCurrentStep(null)
      setRoute(null)
      setEstimatedTime(null)
    }
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${meters.toFixed(0)}m`
    } else {
      return `${(meters / 1000).toFixed(1)}km`
    }
  }

  if (!origin || !destination) {
    return (
      <div className="modern-card p-4">
        <div className="text-center text-white/60">
          <Navigation className="w-6 h-6 text-white/50" />
          <p>Set pickup and destination to start navigation</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`modern-card p-4 ${className}`}>
      {/* Navigation Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="text-white/80 text-sm font-medium">
            {currentStep === 'pickup' ? 'Navigate to Pickup' : 
             currentStep === 'delivery' ? 'Navigate to Delivery' : 
             'Start Navigation'}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="bg-white/10 border-white/20 text-white hover:bg-white/20"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? <Maximize2 className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="bg-white/10 border-white/20 text-white hover:bg-white/20"
          onClick={handleStartNavigation}
          disabled={isNavigating || !origin || !destination}
        >
          <Navigation className="w-4 h-4 mr-2" />
          Start Navigation
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="bg-white/10 border-white/20 text-white hover:bg-white/20"
          onClick={() => {
            if (window.confirm('Share this location with customer?')) {
              const shareUrl = `https://grilled.ink/track/${origin.lat},${origin.lng}`
              navigator.clipboard.writeText(shareUrl)
              alert('Location shared successfully!')
            }
          }}
        >
          <Share2 className="w-4 h-4 mr-2" />
        </Button>
      </div>
      <div className="text-white/80 text-sm">
        {estimatedTime ? `ETA: ${formatTime(estimatedTime)}` : 'Calculating...'}
      </div>
      </div>

      {/* Map Container */}
      <div className="relative">
        <div 
          ref={mapRef}
          className="w-full h-96 rounded-lg overflow-hidden"
        />
      </div>

      {/* Route Steps */}
      {route && (
        <div className="mt-4 p-4 bg-white/95 backdrop-blur-xl border border-white/20 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="text-white/80 text-sm">
              {formatDistance(route.totalDistance)} • {formatTime(route.totalTime)}
            </div>
            <div className="text-white/60 text-xs">
              {estimatedTime ? `ETA: ${formatTime(estimatedTime)}` : 'Calculating...'}
            </div>
          </div>

          {/* Step Progress */}
          <div className="flex items-center space-x-4 mb-6">
            <div className={`flex-1 h-8 rounded-full ${
              currentStep === 'pickup' ? 'bg-blue-500' : 
              currentStep === 'delivery' ? 'bg-green-500' : 'bg-gray-400'
            }`}>
              <span className="text-white font-medium text-sm">
                {currentStep === 'pickup' ? '1' : '2'}
              </span>
              <p className="text-white text-xs mt-1">
                {currentStep === 'pickup' ? 'Go to Pickup' : 
                   currentStep === 'delivery' ? 'Go to Delivery' : 'Start Navigation'}
              </p>
            </div>
            <div className={`flex-1 h-8 rounded-full ${
              currentStep === 'pickup' ? 'bg-blue-500' : 
              currentStep === 'delivery' ? 'bg-green-500' : 'bg-gray-400'
            }`}>
              <span className="text-white font-medium text-sm">
                {currentStep === 'pickup' ? '1' : '2'}
              </span>
              <p className="text-white text-xs mt-1">
                {currentStep === 'pickup' ? 'Pickup order' : 
                   currentStep === 'delivery' ? 'Deliver to customer' : 'Wait for pickup'}
              </p>
            </div>
            <div className={`flex-1 h-8 rounded-full ${
              currentStep === 'pickup' ? 'bg-blue-500' : 
              currentStep === 'delivery' ? 'bg-green-500' : 'bg-gray-400'
            }`}>
              <span className="text-white font-medium text-sm">
                {currentStep === 'pickup' ? '1' : '2'}
              </span>
              <p className="text-white text-xs mt-1">
                {currentStep === 'pickup' ? 'Ready to pickup' : 
                   currentStep === 'delivery' ? 'Ready to deliver' : 'Waiting'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              onClick={handleStepComplete}
              disabled={currentStep !== 'pickup' && currentStep !== 'delivery'}
            >
              {currentStep === 'pickup' ? 'Mark Picked Up' : 'Mark Delivered'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              onClick={() => {
                if (window.confirm('Cancel this delivery?')) {
                  setIsNavigating(false)
                  setCurrentStep('pickup')
                  setRoute(null)
                  setEstimatedTime(null)
                }
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}