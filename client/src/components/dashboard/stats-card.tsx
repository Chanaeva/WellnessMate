import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor: string;
  iconBgColor: string;
  change?: {
    value: number;
    label: string;
    positive?: boolean;
  };
  className?: string;
}

const StatsCard = ({
  title,
  value,
  icon: Icon,
  iconColor,
  iconBgColor,
  change,
  className,
}: StatsCardProps) => {
  return (
    <Card className={cn("", className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <h3 className="text-2xl font-heading font-semibold mt-1">{value}</h3>
          </div>
          <div className={cn("rounded-full p-3", iconBgColor)}>
            <Icon className={cn("text-xl", iconColor)} />
          </div>
        </div>
        {change && (
          <div className="mt-4 flex items-center text-xs">
            <span className={cn("flex items-center", change.positive ? "text-green-500" : "text-red-500")}>
              {change.positive ? <ArrowUp className="mr-1 h-3 w-3" /> : <ArrowDown className="mr-1 h-3 w-3" />}
              {change.value}%
            </span>
            <span className="ml-2 text-gray-500">{change.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StatsCard;
