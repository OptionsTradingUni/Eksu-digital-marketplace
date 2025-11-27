import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Shield, FileText, HelpCircle, AlertTriangle, Lock, Scale } from "lucide-react";

export default function LegalPage() {
  const [activeTab, setActiveTab] = useState("privacy");

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" data-testid="text-legal-title">Legal & Privacy</h1>
        <p className="text-muted-foreground">
          Important information about how we handle your data and our terms of service
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="privacy" className="flex items-center gap-1" data-testid="tab-privacy">
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">Privacy</span>
          </TabsTrigger>
          <TabsTrigger value="terms" className="flex items-center gap-1" data-testid="tab-terms">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Terms</span>
          </TabsTrigger>
          <TabsTrigger value="faqs" className="flex items-center gap-1" data-testid="tab-faqs">
            <HelpCircle className="h-4 w-4" />
            <span className="hidden sm:inline">FAQs</span>
          </TabsTrigger>
          <TabsTrigger value="disclaimer" className="flex items-center gap-1" data-testid="tab-disclaimer">
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">Disclaimer</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="privacy">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle>Privacy Policy</CardTitle>
              </div>
              <CardDescription>Last updated: November 2025</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[60vh] pr-4">
                <div className="space-y-6 text-sm">
                  <section>
                    <h3 className="font-semibold text-base mb-2">1. Information We Collect</h3>
                    <p className="text-muted-foreground mb-2">
                      We collect information you provide directly to us, including:
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                      <li>Account information (name, email, phone number)</li>
                      <li>Profile information (photo, bio, campus location)</li>
                      <li>Transaction data (purchases, sales, wallet activity)</li>
                      <li>Communication data (messages, support tickets)</li>
                      <li>Verification documents (NIN, selfie for KYC - deleted after verification)</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2">2. How We Use Your Information</h3>
                    <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                      <li>To provide and maintain our marketplace services</li>
                      <li>To process transactions and payments</li>
                      <li>To verify your identity (one-time KYC process)</li>
                      <li>To communicate with you about orders and updates</li>
                      <li>To detect and prevent fraud or scams</li>
                      <li>To improve our platform and user experience</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2">3. KYC Verification & Data Handling</h3>
                    <p className="text-muted-foreground mb-2">
                      For identity verification, we follow strict data handling practices:
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                      <li>NIN photos and selfies are used ONLY for one-time verification</li>
                      <li>Both images are automatically deleted within 24 hours of verification decision</li>
                      <li>We store only a hashed version of your NIN (not the actual number)</li>
                      <li>Verification logs are kept for 1 year for security purposes</li>
                      <li>Your explicit consent is required before any verification</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2">4. Information Sharing</h3>
                    <p className="text-muted-foreground mb-2">
                      We do not sell your personal information. We may share information:
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                      <li>With other users (limited profile info for transactions)</li>
                      <li>With payment processors to complete transactions</li>
                      <li>With verification providers for KYC (SMEDATA.NG)</li>
                      <li>When required by law or to protect our rights</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2">5. Data Security</h3>
                    <p className="text-muted-foreground">
                      We implement industry-standard security measures including encryption, 
                      secure connections (HTTPS), and access controls. However, no system is 
                      100% secure. We encourage you to protect your account credentials and 
                      report any suspicious activity.
                    </p>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2">6. Your Rights</h3>
                    <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                      <li>Access your personal data</li>
                      <li>Request correction of inaccurate data</li>
                      <li>Request deletion of your account (30-day grace period)</li>
                      <li>Opt out of promotional communications</li>
                      <li>Control your location visibility settings</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2">7. Contact Us</h3>
                    <p className="text-muted-foreground">
                      For privacy-related questions, contact us through the Support page 
                      or email our data protection team.
                    </p>
                  </section>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="terms">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-primary" />
                <CardTitle>Terms & Conditions</CardTitle>
              </div>
              <CardDescription>Last updated: November 2025</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[60vh] pr-4">
                <div className="space-y-6 text-sm">
                  <section>
                    <h3 className="font-semibold text-base mb-2">1. Acceptance of Terms</h3>
                    <p className="text-muted-foreground">
                      By using Campuspluguni (EKSU Marketplace), you agree to these terms. 
                      If you do not agree, please do not use our platform.
                    </p>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2">2. Eligibility</h3>
                    <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                      <li>You must be at least 18 years old</li>
                      <li>You must be a current student or affiliate of EKSU</li>
                      <li>You must provide accurate registration information</li>
                      <li>One account per person (enforced via phone/NIN)</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2">3. Account Responsibilities</h3>
                    <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                      <li>Keep your login credentials secure</li>
                      <li>You are responsible for all activity under your account</li>
                      <li>Report unauthorized access immediately</li>
                      <li>Do not share your account with others</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2">4. Seller Requirements</h3>
                    <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                      <li>Sellers must complete KYC verification before listing products</li>
                      <li>List only items you legally own and can sell</li>
                      <li>Provide accurate descriptions and images</li>
                      <li>Honor pricing and availability of listed items</li>
                      <li>Respond to inquiries in a timely manner</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2">5. Transaction Limits (Tier-1)</h3>
                    <p className="text-muted-foreground mb-2">
                      To comply with financial regulations, all accounts are Tier-1 with:
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                      <li>Maximum daily transaction limit: N50,000</li>
                      <li>Maximum wallet balance: N200,000</li>
                      <li>Higher limits may be available with additional verification</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2">6. Prohibited Activities</h3>
                    <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                      <li>Selling illegal, stolen, or counterfeit items</li>
                      <li>Fraudulent transactions or scams</li>
                      <li>Harassment, abuse, or threatening behavior</li>
                      <li>Creating multiple accounts</li>
                      <li>Manipulating reviews or ratings</li>
                      <li>Bypassing platform fees or escrow</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2">7. Fees & Payments</h3>
                    <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                      <li>Platform fees: 3-6% on successful transactions</li>
                      <li>KYC verification fee: N200 (one-time)</li>
                      <li>Withdrawal processing within 24 hours</li>
                      <li>Escrow protection on all transactions</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2">8. Dispute Resolution</h3>
                    <p className="text-muted-foreground">
                      We encourage buyers and sellers to resolve disputes directly. 
                      If unsuccessful, you may open a dispute through our Support system. 
                      Our team will review evidence and make a fair decision.
                    </p>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2">9. Account Termination</h3>
                    <p className="text-muted-foreground">
                      We may suspend or terminate accounts for violations of these terms. 
                      You may also request account deletion with a 30-day grace period 
                      to recover your account if needed.
                    </p>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2">10. Limitation of Liability</h3>
                    <p className="text-muted-foreground">
                      We are a platform connecting buyers and sellers. We are not responsible 
                      for the quality of items, delivery issues, or disputes between users. 
                      Use escrow and our safety features to protect yourself.
                    </p>
                  </section>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faqs">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                <CardTitle>Frequently Asked Questions</CardTitle>
              </div>
              <CardDescription>Quick answers to common questions</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[60vh] pr-4">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="what-is">
                    <AccordionTrigger>What is Campuspluguni?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      Campuspluguni is a secure marketplace platform designed specifically for EKSU students. 
                      You can buy and sell items, purchase VTU data, play games, and connect with other students - 
                      all with built-in safety features like escrow and identity verification.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="verification">
                    <AccordionTrigger>Why do I need to verify my identity?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      Verification helps prevent scams and builds trust. Verified sellers can list products, 
                      and verified users get a green badge on their profile. The N200 fee covers the cost 
                      of NIN verification and helps ensure only real people use the platform.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="fees">
                    <AccordionTrigger>What are the platform fees?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Transaction fee: 3-6% on successful sales</li>
                        <li>KYC verification: N200 (one-time)</li>
                        <li>Deposits: Free</li>
                        <li>Withdrawals: Small processing fee</li>
                      </ul>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="escrow">
                    <AccordionTrigger>How does escrow protection work?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      When you make a purchase, the payment is held securely by the platform. 
                      Once you confirm you've received the item, the payment is released to the seller. 
                      If there's a problem, you can open a dispute and our team will help resolve it.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="vtu">
                    <AccordionTrigger>What is VTU Data?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      VTU (Virtual Top-Up) allows you to buy data directly from the app. 
                      We offer MTN SME, GLO CG, Airtel CG, and 9mobile data at discounted rates. 
                      Data is delivered instantly to any Nigerian phone number.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="games">
                    <AccordionTrigger>Can I win real money playing games?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      Yes! You can stake money on games like Ludo, Word Battle, and Trivia. 
                      Winnings are credited to your wallet and can be withdrawn. 
                      You can also practice for free before staking real money.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="refund">
                    <AccordionTrigger>How do refunds work?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      If you're using escrow and there's an issue with your order, don't confirm receipt. 
                      Contact the seller first. If unresolved, open a dispute. If the dispute is resolved 
                      in your favor, you'll receive a full refund to your wallet.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="delete-account">
                    <AccordionTrigger>How do I delete my account?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      Go to Settings, then the Account tab, and click "Request Account Deletion". 
                      You'll have a 30-day grace period to cancel the deletion if you change your mind. 
                      After 30 days, your account and data will be permanently deleted.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="support">
                    <AccordionTrigger>How do I contact support?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      Visit the Support page to submit a ticket, chat with our AI assistant, 
                      or browse FAQs. For urgent issues, use the live chat feature. 
                      Our team typically responds within 24 hours.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disclaimer">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-primary" />
                <CardTitle>Disclaimer</CardTitle>
              </div>
              <CardDescription>Important notices and limitations</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[60vh] pr-4">
                <div className="space-y-6 text-sm">
                  <section>
                    <h3 className="font-semibold text-base mb-2">Platform Role</h3>
                    <p className="text-muted-foreground">
                      Campuspluguni (EKSU Marketplace) is a platform that connects buyers and sellers. 
                      We do not own, manufacture, or sell any products listed on the platform. 
                      We are not responsible for the quality, safety, legality, or accuracy of listings.
                    </p>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2">User Responsibility</h3>
                    <p className="text-muted-foreground">
                      Users are responsible for their own transactions. While we provide safety 
                      features like escrow and verification, we cannot guarantee that all users 
                      will act honestly. Always use caution and common sense when transacting.
                    </p>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2">No Financial Advice</h3>
                    <p className="text-muted-foreground">
                      Any information on the platform about pricing, investments, or financial 
                      matters is for informational purposes only and should not be considered 
                      financial advice. Consult a professional for financial decisions.
                    </p>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2">Games & Staking</h3>
                    <p className="text-muted-foreground">
                      Games with staking involve real money and risk. Only stake what you can 
                      afford to lose. We are not responsible for losses incurred through gaming. 
                      Please gamble responsibly and within legal limits.
                    </p>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2">VTU Services</h3>
                    <p className="text-muted-foreground">
                      VTU data services are provided through third-party APIs. While we strive 
                      for reliability, we cannot guarantee 100% uptime or instant delivery. 
                      Refunds for failed transactions will be processed according to our policy.
                    </p>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2">Identity Verification</h3>
                    <p className="text-muted-foreground">
                      Our KYC verification is a basic in-house real-person check, not a 
                      CBN-approved biometric verification. It helps build trust but does not 
                      guarantee the identity or intentions of users. Always verify independently 
                      for high-value transactions.
                    </p>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2">Service Availability</h3>
                    <p className="text-muted-foreground">
                      We strive to maintain platform availability but cannot guarantee uninterrupted 
                      service. We may perform maintenance, updates, or experience technical issues 
                      that temporarily affect service.
                    </p>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2">Changes to Terms</h3>
                    <p className="text-muted-foreground">
                      We may update these terms and policies at any time. Continued use of the 
                      platform after changes constitutes acceptance of the new terms. Major 
                      changes will be communicated through announcements.
                    </p>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2">Contact</h3>
                    <p className="text-muted-foreground">
                      For questions about these disclaimers or any legal matters, please contact 
                      us through the Support page or email our legal team.
                    </p>
                  </section>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
