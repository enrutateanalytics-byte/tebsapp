import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Bus } from 'lucide-react';

const DriverLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Sign in with Supabase auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        toast({
          title: 'Error de autenticación',
          description: 'Usuario o contraseña incorrectos',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      if (!authData.user) {
        toast({
          title: 'Error',
          description: 'No se pudo iniciar sesión',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Verify the user is an active driver
      const { data: driverData, error: driverError } = await supabase
        .from('drivers')
        .select('id, name, is_active')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (driverError || !driverData) {
        await supabase.auth.signOut();
        toast({
          title: 'Acceso denegado',
          description: 'Esta cuenta no es de conductor',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      if (!driverData.is_active) {
        await supabase.auth.signOut();
        toast({
          title: 'Cuenta desactivada',
          description: 'Tu cuenta de conductor está desactivada',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      toast({
        title: '¡Bienvenido!',
        description: `Hola, ${driverData.name}`,
      });

      navigate('/driver-app');
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: 'Error',
        description: 'Ocurrió un error inesperado',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center">
            <Bus className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">App Conductor</CardTitle>
          <CardDescription>
            Inicia sesión para ver tus rutas y registrar pasajeros
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default DriverLogin;
