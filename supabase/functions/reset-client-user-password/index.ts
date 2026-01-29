import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Generate a random password
function generatePassword(length = 12): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
  let password = '';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    password += charset[array[i] % charset.length];
  }
  return password;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get the authorization header to verify the caller is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No autorizado');
    }

    // Create a client with the user's token to verify they're an admin
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Check if the caller is an administrator
    const { data: adminCheck, error: adminError } = await supabaseUser
      .from('administrators')
      .select('id')
      .single();

    if (adminError || !adminCheck) {
      console.error('Admin check failed:', adminError);
      throw new Error('Solo los administradores pueden restablecer contraseñas');
    }

    // Get the request body
    const { user_id } = await req.json();

    if (!user_id) {
      throw new Error('Se requiere user_id');
    }

    // Verify the user exists in client_users
    const { data: clientUser, error: clientUserError } = await supabaseAdmin
      .from('client_users')
      .select('id, name, username')
      .eq('user_id', user_id)
      .single();

    if (clientUserError || !clientUser) {
      console.error('Client user not found:', clientUserError);
      throw new Error('Usuario de cliente no encontrado');
    }

    // Generate new password
    const newPassword = generatePassword(12);

    // Update the user's password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      throw new Error('Error al actualizar la contraseña: ' + updateError.message);
    }

    console.log(`Password reset successful for user: ${clientUser.username}`);

    return new Response(
      JSON.stringify({
        success: true,
        password: newPassword,
        username: clientUser.username,
        name: clientUser.name,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error in reset-client-user-password:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
