import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Payment, Membership } from "@shared/schema";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, CreditCard, Shield, Lock } from "lucide-react";
import { format } from "date-fns";

export default function PaymentsPage() {
  const { user } = useAuth();
  const [timeFilter, setTimeFilter] = useState("3months");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Fetch membership data
  const { data: membership } = useQuery<Membership>({
    queryKey: ["/api/membership"],
    enabled: !!user,
  });

  // Fetch payments data
  const { data: payments, isLoading: isPaymentsLoading } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
    enabled: !!user,
  });

  // Helper function to convert cents to dollars
  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  // Filter payments based on time filter
  const getFilteredPayments = () => {
    if (!payments) return [];
    
    const now = new Date();
    let filterDate = new Date();
    
    switch (timeFilter) {
      case "3months":
        filterDate.setMonth(now.getMonth() - 3);
        break;
      case "6months":
        filterDate.setMonth(now.getMonth() - 6);
        break;
      case "year":
        filterDate.setFullYear(now.getFullYear() - 1);
        break;
      case "all":
        return payments;
      default:
        filterDate.setMonth(now.getMonth() - 3);
    }
    
    return payments.filter(payment => new Date(payment.transactionDate) >= filterDate);
  };
  
  const filteredPayments = getFilteredPayments();
  
  // Pagination
  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
  const currentPageData = filteredPayments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  return (
    <div className="min-h-screen flex flex-col bg-neutral-light">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card className="mb-8">
            <CardHeader className="bg-primary text-white">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-bold">Payment History</CardTitle>
                  <CardDescription className="text-white/80">View and manage your billing information</CardDescription>
                </div>
                <div className="flex items-center space-x-2 text-white/90">
                  <Shield className="h-5 w-5" />
                  <span className="text-sm font-medium">Secure Payments</span>
                  <Lock className="h-4 w-4" />
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-6">
              {/* Billing Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <Card>
                  <CardContent className="p-4">
                    <h4 className="text-sm text-gray-500 mb-1">Current Plan</h4>
                    <p className="font-medium">{membership?.planType === 'premium' ? 'Premium Membership' : membership?.planType === 'vip' ? 'VIP Membership' : 'Basic Membership'}</p>
                    <p className="text-sm text-gray-500 mt-2">{membership ? formatPrice(membership.planType === 'premium' ? 8900 : membership.planType === 'vip' ? 12900 : 4900) : '$0.00'}/month</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <h4 className="text-sm text-gray-500 mb-1">Next Billing Date</h4>
                    <p className="font-medium">{membership ? format(new Date(membership.endDate), "MMMM d, yyyy") : 'N/A'}</p>
                    <p className="text-sm text-gray-500 mt-2">{membership?.autoRenew ? 'Auto-renewal enabled' : 'Auto-renewal disabled'}</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <h4 className="text-sm text-gray-500 mb-1">Payment Method</h4>
                    <p className="font-medium">Visa ending in 4242</p>
                    <div className="mt-2 flex">
                      <Button variant="link" className="text-primary p-0 h-auto mr-3">Update</Button>
                      <Button variant="link" className="text-primary p-0 h-auto">Add New</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Transaction History */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold">Transaction History</h3>
                  <div className="flex items-center">
                    <Select value={timeFilter} onValueChange={setTimeFilter}>
                      <SelectTrigger className="w-[180px] mr-2 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3months">Last 3 Months</SelectItem>
                        <SelectItem value="6months">Last 6 Months</SelectItem>
                        <SelectItem value="year">Last Year</SelectItem>
                        <SelectItem value="all">All Time</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" className="flex items-center h-9">
                      <Download className="h-4 w-4 mr-1" /> Export
                    </Button>
                  </div>
                </div>

                {isPaymentsLoading ? (
                  <div className="p-6 text-center">Loading payment history...</div>
                ) : filteredPayments.length > 0 ? (
                  <>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receipt</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {currentPageData.map((payment, index) => (
                            <tr key={payment.id} className={index % 2 === 1 ? "bg-gray-50" : ""}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {format(new Date(payment.transactionDate), "MMM d, yyyy")}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {payment.description}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatPrice(payment.amount)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <Badge className={
                                  payment.status === 'successful' ? 'bg-green-100 text-green-800' : 
                                  payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                                  payment.status === 'failed' ? 'bg-red-100 text-red-800' : 
                                  'bg-gray-100 text-gray-800'
                                }>
                                  {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <Button variant="link" className="text-primary p-0 h-auto">Download</Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="mt-4 flex justify-between items-center">
                        <div className="text-sm text-gray-500">
                          Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredPayments.length)} of {filteredPayments.length} transactions
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button 
                            variant="outline" 
                            size="icon"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(currentPage - 1)}
                          >
                            <span className="sr-only">Previous page</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-left">
                              <path d="m15 18-6-6 6-6" />
                            </svg>
                          </Button>
                          <div className="flex items-center">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                              <Button
                                key={page}
                                variant={currentPage === page ? "default" : "outline"}
                                className="mx-1 h-8 w-8 p-0"
                                onClick={() => setCurrentPage(page)}
                              >
                                {page}
                              </Button>
                            ))}
                          </div>
                          <Button 
                            variant="outline" 
                            size="icon"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(currentPage + 1)}
                          >
                            <span className="sr-only">Next page</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-right">
                              <path d="m9 18 6-6-6-6" />
                            </svg>
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-6 text-center bg-gray-50 rounded-lg">
                    <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-900">No payment history</h3>
                    <p className="mt-1 text-sm text-gray-500">Your payment history will appear here once you make a payment</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
