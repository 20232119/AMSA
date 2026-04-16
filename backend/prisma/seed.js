import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding...')

  const estudianteRole = await prisma.role.upsert({
    where: { name: 'estudiante' },
    update: {},
    create: {
      name: 'estudiante',
      description: 'Estudiante universitario',
    },
  })

  const profesorRole = await prisma.role.upsert({
    where: { name: 'profesor' },
    update: {},
    create: {
      name: 'profesor',
      description: 'Docente universitario',
    },
  })

  await prisma.role.upsert({
    where: { name: 'registro' },
    update: {},
    create: {
      name: 'registro',
      description: 'Personal de Registro y Admisiones',
    },
  })

  await prisma.user.upsert({
    where: { institutionalId: 'PROF-001' },
    update: {},
    create: {
      roleId: profesorRole.id,
      institutionalId: 'PROF-001',
      firstName: 'Juan',
      lastName: 'Pérez',
      email: 'juan.profesor@test.com',
      passwordHash: '123456',
    },
  })

  await prisma.user.upsert({
    where: { institutionalId: 'PROF-002' },
    update: {},
    create: {
      roleId: profesorRole.id,
      institutionalId: 'PROF-002',
      firstName: 'Ana',
      lastName: 'Gómez',
      email: 'ana.profesor@test.com',
      passwordHash: '123456',
    },
  })

  for (let i = 1; i <= 10; i++) {
    const num = String(i).padStart(3, '0')

    await prisma.user.upsert({
      where: { institutionalId: `2025-${num}` },
      update: {},
      create: {
        roleId: estudianteRole.id,
        institutionalId: `2025-${num}`,
        firstName: `Estudiante${i}`,
        lastName: 'Demo',
        email: `estudiante${i}@test.com`,
        passwordHash: '123456',
      },
    })
  }

  await prisma.period.upsert({
    where: { name: '2025-1' },
    update: {},
    create: {
      name: '2025-1',
      startDate: new Date('2025-01-10'),
      endDate: new Date('2025-05-30'),
      isActive: true,
    },
  })

  await prisma.course.upsert({
    where: { code: 'INF-101' },
    update: {},
    create: {
      code: 'INF-101',
      name: 'Introducción a la Programación',
    },
  })

  await prisma.course.upsert({
    where: { code: 'MAT-101' },
    update: {},
    create: {
      code: 'MAT-101',
      name: 'Matemática Básica',
    },
  })

  console.log('✅ Seed completado')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })