import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateDriverRequest {
  username: string
  password: string
  name: string
  email: string
  phone?: string
  unit_id?: string
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
        JSON.stringify({ error: 'Only administrators can create drivers' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body: CreateDriverRequest = await req.json()
    const { username, password, name, email, phone, unit_id } = body

    // Validate required fields
    if (!username || !password || !name || !email) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: username, password, name, email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if username already exists
    const { data: existingDriver } = await supabaseAdmin
      .from('drivers')
      .select('id')
      .eq('username', username)
      .maybeSingle()

    if (existingDriver) {
      return new Response(
        JSON.stringify({ error: 'Username already exists' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create auth user
    const { data: authData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email for drivers
      user_metadata: {
        name,
        role: 'driver',
      },
    })

    if (createUserError) {
      console.error('Error creating auth user:', createUserError)
      return new Response(
        JSON.stringify({ error: createUserError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!authData.user) {
      return new Response(
        JSON.stringify({ error: 'Failed to create user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create driver record
    const { data: driver, error: driverError } = await supabaseAdmin
      .from('drivers')
      .insert({
        user_id: authData.user.id,
        username,
        name,
        email,
        phone: phone || null,
        unit_id: unit_id || null,
      })
      .select()
      .single()

    if (driverError) {
      console.error('Error creating driver record:', driverError)
      // Rollback: delete the auth user we just created
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return new Response(
        JSON.stringify({ error: driverError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Driver created successfully:', driver.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        driver: {
          id: driver.id,
          username: driver.username,
          name: driver.name,
          email: driver.email,
        }
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
