import { NextRequest, NextResponse } from 'next/server';

// Verify email verification token
// In production, this should check against a database table
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, token } = body;

    if (!email || !token) {
      return NextResponse.json(
        { error: 'Email and token are required' },
        { status: 400 }
      );
    }

    // TODO: Verify token against database
    // For now, we'll accept any token format (32 hex characters)
    // In production, check against email_verification_tokens table
    
    const isValidToken = /^[a-f0-9]{64}$/.test(token);

    if (!isValidToken) {
      return NextResponse.json(
        { error: 'Invalid token format' },
        { status: 400 }
      );
    }

    // In production, check:
    // 1. Token exists in database
    // 2. Token matches email
    // 3. Token hasn't expired
    // 4. Token hasn't been used

    return NextResponse.json(
      { 
        valid: true,
        email: email.trim().toLowerCase()
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error verifying token:', error);
    return NextResponse.json(
      { error: 'Failed to verify token' },
      { status: 500 }
    );
  }
}

