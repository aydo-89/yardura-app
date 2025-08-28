import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body?.email || !body?.name) return NextResponse.json({ ok:false }, { status: 400 });

    if (resend) {
      const envTo = process.env.CONTACT_TO_EMAIL || "ayden@yardura.com,austyn@yardura.com";
      const recipients = envTo.split(",").map((e) => e.trim()).filter(Boolean);
      await resend.emails.send({
        from: "Yardura <notifications@yardura.com>",
        to: recipients,
        subject: `New Quote Request from ${body.name}`,
        replyTo: body.email,
        text: JSON.stringify(body, null, 2),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok:false }, { status: 500 });
  }
}

