// supabase/functions/create-order/index.ts

// THIS FUNCTION IS NOW OBSOLETE.
// The logic for creating an order has been moved into the `create-midtrans-transaction`
// function to ensure an order record is created with 'pending_payment' status *before*
// the user is sent to the payment gateway. This is a more reliable pattern.
// The `midtrans-notification-handler` function is now responsible for updating the
// order status to 'paid' after a successful payment.
//
// You can safely delete this function from your Supabase project.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

serve(async (req) => {
  return new Response(
    JSON.stringify({ error: "This function is deprecated and should not be used." }),
    {
      headers: { 'Content-Type': 'application/json' },
      status: 410, // 410 Gone
    }
  );
});
