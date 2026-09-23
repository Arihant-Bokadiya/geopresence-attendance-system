import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Clearing all institutional business data for clean first-run experience...');

  // Delete all records in reverse dependency order
  await prisma.auditLog.deleteMany();
  await prisma.erpStagingBatch.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.attendanceSession.deleteMany();
  await prisma.classroomDevice.deleteMany();
  await prisma.teacherAssignment.deleteMany();
  await prisma.studentEnrollment.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.webAuthnCredential.deleteMany();
  await prisma.student.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.division.deleteMany();
  await prisma.classroom.deleteMany();
  await prisma.department.deleteMany();
  await prisma.user.deleteMany();

  console.log('✅ Database is completely clean and empty (0 records).');
  console.log('   Create the initial administrator via:');
  console.log('   npm run create-admin --workspace=server -- --email admin@college.edu --password <password> --name "Admin Name"');
  console.log('   Then open http://localhost:5180 to log in.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
