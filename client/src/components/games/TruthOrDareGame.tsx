import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Clock, 
  Trophy, 
  Bot, 
  User, 
  RotateCcw, 
  Heart,
  Sparkles,
  Play,
  SkipForward,
  CheckCircle2,
  XCircle,
  Flame,
  MessageCircle,
  Zap,
  Target,
  Star,
  Crown,
  ThumbsUp,
  AlertTriangle
} from "lucide-react";

interface TruthOrDareGameProps {
  stake: number;
  onGameEnd: (won: boolean, score?: number) => void;
  isPractice: boolean;
}

type Difficulty = "easy" | "medium" | "spicy";
type PromptType = "truth" | "dare";
type GamePhase = "ready" | "choosing" | "prompt" | "responding" | "ai_turn" | "round_result" | "finished";

interface Prompt {
  id: number;
  type: PromptType;
  difficulty: Difficulty;
  text: string;
  points: number;
}

const TRUTHS: Prompt[] = [
  { id: 1, type: "truth", difficulty: "easy", text: "What's your favorite course this semester and why?", points: 5 },
  { id: 2, type: "truth", difficulty: "easy", text: "Have you ever fallen asleep during a lecture? Which class?", points: 5 },
  { id: 3, type: "truth", difficulty: "easy", text: "What's the first thing you do when you wake up in your hostel?", points: 5 },
  { id: 4, type: "truth", difficulty: "easy", text: "What's your go-to spot on campus to hang out?", points: 5 },
  { id: 5, type: "truth", difficulty: "easy", text: "What song do you secretly listen to that would surprise people?", points: 5 },
  { id: 6, type: "truth", difficulty: "easy", text: "If you could swap rooms with anyone in your hostel, who would it be?", points: 5 },
  { id: 7, type: "truth", difficulty: "easy", text: "What's your guilty pleasure snack from the campus cafeteria?", points: 5 },
  { id: 8, type: "truth", difficulty: "easy", text: "What's the longest you've procrastinated on an assignment?", points: 5 },
  
  { id: 9, type: "truth", difficulty: "medium", text: "What's the most embarrassing thing that happened to you on campus?", points: 10 },
  { id: 10, type: "truth", difficulty: "medium", text: "Have you ever had a crush on a classmate? What happened?", points: 10 },
  { id: 11, type: "truth", difficulty: "medium", text: "What's the biggest lie you've told a lecturer?", points: 10 },
  { id: 12, type: "truth", difficulty: "medium", text: "If you could change one decision from your university life, what would it be?", points: 10 },
  { id: 13, type: "truth", difficulty: "medium", text: "What's your biggest fear about graduating?", points: 10 },
  { id: 14, type: "truth", difficulty: "medium", text: "Have you ever cheated on a test? (Be honest!)", points: 10 },
  { id: 15, type: "truth", difficulty: "medium", text: "What's the most money you've ever wasted on something you regret?", points: 10 },
  { id: 16, type: "truth", difficulty: "medium", text: "Who do you secretly look up to on campus?", points: 10 },
  
  { id: 17, type: "truth", difficulty: "spicy", text: "What's the most controversial opinion you hold that you've never shared?", points: 15 },
  { id: 18, type: "truth", difficulty: "spicy", text: "Have you ever developed feelings for your roommate or close friend?", points: 15 },
  { id: 19, type: "truth", difficulty: "spicy", text: "What's something you've done that would disappoint your parents?", points: 15 },
  { id: 20, type: "truth", difficulty: "spicy", text: "Who is the most attractive person you know on campus?", points: 15 },
  { id: 21, type: "truth", difficulty: "spicy", text: "What's a secret you've never told anyone at university?", points: 15 },
  { id: 22, type: "truth", difficulty: "spicy", text: "Have you ever pretended to be someone you're not to impress someone?", points: 15 },
  { id: 23, type: "truth", difficulty: "spicy", text: "What's the pettiest thing you've done to someone who wronged you?", points: 15 },
  { id: 24, type: "truth", difficulty: "spicy", text: "If you had to confess something to your best friend, what would it be?", points: 15 },
];

const DARES: Prompt[] = [
  { id: 101, type: "dare", difficulty: "easy", text: "Do 10 jumping jacks right now!", points: 8 },
  { id: 102, type: "dare", difficulty: "easy", text: "Send a compliment to your best friend right now.", points: 8 },
  { id: 103, type: "dare", difficulty: "easy", text: "Speak in an accent for the next 30 seconds.", points: 8 },
  { id: 104, type: "dare", difficulty: "easy", text: "Strike a funny pose and hold it for 10 seconds.", points: 8 },
  { id: 105, type: "dare", difficulty: "easy", text: "Say the alphabet backwards as fast as you can.", points: 8 },
  { id: 106, type: "dare", difficulty: "easy", text: "Do your best impression of a popular lecturer.", points: 8 },
  { id: 107, type: "dare", difficulty: "easy", text: "Share your most recent photo in your gallery (if appropriate).", points: 8 },
  { id: 108, type: "dare", difficulty: "easy", text: "Sing the chorus of your favorite song out loud.", points: 8 },
  
  { id: 109, type: "dare", difficulty: "medium", text: "Post a story saying something nice about EKSU.", points: 12 },
  { id: 110, type: "dare", difficulty: "medium", text: "Text your crush 'Hi' with no follow-up explanation.", points: 12 },
  { id: 111, type: "dare", difficulty: "medium", text: "Share your most embarrassing moment from this year.", points: 12 },
  { id: 112, type: "dare", difficulty: "medium", text: "Do 20 squats while counting out loud.", points: 12 },
  { id: 113, type: "dare", difficulty: "medium", text: "Let someone pick a song and you have to dance to it.", points: 12 },
  { id: 114, type: "dare", difficulty: "medium", text: "Call a friend and tell them you appreciate them without explaining why.", points: 12 },
  { id: 115, type: "dare", difficulty: "medium", text: "Make up a short poem about university life on the spot.", points: 12 },
  { id: 116, type: "dare", difficulty: "medium", text: "Do your best runway walk across the room.", points: 12 },
  
  { id: 117, type: "dare", difficulty: "spicy", text: "Post a throwback photo from when you first arrived at university.", points: 18 },
  { id: 118, type: "dare", difficulty: "spicy", text: "Reveal your last 3 search history items (if appropriate).", points: 18 },
  { id: 119, type: "dare", difficulty: "spicy", text: "Send a voice note to your crush saying something nice.", points: 18 },
  { id: 120, type: "dare", difficulty: "spicy", text: "Let someone go through your phone's photo gallery for 30 seconds.", points: 18 },
  { id: 121, type: "dare", difficulty: "spicy", text: "Share a screenshot of your most used emojis.", points: 18 },
  { id: 122, type: "dare", difficulty: "spicy", text: "Call a family member and tell them you love them.", points: 18 },
  { id: 123, type: "dare", difficulty: "spicy", text: "Make a TikTok-style video doing a trending dance.", points: 18 },
  { id: 124, type: "dare", difficulty: "spicy", text: "Write and send a sincere apology to someone you've wronged.", points: 18 },
];

const TOTAL_ROUNDS = 10;
const RESPONSE_TIME = 30;

const getDifficultyColor = (difficulty: Difficulty) => {
  switch (difficulty) {
    case "easy": return "bg-green-500/20 text-green-600 dark:text-green-400";
    case "medium": return "bg-amber-500/20 text-amber-600 dark:text-amber-400";
    case "spicy": return "bg-red-500/20 text-red-600 dark:text-red-400";
  }
};

const getDifficultyIcon = (difficulty: Difficulty) => {
  switch (difficulty) {
    case "easy": return Star;
    case "medium": return Zap;
    case "spicy": return Flame;
  }
};

const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const getRandomPrompt = (type: PromptType, usedIds: Set<number>): Prompt => {
  const prompts = type === "truth" ? TRUTHS : DARES;
  const available = prompts.filter(p => !usedIds.has(p.id));
  
  if (available.length === 0) {
    const shuffled = shuffleArray(prompts);
    return shuffled[0];
  }
  
  const shuffled = shuffleArray(available);
  return shuffled[0];
};

const simulateAIChoice = (): { choice: PromptType; completed: boolean; difficulty: Difficulty } => {
  const choice: PromptType = Math.random() > 0.5 ? "truth" : "dare";
  const difficulties: Difficulty[] = ["easy", "medium", "spicy"];
  const weights = [0.5, 0.35, 0.15];
  const random = Math.random();
  let sum = 0;
  let difficulty: Difficulty = "easy";
  
  for (let i = 0; i < weights.length; i++) {
    sum += weights[i];
    if (random < sum) {
      difficulty = difficulties[i];
      break;
    }
  }
  
  const completionChance = difficulty === "easy" ? 0.95 : difficulty === "medium" ? 0.80 : 0.65;
  const completed = Math.random() < completionChance;
  
  return { choice, completed, difficulty };
};

const getAIPoints = (completed: boolean, difficulty: Difficulty): number => {
  if (!completed) return 0;
  switch (difficulty) {
    case "easy": return 6;
    case "medium": return 11;
    case "spicy": return 16;
  }
};

export default function TruthOrDareGame({ stake, onGameEnd, isPractice }: TruthOrDareGameProps) {
  const [gamePhase, setGamePhase] = useState<GamePhase>("ready");
  const [currentRound, setCurrentRound] = useState(1);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [currentPrompt, setCurrentPrompt] = useState<Prompt | null>(null);
  const [timeLeft, setTimeLeft] = useState(RESPONSE_TIME);
  const [usedPromptIds, setUsedPromptIds] = useState<Set<number>>(new Set());
  const [selectedChoice, setSelectedChoice] = useState<PromptType | null>(null);
  const [roundResult, setRoundResult] = useState<{ completed: boolean; points: number; skipped: boolean } | null>(null);
  const [aiRoundResult, setAiRoundResult] = useState<{ choice: PromptType; completed: boolean; points: number } | null>(null);
  const [showPromptReveal, setShowPromptReveal] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (gamePhase === "responding" && timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (gamePhase === "responding" && timeLeft === 0) {
      handleSkip();
    }
    
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [gamePhase, timeLeft]);

  const startGame = useCallback(() => {
    setGamePhase("choosing");
    setCurrentRound(1);
    setPlayerScore(0);
    setAiScore(0);
    setUsedPromptIds(new Set());
    setCurrentPrompt(null);
    setTimeLeft(RESPONSE_TIME);
    setRoundResult(null);
    setAiRoundResult(null);
  }, []);

  const handleChoice = (choice: PromptType) => {
    setSelectedChoice(choice);
    const prompt = getRandomPrompt(choice, usedPromptIds);
    setCurrentPrompt(prompt);
    setUsedPromptIds(prev => {
      const newSet = new Set(Array.from(prev));
      newSet.add(prompt.id);
      return newSet;
    });
    setShowPromptReveal(true);
    setGamePhase("prompt");
    
    setTimeout(() => {
      setShowPromptReveal(false);
      setGamePhase("responding");
      setTimeLeft(RESPONSE_TIME);
    }, 2000);
  };

  const handleComplete = () => {
    if (!currentPrompt) return;
    
    const points = currentPrompt.points;
    setPlayerScore(prev => prev + points);
    setRoundResult({ completed: true, points, skipped: false });
    setGamePhase("ai_turn");
    
    setTimeout(() => {
      processAITurn();
    }, 1500);
  };

  const handleSkip = () => {
    const penaltyPoints = -3;
    setPlayerScore(prev => Math.max(0, prev + penaltyPoints));
    setRoundResult({ completed: false, points: penaltyPoints, skipped: true });
    setGamePhase("ai_turn");
    
    setTimeout(() => {
      processAITurn();
    }, 1500);
  };

  const processAITurn = () => {
    const aiResult = simulateAIChoice();
    const aiPoints = getAIPoints(aiResult.completed, aiResult.difficulty);
    
    setAiScore(prev => prev + aiPoints);
    setAiRoundResult({
      choice: aiResult.choice,
      completed: aiResult.completed,
      points: aiPoints
    });
    
    setTimeout(() => {
      setGamePhase("round_result");
    }, 1500);
  };

  const nextRound = () => {
    if (currentRound >= TOTAL_ROUNDS) {
      setGamePhase("finished");
      const won = playerScore > aiScore;
      onGameEnd(won, playerScore);
    } else {
      setCurrentRound(prev => prev + 1);
      setCurrentPrompt(null);
      setSelectedChoice(null);
      setRoundResult(null);
      setAiRoundResult(null);
      setGamePhase("choosing");
    }
  };

  const resetGame = () => {
    setGamePhase("ready");
    setCurrentRound(1);
    setPlayerScore(0);
    setAiScore(0);
    setCurrentPrompt(null);
    setSelectedChoice(null);
    setUsedPromptIds(new Set());
    setTimeLeft(RESPONSE_TIME);
    setRoundResult(null);
    setAiRoundResult(null);
  };

  const progressPercentage = (currentRound / TOTAL_ROUNDS) * 100;
  const timerPercentage = (timeLeft / RESPONSE_TIME) * 100;

  if (gamePhase === "ready") {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            <Heart className="h-16 w-16 mx-auto text-rose-500 mb-4" />
          </motion.div>
          <CardTitle className="text-2xl">Truth or Dare</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              The classic party game! Choose Truth or Dare each round, complete the challenge, and score points.
            </p>
            <p className="text-sm text-muted-foreground">
              Harder challenges = more points. Beat the AI over 10 rounds to win!
            </p>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-green-500/10">
              <Star className="h-6 w-6 mx-auto text-green-500 mb-1" />
              <div className="text-xs font-medium text-green-600 dark:text-green-400">Easy</div>
              <div className="text-xs text-muted-foreground">5-8 pts</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-amber-500/10">
              <Zap className="h-6 w-6 mx-auto text-amber-500 mb-1" />
              <div className="text-xs font-medium text-amber-600 dark:text-amber-400">Medium</div>
              <div className="text-xs text-muted-foreground">10-12 pts</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-red-500/10">
              <Flame className="h-6 w-6 mx-auto text-red-500 mb-1" />
              <div className="text-xs font-medium text-red-600 dark:text-red-400">Spicy</div>
              <div className="text-xs text-muted-foreground">15-18 pts</div>
            </div>
          </div>
          
          {!isPractice && stake > 0 && (
            <div className="text-center p-3 bg-primary/10 rounded-lg">
              <p className="text-sm font-medium">Stake: {stake.toLocaleString()} NGN</p>
              <p className="text-xs text-muted-foreground">Win to double your stake!</p>
            </div>
          )}
          
          <Button 
            onClick={startGame} 
            size="lg" 
            className="w-full"
            data-testid="button-start-game"
          >
            <Play className="h-5 w-5 mr-2" />
            Start Game
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (gamePhase === "finished") {
    const won = playerScore > aiScore;
    const tied = playerScore === aiScore;
    
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            {won ? (
              <Trophy className="h-20 w-20 mx-auto text-yellow-500 mb-4" />
            ) : tied ? (
              <Target className="h-20 w-20 mx-auto text-blue-500 mb-4" />
            ) : (
              <AlertTriangle className="h-20 w-20 mx-auto text-red-500 mb-4" />
            )}
          </motion.div>
          <CardTitle className="text-2xl">
            {won ? "You Won!" : tied ? "It's a Tie!" : "AI Wins!"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <motion.div 
              className={`p-4 rounded-lg text-center ${won ? 'bg-green-500/10 ring-2 ring-green-500' : 'bg-muted/50'}`}
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <User className="h-8 w-8 mx-auto mb-2 text-blue-500" />
              <div className="text-sm text-muted-foreground">You</div>
              <div className="text-3xl font-bold">{playerScore}</div>
              <div className="text-xs text-muted-foreground">points</div>
            </motion.div>
            <motion.div 
              className={`p-4 rounded-lg text-center ${!won && !tied ? 'bg-red-500/10 ring-2 ring-red-500' : 'bg-muted/50'}`}
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Bot className="h-8 w-8 mx-auto mb-2 text-orange-500" />
              <div className="text-sm text-muted-foreground">AI</div>
              <div className="text-3xl font-bold">{aiScore}</div>
              <div className="text-xs text-muted-foreground">points</div>
            </motion.div>
          </div>
          
          {!isPractice && stake > 0 && (
            <motion.div 
              className={`text-center p-4 rounded-lg ${won ? 'bg-green-500/10' : 'bg-red-500/10'}`}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {won ? (
                <>
                  <Sparkles className="h-8 w-8 mx-auto text-green-500 mb-2" />
                  <p className="font-bold text-green-600 dark:text-green-400">
                    You earned {(stake * 1.8).toLocaleString()} NGN!
                  </p>
                </>
              ) : (
                <p className="font-medium text-red-600 dark:text-red-400">
                  You lost {stake.toLocaleString()} NGN
                </p>
              )}
            </motion.div>
          )}
          
          <div className="flex gap-3">
            <Button variant="outline" onClick={resetGame} className="flex-1" data-testid="button-play-again">
              <RotateCcw className="h-4 w-4 mr-2" />
              Play Again
            </Button>
            <Button onClick={() => onGameEnd(won, playerScore)} className="flex-1" data-testid="button-exit-game">
              Exit Game
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-rose-500" />
            <span className="font-semibold">Round {currentRound}/{TOTAL_ROUNDS}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <User className="h-4 w-4 text-blue-500" />
              <span className="font-bold">{playerScore}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Bot className="h-4 w-4 text-orange-500" />
              <span className="font-bold">{aiScore}</span>
            </div>
          </div>
        </div>
        <Progress value={progressPercentage} className="h-2 mt-2" />
      </CardHeader>
      
      <CardContent className="space-y-6">
        <AnimatePresence mode="wait">
          {gamePhase === "choosing" && (
            <motion.div
              key="choosing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="text-center">
                <h3 className="text-xl font-bold mb-2">Make Your Choice</h3>
                <p className="text-muted-foreground">Truth or Dare?</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <motion.button
                  className="p-6 rounded-xl bg-blue-500/10 border-2 border-blue-500/20 text-center space-y-3"
                  whileHover={{ scale: 1.03, borderColor: "rgb(59 130 246)" }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleChoice("truth")}
                  data-testid="button-choose-truth"
                >
                  <MessageCircle className="h-12 w-12 mx-auto text-blue-500" />
                  <div className="font-bold text-lg">Truth</div>
                  <div className="text-xs text-muted-foreground">Answer honestly</div>
                </motion.button>
                
                <motion.button
                  className="p-6 rounded-xl bg-rose-500/10 border-2 border-rose-500/20 text-center space-y-3"
                  whileHover={{ scale: 1.03, borderColor: "rgb(244 63 94)" }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleChoice("dare")}
                  data-testid="button-choose-dare"
                >
                  <Flame className="h-12 w-12 mx-auto text-rose-500" />
                  <div className="font-bold text-lg">Dare</div>
                  <div className="text-xs text-muted-foreground">Complete the challenge</div>
                </motion.button>
              </div>
            </motion.div>
          )}

          {gamePhase === "prompt" && currentPrompt && (
            <motion.div
              key="prompt"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="text-center space-y-4"
            >
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ repeat: Infinity, duration: 1 }}
              >
                {currentPrompt.type === "truth" ? (
                  <MessageCircle className="h-16 w-16 mx-auto text-blue-500" />
                ) : (
                  <Flame className="h-16 w-16 mx-auto text-rose-500" />
                )}
              </motion.div>
              <div className="text-lg font-medium">
                Revealing your {currentPrompt.type}...
              </div>
              <div className="flex justify-center gap-2">
                <Badge className={getDifficultyColor(currentPrompt.difficulty)}>
                  {currentPrompt.difficulty}
                </Badge>
                <Badge variant="outline">+{currentPrompt.points} pts</Badge>
              </div>
            </motion.div>
          )}

          {gamePhase === "responding" && currentPrompt && (
            <motion.div
              key="responding"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex justify-center gap-2">
                <Badge variant={currentPrompt.type === "truth" ? "default" : "destructive"}>
                  {currentPrompt.type.toUpperCase()}
                </Badge>
                <Badge className={getDifficultyColor(currentPrompt.difficulty)}>
                  {(() => {
                    const Icon = getDifficultyIcon(currentPrompt.difficulty);
                    return <Icon className="h-3 w-3 mr-1" />;
                  })()}
                  {currentPrompt.difficulty}
                </Badge>
              </div>
              
              <motion.div 
                className="p-6 rounded-xl bg-muted/50 text-center"
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
              >
                <p className="text-lg font-medium leading-relaxed">{currentPrompt.text}</p>
              </motion.div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Time remaining</span>
                  </div>
                  <span className={`font-bold ${timeLeft <= 10 ? 'text-red-500' : ''}`}>
                    {timeLeft}s
                  </span>
                </div>
                <Progress 
                  value={timerPercentage} 
                  className={`h-2 ${timeLeft <= 10 ? '[&>div]:bg-red-500' : ''}`}
                />
              </div>
              
              <div className="text-center text-sm text-muted-foreground">
                Complete the {currentPrompt.type} to earn <strong>{currentPrompt.points} points</strong>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={handleSkip}
                  data-testid="button-skip"
                >
                  <SkipForward className="h-4 w-4 mr-2" />
                  Skip (-3 pts)
                </Button>
                <Button
                  onClick={handleComplete}
                  data-testid="button-complete"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Completed!
                </Button>
              </div>
            </motion.div>
          )}

          {gamePhase === "ai_turn" && (
            <motion.div
              key="ai_turn"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-4 py-8"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              >
                <Bot className="h-16 w-16 mx-auto text-orange-500" />
              </motion.div>
              <div className="text-lg font-medium">AI is taking their turn...</div>
              
              {roundResult && (
                <motion.div 
                  className={`p-3 rounded-lg inline-flex items-center gap-2 ${
                    roundResult.completed ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'
                  }`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                >
                  {roundResult.completed ? (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
                      <span>You earned +{roundResult.points} pts</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5" />
                      <span>{roundResult.skipped ? "Skipped" : "Time up"}: {roundResult.points} pts</span>
                    </>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}

          {gamePhase === "round_result" && (
            <motion.div
              key="round_result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="text-center">
                <h3 className="text-xl font-bold mb-1">Round {currentRound} Complete!</h3>
                <p className="text-muted-foreground">See how you both did</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <motion.div 
                  className={`p-4 rounded-lg ${
                    roundResult?.completed ? 'bg-green-500/10' : 'bg-red-500/10'
                  }`}
                  initial={{ x: -30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-5 w-5 text-blue-500" />
                    <span className="font-medium">You</span>
                  </div>
                  <div className="text-center">
                    {roundResult?.completed ? (
                      <CheckCircle2 className="h-8 w-8 mx-auto text-green-500 mb-1" />
                    ) : (
                      <XCircle className="h-8 w-8 mx-auto text-red-500 mb-1" />
                    )}
                    <div className={`font-bold text-lg ${
                      roundResult?.completed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {roundResult?.completed ? `+${roundResult.points}` : roundResult?.points}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {selectedChoice === "truth" ? "Truth" : "Dare"}
                    </div>
                  </div>
                </motion.div>
                
                <motion.div 
                  className={`p-4 rounded-lg ${
                    aiRoundResult?.completed ? 'bg-green-500/10' : 'bg-red-500/10'
                  }`}
                  initial={{ x: 30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Bot className="h-5 w-5 text-orange-500" />
                    <span className="font-medium">AI</span>
                  </div>
                  <div className="text-center">
                    {aiRoundResult?.completed ? (
                      <CheckCircle2 className="h-8 w-8 mx-auto text-green-500 mb-1" />
                    ) : (
                      <XCircle className="h-8 w-8 mx-auto text-red-500 mb-1" />
                    )}
                    <div className={`font-bold text-lg ${
                      aiRoundResult?.completed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {aiRoundResult?.completed ? `+${aiRoundResult.points}` : '0'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {aiRoundResult?.choice === "truth" ? "Truth" : "Dare"}
                    </div>
                  </div>
                </motion.div>
              </div>
              
              <motion.div 
                className="flex items-center justify-center gap-4 p-3 bg-muted/50 rounded-lg"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">Your Score</div>
                  <div className="text-2xl font-bold text-blue-500">{playerScore}</div>
                </div>
                <div className="text-2xl text-muted-foreground">vs</div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">AI Score</div>
                  <div className="text-2xl font-bold text-orange-500">{aiScore}</div>
                </div>
              </motion.div>
              
              <Button 
                onClick={nextRound} 
                className="w-full" 
                size="lg"
                data-testid="button-next-round"
              >
                {currentRound >= TOTAL_ROUNDS ? (
                  <>
                    <Trophy className="h-5 w-5 mr-2" />
                    See Final Results
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5 mr-2" />
                    Next Round
                  </>
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
