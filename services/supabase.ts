import { createClient } from '@supabase/supabase-js';

// IMPORTANT: Replace with your actual Supabase URL and Anon Key.
// You can find these in your Supabase project's API settings.
const supabaseUrl = 'https://fpezlfmzqmyxmbyxvxmp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwZXpsZm16cW15eG1ieXh2eG1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNTYyMDYsImV4cCI6MjA3NjYzMjIwNn0.MB96t9LlnA0PM5KZpLat7w0J5Pmxr4DC6ESFDzUDAFM';

// FIX: Removed the check for placeholder credentials. Since actual credentials are
// in place, the check is obsolete and caused a TypeScript comparison error.

export const supabase = createClient(supabaseUrl, supabaseKey);