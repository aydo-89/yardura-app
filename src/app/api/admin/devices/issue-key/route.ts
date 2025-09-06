import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  const { deviceId } = await req.json();
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const issuer = process.env.EDGE_DEVICE_ISSUER || 'yardura-device';
  const signingKey = process.env.JWT_SIGNING_KEY || 'dev_signing_key_change_me';
  const token = jwt.sign({ sub: deviceId }, signingKey, { issuer, header: { kid: `device:${deviceId}` }, expiresIn: '2y' });
  const hash = await bcrypt.hash(token, 10);
  await prisma.device.update({ where: { id: deviceId }, data: { apiKeyHash: hash } });
  return NextResponse.json({ deviceId, deviceKey: token });
}

export const runtime = 'nodejs';
