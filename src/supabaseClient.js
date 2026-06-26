import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nvxnkwppyzhutkmfjohb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52eG5rd3BweXpodXRrbWZqb2hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0Mzc4MTYsImV4cCI6MjA5ODAxMzgxNn0.FSv7Fw31kMO2uhRqjuvZDLdtyaytZXWjRcQXVNS1Rkc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
