import { User, Membership, MembershipPlan } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Crown, Calendar, CreditCard } from "lucide-react";
import { format } from "date-fns";

interface MemberCardProps {
  user: User | null;
  membership: Membership | undefined;
  membershipEndDate: string;
  planName: string;
  memberSince: string;
  currentPlan?: MembershipPlan;
}

const MemberCard = ({
  user,
  membership,
  membershipEndDate,
  planName,
  memberSince,
  currentPlan
}: MemberCardProps) => {
  const isActive = membership?.status === 'active';
  const membershipPrice = currentPlan?.monthlyPrice ? (currentPlan.monthlyPrice / 100).toFixed(0) : '65';
  
  if (!membership || !isActive) {
    return (
      <Card className="wellness-card">
        <CardHeader className="text-center py-8">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Crown className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">No Active Plan</CardTitle>
          <p className="text-muted-foreground">Get started with a membership plan to access all thermal wellness facilities.</p>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="wellness-card overflow-hidden">
      {/* Gradient Header */}
      <div className="h-32 thermal-gradient relative">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative h-full p-6 flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <Crown className="h-5 w-5 text-white" />
              <Badge className="bg-white/20 text-white border-white/30">
                Active Plan
              </Badge>
            </div>
            <h3 className="text-xl font-display font-bold text-white">
              {currentPlan?.name || planName}
            </h3>
          </div>
          <div className="text-right">
            <div className="text-white/80 text-sm">Monthly</div>
            <div className="text-2xl font-bold text-white">${membershipPrice}</div>
          </div>
        </div>
      </div>

      <CardContent className="p-6">
        {/* Membership Details */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Next Billing</span>
            </div>
            <span className="font-semibold">{membershipEndDate}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Member ID</span>
            </div>
            <span className="font-mono text-sm">
              {membership.membershipId}
            </span>
          </div>
        </div>

        {/* Plan Features */}
        {currentPlan?.features && (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Included Features
            </h4>
            <div className="space-y-2">
              {currentPlan.features.slice(0, 3).map((feature, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
              {currentPlan.features.length > 3 && (
                <div className="text-sm text-muted-foreground">
                  +{currentPlan.features.length - 3} more features
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MemberCard;
