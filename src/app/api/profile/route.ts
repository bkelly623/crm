import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const updated = await prisma.profile.update({
    where: { id: profile.id },
    data: {
      phone: body.phone,
      timezone: body.timezone,
      googleCalendarId: body.googleCalendarId,
      dialerHoursExtended: body.dialerHoursExtended,
    },
  });

  return NextResponse.json(updated);
}
