import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeGetServerSession, authOptions } from "@/lib/auth";
import { env } from "@/lib/env";
import { uploadImage } from "@/lib/supabase-admin";

function inferExtension(contentType?: string) {
  if (!contentType) return "jpg";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("heic")) return "heic";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("jpeg")) return "jpg";
  return "jpg";
}

export async function POST(request: NextRequest) {
  try {
    const session = (await safeGetServerSession(authOptions as any)) as {
      user?: { id?: string };
    } | null;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bucket = env.STORAGE_BUCKET;
    if (!bucket) {
      return NextResponse.json(
        { error: "Storage is not configured" },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const extension = inferExtension(file.type);
    const storagePath = `profiles/users/${session.user.id}/${Date.now()}.${extension}`;

    await uploadImage(bucket, storagePath, fileBuffer, file.type || "image/jpeg");

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: { image: storagePath },
      select: { id: true, image: true },
    });

    return NextResponse.json({ image: updated.image });
  } catch (error) {
    console.error("Error uploading user photo:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
