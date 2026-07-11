import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const formData = await request.formData();
  const callSid = formData.get("CallSid")?.toString();
  const callStatus = formData.get("CallStatus")?.toString();
  const duration = formData.get("CallDuration")?.toString();
  const leadId = formData.get("leadId")?.toString();
  const userId = formData.get("userId")?.toString();

  if (callSid && leadId && userId) {
    const statusMap: Record<string, "completed" | "no_answer" | "busy" | "failed" | "canceled" | "in_progress"> = {
      completed: "completed",
      "no-answer": "no_answer",
      busy: "busy",
      failed: "failed",
      canceled: "canceled",
      in_progress: "in_progress",
    };

    await prisma.call.upsert({
      where: { twilioCallSid: callSid },
      create: {
        twilioCallSid: callSid,
        leadId,
        userId,
        status: statusMap[callStatus ?? ""] ?? "completed",
        durationSeconds: duration ? parseInt(duration, 10) : null,
        endedAt: callStatus === "completed" ? new Date() : null,
      },
      update: {
        status: statusMap[callStatus ?? ""] ?? "completed",
        durationSeconds: duration ? parseInt(duration, 10) : undefined,
        endedAt: callStatus === "completed" ? new Date() : undefined,
      },
    });

    if (callStatus === "completed") {
      await prisma.lead.update({
        where: { id: leadId },
        data: { dialedCount: { increment: 1 } },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
