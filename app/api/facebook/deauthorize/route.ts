import { NextRequest, NextResponse } from 'next/server';
import { parseSignedRequest } from '@/lib/facebook-utils';
import { prisma } from '@/lib/prisma';


export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const signedRequest = formData.get('signed_request') as string;

        if (!signedRequest) {
            return NextResponse.json({ error: 'Missing signed_request' }, { status: 400 });
        }

        const appSecret = process.env.FACEBOOK_CLIENT_SECRET;
        if (!appSecret) {
            console.error('FACEBOOK_CLIENT_SECRET not configured');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const payload = parseSignedRequest(signedRequest, appSecret);
        if (!payload) {
            return NextResponse.json({ error: 'Invalid signed_request' }, { status: 400 });
        }

        const facebookUserId = payload.user_id;
        console.log(`[Facebook Deauthorization] received for FB User ID: ${facebookUserId}`);

        // Find the user associated with this Facebook ID
        // We look up via Account table (provider = 'facebook', providerAccountId = facebookUserId)
        const account = await prisma.account.findFirst({
            where: {
                provider: 'facebook',
                providerAccountId: facebookUserId,
            },
            select: { userId: true },
        });

        if (account) {
            console.log(`[Facebook Deauthorization] Disabling engine connection for User ID: ${account.userId}`);

            // Disable integrations for this user
            await prisma.facebookPage.updateMany({
                where: { userId: account.userId },
                data: { engineConnected: false },
            });
        } else {
            console.warn(`[Facebook Deauthorization] No matching user found for FB User ID: ${facebookUserId}`);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Facebook Deauthorization] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
