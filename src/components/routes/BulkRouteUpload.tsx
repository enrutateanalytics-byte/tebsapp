import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Upload, X, FileUp, CheckCircle2, AlertCircle } from 'lucide-react';
import { parseKmlFile, coordinatesToString, KmlCoordinate, KmlStop } from '@/lib/kmlParser';
import { Progress } from '@/components/ui/progress';

interface Client {
  id: string;
  name: string;
}

interface ParsedRoute {
  fileName: string;
  name: string;
  coordinates: KmlCoordinate[];
  stops: KmlStop[];
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

const BulkRouteUpload = () => {
  const [open, setOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [parsedRoutes, setParsedRoutes] = useState<ParsedRoute[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data as Client[];
    },
  });

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newRoutes: ParsedRoute[] = [];

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const result = parseKmlFile(content);
        const routeName = file.name.replace(/\.kml$/i, '');

        setParsedRoutes((prev) => [
          ...prev,
          {
            fileName: file.name,
            name: routeName,
            coordinates: result.coordinates,
            stops: result.stops,
            status: 'pending',
          },
        ]);
      };
      reader.readAsText(file);
    });

    // Reset file input
    e.target.value = '';
  };

  const removeRoute = (fileName: string) => {
    setParsedRoutes((prev) => prev.filter((r) => r.fileName !== fileName));
  };

  const createRoutesMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClientId) throw new Error('Selecciona un cliente');
      if (parsedRoutes.length === 0) throw new Error('No hay rutas para crear');

      const routesToCreate = parsedRoutes.map((route) => ({
        name: route.name,
        client_id: selectedClientId,
        kml_file_path: route.coordinates.length > 0 ? coordinatesToString(route.coordinates) : null,
        stops: (route.stops.length > 0 ? route.stops : []) as unknown as null,
        is_active: true,
      }));

      const { error } = await supabase.from('routes').insert(routesToCreate);
      if (error) throw error;

      return routesToCreate.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      toast.success(`${count} rutas creadas correctamente`);
      handleClose();
    },
    onError: (error) => {
      toast.error('Error: ' + error.message);
    },
  });

  const handleSubmit = async () => {
    if (!selectedClientId) {
      toast.error('Selecciona un cliente');
      return;
    }
    if (parsedRoutes.length === 0) {
      toast.error('Agrega al menos un archivo KML');
      return;
    }

    setIsProcessing(true);
    
    // Update all to uploading status
    setParsedRoutes((prev) => prev.map((r) => ({ ...r, status: 'uploading' as const })));

    try {
      await createRoutesMutation.mutateAsync();
      // Update all to success
      setParsedRoutes((prev) => prev.map((r) => ({ ...r, status: 'success' as const })));
    } catch (error) {
      // Update all to error
      setParsedRoutes((prev) =>
        prev.map((r) => ({ ...r, status: 'error' as const, error: (error as Error).message }))
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedClientId('');
    setParsedRoutes([]);
    setIsProcessing(false);
  };

  const validRoutesCount = parsedRoutes.filter((r) => r.coordinates.length > 0 || r.stops.length > 0).length;
  const invalidRoutesCount = parsedRoutes.filter((r) => r.coordinates.length === 0 && r.stops.length === 0).length;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="w-4 h-4 mr-2" />
          Carga Masiva
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Carga Masiva de Rutas</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client selector */}
          <div className="space-y-2">
            <Label htmlFor="bulk-client">Cliente *</Label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* File upload area */}
          <div className="space-y-2">
            <Label>Archivos KML</Label>
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
              <FileUp className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-2">
                Arrastra archivos KML aquí o haz clic para seleccionar
              </p>
              <input
                type="file"
                accept=".kml"
                multiple
                onChange={handleFilesChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
                style={{ position: 'relative' }}
              />
              <Button variant="secondary" size="sm" asChild>
                <label className="cursor-pointer">
                  Seleccionar archivos
                  <input
                    type="file"
                    accept=".kml"
                    multiple
                    onChange={handleFilesChange}
                    className="hidden"
                  />
                </label>
              </Button>
            </div>
          </div>

          {/* Preview table */}
          {parsedRoutes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Vista previa ({parsedRoutes.length} archivos)</Label>
                {invalidRoutesCount > 0 && (
                  <Badge variant="destructive">
                    {invalidRoutesCount} archivo(s) sin datos válidos
                  </Badge>
                )}
              </div>

              <div className="border rounded-lg max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre de ruta</TableHead>
                      <TableHead className="text-center">Puntos</TableHead>
                      <TableHead className="text-center">Paradas</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRoutes.map((route) => (
                      <TableRow key={route.fileName}>
                        <TableCell className="font-medium">{route.name}</TableCell>
                        <TableCell className="text-center">
                          {route.coordinates.length > 0 ? (
                            <Badge variant="secondary">{route.coordinates.length}</Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {route.stops.length > 0 ? (
                            <Badge variant="secondary">{route.stops.length}</Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {route.status === 'pending' && (
                            route.coordinates.length === 0 && route.stops.length === 0 ? (
                              <Badge variant="destructive">Sin datos</Badge>
                            ) : (
                              <Badge variant="outline">Pendiente</Badge>
                            )
                          )}
                          {route.status === 'uploading' && (
                            <Badge variant="secondary">Procesando...</Badge>
                          )}
                          {route.status === 'success' && (
                            <Badge variant="default">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Creada
                            </Badge>
                          )}
                          {route.status === 'error' && (
                            <Badge variant="destructive">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Error
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRoute(route.fileName)}
                            disabled={isProcessing}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Progress bar during processing */}
          {isProcessing && (
            <div className="space-y-2">
              <Progress value={undefined} className="w-full" />
              <p className="text-sm text-center text-muted-foreground">
                Creando rutas...
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedClientId || validRoutesCount === 0 || isProcessing}
            >
              Crear {validRoutesCount} Ruta{validRoutesCount !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkRouteUpload;
