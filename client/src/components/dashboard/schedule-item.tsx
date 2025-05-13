import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

interface ScheduleItemProps {
  item: {
    id: number;
    name: string;
    time: string;
    location: string;
    instructor?: string;
    icon: ReactNode;
    iconColor: string;
    available: boolean;
  };
}

const ScheduleItem = ({ item }: ScheduleItemProps) => {
  return (
    <div className="border border-gray-200 rounded-lg p-4 flex justify-between items-center">
      <div className="flex items-center space-x-4">
        <div className={`${item.iconColor} rounded-lg p-3`}>
          {item.icon}
        </div>
        <div>
          <h4 className="font-medium">{item.name}</h4>
          <div className="text-sm text-gray-500">
            {item.time} • {item.location}
            {item.instructor && ` • ${item.instructor}`}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge 
          variant="outline"
          className={`
            ${item.available 
              ? 'bg-green-100 text-green-800 hover:bg-green-100'
              : 'bg-red-100 text-red-800 hover:bg-red-100'
            }
          `}
        >
          {item.available ? 'Available' : 'Full'}
        </Badge>
        <Button 
          variant="ghost" 
          size="icon"
          className="text-primary hover:bg-primary/10 p-2 rounded-md"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default ScheduleItem;
