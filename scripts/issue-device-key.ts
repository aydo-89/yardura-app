import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
// TS in some editor contexts may not pick up generated Prisma delegates.
// Use a narrow any-cast for this script to avoid false-negative type errors.
const db: any = prisma;

async function main() {
  const deviceId = process.argv[2];
  if (!deviceId) {
    console.error('Usage: tsx scripts/issue-device-key.ts <deviceId>');
    process.exit(1);
  }
  const device = await db.device.findUnique({ where: { id: deviceId } });
  if (!device) throw new Error('Device not found');

  const issuer = process.env.EDGE_DEVICE_ISSUER || 'yardura-device';
  const signingKey = process.env.JWT_SIGNING_KEY || 'dev_signing_key_change_me';

  const token = jwt.sign({ sub: deviceId }, signingKey, {
    issuer,
    header: { kid: `device:${deviceId}`, alg: 'HS256' },
    expiresIn: '2y',
  });

  const hash = await bcrypt.hash(token, 10);
  await db.device.update({ where: { id: deviceId }, data: { apiKeyHash: hash } });

  console.log('DEVICE KEY (store on device, show once):');
  console.log(token);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
