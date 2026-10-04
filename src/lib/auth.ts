import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

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

  // upsert avoids race when layout + page both call getCurrentProfile
  return prisma.profile.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      email,
      fullName,
      // User-editable metadata is never role authority. Authorized invitations
      // persist their assignment in Profile; update below preserves that row.
      role: "sales_rep",
    },
    update: {},
  });
}
