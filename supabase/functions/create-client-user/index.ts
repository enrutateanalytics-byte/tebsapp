import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateClientUserRequest {
  username: string
  password: string
  name: string
  client_id: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('No authorization header provided')
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with the user's token to verify they're an admin
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Check if the caller is an administrator
    const { data: isAdmin, error: adminError } = await userClient.rpc('is_administrator')
    
    if (adminError) {
      console.error('Error checking admin status:', adminError)
      return new Response(
        JSON.stringify({ error: 'Error verificando permisos' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!isAdmin) {
      console.error('User is not an administrator')
      return new Response(
        JSON.stringify({ error: 'Solo los administradores pueden crear usuarios de cliente' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body: CreateClientUserRequest = await req.json()
    const { username, password, name, client_id } = body

    // Validate required fields
    if (!username || !password || !name || !client_id) {
      return new Response(
        JSON.stringify({ error: 'Faltan campos requeridos: username, password, name, client_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate username format (alphanumeric, dots, underscores, min 3 chars)
    const usernameRegex = /^[a-zA-Z0-9._]{3,30}$/
    if (!usernameRegex.test(username)) {
      return new Response(
        JSON.stringify({ error: 'El username debe tener 3-30 caracteres (letras, números, puntos o guiones bajos)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate password length
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'La contraseña debe tener al menos 6 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin client with service role key
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Verify the client exists
    const { data: clientData, error: clientError } = await adminClient
      .from('clients')
      .select('id, name')
      .eq('id', client_id)
      .maybeSingle()

    if (clientError) {
      console.error('Error fetching client:', clientError)
      return new Response(
        JSON.stringify({ error: 'Error verificando cliente' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!clientData) {
      return new Response(
        JSON.stringify({ error: 'Cliente no encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if username already exists in client_users
    const { data: existingUser, error: existingError } = await adminClient
      .from('client_users')
      .select('id')
      .eq('username', username.toLowerCase())
      .maybeSingle()

    if (existingError) {
      console.error('Error checking existing username:', existingError)
      return new Response(
        JSON.stringify({ error: 'Error verificando username' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'Este nombre de usuario ya está en uso' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate internal email for Supabase Auth (users won't see this)
    const internalEmail = `${username.toLowerCase()}@internal.transportepro.app`

    // Check if auth user with this email already exists (could be orphaned from failed creation)
    const { data: existingAuthUsers } = await adminClient.auth.admin.listUsers()
    const existingAuthUser = existingAuthUsers?.users?.find(u => u.email === internalEmail)
    
    let userId: string

    if (existingAuthUser) {
      // Check if this auth user already has a client_users record
      const { data: linkedClientUser } = await adminClient
        .from('client_users')
        .select('id')
        .eq('user_id', existingAuthUser.id)
        .maybeSingle()
      
      if (linkedClientUser) {
        // User fully exists, can't create again
        return new Response(
          JSON.stringify({ error: 'Este nombre de usuario ya está registrado y tiene una cuenta activa' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Auth user exists but no client_users record - update password and reuse
      console.log('Found orphaned auth user, updating password and reusing:', existingAuthUser.id)
      const { error: updateError } = await adminClient.auth.admin.updateUserById(existingAuthUser.id, {
        password,
        email_confirm: true,
      })
      
      if (updateError) {
        console.error('Error updating orphaned auth user:', updateError)
        return new Response(
          JSON.stringify({ error: 'Error actualizando usuario existente' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      userId = existingAuthUser.id
    } else {
      // Create new auth user
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email: internalEmail,
        password,
        email_confirm: true,
      })

      if (authError) {
        console.error('Error creating auth user:', authError)
        return new Response(
          JSON.stringify({ error: 'Error creando usuario: ' + authError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      userId = authData.user.id
    }

    // Create the client_users record
    const { data: clientUser, error: clientUserError } = await adminClient
      .from('client_users')
      .insert({
        user_id: userId,
        client_id,
        name,
        username: username.toLowerCase(),
        email: internalEmail,
        is_active: true
      })
      .select()
      .single()

    if (clientUserError) {
      console.error('Error creating client_user record:', clientUserError)
      
      // Only rollback (delete auth user) if we created a new one (not reusing orphaned)
      if (!existingAuthUser) {
        await adminClient.auth.admin.deleteUser(userId)
      }
      
      return new Response(
        JSON.stringify({ error: 'Error creando registro de usuario de cliente' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Successfully created client user:', { username, name, client_id, userId })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Usuario creado exitosamente',
        user: {
          id: clientUser.id,
          username: clientUser.username,
          name: clientUser.name,
          client_id: clientUser.client_id,
          is_active: clientUser.is_active
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
