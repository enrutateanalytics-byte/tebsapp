import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify the caller is an administrator
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if caller is admin
    const { data: adminCheck } = await supabaseAdmin
      .from("administrators")
      .select("id")
      .eq("user_id", callerUser.id)
      .maybeSingle();

    if (!adminCheck) {
      return new Response(
        JSON.stringify({ error: "Solo administradores pueden crear supervisores" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, password, name } = await req.json();

    if (!email || !password || !name) {
      return new Response(
        JSON.stringify({ error: "Email, contraseña y nombre son requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if email already exists in supervisors table
    const { data: existingSupervisor } = await supabaseAdmin
      .from("supervisors")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();

    if (existingSupervisor) {
      return new Response(
        JSON.stringify({ error: "Ya existe un supervisor con este correo electrónico" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to create user in auth.users
    let authUserId: string;
    const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (createAuthError) {
      // If user already exists in auth, check if it's an orphaned account (no role linked)
      if (createAuthError.message?.includes("already been registered") || createAuthError.status === 422) {
        // Find the existing auth user
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const existingAuthUser = listData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
        
        if (!existingAuthUser) {
          return new Response(
            JSON.stringify({ error: "Error inesperado: no se encontró el usuario existente" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check if this auth user has any role (admin, driver, other supervisor, client_user)
        const [adminCheck, driverCheck, clientCheck] = await Promise.all([
          supabaseAdmin.from("administrators").select("id").eq("user_id", existingAuthUser.id).maybeSingle(),
          supabaseAdmin.from("drivers").select("id").eq("user_id", existingAuthUser.id).maybeSingle(),
          supabaseAdmin.from("client_users").select("id").eq("user_id", existingAuthUser.id).maybeSingle(),
        ]);

        if (adminCheck.data || driverCheck.data || clientCheck.data) {
          return new Response(
            JSON.stringify({ error: "Este correo ya está registrado en el sistema con otro rol (administrador, conductor o usuario de cliente)" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Orphaned account - reuse it, update password
        console.log(`Reusing orphaned auth account for: ${email}`);
        await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, { password });
        authUserId = existingAuthUser.id;
      } else {
        console.error("Error creating auth user:", createAuthError);
        return new Response(
          JSON.stringify({ error: createAuthError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      authUserId = authData.user.id;
    }

    // Add to supervisors table
    const { error: supervisorError } = await supabaseAdmin
      .from("supervisors")
      .insert({
        user_id: authUserId,
        email: email,
        name: name
      });

    if (supervisorError) {
      console.error("Error adding to supervisors:", supervisorError);
      // Rollback: delete the auth user if we can't add them as supervisor
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      return new Response(
        JSON.stringify({ error: supervisorError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Supervisor created successfully: ${email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Supervisor creado exitosamente",
        user_id: authUserId 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
