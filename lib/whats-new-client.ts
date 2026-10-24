import { createClient } from '@/lib/supabase/client';
import { LATEST_UPDATE_ID, SEEN_EVENT } from '@/lib/whats-new';

// "Seen" is remembered on the signed-in account itself (in the account's profile data), so it follows the person
// across devices and never carries over from one account to another on the same browser.

const META_KEY = 'whats_new_seen';

/** True when the signed-in person has not opened the latest update yet. False when signed out. */
export async function hasUnseenUpdate(): Promise<boolean> {
  try {
    const { data: { user } } = await createClient().auth.getUser();
    if (!user) return false;
    return user.user_metadata?.[META_KEY] !== LATEST_UPDATE_ID;
  } catch {
    return false;
  }
}

/** Records that the signed-in person has seen the latest update, then tells the button to update itself. */
export async function markUpdateSeen(): Promise<void> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.user_metadata?.[META_KEY] !== LATEST_UPDATE_ID) {
      await supabase.auth.updateUser({ data: { [META_KEY]: LATEST_UPDATE_ID } });
    }
  } catch {
    /* if saving fails the star simply shows again next time */
  }
  window.dispatchEvent(new Event(SEEN_EVENT));
}
