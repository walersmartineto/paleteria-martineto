import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mbxanxesxiwzzgzvhhi.supabase.co';
const supabaseAnonKey = 'sb_secret_W_ytEv8NrxVBfuBd3lx9Ng_N_dRU9gv';

export const supabase = createClient(supabaseUrl, supabaseAnonKey); 