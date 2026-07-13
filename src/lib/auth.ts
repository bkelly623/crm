import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@prisma/client";

export async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const email = user.email ?? "";
  const fullName =
    (user.user_metadata?.full_name as string | undefined) ??
    email.split("@")[0] ??
    null;
  const role = (user.user_metadata?.role as UserRole | undefined) ?? "sales_rep";

  // upsert avoids race when layout + page both call getCurrentProfile
  return prisma.profile.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      email,
      fullName,
      role,
    },
    update: {},
  });
}
