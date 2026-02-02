import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ResetPasswordRequest {
  driver_id: string
  new_password: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Get the authorization header to verify admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the calling user is an administrator
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: callingUser }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !callingUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if calling user is an administrator
    const { data: adminCheck } = await supabaseAdmin
      .from('administrators')
      .select('id')
      .eq('user_id', callingUser.id)
      .maybeSingle()

    if (!adminCheck) {
      return new Response(
        JSON.stringify({ error: 'Only administrators can reset driver passwords' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body: ResetPasswordRequest = await req.json()
    const { driver_id, new_password } = body

    // Validate required fields
    if (!driver_id || !new_password) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: driver_id, new_password' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the driver's user_id
    const { data: driver, error: driverError } = await supabaseAdmin
      .from('drivers')
      .select('user_id, name')
      .eq('id', driver_id)
      .maybeSingle()

    if (driverError || !driver) {
      return new Response(
        JSON.stringify({ error: 'Driver not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update the user's password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      driver.user_id,
      { password: new_password }
    )

    if (updateError) {
      console.error('Error updating password:', updateError)
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Password reset successful for driver:', driver.name)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Password reset successfully for ${driver.name}`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
