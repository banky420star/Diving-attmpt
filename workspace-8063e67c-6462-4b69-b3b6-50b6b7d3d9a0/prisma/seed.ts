import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding Grilled.ink database...')

  // Create admin user
  const admin = await prisma.admin.upsert({
    where: { email: 'admin@grilled.ink' },
    update: {},
    create: {
      email: 'admin@grilled.ink',
      password: 'admin123', // In production, use hashed passwords
      name: 'Banky',
      phone: '+27831234567'
    }
  })

  console.log('Created admin:', admin)

  // Create sample drivers
  const drivers = [
    {
      name: 'John Smith',
      email: 'john@driver.com',
      phone: '+27821234567',
      vehicleType: 'CAR' as const,
      vehiclePlate: 'CA 12345',
      password: 'driver123',
      status: 'ONLINE' as const,
      latitude: -33.9249,
      longitude: 18.4241,
      rating: 4.8
    },
    {
      name: 'Maria Garcia',
      email: 'maria@driver.com', 
      phone: '+27831234568',
      vehicleType: 'MOTORBIKE' as const,
      vehiclePlate: 'CA 54321',
      password: 'driver123',
      status: 'ON_JOB' as const,
      latitude: -33.9349,
      longitude: 18.4341,
      rating: 4.9
    },
    {
      name: 'David Chen',
      email: 'david@driver.com',
      phone: '+27832234569', 
      vehicleType: 'CAR' as const,
      vehiclePlate: 'CA 98765',
      password: 'driver123',
      status: 'OFFLINE' as const,
      rating: 4.7
    },
    {
      name: 'Sarah Johnson',
      email: 'sarah@driver.com',
      phone: '+27833234570',
      vehicleType: 'VAN' as const,
      vehiclePlate: 'CA 11111',
      password: 'driver123', 
      status: 'ONLINE' as const,
      latitude: -33.9149,
      longitude: 18.4141,
      rating: 4.9
    }
  ]

  for (const driverData of drivers) {
    const driver = await prisma.driver.upsert({
      where: { email: driverData.email },
      update: driverData,
      create: driverData
    })
    console.log('Created driver:', driver.name)
  }

  // Create sample orders
  const orders = [
    {
      customerName: 'Alice Brown',
      customerPhone: '+27841234567',
      pickupAddress: '123 Main Street, Cape Town',
      pickupLat: -33.9249,
      pickupLng: 18.4241,
      deliveryAddress: '456 Oak Avenue, Cape Town',
      deliveryLat: -33.9349,
      deliveryLng: 18.4341,
      orderValue: 850,
      deliveryFee: 120,
      driverPay: 72,
      paymentType: 'EFT' as const,
      status: 'EN_ROUTE' as const,
      createdById: admin.id,
      assignedDriverId: (await prisma.driver.findUnique({ where: { email: 'maria@driver.com' } }))?.id,
      acceptedAt: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
      pickedUpAt: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
      estimatedTime: 25,
      actualTime: 22
    },
    {
      customerName: 'Bob Wilson',
      customerPhone: '+27842234568',
      pickupAddress: '789 Elm Road, Cape Town',
      pickupLat: -33.9449,
      pickupLng: 18.4441,
      deliveryAddress: '321 Pine Street, Cape Town',
      deliveryLat: -33.9549,
      deliveryLng: 18.4541,
      orderValue: 1200,
      deliveryFee: 150,
      driverPay: 90,
      paymentType: 'CASH' as const,
      status: 'PICKED_UP' as const,
      createdById: admin.id,
      assignedDriverId: (await prisma.driver.findUnique({ where: { email: 'john@driver.com' } }))?.id,
      acceptedAt: new Date(Date.now() - 1000 * 60 * 45), // 45 minutes ago
      pickedUpAt: new Date(Date.now() - 1000 * 60 * 10), // 10 minutes ago
      estimatedTime: 30,
      actualTime: null
    },
    {
      customerName: 'Carol Davis',
      customerPhone: '+27843234569',
      pickupAddress: '555 Beach Road, Cape Town',
      pickupLat: -33.9049,
      pickupLng: 18.4041,
      deliveryAddress: '999 Mountain View, Cape Town',
      deliveryLat: -33.8649,
      deliveryLng: 18.3641,
      orderValue: 950,
      deliveryFee: 130,
      driverPay: 78,
      paymentType: 'EFT' as const,
      status: 'PENDING' as const,
      createdById: admin.id,
      assignedDriverId: null,
      estimatedTime: 35,
      actualTime: null
    }
  ]

  for (const orderData of orders) {
    const order = await prisma.order.create({
      data: orderData
    })
    console.log('Created order:', order.customerName)
  }

  // Create some earnings
  const johnDriver = await prisma.driver.findUnique({ where: { email: 'john@driver.com' } })
  const mariaDriver = await prisma.driver.findUnique({ where: { email: 'maria@driver.com' } })
  
  if (johnDriver && mariaDriver) {
    const earnings = [
      {
        driverId: johnDriver.id,
        orderId: (await prisma.order.findFirst({ where: { customerName: 'Bob Wilson' } }))!.id,
        amount: 90,
        tip: 20,
        distance: 5.2,
        duration: 28,
        earnedAt: new Date(Date.now() - 1000 * 60 * 60 * 2) // 2 hours ago
      },
      {
        driverId: mariaDriver.id,
        orderId: (await prisma.order.findFirst({ where: { customerName: 'Alice Brown' } }))!.id,
        amount: 72,
        tip: 15,
        distance: 3.8,
        duration: 22,
        earnedAt: new Date(Date.now() - 1000 * 60 * 60) // 1 hour ago
      }
    ]

    for (const earningData of earnings) {
      const earning = await prisma.earning.create({
        data: earningData
      })
      console.log('Created earning:', earning.amount)
    }
  }

  // Create admin settings
  const settings = [
    { key: 'base_delivery_fee', value: '50' },
    { key: 'per_km_fee', value: '10' },
    { key: 'cash_handling_fee', value: '250' },
    { key: 'day_minimum_order', value: '600' },
    { key: 'night_minimum_order', value: '1500' },
    { key: 'driver_pay_percentage', value: '60' },
    { key: 'surge_multiplier', value: '1.5' },
    { key: 'business_hours_start', value: '08:00' },
    { key: 'business_hours_end', value: '22:00' }
  ]

  for (const settingData of settings) {
    const setting = await prisma.adminSetting.upsert({
      where: { key: settingData.key },
      update: { value: settingData.value },
      create: { ...settingData, adminId: admin.id }
    })
    console.log('Created setting:', setting.key)
  }

  console.log('Grilled.ink database seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })