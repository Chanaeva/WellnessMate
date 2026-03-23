import { User, Membership, MembershipPlan, PunchCard, Payment } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Crown, Calendar, CreditCard, AlertTriangle, Clock } from "lucide-react";

interface MemberCardProps {
  user: User | null;
  membership: Membership | undefined;
  membershipEndDate: string;
  planName: string;
  memberSince: string;
  currentPlan?: MembershipPlan;
  userPunchCards?: PunchCard[];
  payments?: Payment[];
  onCancelMembership?: () => void;
  billingInterval?: string; // 'month' or 'year'
}

const MemberCard = ({
  user,
  membership,
  membershipEndDate,
  planName,
  memberSince,
  currentPlan,
  userPunchCards = [],
  payments = [],
  onCancelMembership,
  isLoading = false,
  billingInterval = 'month',
}: MemberCardProps & { isLoading?: boolean }) => {
  const isActive = membership?.status === 'active';
  const isPendingCancellation = isActive && membership?.autoRenew === false;
  const membershipPrice = currentPlan?.monthlyPrice ? (currentPlan.monthlyPrice / 100).toFixed(0) : '65';
  const billingLabel = billingInterval === 'year' ? 'Yearly' : 'Monthly';
  
  const hasPurchasedItems = userPunchCards.length > 0 || payments.length > 0;
  
  if (isLoading) {
    return (
      <Card className="wellness-card">
        <CardHeader className="text-center py-8">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
          <CardTitle className="text-xl">Updating Membership...</CardTitle>
          <p className="text-muted-foreground">Please wait while we refresh your membership details.</p>
        </CardHeader>
      </Card>
    );
  }

  if (!membership || !isActive) {
    return (
      <Card className="wellness-card">
        <CardHeader className="text-center py-8">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Crown className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">Wolf Mother Member</CardTitle>
          {!hasPurchasedItems && (
            <p className="text-muted-foreground">Purchase a monthly package or day passes to access thermal wellness facilities.</p>
          )}
          {hasPurchasedItems && (
            <p className="text-muted-foreground">Welcome back! Your day passes are ready to use.</p>
          )}
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="wellness-card overflow-hidden">
      {/* Gradient Header */}
      <div className="h-32 thermal-gradient relative">
        <div className="absolute inset-0 bg-black/5"></div>
        <div className="relative h-full p-6 flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <Crown className="h-5 w-5 text-white" />
              <Badge className="bg-white/20 text-white border-white/30 text-xs sm:text-sm">
                {isPendingCancellation ? 'Cancellation Scheduled' : 'Active Plan'}
              </Badge>
            </div>
            <h3 className="text-sm sm:text-lg md:text-xl font-display font-bold text-white">
              {currentPlan?.name || planName}
            </h3>
          </div>
          <div className="text-right">
            <div className="text-white/80 text-xs sm:text-sm">{billingLabel}</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-white">${membershipPrice}</div>
          </div>
        </div>
      </div>

      <CardContent className="p-6">
        {/* Pending cancellation notice */}
        {isPendingCancellation && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 mb-4">
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-300">
              Your membership is scheduled to end on <strong>{membershipEndDate}</strong>. You'll keep full access until then and will not be charged again.
            </p>
          </div>
        )}

        {/* Membership Details */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs sm:text-sm text-muted-foreground">
                {isPendingCancellation ? 'Access Until' : 'Next Billing'}
              </span>
            </div>
            <span className="font-semibold text-xs sm:text-sm">{membershipEndDate}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs sm:text-sm text-muted-foreground">Member ID</span>
            </div>
            <span className="font-mono text-xs sm:text-sm">
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
        
        {/* Cancel Membership Button — hidden when cancellation already scheduled */}
        {onCancelMembership && !isPendingCancellation && (
          <div className="border-t pt-4 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={onCancelMembership}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Cancel Membership
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MemberCard;
