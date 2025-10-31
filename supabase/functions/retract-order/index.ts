// supabase/functions/retract-order/index.ts

// THIS FUNCTION IS DEPRECATED.
// All cancellation logic has been consolidated into the `cancel-order` function.
//
// You can safely delete this function directory from your Supabase project.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

serve(async (_req) => {
  console.warn("DEPRECATED: The 'retract-order' function was called. Please use 'cancel-order' instead.");
  return new Response(
    JSON.stringify({ error: "This function is deprecated. Please use the 'cancel-order' function." }),
    {
      headers: { 'Content-Type': 'application/json' },
      status: 410, // 410 Gone
    }
  );
});
