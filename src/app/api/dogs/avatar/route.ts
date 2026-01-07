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
    const dogId = formData.get("dogId");
    const file = formData.get("file");

    if (typeof dogId !== "string" || !dogId) {
      return NextResponse.json({ error: "Dog ID is required" }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const dog = await prisma.dog.findFirst({
      where: {
        id: dogId,
        userId: session.user.id,
      },
    });

    if (!dog) {
      return NextResponse.json({ error: "Dog not found" }, { status: 404 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const extension = inferExtension(file.type);
    const storagePath = `profiles/dogs/${dogId}/${Date.now()}.${extension}`;

    await uploadImage(bucket, storagePath, fileBuffer, file.type || "image/jpeg");

    const updated = await prisma.dog.update({
      where: { id: dogId },
      data: { photoUrl: storagePath },
    });

    return NextResponse.json({ photoUrl: updated.photoUrl });
  } catch (error) {
    console.error("Error uploading dog photo:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
