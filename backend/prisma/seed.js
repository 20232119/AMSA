// prisma/seed.js
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Roles
  const roles = await Promise.all([
    prisma.role.upsert({ where: { name: 'estudiante' }, update: {}, create: { name: 'estudiante', description: 'Estudiante universitario' } }),
    prisma.role.upsert({ where: { name: 'profesor'   }, update: {}, create: { name: 'profesor',   description: 'Docente universitario' } }),
    prisma.role.upsert({ where: { name: 'registro'   }, update: {}, create: { name: 'registro',   description: 'Personal de Registro y Admisiones' } }),
  ])
  const [rolEst, rolProf, rolReg] = roles

  // Departments
  const deptReg = await prisma.department.upsert({
    where: { name: 'Registro y Admisiones' }, update: {},
    create: { name: 'Registro y Admisiones' },
  })
  const deptAcad = await prisma.department.upsert({
    where: { name: 'Académico' }, update: {},
    create: { name: 'Académico' },
  })

  // Careers
  const careerAgro = await prisma.career.upsert({
    where: { code: 'AGRO' }, update: {},
    create: { code: 'AGRO', name: 'Ingeniería Agroforestal' },
  })
  const careerAdm = await prisma.career.upsert({
    where: { code: 'ADM' }, update: {},
    create: { code: 'ADM', name: 'Administración Agropecuaria' },
  })

  const hash = await bcrypt.hash('Test1234!', 12)

  // Test users
  const student = await prisma.user.upsert({
    where: { institutionalId: '2025-0001' }, update: {},
    create: {
      institutionalId: '2025-0001', roleId: rolEst.id,
      firstName: 'María', lastName: 'García',
      email: 'maria.garcia@uafam.edu.do', passwordHash: hash,
      careerId: careerAgro.id,
    },
  })

  const professor = await prisma.user.upsert({
    where: { institutionalId: 'EMP-0042' }, update: {},
    create: {
      institutionalId: 'EMP-0042', roleId: rolProf.id,
      firstName: 'Carlos', lastName: 'Ramírez',
      email: 'carlos.ramirez@uafam.edu.do', passwordHash: hash,
      departmentId: deptAcad.id,
    },
  })

  const registro = await prisma.user.upsert({
    where: { institutionalId: 'REG-0005' }, update: {},
    create: {
      institutionalId: 'REG-0005', roleId: rolReg.id,
      firstName: 'Patricia', lastName: 'Marte',
      email: 'patricia.marte@uafam.edu.do', passwordHash: hash,
      departmentId: deptReg.id,
    },
  })

  // More students
  const studentIds = ['2025-0002','2025-0003','2025-0004','2025-0005']
  const studentNames = [
    ['José','Pérez'],['Ana','Martínez'],['Luis','Rodríguez'],['Carmen','López']
  ]
  const extraStudents = []
  for (let i = 0; i < studentIds.length; i++) {
    const s = await prisma.user.upsert({
      where: { institutionalId: studentIds[i] }, update: {},
      create: {
        institutionalId: studentIds[i], roleId: rolEst.id,
        firstName: studentNames[i][0], lastName: studentNames[i][1],
        email: `${studentNames[i][0].toLowerCase()}.${studentNames[i][1].toLowerCase()}@uafam.edu.do`,
        passwordHash: hash, careerId: i % 2 === 0 ? careerAgro.id : careerAdm.id,
      },
    })
    extraStudents.push(s)
  }

  // Period
  const period = await prisma.period.upsert({
    where: { name: 'Enero–Mayo 2026' }, update: {},
    create: { name: 'Enero–Mayo 2026', startDate: new Date('2026-01-15'), endDate: new Date('2026-05-30') },
  })

  // Courses
  const courseInf = await prisma.course.upsert({
    where: { code: 'INF-101' }, update: {},
    create: { code: 'INF-101', name: 'Programación I', credits: 4, careerId: careerAgro.id },
  })
  const courseMat = await prisma.course.upsert({
    where: { code: 'MAT-202' }, update: {},
    create: { code: 'MAT-202', name: 'Cálculo Diferencial', credits: 4, careerId: careerAgro.id },
  })

  // Sections
  const section1 = await prisma.section.upsert({
    where: { courseId_periodId_sectionNo: { courseId: courseInf.id, periodId: period.id, sectionNo: 1 } },
    update: {},
    create: { courseId: courseInf.id, professorId: professor.id, periodId: period.id, sectionNo: 1, schedule: 'L/M/V 8:00–9:00' },
  })
  const section2 = await prisma.section.upsert({
    where: { courseId_periodId_sectionNo: { courseId: courseMat.id, periodId: period.id, sectionNo: 2 } },
    update: {},
    create: { courseId: courseMat.id, professorId: professor.id, periodId: period.id, sectionNo: 2, schedule: 'M/J 10:00–11:30' },
  })

  // Enroll all students in section1
  const allStudents = [student, ...extraStudents]
  for (const s of allStudents) {
    await prisma.enrollment.upsert({
      where: { studentId_sectionId: { studentId: s.id, sectionId: section1.id } },
      update: {}, create: { studentId: s.id, sectionId: section1.id },
    })
  }
  // Enroll first 3 in section2
  for (const s of allStudents.slice(0, 3)) {
    await prisma.enrollment.upsert({
      where: { studentId_sectionId: { studentId: s.id, sectionId: section2.id } },
      update: {}, create: { studentId: s.id, sectionId: section2.id },
    })
  }

  console.log('✅ Seed completado')
  console.log('   Estudiante : 2025-0001 / Test1234!')
  console.log('   Profesor   : EMP-0042  / Test1234!')
  console.log('   Registro   : REG-0005  / Test1234!')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
