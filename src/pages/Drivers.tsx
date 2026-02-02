import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Plus, UserCog, Key, Trash2, Edit, Search } from 'lucide-react';

interface Driver {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string | null;
  unit_id: string | null;
  is_active: boolean;
  created_at: string;
  unit?: {
    id: string;
    plate_number: string;
  } | null;
}

interface Unit {
  id: string;
  plate_number: string;
  brand: string | null;
  model: string | null;
}

const Drivers = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const { toast } = useToast();
  const { isAdmin, session } = useAuth();

  // Form state
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    phone: '',
    unit_id: '',
  });
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (isAdmin) {
      fetchDrivers();
      fetchUnits();
    }
  }, [isAdmin]);

  const fetchDrivers = async () => {
    const { data, error } = await supabase
      .from('drivers')
      .select(`
        *,
        unit:units (
          id,
          plate_number
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching drivers:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los conductores',
        variant: 'destructive',
      });
    } else {
      setDrivers(data || []);
    }
    setLoading(false);
  };

  const fetchUnits = async () => {
    const { data, error } = await supabase
      .from('units')
      .select('id, plate_number, brand, model')
      .eq('is_active', true)
      .order('plate_number');

    if (error) {
      console.error('Error fetching units:', error);
    } else {
      setUnits(data || []);
    }
  };

  const handleCreateDriver = async () => {
    if (!formData.username || !formData.password || !formData.name || !formData.email) {
      toast({
        title: 'Error',
        description: 'Completa todos los campos requeridos',
        variant: 'destructive',
      });
      return;
    }

    setFormLoading(true);
    try {
      const response = await supabase.functions.invoke('create-driver', {
        body: {
          username: formData.username,
          password: formData.password,
          name: formData.name,
          email: formData.email,
          phone: formData.phone || undefined,
          unit_id: formData.unit_id || undefined,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Error al crear conductor');
      }

      const data = response.data;
      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Conductor creado',
        description: `Se ha creado la cuenta para ${formData.name}`,
      });

      setDialogOpen(false);
      resetForm();
      fetchDrivers();
    } catch (error: any) {
      console.error('Error creating driver:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo crear el conductor',
        variant: 'destructive',
      });
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateDriver = async () => {
    if (!selectedDriver) return;

    setFormLoading(true);
    try {
      const { error } = await supabase
        .from('drivers')
        .update({
          name: formData.name,
          phone: formData.phone || null,
          unit_id: formData.unit_id || null,
        })
        .eq('id', selectedDriver.id);

      if (error) throw error;

      toast({
        title: 'Conductor actualizado',
        description: 'Los datos se han guardado correctamente',
      });

      setDialogOpen(false);
      resetForm();
      fetchDrivers();
    } catch (error: any) {
      console.error('Error updating driver:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el conductor',
        variant: 'destructive',
      });
    } finally {
      setFormLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedDriver || !newPassword) return;

    setFormLoading(true);
    try {
      const response = await supabase.functions.invoke('reset-driver-password', {
        body: {
          driver_id: selectedDriver.id,
          new_password: newPassword,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Error al restablecer contraseña');
      }

      const data = response.data;
      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Contraseña restablecida',
        description: `La contraseña de ${selectedDriver.name} ha sido actualizada`,
      });

      setResetPasswordDialogOpen(false);
      setNewPassword('');
      setSelectedDriver(null);
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo restablecer la contraseña',
        variant: 'destructive',
      });
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleActive = async (driver: Driver) => {
    try {
      const { error } = await supabase
        .from('drivers')
        .update({ is_active: !driver.is_active })
        .eq('id', driver.id);

      if (error) throw error;

      toast({
        title: driver.is_active ? 'Conductor desactivado' : 'Conductor activado',
        description: `${driver.name} ha sido ${driver.is_active ? 'desactivado' : 'activado'}`,
      });

      fetchDrivers();
    } catch (error: any) {
      console.error('Error toggling driver status:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cambiar el estado del conductor',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      name: '',
      email: '',
      phone: '',
      unit_id: '',
    });
    setSelectedDriver(null);
  };

  const openEditDialog = (driver: Driver) => {
    setSelectedDriver(driver);
    setFormData({
      username: driver.username,
      password: '',
      name: driver.name,
      email: driver.email,
      phone: driver.phone || '',
      unit_id: driver.unit_id || '',
    });
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openResetPasswordDialog = (driver: Driver) => {
    setSelectedDriver(driver);
    setNewPassword('');
    setResetPasswordDialogOpen(true);
  };

  const filteredDrivers = drivers.filter(driver =>
    driver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    driver.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    driver.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAdmin) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">
              Solo los administradores pueden gestionar conductores
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserCog className="w-6 h-6" />
            Conductores
          </h1>
          <p className="text-muted-foreground">
            Gestiona las cuentas de los conductores de la app móvil
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Conductor
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conductores..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredDrivers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {searchTerm ? 'No se encontraron conductores' : 'No hay conductores registrados'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDrivers.map((driver) => (
                  <TableRow key={driver.id}>
                    <TableCell className="font-medium">{driver.name}</TableCell>
                    <TableCell>{driver.username}</TableCell>
                    <TableCell>{driver.email}</TableCell>
                    <TableCell>
                      {driver.unit?.plate_number || (
                        <span className="text-muted-foreground">Sin asignar</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={driver.is_active ? 'default' : 'secondary'}>
                        {driver.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(driver)}
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openResetPasswordDialog(driver)}
                          title="Restablecer contraseña"
                        >
                          <Key className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleActive(driver)}
                          title={driver.is_active ? 'Desactivar' : 'Activar'}
                        >
                          <Trash2 className={`w-4 h-4 ${driver.is_active ? 'text-destructive' : ''}`} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Driver Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedDriver ? 'Editar Conductor' : 'Nuevo Conductor'}
            </DialogTitle>
            <DialogDescription>
              {selectedDriver 
                ? 'Actualiza los datos del conductor'
                : 'Ingresa los datos para crear una nueva cuenta de conductor'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!selectedDriver && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="username">Usuario *</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="conductor1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Correo electrónico *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="conductor@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Nombre completo *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Juan Pérez"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="555-123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unidad asignada</Label>
              <Select
                value={formData.unit_id || '__none__'}
                onValueChange={(value) => setFormData({ ...formData, unit_id: value === '__none__' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una unidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin asignar</SelectItem>
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.plate_number} {unit.brand && unit.model ? `- ${unit.brand} ${unit.model}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={selectedDriver ? handleUpdateDriver : handleCreateDriver}
              disabled={formLoading}
            >
              {formLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {selectedDriver ? 'Guardar cambios' : 'Crear conductor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restablecer Contraseña</DialogTitle>
            <DialogDescription>
              Ingresa la nueva contraseña para {selectedDriver?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nueva contraseña</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleResetPassword}
              disabled={formLoading || !newPassword}
            >
              {formLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Restablecer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Drivers;
