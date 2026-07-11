import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@prisma/client";

export async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  let profile = await prisma.profile.findUnique({ where: { id: user.id } });

  if (!profile) {
    profile = await prisma.profile.create({
      data: {
        id: user.id,
        email: user.email ?? "",
        fullName: user.user_metadata?.full_name ?? user.email?.split("@")[0],
        role: (user.user_metadata?.role as UserRole) ?? "sales_rep",
      },
    });
  }

  return profile;
}
