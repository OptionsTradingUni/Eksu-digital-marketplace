import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { HelpCircle, MessageCircle, LifeBuoy, Clock, Send, Ticket, CreditCard, User, AlertTriangle, Wrench, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SupportTicket } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

const ticketFormSchema = z.object({
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  message: z.string().min(20, "Please provide more details (minimum 20 characters)"),
  category: z.string().min(1, "Please select a category"),
  priority: z.string().min(1, "Please select a priority level"),
});

type TicketFormData = z.infer<typeof ticketFormSchema>;

const faqData = [
  {
    category: "Account",
    icon: User,
    questions: [
      {
        question: "How do I verify my account?",
        answer: "To verify your account, go to Profile > Settings and click on 'Verify Account'. You'll need to provide your student ID, phone number, and complete NIN verification for full verification status."
      },
      {
        question: "Can I change my role from buyer to seller?",
        answer: "Yes! Go to Profile > Settings and select 'Both' as your role. This allows you to buy and sell items on the marketplace."
      },
      {
        question: "How do I reset my password?",
        answer: "Click on 'Forgot Password' on the login page, enter your email address, and follow the instructions sent to your email to reset your password."
      },
      {
        question: "What is the Verified Student badge?",
        answer: "The Verified Student badge appears on profiles that have completed identity verification. This builds trust with other users and helps prevent scams."
      }
    ]
  },
  {
    category: "Payment & Wallet",
    icon: CreditCard,
    questions: [
      {
        question: "How do I add money to my wallet?",
        answer: "Go to Wallet > Deposit, enter the amount you want to add (minimum 100 NGN), and complete the payment via bank transfer, card, or USSD."
      },
      {
        question: "How do I withdraw money from my wallet?",
        answer: "Navigate to Wallet > Withdraw, enter your bank details and the amount (minimum 500 NGN). Withdrawals are usually processed within 24 hours."
      },
      {
        question: "What is escrow and how does it work?",
        answer: "Escrow holds payment securely until the buyer confirms receipt of the item. This protects both buyers and sellers - buyers know their money is safe, and sellers are guaranteed payment."
      },
      {
        question: "What are the platform fees?",
        answer: "We charge a small fee (3-6%) on successful transactions to maintain the platform and provide security features. The exact fee is shown before you confirm any transaction."
      }
    ]
  },
  {
    category: "Buying & Selling",
    icon: LifeBuoy,
    questions: [
      {
        question: "How do I post an item for sale?",
        answer: "Click the '+' button or go to My Ads > Create New. Add photos, title, description, price, and select a category. Your listing will be live immediately after posting."
      },
      {
        question: "How do I boost my listing?",
        answer: "Go to My Ads, find your listing, and click 'Boost'. Choose a duration and pay with your wallet balance. Boosted items appear at the top of search results."
      },
      {
        question: "What should I do if I receive a defective item?",
        answer: "If you're using escrow, don't confirm receipt yet. Contact the seller first to resolve. If no resolution, open a dispute from the transaction details page within 48 hours."
      },
      {
        question: "Can I negotiate prices?",
        answer: "Yes! Use the messaging feature to chat with sellers and negotiate prices. Many sellers are open to reasonable offers."
      }
    ]
  },
  {
    category: "Safety & Reporting",
    icon: AlertTriangle,
    questions: [
      {
        question: "How do I report a scammer?",
        answer: "Click the 'Report' button on their profile or listing. Provide as much detail as possible including screenshots. Our team reviews all reports within 24 hours."
      },
      {
        question: "What happens when I report someone?",
        answer: "We investigate all reports thoroughly. If a violation is confirmed, the user may receive a warning, suspension, or permanent ban depending on the severity."
      },
      {
        question: "How can I stay safe when meeting sellers?",
        answer: "Always meet in public campus areas during daytime. Bring a friend if possible. Use escrow for valuable items. Never share personal financial information."
      },
      {
        question: "What should I do if someone asks me to pay outside the platform?",
        answer: "Never pay outside the platform! This is a common scam tactic. Always use our secure payment system for your protection."
      }
    ]
  }
];

const quickLinks = [
  { title: "Verify Your Account", description: "Get verified for trust badges", href: "/profile", icon: User },
  { title: "Wallet & Payments", description: "Add funds or withdraw money", href: "/wallet", icon: CreditCard },
  { title: "Report an Issue", description: "Report scams or violations", href: "#report", icon: AlertTriangle },
  { title: "Technical Help", description: "Fix app or account issues", href: "#contact", icon: Wrench },
];

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "open":
      return "destructive";
    case "in_progress":
      return "default";
    case "resolved":
      return "secondary";
    default:
      return "outline";
  }
}

function getPriorityBadgeVariant(priority: string): "default" | "secondary" | "destructive" | "outline" {
  switch (priority) {
    case "urgent":
      return "destructive";
    case "high":
      return "default";
    case "medium":
      return "secondary";
    default:
      return "outline";
  }
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "account":
      return User;
    case "payment":
      return CreditCard;
    case "technical":
      return Wrench;
    case "report":
      return AlertTriangle;
    default:
      return HelpCircle;
  }
}

export default function SupportPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("faq");

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery<SupportTicket[]>({
    queryKey: ["/api/support"],
  });

  const form = useForm<TicketFormData>({
    resolver: zodResolver(ticketFormSchema),
    defaultValues: {
      subject: "",
      message: "",
      category: "",
      priority: "medium",
    },
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: TicketFormData) => {
      const response = await apiRequest("POST", "/api/support", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Ticket Submitted",
        description: "We've received your support request and will respond soon.",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/support"] });
      setActiveTab("tickets");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit ticket. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TicketFormData) => {
    createTicketMutation.mutate(data);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <LifeBuoy className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Help Center</h1>
        </div>
        <p className="text-muted-foreground">
          Find answers to common questions or contact our support team for assistance.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {quickLinks.map((link, index) => {
          const Icon = link.icon;
          return (
            <Card
              key={index}
              className="hover-elevate cursor-pointer"
              onClick={() => {
                if (link.href.startsWith("#")) {
                  if (link.href === "#contact" || link.href === "#report") {
                    setActiveTab("contact");
                    if (link.href === "#report") {
                      form.setValue("category", "report");
                    }
                  }
                } else {
                  window.location.href = link.href;
                }
              }}
              data-testid={`card-quick-link-${index}`}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div className="p-2 rounded-md bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{link.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{link.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="faq" className="flex items-center gap-2" data-testid="tab-faq">
            <HelpCircle className="h-4 w-4" />
            FAQ
          </TabsTrigger>
          <TabsTrigger value="contact" className="flex items-center gap-2" data-testid="tab-contact">
            <MessageCircle className="h-4 w-4" />
            Contact Us
          </TabsTrigger>
          <TabsTrigger value="tickets" className="flex items-center gap-2" data-testid="tab-tickets">
            <Ticket className="h-4 w-4" />
            My Tickets
            {tickets.length > 0 && (
              <Badge variant="secondary" className="ml-1">{tickets.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="faq">
          <div className="space-y-6">
            {faqData.map((section, sectionIndex) => {
              const Icon = section.icon;
              return (
                <Card key={sectionIndex} data-testid={`card-faq-section-${sectionIndex}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Icon className="h-5 w-5 text-primary" />
                      {section.category}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Accordion type="single" collapsible className="w-full">
                      {section.questions.map((item, index) => (
                        <AccordionItem
                          key={index}
                          value={`${sectionIndex}-${index}`}
                          data-testid={`accordion-item-${sectionIndex}-${index}`}
                        >
                          <AccordionTrigger className="text-left">
                            {item.question}
                          </AccordionTrigger>
                          <AccordionContent className="text-muted-foreground">
                            {item.answer}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="contact">
          <Card data-testid="card-contact-form">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" />
                Submit a Support Ticket
              </CardTitle>
              <CardDescription>
                Can't find your answer in the FAQ? Submit a ticket and we'll get back to you within 24 hours.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-category">
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="account">Account Issues</SelectItem>
                            <SelectItem value="payment">Payment & Wallet</SelectItem>
                            <SelectItem value="technical">Technical Problems</SelectItem>
                            <SelectItem value="report">Report User/Scam</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-priority">
                              <SelectValue placeholder="Select priority level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low - General question</SelectItem>
                            <SelectItem value="medium">Medium - Need help soon</SelectItem>
                            <SelectItem value="high">High - Urgent issue</SelectItem>
                            <SelectItem value="urgent">Urgent - Critical problem</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Brief description of your issue"
                            {...field}
                            data-testid="input-subject"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Please describe your issue in detail. Include any relevant information such as transaction IDs, usernames, or screenshots."
                            className="min-h-[150px]"
                            {...field}
                            data-testid="textarea-message"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={createTicketMutation.isPending}
                    data-testid="button-submit-ticket"
                  >
                    {createTicketMutation.isPending ? (
                      <>
                        <Clock className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Submit Ticket
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets">
          <Card data-testid="card-tickets-list">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5 text-primary" />
                Your Support Tickets
              </CardTitle>
              <CardDescription>
                View and track the status of your support requests.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ticketsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Clock className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : tickets.length === 0 ? (
                <div className="text-center py-8">
                  <Ticket className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">No tickets yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    You haven't submitted any support tickets.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab("contact")}
                    data-testid="button-create-first-ticket"
                  >
                    Create your first ticket
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {tickets.map((ticket) => {
                    const CategoryIcon = getCategoryIcon(ticket.category || "");
                    return (
                      <Card
                        key={ticket.id}
                        className="overflow-visible"
                        data-testid={`card-ticket-${ticket.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                <CategoryIcon className="h-4 w-4 text-muted-foreground" />
                                <h4 className="font-medium">{ticket.subject}</h4>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant={getStatusBadgeVariant(ticket.status || "open")}>
                                  {ticket.status === "in_progress" ? "In Progress" : 
                                   ticket.status ? ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1) : "Open"}
                                </Badge>
                                <Badge variant={getPriorityBadgeVariant(ticket.priority || "medium")}>
                                  {ticket.priority ? ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1) : "Medium"}
                                </Badge>
                              </div>
                            </div>
                            
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {ticket.message}
                            </p>
                            
                            {ticket.response && (
                              <div className="bg-muted/50 rounded-md p-3 mt-2">
                                <p className="text-xs font-medium text-muted-foreground mb-1">Support Response:</p>
                                <p className="text-sm">{ticket.response}</p>
                              </div>
                            )}
                            
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>
                                Submitted {ticket.createdAt ? formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true }) : "recently"}
                              </span>
                              {ticket.category && (
                                <>
                                  <span className="text-muted-foreground/50">|</span>
                                  <span className="capitalize">{ticket.category}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
