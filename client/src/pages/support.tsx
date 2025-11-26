import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, useSearch } from "wouter";
import { HelpCircle, MessageCircle, LifeBuoy, Clock, Send, Ticket, CreditCard, User, AlertTriangle, Wrench, ChevronRight, Image, X, Upload, Loader2, Phone, MapPin, Shield, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { SupportTicket } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

const ticketFormSchema = z.object({
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  message: z.string().min(20, "Please provide more details (minimum 20 characters)"),
  category: z.string().min(1, "Please select a category"),
  priority: z.string().min(1, "Please select a priority level"),
});

type TicketFormData = z.infer<typeof ticketFormSchema>;

const verificationFormSchema = z.object({
  phoneNumber: z.string().optional(),
  location: z.string().optional(),
  ninNumber: z.string().optional(),
}).refine(
  (data) => data.phoneNumber || data.location || data.ninNumber,
  { message: "Please provide at least one verification field" }
);

type VerificationFormData = z.infer<typeof verificationFormSchema>;

const faqData = [
  {
    category: "Account",
    icon: User,
    questions: [
      {
        question: "How do I verify my account?",
        answer: "VERIFICATION_BUTTON",
        hasButton: true,
      },
      {
        question: "Can I change my role from buyer to seller?",
        answer: "Yes! You can update your role in your profile settings. Choose 'Both' to buy and sell items on the marketplace, or switch between buyer and seller as needed."
      },
      {
        question: "How do I reset my password?",
        answer: "Click on 'Forgot Password' on the login page, enter your email address, and follow the instructions sent to your email to reset your password."
      },
      {
        question: "What is the Verified Student badge?",
        answer: "The Verified Student badge appears on profiles that have completed identity verification. This builds trust with other users and helps prevent scams on the platform."
      },
      {
        question: "How do I update my profile picture?",
        answer: "Go to your Profile page and click the camera icon on your avatar. You can upload any image (up to 5MB). The new photo will be visible to other users immediately."
      }
    ]
  },
  {
    category: "Payment & Wallet",
    icon: CreditCard,
    questions: [
      {
        question: "How do I add money to my wallet?",
        answer: "Go to the Wallet page, enter the amount you want to deposit (minimum 100 NGN), and complete the payment via bank transfer, card, or USSD. The funds will be credited once the payment is confirmed."
      },
      {
        question: "How do I withdraw money from my wallet?",
        answer: "Navigate to the Wallet page, click on the Withdraw tab, enter your bank details (bank name, account number, account name) and the amount you wish to withdraw. Minimum withdrawal is 500 NGN. Withdrawals are usually processed within 24 hours."
      },
      {
        question: "What is escrow and how does it work?",
        answer: "Escrow holds payment securely until the buyer confirms receipt of the item. When you make a purchase, the money is held safely. Once you confirm you've received the item, the payment is released to the seller. This protects both parties."
      },
      {
        question: "What are the platform fees?",
        answer: "We charge a small fee (3-6%) on successful transactions to maintain the platform and provide security features. The exact fee is shown before you confirm any transaction."
      },
      {
        question: "How do I track my transactions?",
        answer: "All your transactions (deposits, withdrawals, purchases, sales, and rewards) are displayed in your Wallet page under the transaction history section. You can see the amount, type, and date of each transaction."
      }
    ]
  },
  {
    category: "Buying & Selling",
    icon: LifeBuoy,
    questions: [
      {
        question: "How do I post an item for sale?",
        answer: "If you're a seller, go to My Ads page and click 'Post New Ad'. Add photos (up to 5), title, description, price, and select a category. Your listing will be live immediately after posting."
      },
      {
        question: "How do I boost my listing?",
        answer: "Go to My Ads, find your listing, and click 'Boost'. Choose a duration (1-168 hours) and pay with your wallet balance. Boosted items appear at the top of search results and get more visibility."
      },
      {
        question: "What should I do if I receive a defective item?",
        answer: "If you're using escrow, don't confirm receipt yet. Contact the seller first through the messaging feature to try to resolve the issue. If no resolution is reached, you can open a dispute from your transaction details."
      },
      {
        question: "Can I negotiate prices?",
        answer: "Yes! Use the messaging feature to chat with sellers and negotiate prices. Many sellers are open to reasonable offers. Click the 'Message' button on any listing to start a conversation."
      },
      {
        question: "How do I save items to buy later?",
        answer: "Click the heart icon on any product to add it to your watchlist. You can view all your saved items in the Watchlist section accessible from the home page."
      }
    ]
  },
  {
    category: "Safety & Reporting",
    icon: AlertTriangle,
    questions: [
      {
        question: "How do I report a scammer?",
        answer: "Click the 'Report' button on their profile or listing. Provide as much detail as possible including screenshots. You can attach images when submitting a support ticket. Our team reviews all reports within 24 hours."
      },
      {
        question: "What happens when I report someone?",
        answer: "We investigate all reports thoroughly. If a violation is confirmed, the user may receive a warning, suspension, or permanent ban depending on the severity. You'll be notified of the outcome."
      },
      {
        question: "How can I stay safe when meeting sellers?",
        answer: "Always meet in public campus areas during daytime. Bring a friend if possible. Use escrow for valuable items to ensure secure payment. Never share personal financial information like bank passwords."
      },
      {
        question: "What should I do if someone asks me to pay outside the platform?",
        answer: "Never pay outside the platform! This is a common scam tactic. Always use our secure payment system for your protection. Report any user who asks you to pay outside the platform."
      },
      {
        question: "How do I block a user?",
        answer: "If someone is harassing you, report them using the support ticket system. Select 'Report User/Scam' as the category and provide details about the harassment. Our team will take appropriate action."
      }
    ]
  }
];

interface QuickLink {
  title: string;
  description: string;
  action: "navigate" | "tab" | "modal";
  href?: string;
  tab?: string;
  category?: string;
  modal?: string;
  icon: typeof User;
}

const quickLinks: QuickLink[] = [
  { title: "Verify Your Account", description: "Get verified for trust badges", action: "modal", modal: "verification", icon: Shield },
  { title: "Wallet & Payments", description: "Add funds or withdraw money", action: "navigate", href: "/wallet", icon: CreditCard },
  { title: "Report an Issue", description: "Report scams or violations", action: "tab", tab: "contact", category: "report", icon: AlertTriangle },
  { title: "Technical Help", description: "Fix app or account issues", action: "tab", tab: "contact", category: "technical", icon: Wrench },
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
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const [activeTab, setActiveTab] = useState("faq");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contactFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const tab = params.get("tab");
    const category = params.get("category");
    
    if (tab === "contact") {
      setActiveTab("contact");
      if (category) {
        form.setValue("category", category);
      }
    }
  }, [search]);

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

  const verificationForm = useForm<VerificationFormData>({
    resolver: zodResolver(verificationFormSchema),
    defaultValues: {
      phoneNumber: user?.phoneNumber || "",
      location: user?.location || "",
      ninNumber: "",
    },
  });

  useEffect(() => {
    if (user) {
      verificationForm.reset({
        phoneNumber: user.phoneNumber || "",
        location: user.location || "",
        ninNumber: "",
      });
    }
  }, [user]);

  const verificationMutation = useMutation({
    mutationFn: async (data: VerificationFormData) => {
      const response = await apiRequest("POST", "/api/users/verify-account", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Account Verified",
        description: "Your account has been successfully verified! You now have trust badges on your profile.",
      });
      setVerificationModalOpen(false);
      verificationForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Failed to verify your account. Please try again.",
        variant: "destructive",
      });
    },
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: TicketFormData) => {
      const response = await apiRequest("POST", "/api/support", {
        ...data,
        attachments: attachments,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Ticket Submitted",
        description: "We've received your support request and will respond soon.",
      });
      form.reset();
      setAttachments([]);
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

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (attachments.length >= 5) {
      toast({
        title: "Maximum attachments reached",
        description: "You can only attach up to 5 images per ticket.",
        variant: "destructive",
      });
      return;
    }

    const file = files[0];
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file (JPG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to upload image");
      }

      const { url } = await response.json();
      setAttachments((prev) => [...prev, url]);
      toast({
        title: "Image uploaded",
        description: "Your image has been attached to the ticket.",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleQuickLinkClick = (link: QuickLink) => {
    if (link.action === "navigate" && link.href) {
      setLocation(link.href);
    } else if (link.action === "tab" && link.tab) {
      setActiveTab(link.tab);
      if (link.category) {
        form.setValue("category", link.category);
      }
      setTimeout(() => {
        contactFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } else if (link.action === "modal" && link.modal === "verification") {
      if (!user) {
        toast({
          title: "Login Required",
          description: "Please log in to verify your account.",
          variant: "destructive",
        });
        return;
      }
      setVerificationModalOpen(true);
    }
  };

  const handleOpenVerificationModal = () => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please log in to verify your account.",
        variant: "destructive",
      });
      return;
    }
    setVerificationModalOpen(true);
  };

  const onVerificationSubmit = (data: VerificationFormData) => {
    verificationMutation.mutate(data);
  };

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
              onClick={() => handleQuickLinkClick(link)}
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
                            {(item as any).hasButton ? (
                              <div className="space-y-4">
                                <p>
                                  Account verification helps build trust with other users on the marketplace. You can verify your account by providing:
                                </p>
                                <ul className="list-disc list-inside space-y-1 ml-2">
                                  <li><strong>Phone Number</strong> - Verify your phone number for secure communication</li>
                                  <li><strong>Campus Location</strong> - Confirm your campus area/hostel for local transactions</li>
                                  <li><strong>NIN (Optional)</strong> - Add your National Identification Number for enhanced verification</li>
                                </ul>
                                <p>
                                  Verified accounts get trust badges displayed on their profile, making it easier to build credibility with buyers and sellers.
                                </p>
                                <Button
                                  onClick={handleOpenVerificationModal}
                                  className="mt-2"
                                  data-testid="button-faq-verify-account"
                                >
                                  <Shield className="mr-2 h-4 w-4" />
                                  Verify Your Account Now
                                </Button>
                              </div>
                            ) : (
                              item.answer
                            )}
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
          <Card data-testid="card-contact-form" ref={contactFormRef}>
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
                            placeholder="Please describe your issue in detail. Include any relevant information such as transaction IDs, usernames, or other details that might help us assist you."
                            className="min-h-[150px]"
                            {...field}
                            data-testid="textarea-message"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <FormLabel>Attachments (Optional)</FormLabel>
                      <span className="text-xs text-muted-foreground">{attachments.length}/5 images</span>
                    </div>
                    
                    {attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {attachments.map((url, index) => (
                          <div
                            key={index}
                            className="relative group rounded-md overflow-visible"
                            data-testid={`attachment-preview-${index}`}
                          >
                            <img
                              src={url}
                              alt={`Attachment ${index + 1}`}
                              className="h-20 w-20 object-cover rounded-md border"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => removeAttachment(index)}
                              data-testid={`button-remove-attachment-${index}`}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        data-testid="input-attachment"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage || attachments.length >= 5}
                        data-testid="button-add-attachment"
                      >
                        {uploadingImage ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Image className="mr-2 h-4 w-4" />
                            Add Image
                          </>
                        )}
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Max 5MB per image. JPG, PNG, GIF supported.
                      </span>
                    </div>
                  </div>

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
                    const ticketAttachments = (ticket as any).attachments as string[] | undefined;
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

                            {ticketAttachments && ticketAttachments.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {ticketAttachments.map((url, index) => (
                                  <a
                                    key={index}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block"
                                    data-testid={`ticket-attachment-${ticket.id}-${index}`}
                                  >
                                    <img
                                      src={url}
                                      alt={`Attachment ${index + 1}`}
                                      className="h-16 w-16 object-cover rounded-md border hover:opacity-80 transition-opacity"
                                    />
                                  </a>
                                ))}
                              </div>
                            )}
                            
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
                              {ticketAttachments && ticketAttachments.length > 0 && (
                                <>
                                  <span className="text-muted-foreground/50">|</span>
                                  <span className="flex items-center gap-1">
                                    <Image className="h-3 w-3" />
                                    {ticketAttachments.length} attachment{ticketAttachments.length > 1 ? 's' : ''}
                                  </span>
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

      <Dialog open={verificationModalOpen} onOpenChange={setVerificationModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Verify Your Account
            </DialogTitle>
            <DialogDescription>
              Complete your verification to get trust badges on your profile. Fill in at least one field below.
            </DialogDescription>
          </DialogHeader>

          {user?.isVerified && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-md border border-green-200 dark:border-green-900">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-400">Account Already Verified</p>
                <p className="text-xs text-green-600 dark:text-green-500">
                  You can still update your verification details below.
                </p>
              </div>
            </div>
          )}

          <Form {...verificationForm}>
            <form onSubmit={verificationForm.handleSubmit(onVerificationSubmit)} className="space-y-4">
              <FormField
                control={verificationForm.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Phone Number
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., +234 801 234 5678"
                        {...field}
                        data-testid="input-verification-phone"
                      />
                    </FormControl>
                    <FormDescription>
                      Your Nigerian phone number for secure communication
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={verificationForm.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Campus Location
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., EKSU Main Campus, Block A"
                        {...field}
                        data-testid="input-verification-location"
                      />
                    </FormControl>
                    <FormDescription>
                      Your campus area or hostel location
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={verificationForm.control}
                name="ninNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      NIN (National Identification Number)
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="11-digit NIN"
                        maxLength={11}
                        {...field}
                        data-testid="input-verification-nin"
                      />
                    </FormControl>
                    <FormDescription>
                      Optional - for enhanced verification and trust
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {verificationForm.formState.errors.root && (
                <p className="text-sm text-destructive">
                  {verificationForm.formState.errors.root.message}
                </p>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setVerificationModalOpen(false)}
                  data-testid="button-cancel-verification"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={verificationMutation.isPending}
                  data-testid="button-submit-verification"
                >
                  {verificationMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Verify Account
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
