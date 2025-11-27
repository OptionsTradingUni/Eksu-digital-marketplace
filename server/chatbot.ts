import Groq from "groq-sdk";

const groqClient = new Groq({
  apiKey: process.env.GROQ_API_KEY || "not-set",
});

const API_TIMEOUT_MS = 10000;

const CACHED_RESPONSES: Record<string, string> = {
  "how to sell": "To sell on EKSU Marketplace:\n\n1. Tap the + button or go to My Ads page\n2. Select your product category\n3. Add clear photos (up to 5)\n4. Write a catchy title and detailed description\n5. Set your price (be competitive!)\n6. Add your location for easy pickup\n7. Post and wait for buyers!\n\nYour first listing gets FREE boost. Pro tip: Good photos and honest descriptions sell faster. No wahala!",

  "what is escrow": "Escrow na secure payment system wey protect both buyer and seller!\n\nHow e work:\n1. Buyer pays - money go ESCROW (not seller directly)\n2. Seller sees payment notification\n3. Seller sends item to buyer\n4. Buyer confirms receipt\n5. Money releases to seller\n\nIf anything go wrong, money still safe for escrow. No more \"I don pay, seller disappear\" stories. Na the SAFEST way to trade on campus!",

  "how to buy": "Buying on EKSU Marketplace is easy:\n\n1. Browse products on Home or use Search\n2. Tap any item to see full details\n3. Chat with seller to negotiate or ask questions\n4. Tap BUY NOW and pay through the app\n5. Your money goes to ESCROW (safe!)\n6. Collect your item from seller\n7. Confirm delivery in app\n8. Money releases to seller\n\nALWAYS use escrow - never pay outside the app!",

  "how to deposit": "To add money to your wallet:\n\n1. Go to Wallet page (tap Wallet icon)\n2. Tap 'Add Money' or 'Deposit'\n3. Enter amount (minimum N100)\n4. Choose payment method:\n   - Bank Transfer\n   - Debit Card\n   - USSD\n5. Complete payment\n6. Money reflects in seconds!\n\nYour wallet is secure and you can use it for all purchases and game stakes.",

  "how to withdraw": "To withdraw from your wallet:\n\n1. Go to Wallet page\n2. Tap 'Withdraw'\n3. Enter amount (minimum N500)\n4. Add your bank details (first time only)\n5. Confirm with your PIN\n6. Money arrives within 24 hours!\n\nWithdrawal fee: N50 per transaction. Make sure your bank details are correct to avoid delays.",

  "report scam": "To report a scammer:\n\n1. Go to Support page\n2. Tap 'Submit Ticket'\n3. Select 'Scam Report' category\n4. Include:\n   - Scammer's username\n   - Screenshots of conversations\n   - Payment proof (if any)\n   - What happened\n5. Submit!\n\nWe investigate within 1-4 hours. You can also report from user's profile or chat. IMPORTANT: Only use escrow - we can NOT help with outside payments!",

  "hello": "Hey! How far? I'm your campus marketplace assistant. I sabi everything about buying, selling, wallet, games, and staying safe. Wetin you wan know?",

  "hi": "Hello! Welcome to EKSU Marketplace. I fit help you with:\n- Buying and selling items\n- Wallet (deposits, withdrawals)\n- Games (Ludo, Trivia, Word Battle)\n- Reporting scams\n- Getting verified\n\nWetin you need help with today?",

  "games": "We get three FIRE games:\n\n1. LUDO - Classic board game, 2-4 players\n   Stake: N100 - N10,000\n\n2. WORD BATTLE - Make words from letters\n   Stake: N200 - N5,000\n\n3. TRIVIA - Answer quiz questions\n   Stake: N200 - N10,000\n\nYou fit play for fun (free) or stake money to win! Must be verified student to stake. Winnings go straight to wallet. Game on!",

  "wallet": "Your Wallet is your money center:\n\n- Check balance anytime\n- DEPOSIT: Add money via card, transfer, or USSD\n- WITHDRAW: Send to any Nigerian bank (24hr max)\n- View all transaction history\n- Track escrow for pending orders\n\nMinimum deposit: N100\nMinimum withdrawal: N500\nWithdrawal fee: N50\n\nNeed specific help? Ask about deposit or withdraw!",

  "verify": "Getting verified gives you more trust:\n\n1. STUDENT VERIFICATION (Green badge)\n   - Upload valid EKSU student ID\n   - Approval within 24 hours\n   - Required to stake in games\n\n2. NIN VERIFICATION (Blue badge)\n   - Add your NIN number\n   - Instant verification\n   - Higher trust score\n\nGo to Profile > Verification to start. Verified accounts get more buyers and can access all features!",

  "help": "I fit help you with:\n\n- HOW TO SELL - List items for sale\n- HOW TO BUY - Purchase safely\n- ESCROW - Safe payment system\n- WALLET - Deposits and withdrawals\n- GAMES - Ludo, Trivia, Word Battle\n- REPORT SCAM - Stay protected\n- VERIFY - Get verified badge\n\nJust ask any question in English or Pidgin! Wetin you need?",

  "referral": "Earn money by referring friends!\n\n1. Go to Referrals page\n2. Copy your unique code\n3. Share via WhatsApp, SMS, or social media\n4. You get N500 when friend verifies\n5. Friend gets N300 bonus\n\nMilestones: 5 referrals = N3,000 bonus, 10 = N7,500! Referral earnings go straight to wallet.",

  "boost": "Boost makes your product appear at the TOP of listings!\n\n1. Go to My Ads\n2. Select the product you want to boost\n3. Choose boost duration (1-7 days)\n4. Pay from wallet\n5. Watch more buyers message you!\n\nBoosted items get 5-10x more views. First listing gets FREE boost!",
};

function matchCachedResponse(query: string): string | null {
  const normalizedQuery = query.toLowerCase().trim();
  
  for (const [pattern, response] of Object.entries(CACHED_RESPONSES)) {
    if (normalizedQuery.includes(pattern)) {
      return response;
    }
  }
  
  const exactMatches: Record<string, string> = {
    "hi": CACHED_RESPONSES["hi"],
    "hey": CACHED_RESPONSES["hello"],
    "hello": CACHED_RESPONSES["hello"],
    "help": CACHED_RESPONSES["help"],
    "?": CACHED_RESPONSES["help"],
  };
  
  if (exactMatches[normalizedQuery]) {
    return exactMatches[normalizedQuery];
  }
  
  return null;
}

function isSimpleQuestion(query: string): boolean {
  const simplePatterns = [
    /^(hi|hey|hello|yo|sup|what'?s up)/i,
    /^(thanks|thank you|okay|ok|cool|nice)/i,
    /^(bye|goodbye|later|see you)/i,
    /\?$/,
  ];
  
  return query.length < 50 && simplePatterns.some(pattern => pattern.test(query));
}

async function callGroqWithTimeout(
  messages: { role: string; content: string }[],
  model: string,
  timeoutMs: number
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const chatCompletion = await groqClient.chat.completions.create({
      messages: messages as any,
      model,
      temperature: 0.7,
      max_tokens: 600,
    });

    clearTimeout(timeoutId);
    return chatCompletion.choices[0]?.message?.content || "";
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('API request timed out');
    }
    throw error;
  }
}

const SYSTEM_PROMPT = `You are the EKSU Campus Marketplace AI Assistant - smart, helpful, and occasionally sassy when appropriate.

CRITICAL FORMATTING RULES - FOLLOW THESE STRICTLY:
- NEVER use asterisks for emphasis. No ** or * anywhere in your response.
- Use CAPS for emphasis instead of bold. Example: "ALWAYS use escrow" not "**always use escrow**"
- Use quotes for emphasis instead of italics. Example: "this is important" not "*this is important*"
- No markdown formatting at all - plain text only
- Use line breaks and numbered lists for structure
- Keep responses conversational and natural

Your Personality:
- Friendly, conversational, and helpful
- Use Nigerian Pidgin naturally when it fits
- Be direct about safety and scam prevention
- Know when to be serious vs playful
- Understand Pidgin, Yoruba, Igbo expressions

Nigerian Pidgin Expressions (Use Naturally):
- "No wahala" = No problem
- "Sharp sharp" = Quickly
- "Omo" = Expression like "Bro"
- "Wetin" = What
- "E dey" = It's available
- "Na so" = That's how it is
- "Abeg" = Please
- "How far" = What's up
- "Sabi" = Know/Understand
- "Chop" = Eat/Use
- "No vex" = Don't be angry
- "Make we run am" = Let's do it
- "Shey you understand?" = Do you understand?

APP SECTIONS - Know These Well:

HOME PAGE:
- Browse all available products
- See featured and boosted items at the top
- Categories: Electronics, Fashion, Books, Food, Services, etc.
- Filter by price, condition, location
- Tap any product to view details
- Start shopping button takes you here

SEARCH PAGE:
- Find specific items using search bar
- Use filters: Category, Price range, Condition, Location
- Search by product name, course code (for textbooks), keywords
- Sort by: Newest, Price low-high, Price high-low
- Save searches for notifications when matching items appear

GAMES SECTION:
Three main games available:

1. LUDO GAME
   - Classic 4-player Ludo board game
   - Play for fun (free) or stake money
   - Stake range: N100 - N10,000 per game
   - Win entire pot if you get all pieces home first
   - Multiplayer: Challenge friends or random opponents

2. WORD BATTLE
   - Word puzzle game - make words from letters
   - Timed rounds, score based on word length
   - Play solo for practice or stake against others
   - Stake range: N200 - N5,000
   - Higher difficulty = Higher multiplier

3. TRIVIA GAME
   - Answer quiz questions from various categories
   - Categories: EKSU knowledge, Nigerian trivia, Sports, Entertainment
   - 10 questions per round, 20 seconds each
   - Score determines prize (10/10 = 2.5x stake, 8/10 = 1.5x, 6/10 = 1x refund)
   - Stake range: N200 - N10,000

Game Rules:
- Must be verified student to play stakes
- Winnings go directly to wallet (5% platform fee)
- Can set daily spending limits
- Free practice modes available
- Responsible gaming - only stake what you can afford

WALLET PAGE:
- View current balance
- DEPOSIT: Add money via bank transfer, card, USSD
- WITHDRAW: Send money to any Nigerian bank
- Transaction history: See all deposits, withdrawals, purchases
- Escrow status: Track money held for pending transactions
- Minimum deposit: N100, Minimum withdrawal: N500
- Withdrawal fee: N50 per transaction

PROFILE PAGE:
- Edit your profile: Name, photo, bio, contact
- Student verification: Upload student ID for green badge
- NIN verification: Add NIN for blue verified badge
- Settings: Notifications, privacy, security
- View your trust score (1.0 - 5.0)
- Change password and security options
- Switch between buyer/seller roles

MESSAGES PAGE:
- Chat with buyers and sellers
- Real-time messaging with read receipts
- Share images (up to 5 per message)
- Voice notes (up to 60 seconds)
- Report suspicious users directly from chat
- Price negotiation tools built-in
- Block users if needed

MY ADS PAGE:
- View all your listed products
- See status: Active, Sold, Pending, Draft
- Edit listings: Update price, photos, description
- Boost products for more visibility
- Mark items as sold
- Delete listings
- View analytics: Views, saves, messages received

REFERRALS PAGE:
- Get your unique referral code
- Share via WhatsApp, SMS, or social media
- Track who signed up with your code
- Earnings: N500 when referred user verifies
- Friend gets: N300 extra welcome bonus
- Milestones: 5 referrals = N3,000 bonus, 10 = N7,500
- Withdraw referral earnings to wallet

SUPPORT PAGE:
- View FAQ for common questions
- Submit support ticket for issues
- Categories: Account, Payment, Dispute, Bug, Other
- Track ticket status
- Response times: Urgent 1-4 hours, Normal 12-24 hours
- Emergency SOS for immediate threats
- Contact admin directly for serious issues

SELLER DASHBOARD:
- Sales analytics: Total sales, revenue, growth
- Order management: Track pending and completed orders
- Customer insights: Repeat buyers, ratings
- Performance metrics: Response time, completion rate
- Boost suggestions for slow products
- Earnings breakdown and withdrawal history

ADMIN PANEL (Admin users only):
- Manage all users: Verify, suspend, ban
- Review reported products and users
- Handle disputes and escalations
- Create announcements for all users
- Manage categories and boost packages
- View platform analytics and revenue

ESCROW SYSTEM - VERY IMPORTANT:
- All purchases go through escrow for protection
- When buyer pays, money goes to ESCROW not seller
- Seller sees payment notification but cannot access money yet
- After buyer receives item and confirms, money releases to seller
- Disputes can be raised within 24 hours of delivery
- Platform holds funds maximum 7 days before auto-release

NAVIGATION TIPS:
- To sell: Tap + button or go to My Ads and create new listing
- To check balance: Go to Wallet tab
- To report scam: Go to Support and submit ticket
- To play games: Tap Games in the menu
- To verify account: Go to Profile then Verification
- To find specific item: Use Search with filters

COMMON USER INTENTS AND RESPONSES:

If user asks "how do I sell":
Tell them to tap the + button or go to My Ads page, then guide them through: choose category, add photos, write title and description, set price, add location, and post.

If user asks about "my balance" or "wallet":
Tell them to go to the Wallet tab to see their balance, deposit money, withdraw, or view transaction history.

If user wants to "report a scam":
Tell them to go to Support page and submit a ticket under the Scam Report category. Include screenshots and all evidence. They can also report directly from the user's profile.

If user asks about games:
Explain Ludo, Word Battle, and Trivia. Tell them they can play for fun or stake money. Must be verified to stake.

If user seems lost:
Ask what they're trying to do and guide them to the right section of the app.

CONTEXT-AWARE RESPONSES:
When you know the user's current page, give specific help for that section.

If on HOME: Help them browse, explain categories, suggest using filters
If on SEARCH: Help with search tips, explain filters
If on GAMES: Explain game rules, stakes, how to play
If on WALLET: Help with deposits, withdrawals, transactions
If on PROFILE: Help with verification, settings, editing profile
If on MESSAGES: Help with chat features, reporting
If on MY ADS: Help manage listings, boost products
If on REFERRALS: Explain referral system, how to share code
If on SUPPORT: Help submit tickets, find FAQ answers
If on SELLER DASHBOARD: Help understand analytics, manage orders
If on ADMIN: Help with admin tasks (if admin user)

SAFETY REMINDERS - Always mention when relevant:
- ALWAYS use escrow for purchases
- NEVER pay outside the app
- Check seller verification badges
- Report suspicious activity immediately
- Meet in public places for pickups
- Trust scores indicate reliability

Keep responses:
- Concise but helpful (2-4 sentences for simple questions)
- Detailed when needed (step-by-step for complex tasks)
- Friendly and encouraging
- Safe - always promote escrow and in-app transactions`;

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface UserContext {
  role?: string;
  isVerified?: boolean;
  trustScore?: string;
  currentPage?: string;
}

export async function getChatbotResponse(
  messages: ChatMessage[],
  userContext?: UserContext
): Promise<string> {
  try {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === "user") {
      const cachedResponse = matchCachedResponse(lastMessage.content);
      if (cachedResponse) {
        console.log("Returning cached response for:", lastMessage.content.substring(0, 50));
        return cachedResponse;
      }
    }

    let contextualPrompt = SYSTEM_PROMPT;
    
    if (userContext) {
      contextualPrompt += `\n\nCURRENT USER CONTEXT:\n`;
      
      if (userContext.currentPage) {
        contextualPrompt += `- User is currently on: ${userContext.currentPage} page\n`;
        contextualPrompt += `- Provide help relevant to this section when appropriate\n`;
      }
      
      if (userContext.role) {
        contextualPrompt += `- User role: ${userContext.role}\n`;
      }
      
      if (userContext.isVerified !== undefined) {
        contextualPrompt += `- Verified student: ${userContext.isVerified ? "Yes" : "No"}\n`;
        if (!userContext.isVerified) {
          contextualPrompt += `- Remind them to verify for full features when relevant\n`;
        }
      }
      
      if (userContext.trustScore) {
        contextualPrompt += `- Trust score: ${userContext.trustScore}/5.0\n`;
      }
    }

    const useSimpleQuestion = lastMessage && isSimpleQuestion(lastMessage.content);
    const model = useSimpleQuestion ? "llama-3.1-8b-instant" : "llama-3.3-70b-versatile";
    const timeout = useSimpleQuestion ? 5000 : API_TIMEOUT_MS;

    let response: string;
    try {
      response = await callGroqWithTimeout(
        [
          { role: "system", content: contextualPrompt },
          ...messages,
        ],
        model,
        timeout
      );
    } catch (timeoutError: any) {
      console.warn("API timeout, trying faster model:", timeoutError.message);
      response = await callGroqWithTimeout(
        [
          { role: "system", content: contextualPrompt },
          ...messages,
        ],
        "llama-3.1-8b-instant",
        5000
      );
    }

    if (!response) {
      response = "Sorry, I no fit process your message now. Try again!";
    }
    
    response = cleanMarkdown(response);
    
    return response;
  } catch (error) {
    console.error("Groq API error:", error);
    return "Omo, something don happen. I no fit connect now. Try again or contact support if e continue. No wahala!";
  }
}

function cleanMarkdown(text: string): string {
  let cleaned = text;
  cleaned = cleaned.replace(/\*\*\*/g, '');
  cleaned = cleaned.replace(/\*\*/g, '');
  cleaned = cleaned.replace(/\*/g, '');
  cleaned = cleaned.replace(/_{2,}/g, '');
  cleaned = cleaned.replace(/`{1,3}/g, '');
  cleaned = cleaned.replace(/^#+\s/gm, '');
  cleaned = cleaned.replace(/^\s*[-*+]\s/gm, '- ');
  return cleaned.trim();
}

export function checkForPaymentScam(message: string): boolean {
  const scamKeywords = [
    "bank account",
    "account number",
    "transfer money",
    "pay outside",
    "send money directly",
    "cash on delivery",
    "mobile money",
    "pay before",
    "send am",
    "transfer am",
    "my account",
    "direct payment",
    "pay me direct",
    "send to my",
    "opay",
    "palmpay",
    "pay to my",
    "send to account",
  ];

  const messageLower = message.toLowerCase();
  return scamKeywords.some(keyword => messageLower.includes(keyword));
}

export const QUICK_RESPONSES = {
  escrow: "Escrow na like middleman wey hold your money safe. When you pay, money go escrow FIRST, not seller. Seller see payment notification but no fit touch am. When you collect item and confirm, THEN money release to seller. If anything go wrong, money still safe for escrow. Na the SAFEST way to buy!",
  
  sell: "To sell: 1) Tap + button or go to My Ads 2) Pick category 3) Add clear photos 4) Write good title 5) Describe item well 6) Set price 7) Add location 8) Post! First listing get free boost. Buyers go start messaging you!",
  
  scam: "If you suspect scam: 1) STOP any outside payment 2) Screenshot everything 3) Go to Support page 4) Submit Scam Report ticket 5) Include all evidence. We investigate within 1-4 hours. ALWAYS use escrow - we no fit help if you pay outside app!",
  
  wallet: "Wallet help: DEPOSIT - Go Wallet tab, tap Add Money, choose method, pay. WITHDRAW - Tap Withdraw, enter amount, add bank, confirm PIN. Check transaction history anytime. Escrow money releases when you confirm receipt of items.",
  
  games: "Games available: LUDO (4-player board game), WORD BATTLE (make words from letters), TRIVIA (answer quiz questions). Play for fun free or stake money to win. Must be verified student for stakes. Winnings go straight to wallet!",
};
