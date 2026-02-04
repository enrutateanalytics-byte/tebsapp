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

    let userId: string

    // Try to create the user in auth.users
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true, // Auto-confirm email
    })

    if (authError) {
      console.error('Error creating auth user:', authError)
      
      // If email already exists, check if it's an orphaned auth user (no client_users record)
      if (authError.message.includes('already been registered')) {
        console.log('Auth user exists, checking for orphaned user...')
        
        // Find the existing auth user by email
        const { data: existingAuthUsers, error: listError } = await adminClient.auth.admin.listUsers()
        
        if (listError) {
          console.error('Error listing users:', listError)
          return new Response(
            JSON.stringify({ error: 'Error verificando usuarios existentes' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        const existingAuthUser = existingAuthUsers.users.find(u => u.email === internalEmail)
        
        if (!existingAuthUser) {
          return new Response(
            JSON.stringify({ error: 'Este nombre de usuario ya está registrado' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // Check if this auth user has a client_users record
        const { data: linkedClientUser } = await adminClient
          .from('client_users')
          .select('id')
          .eq('user_id', existingAuthUser.id)
          .maybeSingle()
        
        if (linkedClientUser) {
          // User is already fully registered
          return new Response(
            JSON.stringify({ error: 'Este nombre de usuario ya está registrado' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // Orphaned auth user found - delete it and create fresh
        console.log('Found orphaned auth user, deleting and recreating...')
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(existingAuthUser.id)
        
        if (deleteError) {
          console.error('Error deleting orphaned user:', deleteError)
          return new Response(
            JSON.stringify({ error: 'Error limpiando usuario huérfano' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // Now create fresh auth user
        const { data: newAuthData, error: newAuthError } = await adminClient.auth.admin.createUser({
          email: internalEmail,
          password,
          email_confirm: true,
        })
        
        if (newAuthError) {
          console.error('Error creating new auth user after cleanup:', newAuthError)
          return new Response(
            JSON.stringify({ error: 'Error creando usuario después de limpieza' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        userId = newAuthData.user.id
      } else {
        return new Response(
          JSON.stringify({ error: 'Error creando usuario: ' + authError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
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
      
      // Rollback: delete the auth user if we couldn't create the client_users record
      await adminClient.auth.admin.deleteUser(userId)
      
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