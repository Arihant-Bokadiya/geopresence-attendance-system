import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';

async function main() {
  const args = process.argv.slice(2);
  let email = '';
  let password = '';
  let fullName = 'System Administrator';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) {
      email = args[i + 1].trim().toLowerCase();
      i++;
    } else if (args[i] === '--password' && args[i + 1]) {
      password = args[i + 1];
      i++;
    } else if (args[i] === '--name' && args[i + 1]) {
      fullName = args[i + 1].trim();
      i++;
    }
  }

  if (!email || !password) {
    console.log(`
Usage:
  npx tsx server/src/scripts/create-admin.ts --email <admin-email> --password <secure-password> [--name <full-name>]

Example:
  npx tsx server/src/scripts/create-admin.ts --email admin@college.edu --password AdminPassword@2026 --name "Dr. Sharma"
`);
    process.exit(1);
  }

  if (password.length < 6) {
    console.error('❌ Error: Password must be at least 6 characters long.');
    process.exit(1);
  }

  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    console.error(`❌ Error: An account with email "${email}" already exists.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const adminUser = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: 'ADMIN',
      isActive: true
    }
  });

  console.log(`
============================================================
✅ ADMINISTRATOR ACCOUNT CREATED SUCCESSFULLY
============================================================
  ID:        ${adminUser.id}
  Full Name: ${fullName}
  Email:     ${adminUser.email}
  Role:      ${adminUser.role}
============================================================
You can now log in at http://localhost:5180 with these credentials.
`);
}

main()
  .catch((err) => {
    console.error('❌ Failed to create administrator:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
