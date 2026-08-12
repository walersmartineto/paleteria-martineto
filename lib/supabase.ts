import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://mbxanxesxiwzzgzvhhi.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_N0rwJ_8HqwPuk6w0MjmqDQ_9ssHRcYh';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);