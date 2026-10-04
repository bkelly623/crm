// Read-only diagnostic of the user's local pilot records. Auth is explicitly mocked.
import { afterAll, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { prisma } from '@/lib/prisma';
import { getCurrentProfile } from '@/lib/auth';
import { GET as queue } from '@/app/api/dialer/next-lead/route';
import { GET as recovery } from '@/app/api/dialer/intents/route';
import { assertLocalUrl } from './guard';
assertLocalUrl(process.env.POSTGRES_PRISMA_URL ?? '');
afterAll(async () => prisma.$disconnect());
it.skipIf(process.env.CRM_PILOT_READ_DIAGNOSTIC !== '1')('local pilot recovery unlocks and named-list queue returns the approved test lead', async () => {
 const profile = await prisma.profile.findUniqueOrThrow({where:{email:'bkel733@gmail.com'}});
 vi.mocked(getCurrentProfile).mockResolvedValue(profile);
 const recovered = await recovery();
 expect(recovered.status).toBe(200);
 expect(await recovered.json()).toEqual({intent:null});
 const list = await prisma.leadList.findUniqueOrThrow({where:{ownerId_nameKey:{ownerId:profile.id,nameKey:'dialer test'}}});
 const result = await queue(new Request('http://127.0.0.1:3090/api/dialer/next-lead?listId='+encodeURIComponent(list.id)));
 expect(result.status).toBe(200);
 const body = await result.json();
 expect(body.lead.businessName).toBe('Google Voice — Test Call');
 expect(body.lead.setterId).toBe(profile.id);
 expect(body.lead.phone).toBe('+14844249624');
});
