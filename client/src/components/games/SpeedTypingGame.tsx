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
  Keyboard, 
  Zap,
  Target,
  Star,
  Crown,
  Sparkles,
  Play,
  ChevronRight,
  Award,
  Timer
} from "lucide-react";

interface SpeedTypingGameProps {
  stake: number;
  onGameEnd: (won: boolean, score?: number) => void;
  isPractice: boolean;
}

interface Passage {
  id: number;
  category: string;
  text: string;
  difficulty: "easy" | "medium" | "hard";
}

const PASSAGES: Passage[] = [
  {
    id: 1,
    category: "University Life",
    text: "The campus library is always full during exam period. Students gather to read and prepare for their tests. Success requires dedication and hard work.",
    difficulty: "easy"
  },
  {
    id: 2,
    category: "University Life",
    text: "Hostel life at EKSU teaches you how to survive and thrive with limited resources. You learn to manage your time, money, and relationships all at once.",
    difficulty: "medium"
  },
  {
    id: 3,
    category: "University Life",
    text: "The Student Union Government election season brings excitement to campus. Candidates campaign with posters, rallies, and promises of better welfare for students.",
    difficulty: "medium"
  },
  {
    id: 4,
    category: "University Life",
    text: "Carrying over a course is never the end of the world. Many successful graduates once struggled with some subjects before finding their footing and excelling in their studies.",
    difficulty: "medium"
  },
  {
    id: 5,
    category: "University Life",
    text: "Registration week is always chaotic. Long queues at the bursary, rushing to pay school fees, and the scramble to complete course registration before the deadline closes.",
    difficulty: "hard"
  },
  {
    id: 6,
    category: "Nigerian Culture",
    text: "Jollof rice remains the king of Nigerian parties. No owambe is complete without a generous serving of this beloved one-pot rice dish.",
    difficulty: "easy"
  },
  {
    id: 7,
    category: "Nigerian Culture",
    text: "The Yoruba people celebrate the Eyo festival in Lagos with colorful masquerades dancing through the streets. It is a spectacular display of culture and tradition.",
    difficulty: "medium"
  },
  {
    id: 8,
    category: "Nigerian Culture",
    text: "Aso-ebi at Nigerian weddings has become a beautiful tradition. Friends and family coordinate their attire to show unity and support for the couple getting married.",
    difficulty: "medium"
  },
  {
    id: 9,
    category: "Nigerian Culture",
    text: "From Afrobeats to Highlife, Nigerian music has conquered the world stage. Artists like Burna Boy, Wizkid, and Davido have put our sounds on the global map.",
    difficulty: "medium"
  },
  {
    id: 10,
    category: "Nigerian Culture",
    text: "The New Yam Festival celebrated by the Igbo people marks the end of harvest season. It is a time of thanksgiving, feasting, and cultural performances that unite communities together.",
    difficulty: "hard"
  },
  {
    id: 11,
    category: "Tech & Coding",
    text: "Learning to code opens doors to endless opportunities. Start with the basics and build your skills one project at a time.",
    difficulty: "easy"
  },
  {
    id: 12,
    category: "Tech & Coding",
    text: "JavaScript is the language of the web. With it, you can build websites, mobile apps, and even server-side applications using Node.js.",
    difficulty: "medium"
  },
  {
    id: 13,
    category: "Tech & Coding",
    text: "Debugging is an essential skill for every programmer. When your code breaks, stay calm, read the error message, and trace your logic step by step until you find the bug.",
    difficulty: "medium"
  },
  {
    id: 14,
    category: "Tech & Coding",
    text: "The Nigerian tech ecosystem is growing rapidly. Startups like Paystack, Flutterwave, and Andela have shown that world-class technology companies can emerge from Africa.",
    difficulty: "hard"
  },
  {
    id: 15,
    category: "Tech & Coding",
    text: "Version control with Git helps developers collaborate effectively. Commit your changes often, write clear messages, and always pull the latest code before pushing your updates to the repository.",
    difficulty: "hard"
  },
  {
    id: 16,
    category: "Motivational",
    text: "Success is not final, failure is not fatal. It is the courage to continue that counts. Keep pushing forward every day.",
    difficulty: "easy"
  },
  {
    id: 17,
    category: "Motivational",
    text: "Your dreams are valid no matter where you come from. Hard work and persistence can take you places you never imagined possible.",
    difficulty: "easy"
  },
  {
    id: 18,
    category: "Motivational",
    text: "The road to success is paved with setbacks and challenges. Embrace them as opportunities to learn and grow stronger. Winners never quit and quitters never win.",
    difficulty: "medium"
  },
  {
    id: 19,
    category: "Motivational",
    text: "Education is the passport to the future. Invest in yourself, read widely, and never stop learning. The knowledge you gain today will shape your tomorrow.",
    difficulty: "medium"
  },
  {
    id: 20,
    category: "Motivational",
    text: "Great achievements require great sacrifice. Stay focused on your goals, work diligently, and maintain a positive attitude even when progress seems slow. Your breakthrough is coming.",
    difficulty: "hard"
  },
  {
    id: 21,
    category: "University Life",
    text: "Group projects teach valuable teamwork skills. Coordinating schedules, dividing tasks, and presenting together builds bonds that last beyond graduation.",
    difficulty: "medium"
  },
  {
    id: 22,
    category: "Nigerian Culture",
    text: "Palm wine is a traditional beverage tapped from palm trees. It is enjoyed at ceremonies and gatherings, connecting us to our roots and ancestors.",
    difficulty: "easy"
  },
  {
    id: 23,
    category: "Tech & Coding",
    text: "APIs allow different software systems to communicate with each other. Understanding how to work with APIs is crucial for building modern web applications.",
    difficulty: "medium"
  },
  {
    id: 24,
    category: "Motivational",
    text: "The future belongs to those who believe in the beauty of their dreams. Take action today and build the life you envision for yourself.",
    difficulty: "easy"
  },
  {
    id: 25,
    category: "University Life",
    text: "The cafeteria serves as a social hub on campus. Between lectures, students gather to share meals, discuss assignments, and catch up on the latest campus gossip and news.",
    difficulty: "hard"
  },
  {
    id: 26,
    category: "Nigerian Culture",
    text: "Nollywood is the second largest film industry in the world by volume. Nigerian movies tell our stories and have captivated audiences across Africa and beyond.",
    difficulty: "medium"
  },
  {
    id: 27,
    category: "Tech & Coding",
    text: "Clean code is readable, maintainable, and efficient. Write code as if the next person to read it will be you six months from now.",
    difficulty: "easy"
  },
  {
    id: 28,
    category: "Motivational",
    text: "Every expert was once a beginner. Do not be afraid to start from scratch. The journey of a thousand miles begins with a single step.",
    difficulty: "easy"
  },
  {
    id: 29,
    category: "University Life",
    text: "Convocation day is the culmination of years of hard work and sacrifice. Wearing your academic gown and receiving your certificate is a moment of immense pride for graduates and their families.",
    difficulty: "hard"
  },
  {
    id: 30,
    category: "Nigerian Culture",
    text: "Suya is a beloved Nigerian street food made from grilled meat skewers seasoned with spicy pepper mix. The aroma of suya grilling in the evening attracts hungry customers from far and wide.",
    difficulty: "hard"
  }
];

const getCategoryColor = (category: string) => {
  switch (category) {
    case "University Life": return "bg-purple-500/20 text-purple-600 dark:text-purple-400";
    case "Nigerian Culture": return "bg-green-500/20 text-green-600 dark:text-green-400";
    case "Tech & Coding": return "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400";
    case "Motivational": return "bg-amber-500/20 text-amber-600 dark:text-amber-400";
    default: return "bg-muted";
  }
};

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case "easy": return "bg-green-500/20 text-green-600 dark:text-green-400";
    case "medium": return "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400";
    case "hard": return "bg-red-500/20 text-red-600 dark:text-red-400";
    default: return "bg-muted";
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

const getRandomPassage = (): Passage => {
  const shuffled = shuffleArray(PASSAGES);
  return shuffled[0];
};

const calculateWPM = (correctChars: number, timeElapsed: number): number => {
  if (timeElapsed <= 0) return 0;
  const wordsTyped = correctChars / 5;
  const minutesElapsed = timeElapsed / 60;
  return Math.round(wordsTyped / minutesElapsed);
};

const calculateAccuracy = (correctChars: number, totalTyped: number): number => {
  if (totalTyped === 0) return 100;
  return Math.round((correctChars / totalTyped) * 100);
};

const generateAIPerformance = (passage: Passage): { wpm: number; accuracy: number } => {
  const baseWPM = {
    easy: 65,
    medium: 55,
    hard: 45
  };
  
  const baseAccuracy = {
    easy: 96,
    medium: 94,
    hard: 91
  };
  
  const wpmVariation = Math.floor(Math.random() * 20) - 10;
  const accuracyVariation = Math.floor(Math.random() * 4) - 2;
  
  return {
    wpm: baseWPM[passage.difficulty] + wpmVariation,
    accuracy: Math.min(99, Math.max(85, baseAccuracy[passage.difficulty] + accuracyVariation))
  };
};

const calculateScore = (wpm: number, accuracy: number): number => {
  return Math.round((wpm * (accuracy / 100)) * 2);
};

export default function SpeedTypingGame({ stake, onGameEnd, isPractice }: SpeedTypingGameProps) {
  const [passage, setPassage] = useState<Passage | null>(null);
  const [typedText, setTypedText] = useState("");
  const [timeLeft, setTimeLeft] = useState(60);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [gamePhase, setGamePhase] = useState<"ready" | "playing" | "finished">("ready");
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [correctChars, setCorrectChars] = useState(0);
  const [incorrectChars, setIncorrectChars] = useState(0);
  const [aiPerformance, setAIPerformance] = useState<{ wpm: number; accuracy: number } | null>(null);
  const [showCursor, setShowCursor] = useState(true);
  const [completed, setCompleted] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 530);
    return () => clearInterval(cursorInterval);
  }, []);

  useEffect(() => {
    const newPassage = getRandomPassage();
    setPassage(newPassage);
    setAIPerformance(generateAIPerformance(newPassage));
  }, []);

  useEffect(() => {
    if (gamePhase !== "playing" || timeLeft <= 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setGamePhase("finished");
          return 0;
        }
        return prev - 1;
      });
      setTimeElapsed((prev) => prev + 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [gamePhase, timeLeft]);

  useEffect(() => {
    if (gamePhase === "playing" && timeElapsed > 0) {
      const newWpm = calculateWPM(correctChars, timeElapsed);
      setWpm(newWpm);
    }
  }, [correctChars, timeElapsed, gamePhase]);

  useEffect(() => {
    if (gamePhase === "finished" && aiPerformance) {
      const playerScore = calculateScore(wpm, accuracy);
      const aiScore = calculateScore(aiPerformance.wpm, aiPerformance.accuracy);
      const won = playerScore > aiScore;
      onGameEnd(won, playerScore);
    }
  }, [gamePhase, wpm, accuracy, aiPerformance, onGameEnd]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (gamePhase !== "playing" || !passage) return;
    
    const newTypedText = e.target.value;
    const passageText = passage.text;
    
    let newCorrectChars = 0;
    let newIncorrectChars = 0;
    
    for (let i = 0; i < newTypedText.length; i++) {
      if (i < passageText.length) {
        if (newTypedText[i] === passageText[i]) {
          newCorrectChars++;
        } else {
          newIncorrectChars++;
        }
      }
    }
    
    setTypedText(newTypedText);
    setCorrectChars(newCorrectChars);
    setIncorrectChars(newIncorrectChars);
    
    const totalTyped = newTypedText.length;
    const newAccuracy = calculateAccuracy(newCorrectChars, totalTyped);
    setAccuracy(newAccuracy);
    
    if (newTypedText.length >= passageText.length && newCorrectChars === passageText.length) {
      setCompleted(true);
      setGamePhase("finished");
    }
  }, [gamePhase, passage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (gamePhase === "ready") {
      setGamePhase("playing");
      inputRef.current?.focus();
    }
  }, [gamePhase]);

  const handleContainerClick = useCallback(() => {
    if (gamePhase === "ready") {
      setGamePhase("playing");
    }
    inputRef.current?.focus();
  }, [gamePhase]);

  const startGame = useCallback(() => {
    setGamePhase("playing");
    inputRef.current?.focus();
  }, []);

  const resetGame = useCallback(() => {
    const newPassage = getRandomPassage();
    setPassage(newPassage);
    setAIPerformance(generateAIPerformance(newPassage));
    setTypedText("");
    setTimeLeft(60);
    setTimeElapsed(0);
    setGamePhase("ready");
    setWpm(0);
    setAccuracy(100);
    setCorrectChars(0);
    setIncorrectChars(0);
    setCompleted(false);
  }, []);

  const renderPassageText = () => {
    if (!passage) return null;
    
    const passageText = passage.text;
    const chars: JSX.Element[] = [];
    
    for (let i = 0; i < passageText.length; i++) {
      let className = "text-muted-foreground";
      
      if (i < typedText.length) {
        if (typedText[i] === passageText[i]) {
          className = "text-green-600 dark:text-green-400";
        } else {
          className = "text-red-600 dark:text-red-400 bg-red-500/20";
        }
      }
      
      const showCursorHere = i === typedText.length && showCursor && gamePhase === "playing";
      
      chars.push(
        <span key={i} className={`relative ${className}`}>
          {showCursorHere && (
            <span className="absolute left-0 top-0 h-full w-0.5 bg-primary animate-pulse" />
          )}
          {passageText[i]}
        </span>
      );
    }
    
    if (typedText.length === passageText.length && showCursor && gamePhase === "playing") {
      chars.push(
        <span key="cursor-end" className="relative">
          <span className="absolute left-0 top-0 h-full w-0.5 bg-primary animate-pulse" />
        </span>
      );
    }
    
    return chars;
  };

  const playerScore = calculateScore(wpm, accuracy);
  const aiScore = aiPerformance ? calculateScore(aiPerformance.wpm, aiPerformance.accuracy) : 0;
  const winner = playerScore > aiScore ? "player" : playerScore < aiScore ? "ai" : "tie";

  if (!passage || !aiPerformance) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Keyboard className="h-8 w-8 text-primary" />
            </motion.div>
            <p className="text-muted-foreground">Preparing your passage...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (gamePhase === "ready") {
    return (
      <div className="w-full max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl flex items-center gap-2">
              <Keyboard className="h-6 w-6 text-primary" />
              Speed Typing Challenge
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-4"
            >
              <div className="relative mx-auto w-24 h-24 mb-4">
                <motion.div
                  animate={{ 
                    scale: [1, 1.1, 1],
                  }}
                  transition={{ 
                    duration: 1.5, 
                    repeat: Infinity,
                    repeatType: "reverse"
                  }}
                  className="w-full h-full rounded-full bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-500 flex items-center justify-center shadow-lg"
                >
                  <Keyboard className="h-12 w-12 text-white" />
                </motion.div>
                <motion.div
                  animate={{ 
                    scale: [1, 1.3, 1],
                    opacity: [0.5, 1, 0.5]
                  }}
                  transition={{ 
                    duration: 1.5, 
                    repeat: Infinity 
                  }}
                  className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center"
                >
                  <Zap className="h-4 w-4 text-yellow-800" />
                </motion.div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold">Test Your Typing Speed</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Type the passage as fast and accurately as you can in 60 seconds!
                </p>
              </div>
            </motion.div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <Badge className={getCategoryColor(passage.category)}>
                  {passage.category}
                </Badge>
                <Badge className={getDifficultyColor(passage.difficulty)}>
                  {passage.difficulty.charAt(0).toUpperCase() + passage.difficulty.slice(1)}
                </Badge>
              </div>

              <div className="p-4 bg-muted/50 rounded-md">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">Preview: </span>
                  {passage.text.substring(0, 100)}...
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-md">
                  <Timer className="h-4 w-4 text-primary" />
                  <span>60 seconds</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-md">
                  <Target className="h-4 w-4 text-primary" />
                  <span>{passage.text.split(' ').length} words</span>
                </div>
              </div>

              {!isPractice && (
                <div className="flex items-center justify-between gap-4 p-3 bg-primary/10 rounded-md">
                  <span className="text-sm font-medium">Stake Amount</span>
                  <Badge variant="secondary">{stake.toLocaleString()} NGN</Badge>
                </div>
              )}
            </div>

            <Button 
              onClick={startGame} 
              className="w-full" 
              size="lg"
              data-testid="button-start-typing"
            >
              <Play className="h-5 w-5 mr-2" />
              Start Typing
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (gamePhase === "finished") {
    return (
      <div className="w-full max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl flex items-center gap-2">
              <Trophy className="h-6 w-6 text-yellow-500" />
              Game Complete!
              {completed && <Badge className="ml-2 bg-green-500/20 text-green-600">Passage Completed</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center"
            >
              {winner === "player" ? (
                <div className="space-y-2">
                  <motion.div
                    animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                    transition={{ duration: 0.5 }}
                  >
                    <Crown className="h-16 w-16 mx-auto text-yellow-500" />
                  </motion.div>
                  <h3 className="text-2xl font-bold text-green-600 dark:text-green-400">You Won!</h3>
                  <p className="text-muted-foreground">
                    {isPractice 
                      ? "Great typing skills! You beat the AI."
                      : `You earned ${Math.round(stake * 1.9).toLocaleString()} NGN!`
                    }
                  </p>
                </div>
              ) : winner === "ai" ? (
                <div className="space-y-2">
                  <Bot className="h-16 w-16 mx-auto text-muted-foreground" />
                  <h3 className="text-2xl font-bold text-red-600 dark:text-red-400">AI Wins</h3>
                  <p className="text-muted-foreground">
                    {isPractice 
                      ? "Keep practicing! The AI was faster this time."
                      : `You lost ${stake.toLocaleString()} NGN. Better luck next time!`
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Star className="h-16 w-16 mx-auto text-yellow-500" />
                  <h3 className="text-2xl font-bold">It's a Tie!</h3>
                  <p className="text-muted-foreground">
                    {isPractice 
                      ? "Impressive! You matched the AI exactly."
                      : "Your stake has been returned."}
                  </p>
                </div>
              )}
            </motion.div>

            <div className="grid grid-cols-2 gap-4">
              <Card className="border-2 border-primary/20">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    <span className="font-semibold">You</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="p-2 bg-muted/50 rounded-md">
                      <p className="text-muted-foreground text-xs">WPM</p>
                      <p className="font-bold text-lg">{wpm}</p>
                    </div>
                    <div className="p-2 bg-muted/50 rounded-md">
                      <p className="text-muted-foreground text-xs">Accuracy</p>
                      <p className="font-bold text-lg">{accuracy}%</p>
                    </div>
                  </div>
                  <div className="text-center pt-2 border-t">
                    <p className="text-xs text-muted-foreground">Score</p>
                    <p className="text-2xl font-bold text-primary">{playerScore}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-muted">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-muted-foreground" />
                    <span className="font-semibold">AI</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="p-2 bg-muted/50 rounded-md">
                      <p className="text-muted-foreground text-xs">WPM</p>
                      <p className="font-bold text-lg">{aiPerformance.wpm}</p>
                    </div>
                    <div className="p-2 bg-muted/50 rounded-md">
                      <p className="text-muted-foreground text-xs">Accuracy</p>
                      <p className="font-bold text-lg">{aiPerformance.accuracy}%</p>
                    </div>
                  </div>
                  <div className="text-center pt-2 border-t">
                    <p className="text-xs text-muted-foreground">Score</p>
                    <p className="text-2xl font-bold">{aiScore}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-md">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Time Used</p>
                  <p className="font-medium">{timeElapsed}s</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-md">
                <Award className="h-4 w-4 text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-xs text-muted-foreground">Correct</p>
                  <p className="font-medium text-green-600 dark:text-green-400">{correctChars}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-red-500/10 rounded-md">
                <Target className="h-4 w-4 text-red-600 dark:text-red-400" />
                <div>
                  <p className="text-xs text-muted-foreground">Errors</p>
                  <p className="font-medium text-red-600 dark:text-red-400">{incorrectChars}</p>
                </div>
              </div>
            </div>

            <Button 
              onClick={resetGame} 
              className="w-full"
              data-testid="button-play-again"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Play Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
              Speed Typing
              {isPractice ? (
                <Badge variant="outline" className="text-xs">Practice</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  Stake: {stake.toLocaleString()} NGN
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge className={`${timeLeft <= 10 ? 'bg-red-500/20 text-red-600 animate-pulse' : 'bg-primary/20'}`}>
                <Clock className="h-3 w-3 mr-1" />
                {timeLeft}s
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span className="font-bold">{wpm}</span>
              <span className="text-xs text-muted-foreground">WPM</span>
            </div>
            <Progress value={(60 - timeLeft) / 60 * 100} className="flex-1 h-2" />
            <div className="flex items-center gap-2">
              <span className="font-bold">{accuracy}%</span>
              <span className="text-xs text-muted-foreground">Accuracy</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <Badge className={getCategoryColor(passage.category)}>
              {passage.category}
            </Badge>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{typedText.length}/{passage.text.length}</span>
              <span>characters</span>
            </div>
          </div>

          <div 
            ref={containerRef}
            onClick={handleContainerClick}
            className="relative p-4 bg-muted/30 rounded-md cursor-text min-h-[120px] border-2 border-dashed border-primary/30 focus-within:border-primary transition-colors"
          >
            <p className="text-lg leading-relaxed font-mono whitespace-pre-wrap break-words">
              {renderPassageText()}
            </p>
            <input
              ref={inputRef}
              type="text"
              value={typedText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              className="absolute inset-0 w-full h-full opacity-0 cursor-text"
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-testid="input-typing"
            />
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Keyboard className="h-4 w-4" />
            <span>Click or tap above to start typing</span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="text-center p-3 bg-muted/30 rounded-md">
              <Zap className="h-4 w-4 mx-auto mb-1 text-primary" />
              <p className="font-bold">{wpm}</p>
              <p className="text-xs text-muted-foreground">WPM</p>
            </div>
            <div className="text-center p-3 bg-green-500/10 rounded-md">
              <Target className="h-4 w-4 mx-auto mb-1 text-green-600 dark:text-green-400" />
              <p className="font-bold text-green-600 dark:text-green-400">{correctChars}</p>
              <p className="text-xs text-muted-foreground">Correct</p>
            </div>
            <div className="text-center p-3 bg-red-500/10 rounded-md">
              <Target className="h-4 w-4 mx-auto mb-1 text-red-600 dark:text-red-400" />
              <p className="font-bold text-red-600 dark:text-red-400">{incorrectChars}</p>
              <p className="text-xs text-muted-foreground">Errors</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
