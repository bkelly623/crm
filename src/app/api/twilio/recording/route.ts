import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const formData = await request.formData();
  const recordingUrl = formData.get("RecordingUrl")?.toString();
  const callSid = formData.get("CallSid")?.toString();

  if (callSid && recordingUrl) {
    await prisma.call.updateMany({
      where: { twilioCallSid: callSid },
      data: { recordingUrl },
    });
  }

  return NextResponse.json({ ok: true });
}
