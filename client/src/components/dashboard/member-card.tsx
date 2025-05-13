import { User, Membership } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";

interface MemberCardProps {
  user: User | null;
  membership: Membership | undefined;
  membershipEndDate: string;
  planName: string;
  memberSince: string;
}

const MemberCard = ({
  user,
  membership,
  membershipEndDate,
  planName,
  memberSince
}: MemberCardProps) => {
  return (
    <Card className="bg-gradient-to-r from-primary to-secondary rounded-xl shadow-lg text-white relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 py-1 px-3 text-center text-xs bg-black/30">
        WolfMother Thermal Wellness
      </div>
      <div className="absolute top-0 right-0 h-40 w-40 bg-white/10 rounded-full -translate-y-20 translate-x-20"></div>
      <div className="absolute bottom-0 left-0 h-24 w-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
      
      <CardContent className="relative p-6 pt-8">
        <div className="flex justify-between items-start mb-10">
          <div>
            <h3 className="font-heading font-semibold text-lg">{planName}</h3>
            <p className="text-white/80 text-sm">Member since {memberSince}</p>
          </div>
          <div className="bg-white/20 rounded-full p-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-award"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
          </div>
        </div>
        
        <div className="border-t border-white/20 pt-4 pb-2">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-white/80">Member ID</p>
              <p className="font-medium">
                {membership?.membershipId || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-white/80">Status</p>
              <p className="font-medium capitalize">
                {membership?.status || 'Inactive'}
              </p>
            </div>
            <div>
              <p className="text-sm text-white/80">Next Billing</p>
              <p className="font-medium">{membershipEndDate}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MemberCard;
