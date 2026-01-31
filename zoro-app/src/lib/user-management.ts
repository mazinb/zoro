import { randomBytes } from 'crypto';

/**
 * Generates a secure user token
 */
export function generateUserToken(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Normalizes email address (lowercase, trim)
 */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return String(email).trim().toLowerCase();
}

/**
 * User lookup/creation strategy:
 * 1. If token provided → lookup by token in users table
 * 2. If token doesn't exist but email provided → lookup by email in users table
 * 3. If no user found → create new user in users table with token
 * 
 * Returns: { userId, token, email }
 */
export interface UserLookupResult {
  userId: string | null;
  token: string;
  email: string | null;
}

/**
 * Determines the correct user identifier (token or email-based lookup)
 * This handles:
 * - Token from URL (from email link)
 * - Email from form submission
 * - Creating new users when needed
 * 
 * Strategy:
 * - Token is primary identifier (for sharing links)
 * - Email is fallback (for users without token)
 * - Always create user in users table if doesn't exist
 */
export async function resolveUserIdentifier(
  supabase: any,
  providedToken: string | null | undefined,
  providedEmail: string | null | undefined
): Promise<UserLookupResult> {
  const normalizedEmail = normalizeEmail(providedEmail);
  let token = providedToken || null;
  let userId: string | null = null;

  // Step 1: If token provided, try to find user by token
  if (token) {
    // Check users table for token (assuming users table has a token field)
    // If users table doesn't have token, we might need to check user_data table
    const { data: tokenUser } = await supabase
      .from('users')
      .select('id, email, token')
      .eq('token', token)
      .maybeSingle();
    
    if (tokenUser?.id) {
      return {
        userId: tokenUser.id,
        token: token,
        email: tokenUser.email || normalizedEmail,
      };
    }

    // Token not found in users table, check user_data table as fallback
    const { data: userData } = await supabase
      .from('user_data')
      .select('user_token, email')
      .eq('user_token', token)
      .maybeSingle();
    
    if (userData) {
      // Found in user_data, now find or create in users table
      if (normalizedEmail) {
        const { data: emailUser } = await supabase
          .from('users')
          .select('id, email')
          .eq('email', normalizedEmail)
          .maybeSingle();
        
        if (emailUser?.id) {
          // Update users table with token
          await supabase
            .from('users')
            .update({ token: token })
            .eq('id', emailUser.id);
          
          return {
            userId: emailUser.id,
            token: token,
            email: normalizedEmail,
          };
        }
      }
    }
  }

  // Step 2: If no token or token not found, try email lookup
  if (normalizedEmail) {
    const { data: emailUser } = await supabase
      .from('users')
      .select('id, email, token')
      .eq('email', normalizedEmail)
      .maybeSingle();
    
    if (emailUser?.id) {
      // User exists, use their token or generate one
      const userToken = emailUser.token || generateUserToken();
      
      // Update token if it was missing
      if (!emailUser.token) {
        await supabase
          .from('users')
          .update({ token: userToken })
          .eq('id', emailUser.id);
      }
      
      return {
        userId: emailUser.id,
        token: userToken,
        email: normalizedEmail,
      };
    }
  }

  // Step 3: Create new user if doesn't exist
  if (normalizedEmail) {
    const newToken = token || generateUserToken();
    const nextCheckinDue = new Date();
    nextCheckinDue.setDate(nextCheckinDue.getDate() + 15);

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        email: normalizedEmail,
        token: newToken,
        checkin_frequency: 'monthly',
        next_checkin_due: nextCheckinDue.toISOString(),
      })
      .select('id')
      .single();

    if (!error && newUser?.id) {
      return {
        userId: newUser.id,
        token: newToken,
        email: normalizedEmail,
      };
    }
  }

  // Step 4: If no email, generate token for anonymous user
  // (This supports sharing forms - user can fill without email initially)
  const anonymousToken = token || generateUserToken();
  
  return {
    userId: null, // No user created yet (will be created when email is provided)
    token: anonymousToken,
    email: normalizedEmail,
  };
}

