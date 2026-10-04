import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

const ROLES = [
  "admin",
  "sales_manager",
  "hiring_manager",
  "sales_rep",
  "closer",
  "project_manager",
  "hybrid",
  "client",
] as const;

const inviteSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1).optional(),
  role: z.enum(ROLES),
});

const patchSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(ROLES),
});

function requireAdmin(role: string) {
  return role === "admin" || role === "sales_manager";
}

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || !requireAdmin(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.profile.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      createdAt: true,
      phone: true,
    },
  });

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !requireAdmin(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = inviteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid invitation" }, { status: 400 });
  }
  const body = parsed.data;
  // Conservative grant policy: admins may grant any schema-valid role;
  // sales managers may invite sales_rep only. All other actors are denied above.
  // Existing-profile role changes remain admin-only (PATCH).
  if (profile.role !== "admin" && body.role !== "sales_rep") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
    user_metadata: {
      full_name: body.fullName ?? body.email.split("@")[0],
    },
  });

  if (error || !data.user) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create user" },
      { status: 400 },
    );
  }

  const created = await prisma.profile.upsert({
    where: { id: data.user.id },
    create: {
      id: data.user.id,
      email: body.email,
      fullName: body.fullName ?? body.email.split("@")[0],
      role: body.role,
    },
    update: {
      email: body.email,
      fullName: body.fullName ?? body.email.split("@")[0],
      role: body.role,
    },
  });

  return NextResponse.json({ user: created }, { status: 201 });
}

export async function PATCH(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid role update" }, { status: 400 });
  }
  const body = parsed.data;

  if (body.userId === profile.id && body.role !== "admin") {
    return NextResponse.json(
      { error: "You cannot demote your own admin account" },
      { status: 400 },
    );
  }

  const updated = await prisma.profile.update({
    where: { id: body.userId },
    data: { role: body.role },
  });

  return NextResponse.json({ user: updated });
}
