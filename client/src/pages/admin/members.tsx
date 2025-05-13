import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { User, Membership } from "@shared/schema";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import Sidebar from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  UserPlus, 
  Search, 
  Eye, 
  Edit, 
  QrCode,
  Download,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { format } from "date-fns";

export default function AdminMembers() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch members data
  const { data: members, isLoading } = useQuery<(User & {membership?: Membership})[]>({
    queryKey: ["/api/admin/members"],
    enabled: !!user && user.role === 'admin',
  });

  // Filter and search members
  const filteredMembers = members?.filter(member => {
    // Apply search filter
    const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
    const email = member.email.toLowerCase();
    const membershipId = member.membership?.membershipId?.toLowerCase() || '';
    const searchLower = searchQuery.toLowerCase();
    
    const matchesSearch = !searchQuery || 
      fullName.includes(searchLower) || 
      email.includes(searchLower) || 
      membershipId.includes(searchLower);
    
    // Apply status filter
    const matchesStatus = statusFilter === 'all' || 
      (member.membership?.status === statusFilter);
    
    // Apply plan filter
    const matchesPlan = planFilter === 'all' || 
      (member.membership?.planType === planFilter);
    
    return matchesSearch && matchesStatus && matchesPlan;
  }) || [];

  // Pagination
  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);
  const currentMembers = filteredMembers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="min-h-screen flex flex-col bg-neutral-light">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:w-1/5">
            <Sidebar />
          </div>

          {/* Main Content Area */}
          <div className="lg:w-4/5 space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xl font-bold">Member Management</CardTitle>
                <Button className="bg-primary hover:bg-primary/90">
                  <UserPlus className="mr-2 h-4 w-4" /> Add New Member
                </Button>
              </CardHeader>
              
              <CardContent>
                {/* Search and Filter */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by name, email, or member ID"
                      className="pl-10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                        <SelectItem value="frozen">Frozen</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select value={planFilter} onValueChange={setPlanFilter}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Plan Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Plans</SelectItem>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                        <SelectItem value="vip">VIP</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Button variant="outline" className="flex items-center">
                      <Download className="mr-2 h-4 w-4" /> Export
                    </Button>
                  </div>
                </div>

                {isLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-500">Loading members...</p>
                  </div>
                ) : filteredMembers.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Membership ID</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Date</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {currentMembers.map((member, index) => (
                          <tr key={member.id} className={index % 2 === 1 ? "bg-gray-50" : ""}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center font-medium">
                                  {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                                </div>
                                <div className="ml-3">
                                  <div className="text-sm font-medium text-gray-900">{member.firstName} {member.lastName}</div>
                                  <div className="text-xs text-gray-500">{member.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {member.membership?.membershipId || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge className={
                                member.membership?.status === 'active' ? 'bg-green-100 text-green-800' :
                                member.membership?.status === 'inactive' ? 'bg-red-100 text-red-800' :
                                member.membership?.status === 'expired' ? 'bg-yellow-100 text-yellow-800' :
                                member.membership?.status === 'frozen' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }>
                                {member.membership?.status 
                                  ? member.membership.status.charAt(0).toUpperCase() + member.membership.status.slice(1)
                                  : 'No Membership'
                                }
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                              {member.membership?.planType || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {member.membership?.endDate 
                                ? format(new Date(member.membership.endDate), "MMM d, yyyy")
                                : 'N/A'
                              }
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <div className="flex space-x-2">
                                <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 h-8 w-8 p-0" title="View Profile">
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" className="text-secondary hover:text-secondary/80 h-8 w-8 p-0" title="Edit Member">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" className="text-[#FF7F50] hover:text-[#FF7F50]/80 h-8 w-8 p-0" title="Manage QR Code">
                                  <QrCode className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 text-gray-400"><path d="M17.5 8A6.5 6.5 0 0 0 4.5 8c0 1.7.75 3.25 2 4.32"></path><path d="M19.5 15.5c0-2.37-2.54-3-3.5-3-1.32 0-3.5.67-3.5 3"></path><circle cx="10" cy="9" r="2"></circle><circle cx="16" cy="9" r="2"></circle><path d="M18.5 13a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"></path><path d="m16.5 15.5 4 4"></path><path d="M7 13c-2.42 0-5 1.58-5 4"></path></svg>
                    <h3 className="text-lg font-medium text-gray-900">No members found</h3>
                    <p className="mt-1 text-sm text-gray-500">Try adjusting your search or filter criteria</p>
                  </div>
                )}

                {/* Pagination */}
                {filteredMembers.length > 0 && (
                  <div className="mt-4 flex justify-between items-center">
                    <div className="text-sm text-gray-500">
                      Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredMembers.length)} of {filteredMembers.length} members
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button 
                        variant="outline" 
                        size="icon"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(currentPage - 1)}
                      >
                        <span className="sr-only">Previous page</span>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="flex items-center">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const pageNumber = i + 1 + Math.max(0, currentPage - 3);
                          if (pageNumber <= totalPages) {
                            return (
                              <Button
                                key={pageNumber}
                                variant={currentPage === pageNumber ? "default" : "outline"}
                                className="mx-1 h-8 w-8 p-0"
                                onClick={() => setCurrentPage(pageNumber)}
                                disabled={currentPage === pageNumber}
                              >
                                {pageNumber}
                              </Button>
                            );
                          }
                          return null;
                        })}
                      </div>
                      <Button 
                        variant="outline" 
                        size="icon"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(currentPage + 1)}
                      >
                        <span className="sr-only">Next page</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
