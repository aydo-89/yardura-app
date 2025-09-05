import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

async function main() {
  const deviceId = process.argv[2];
  if (!deviceId) {
    console.error('Usage: tsx scripts/issue-device-key.ts <deviceId>');
    process.exit(1);
  }
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) throw new Error('Device not found');

  const issuer = process.env.EDGE_DEVICE_ISSUER || 'yardura-device';
  const signingKey = process.env.JWT_SIGNING_KEY || 'dev_signing_key_change_me';

  const token = jwt.sign({ sub: deviceId }, signingKey, {
    issuer,
    header: { kid: `device:${deviceId}` },
    expiresIn: '2y',
  });

  const hash = await bcrypt.hash(token, 10);
  await prisma.device.update({ where: { id: deviceId }, data: { apiKeyHash: hash } });

  console.log('DEVICE KEY (store on device, show once):');
  console.log(token);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
