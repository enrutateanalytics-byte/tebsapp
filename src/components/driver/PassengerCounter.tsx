import { Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface PassengerCounterProps {
  count: number;
  validCount: number;
}

const PassengerCounter = ({ count, validCount }: PassengerCounterProps) => {
  return (
    <Card className="bg-primary/10 border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-full">
              <Users className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pasajeros</p>
              <p className="text-2xl font-bold">{count}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Válidos</p>
            <p className="text-lg font-semibold text-primary">{validCount}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PassengerCounter;
