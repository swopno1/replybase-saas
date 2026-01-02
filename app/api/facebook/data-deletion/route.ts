import { NextRequest, NextResponse } from 'next/server';
import { parseSignedRequest } from '@/lib/facebook-utils';

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

        const userId = payload.user_id;
        const confirmationCode = `del_${userId}_${Date.now()}`;

        // Log the deletion request (MVP: just log to stdout)
        console.log(`[Facebook Data Deletion] Request for User ID: ${userId}, Confirmation Code: ${confirmationCode}`);

        // In a real implementation, we would mark the user for deletion in validity 
        // or store this request in a separate table.

        return NextResponse.json({
            url: `https://app.replybase.co.uk/data-deletion-status?code=${confirmationCode}`,
            confirmation_code: confirmationCode,
        });
    } catch (error) {
        console.error('[Facebook Data Deletion] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
