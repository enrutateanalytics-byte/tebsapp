import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Bus, AtSign, Lock, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const PublicLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !password.trim()) {
      toast({
        title: 'Error',
        description: 'Por favor ingresa tu usuario y contraseña',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Generate internal email from username
      const internalEmail = `${username.toLowerCase().trim()}@internal.transportepro.app`;
      
      // Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: internalEmail,
        password,
      });

      if (authError) {
        console.error('Auth error:', authError);
        toast({
          title: 'Error de autenticación',
          description: authError.message === 'Invalid login credentials' 
            ? 'Usuario o contraseña incorrectos' 
            : authError.message,
          variant: 'destructive',
        });
        return;
      }

      if (!authData.user) {
        toast({
          title: 'Error',
          description: 'No se pudo iniciar sesión',
          variant: 'destructive',
        });
        return;
      }

      // Check if this user is a client user
      const { data: clientUser, error: clientUserError } = await supabase
        .from('client_users')
        .select('id, client_id, name, is_active')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (clientUserError) {
        console.error('Error fetching client user:', clientUserError);
        await supabase.auth.signOut();
        toast({
          title: 'Error',
          description: 'Error verificando usuario',
          variant: 'destructive',
        });
        return;
      }

      if (!clientUser) {
        // User exists in auth but not in client_users - might be an admin
        await supabase.auth.signOut();
        toast({
          title: 'Acceso denegado',
          description: 'Esta cuenta no tiene acceso a la aplicación pública. Si eres administrador, usa /login.',
          variant: 'destructive',
        });
        return;
      }

      if (!clientUser.is_active) {
        await supabase.auth.signOut();
        toast({
          title: 'Cuenta desactivada',
          description: 'Tu cuenta ha sido desactivada. Contacta al administrador.',
          variant: 'destructive',
        });
        return;
      }

      // Success - navigate to the app
      navigate('/app');
      
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: 'Error',
        description: 'Ocurrió un error al iniciar sesión',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Bus className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">TransportePro</CardTitle>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">
            Inicia sesión para ver las rutas y ubicaciones en tiempo real
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuario</Label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder="tu.usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
                  className="pl-10"
                  disabled={loading}
                  autoComplete="username"
                  autoCapitalize="none"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PublicLogin;