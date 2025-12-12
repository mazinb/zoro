import cron from 'node-cron';
import { supabase } from './supabase';
import { sendCheckInEmail } from './email';
import { calculateNextCheckinDate } from './verification';

export function startScheduler() {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    console.log('Running check-in scheduler...');
    await processCheckIns();
  });
  
  // Also run immediately on startup for testing (can be removed later)
  console.log('Running initial check-in check...');
  processCheckIns().catch(console.error);
  
  console.log('Check-in scheduler started');
}

async function processCheckIns() {
  const now = new Date().toISOString();
  
  // Find users who are verified and due for check-in
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, checkin_frequency')
    .eq('is_verified', true)
    .lte('next_checkin_due', now);
  
  if (error) {
    console.error('Error fetching users:', error);
    return;
  }
  
  if (!users || users.length === 0) {
    console.log('No users due for check-in');
    return;
  }
  
  console.log(`Found ${users.length} users due for check-in`);
  
  // Get active campaign/prompt
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('id, prompt_text')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (campaignError || !campaign) {
    console.error('No active campaign found:', campaignError?.message);
    return;
  }
  
  // Send check-in emails
  for (const user of users) {
    try {
      await sendCheckInEmail(user.email, campaign.prompt_text, campaign.id);
      
      // Update next_checkin_due
      const nextCheckinDue = calculateNextCheckinDate(user.checkin_frequency);
      const { error: updateError } = await supabase
        .from('users')
        .update({
          next_checkin_due: nextCheckinDue.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      
      if (updateError) {
        console.error(`Error updating next_checkin_due for ${user.email}:`, updateError);
      } else {
        console.log(`Check-in email sent to ${user.email}`);
      }
    } catch (error) {
      console.error(`Error sending check-in to ${user.email}:`, error);
    }
  }
}

