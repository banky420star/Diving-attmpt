import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding Grilled.ink database...')

  const adminPassword = await hashPassword('admin123')
  const driverPassword = await hashPassword('driver123')

  // Create admin user
  const admin = await prisma.admin.upsert({
    where: { email: 'admin@grilled.ink' },
    update: {},
    create: {
      email: 'admin@grilled.ink',
      password: adminPassword,
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
      password: driverPassword,
      status: 'ONLINE' as const,
      rating: 4.8
    },
    {
      name: 'Maria Garcia',
      email: 'maria@driver.com', 
      phone: '+27831234568',
      vehicleType: 'MOTORBIKE' as const,
      vehiclePlate: 'CA 54321',
      password: driverPassword,
      status: 'ON_JOB' as const,
      rating: 4.9
    },
    {
      name: 'David Chen',
      email: 'david@driver.com',
      phone: '+27832234569', 
      vehicleType: 'CAR' as const,
      vehiclePlate: 'CA 98765',
      password: driverPassword,
      status: 'OFFLINE' as const,
      rating: 4.7
    },
    {
      name: 'Sarah Johnson',
      email: 'sarah@driver.com',
      phone: '+27833234570',
      vehicleType: 'VAN' as const,
      vehiclePlate: 'CA 11111',
      password: driverPassword, 
      status: 'ONLINE' as const,
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
