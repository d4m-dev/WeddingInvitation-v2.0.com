import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = document.body.getAttribute('data-supabase-url').replace('/rest/v1', '');
const supabaseKey = document.body.getAttribute('data-key');
export const supabase = createClient(supabaseUrl, supabaseKey);
