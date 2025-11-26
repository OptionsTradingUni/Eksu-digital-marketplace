import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Clock, 
  Trophy, 
  Bot, 
  User, 
  Check, 
  X, 
  RotateCcw, 
  HelpCircle, 
  Sparkles, 
  Loader2, 
  AlertCircle, 
  Zap,
  Brain,
  BookOpen,
  Gamepad2,
  Music,
  GraduationCap,
  Globe,
  Star,
  Crown,
  Flame,
  Target
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface TriviaGameProps {
  stake: number;
  onGameEnd: (won: boolean, score?: number) => void;
  isPractice: boolean;
}

interface Question {
  id: number;
  category: string;
  question: string;
  options: string[];
  correctAnswer: number;
  difficulty: "easy" | "medium" | "hard";
}

const CATEGORIES = [
  { value: "all", label: "All Categories", icon: Globe },
  { value: "General Knowledge", label: "General Knowledge", icon: BookOpen },
  { value: "Nigerian Culture", label: "Nigerian Culture", icon: Crown },
  { value: "Campus Life", label: "Campus Life", icon: GraduationCap },
  { value: "Sports", label: "Sports", icon: Gamepad2 },
  { value: "Entertainment", label: "Entertainment", icon: Music },
];

const QUESTIONS: Question[] = [
  {
    id: 1,
    category: "General Knowledge",
    question: "What is the capital city of Nigeria?",
    options: ["Lagos", "Abuja", "Kano", "Port Harcourt"],
    correctAnswer: 1,
    difficulty: "easy"
  },
  {
    id: 2,
    category: "Nigerian Culture",
    question: "Which tribe is known for the Eyo Festival?",
    options: ["Igbo", "Hausa", "Yoruba", "Ijaw"],
    correctAnswer: 2,
    difficulty: "easy"
  },
  {
    id: 3,
    category: "Campus Life",
    question: "What does GPA stand for?",
    options: ["Grade Point Average", "General Performance Assessment", "Graduate Program Admission", "Group Project Assignment"],
    correctAnswer: 0,
    difficulty: "easy"
  },
  {
    id: 4,
    category: "Sports",
    question: "Which Nigerian footballer won the African Footballer of the Year award in 1996?",
    options: ["Jay-Jay Okocha", "Kanu Nwankwo", "Rashidi Yekini", "Finidi George"],
    correctAnswer: 1,
    difficulty: "medium"
  },
  {
    id: 5,
    category: "Entertainment",
    question: "Who is known as the 'African Giant' in Nigerian music?",
    options: ["Davido", "Wizkid", "Burna Boy", "Olamide"],
    correctAnswer: 2,
    difficulty: "easy"
  },
  {
    id: 6,
    category: "General Knowledge",
    question: "How many states are there in Nigeria?",
    options: ["32", "36", "38", "40"],
    correctAnswer: 1,
    difficulty: "easy"
  },
  {
    id: 7,
    category: "Nigerian Culture",
    question: "What is the traditional attire called that is worn by Yoruba men?",
    options: ["Babariga", "Agbada", "Kaftan", "Dashiki"],
    correctAnswer: 1,
    difficulty: "medium"
  },
  {
    id: 8,
    category: "Campus Life",
    question: "What is the minimum CGPA typically required for first-class honors in Nigerian universities?",
    options: ["3.0", "3.5", "4.0", "4.5"],
    correctAnswer: 3,
    difficulty: "medium"
  },
  {
    id: 9,
    category: "Sports",
    question: "In what year did Nigeria win the Olympic Gold medal in football?",
    options: ["1992", "1996", "2000", "2008"],
    correctAnswer: 1,
    difficulty: "hard"
  },
  {
    id: 10,
    category: "Entertainment",
    question: "Which Nigerian movie won an Oscar nomination?",
    options: ["Living in Bondage", "The Wedding Party", "Lionheart", "King of Boys"],
    correctAnswer: 2,
    difficulty: "hard"
  },
  {
    id: 11,
    category: "General Knowledge",
    question: "What is Nigeria's currency called?",
    options: ["Dollar", "Pound", "Naira", "Cedi"],
    correctAnswer: 2,
    difficulty: "easy"
  },
  {
    id: 12,
    category: "Nigerian Culture",
    question: "Which Nigerian ethnic group is famous for the Durbar festival?",
    options: ["Yoruba", "Igbo", "Hausa", "Tiv"],
    correctAnswer: 2,
    difficulty: "medium"
  },
  {
    id: 13,
    category: "Campus Life",
    question: "What does JAMB stand for?",
    options: ["Joint Admission and Matriculation Board", "Junior Academic Merit Board", "Joint Assessment and Measurement Board", "Junior Admission and Merit Board"],
    correctAnswer: 0,
    difficulty: "easy"
  },
  {
    id: 14,
    category: "Sports",
    question: "Which Nigerian boxer became the first undisputed heavyweight champion from Africa?",
    options: ["Samuel Peter", "Anthony Joshua", "Francis Ngannou", "David Haye"],
    correctAnswer: 1,
    difficulty: "medium"
  },
  {
    id: 15,
    category: "Entertainment",
    question: "Which year was Nollywood's first movie 'Living in Bondage' released?",
    options: ["1988", "1992", "1996", "2000"],
    correctAnswer: 1,
    difficulty: "hard"
  },
  {
    id: 16,
    category: "General Knowledge",
    question: "Which river is the longest in Nigeria?",
    options: ["Benue River", "Niger River", "Ogun River", "Cross River"],
    correctAnswer: 1,
    difficulty: "medium"
  },
  {
    id: 17,
    category: "Nigerian Culture",
    question: "What is 'Owambe' in Yoruba culture?",
    options: ["A type of food", "A party or celebration", "A traditional dance", "A wedding ceremony"],
    correctAnswer: 1,
    difficulty: "easy"
  },
  {
    id: 18,
    category: "Campus Life",
    question: "What is the typical duration of a bachelor's degree program in Nigeria?",
    options: ["3 years", "4 years", "5 years", "6 years"],
    correctAnswer: 1,
    difficulty: "easy"
  },
  {
    id: 19,
    category: "Sports",
    question: "Which Nigerian club has won the most Nigeria Professional Football League titles?",
    options: ["Enyimba FC", "Kano Pillars", "Rangers International", "Heartland FC"],
    correctAnswer: 0,
    difficulty: "medium"
  },
  {
    id: 20,
    category: "Entertainment",
    question: "Which Nigerian artist released the album 'Made in Lagos'?",
    options: ["Davido", "Wizkid", "Burna Boy", "Tiwa Savage"],
    correctAnswer: 1,
    difficulty: "easy"
  },
  {
    id: 21,
    category: "General Knowledge",
    question: "In what year did Nigeria gain independence?",
    options: ["1957", "1960", "1963", "1966"],
    correctAnswer: 1,
    difficulty: "easy"
  },
  {
    id: 22,
    category: "Nigerian Culture",
    question: "What is the meaning of 'Omo' in Yoruba?",
    options: ["Father", "Mother", "Child", "Elder"],
    correctAnswer: 2,
    difficulty: "easy"
  },
  {
    id: 23,
    category: "Campus Life",
    question: "What is the primary function of the Student Union Government (SUG)?",
    options: ["Collect school fees", "Represent students' interests", "Grade students", "Hire lecturers"],
    correctAnswer: 1,
    difficulty: "easy"
  },
  {
    id: 24,
    category: "Sports",
    question: "Who is the all-time top scorer for the Nigerian national football team?",
    options: ["Rashidi Yekini", "Nwankwo Kanu", "Jay-Jay Okocha", "Vincent Enyeama"],
    correctAnswer: 0,
    difficulty: "medium"
  },
  {
    id: 25,
    category: "Entertainment",
    question: "Which Nigerian comedian is known as 'Mr Macaroni'?",
    options: ["Debo Adedayo", "Bright Okpocha", "Ayo Makun", "Bovi Ugboma"],
    correctAnswer: 0,
    difficulty: "medium"
  },
  {
    id: 26,
    category: "General Knowledge",
    question: "What is the official language of Nigeria?",
    options: ["Yoruba", "Igbo", "Hausa", "English"],
    correctAnswer: 3,
    difficulty: "easy"
  },
  {
    id: 27,
    category: "Nigerian Culture",
    question: "Which festival is celebrated to mark the new yam harvest?",
    options: ["Eyo Festival", "New Yam Festival", "Durbar Festival", "Argungu Festival"],
    correctAnswer: 1,
    difficulty: "easy"
  },
  {
    id: 28,
    category: "Campus Life",
    question: "What is 'carry-over' in Nigerian university slang?",
    options: ["Extra luggage", "A failed course to be repeated", "Transfer to another school", "Graduation ceremony"],
    correctAnswer: 1,
    difficulty: "easy"
  },
  {
    id: 29,
    category: "Sports",
    question: "Which Nigerian athlete won gold in the long jump at the 1996 Olympics?",
    options: ["Chioma Ajunwa", "Mary Onyali", "Blessing Okagbare", "Falilat Ogunkoya"],
    correctAnswer: 0,
    difficulty: "hard"
  },
  {
    id: 30,
    category: "Entertainment",
    question: "What genre of music is Fela Kuti known for pioneering?",
    options: ["Juju", "Highlife", "Afrobeat", "Fuji"],
    correctAnswer: 2,
    difficulty: "medium"
  },
  {
    id: 31,
    category: "General Knowledge",
    question: "Which state is known as the 'Centre of Excellence' in Nigeria?",
    options: ["Abuja", "Lagos", "Rivers", "Kano"],
    correctAnswer: 1,
    difficulty: "medium"
  },
  {
    id: 32,
    category: "Nigerian Culture",
    question: "What is 'Suya' in Nigerian cuisine?",
    options: ["A drink", "Grilled meat skewers", "A soup", "Rice dish"],
    correctAnswer: 1,
    difficulty: "easy"
  },
  {
    id: 33,
    category: "Campus Life",
    question: "What is POST-UTME?",
    options: ["Post-graduation test", "Post-JAMB screening exam", "Teacher evaluation", "Course registration"],
    correctAnswer: 1,
    difficulty: "easy"
  },
  {
    id: 34,
    category: "Sports",
    question: "Which Nigerian Super Eagles coach led the team to win the 2013 AFCON?",
    options: ["Lars Lagerback", "Stephen Keshi", "Samson Siasia", "Gernot Rohr"],
    correctAnswer: 1,
    difficulty: "medium"
  },
  {
    id: 35,
    category: "Entertainment",
    question: "Which Nigerian show features celebrities answering questions while eating spicy wings?",
    options: ["Big Brother Naija", "Hot Ones Nigeria", "Ndani TV", "The Voice Nigeria"],
    correctAnswer: 1,
    difficulty: "hard"
  },
  {
    id: 36,
    category: "General Knowledge",
    question: "What is the largest city in Nigeria by population?",
    options: ["Abuja", "Lagos", "Kano", "Ibadan"],
    correctAnswer: 1,
    difficulty: "easy"
  },
  {
    id: 37,
    category: "Nigerian Culture",
    question: "What is 'Jollof Rice'?",
    options: ["A dessert", "A one-pot rice dish", "A breakfast cereal", "A salad"],
    correctAnswer: 1,
    difficulty: "easy"
  },
  {
    id: 38,
    category: "Campus Life",
    question: "What does 'sorting' mean in Nigerian campus slang?",
    options: ["Organizing books", "Bribing for grades", "Studying hard", "Attending lectures"],
    correctAnswer: 1,
    difficulty: "medium"
  },
  {
    id: 39,
    category: "Sports",
    question: "Which Nigerian tennis player has won WTA titles?",
    options: ["Sada Williams", "Blessing Okagbare", "Marcelina Oko-Ose", "Toyin Abioro"],
    correctAnswer: 2,
    difficulty: "hard"
  },
  {
    id: 40,
    category: "Entertainment",
    question: "Which Nigerian actress starred in 'Half of a Yellow Sun'?",
    options: ["Genevieve Nnaji", "Omotola Jalade", "Funke Akindele", "Mercy Johnson"],
    correctAnswer: 0,
    difficulty: "medium"
  }
];

const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const getRandomQuestions = (count: number, category?: string): Question[] => {
  let filtered = [...QUESTIONS];
  if (category && category !== "all") {
    filtered = QUESTIONS.filter(q => q.category === category);
  }
  const shuffled = shuffleArray(filtered);
  return shuffled.slice(0, Math.min(count, shuffled.length));
};

const generateAIAnswers = (gameQuestions: Question[]): number[] => {
  return gameQuestions.map((q) => {
    const difficultyAccuracy = {
      easy: 0.85,
      medium: 0.65,
      hard: 0.45
    };
    
    const accuracy = difficultyAccuracy[q.difficulty];
    
    if (Math.random() < accuracy) {
      return q.correctAnswer;
    } else {
      const wrongAnswers = [0, 1, 2, 3].filter((i) => i !== q.correctAnswer);
      return wrongAnswers[Math.floor(Math.random() * wrongAnswers.length)];
    }
  });
};

export default function TriviaGame({ stake, onGameEnd, isPractice }: TriviaGameProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAIScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [aiAnswer, setAIAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [gamePhase, setGamePhase] = useState<"setup" | "loading" | "playing" | "results">("setup");
  const [playerAnswers, setPlayerAnswers] = useState<(number | null)[]>([]);
  const [aiAnswers, setAIAnswers] = useState<number[]>([]);
  const [isAIGenerated, setIsAIGenerated] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Generating fresh questions...");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);

  const fetchQuestionsFromAPI = async (category?: string): Promise<Question[] | null> => {
    try {
      setLoadingMessage("Generating fresh AI questions...");
      const body: { category?: string; count?: number } = { count: 10 };
      if (category && category !== "all") {
        body.category = category;
      }
      const response = await apiRequest("POST", "/api/games/generate-trivia-questions", body);
      const data = await response.json();
      
      if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
        return data.questions;
      }
      return null;
    } catch (error) {
      console.error("Failed to fetch AI questions:", error);
      return null;
    }
  };

  const startGame = async () => {
    setGamePhase("loading");
    setLoadingMessage("Generating fresh questions...");
    
    let gameQuestions: Question[] | null = null;
    
    gameQuestions = await fetchQuestionsFromAPI(selectedCategory);
    
    if (gameQuestions && gameQuestions.length >= 5) {
      setIsAIGenerated(true);
      setQuestions(gameQuestions);
    } else {
      setLoadingMessage("Using classic questions...");
      setIsAIGenerated(false);
      gameQuestions = getRandomQuestions(10, selectedCategory !== "all" ? selectedCategory : undefined);
      if (gameQuestions.length < 5) {
        gameQuestions = getRandomQuestions(10);
      }
      setQuestions(gameQuestions);
    }
    
    const aiAnswersList = generateAIAnswers(gameQuestions);
    setAIAnswers(aiAnswersList);
    
    setCurrentQuestionIndex(0);
    setPlayerScore(0);
    setAIScore(0);
    setTimeLeft(15);
    setSelectedAnswer(null);
    setAIAnswer(null);
    setShowResult(false);
    setPlayerAnswers([]);
    setStreak(0);
    setMaxStreak(0);
    
    setGamePhase("playing");
  };

  useEffect(() => {
    if (gamePhase !== "playing" || showResult || questions.length === 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [gamePhase, showResult, currentQuestionIndex, questions.length]);

  const handleTimeout = () => {
    if (selectedAnswer === null) {
      handleAnswer(null);
    }
  };

  const handleAnswer = (answerIndex: number | null) => {
    if (showResult || gamePhase !== "playing") return;
    
    setSelectedAnswer(answerIndex);
    setShowResult(true);
    
    const currentQuestion = questions[currentQuestionIndex];
    const currentAIAnswer = aiAnswers[currentQuestionIndex];
    setAIAnswer(currentAIAnswer);
    
    const isCorrect = answerIndex === currentQuestion.correctAnswer;
    
    if (isCorrect) {
      const points = currentQuestion.difficulty === "easy" ? 10 : currentQuestion.difficulty === "medium" ? 15 : 20;
      const streakBonus = Math.floor(streak / 3) * 5;
      setPlayerScore((prev) => prev + points + streakBonus);
      setStreak(prev => {
        const newStreak = prev + 1;
        if (newStreak > maxStreak) {
          setMaxStreak(newStreak);
        }
        return newStreak;
      });
    } else {
      setStreak(0);
    }
    
    if (currentAIAnswer === currentQuestion.correctAnswer) {
      const points = currentQuestion.difficulty === "easy" ? 10 : currentQuestion.difficulty === "medium" ? 15 : 20;
      setAIScore((prev) => prev + points);
    }
    
    setPlayerAnswers((prev) => [...prev, answerIndex]);
    
    setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex((prev) => prev + 1);
        setSelectedAnswer(null);
        setAIAnswer(null);
        setShowResult(false);
        setTimeLeft(15);
      } else {
        setGamePhase("results");
      }
    }, 2000);
  };

  useEffect(() => {
    if (gamePhase === "results") {
      const playerWon = playerScore > aiScore;
      onGameEnd(playerWon, playerScore);
    }
  }, [gamePhase, playerScore, aiScore, onGameEnd]);

  const resetGame = () => {
    setGamePhase("setup");
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setPlayerScore(0);
    setAIScore(0);
    setTimeLeft(15);
    setSelectedAnswer(null);
    setAIAnswer(null);
    setShowResult(false);
    setPlayerAnswers([]);
    setAIAnswers([]);
    setIsAIGenerated(false);
    setStreak(0);
    setMaxStreak(0);
  };

  const getCategoryIcon = (categoryValue: string) => {
    const cat = CATEGORIES.find(c => c.value === categoryValue);
    return cat?.icon || Globe;
  };

  if (gamePhase === "setup") {
    return (
      <Card className="overflow-visible">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Trivia Challenge
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
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity,
                  repeatType: "reverse"
                }}
                className="w-full h-full rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center shadow-lg"
              >
                <HelpCircle className="h-12 w-12 text-white" />
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
                <Sparkles className="h-4 w-4 text-yellow-800" />
              </motion.div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold">Test Your Knowledge</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Answer 10 questions faster and more accurately than the AI opponent!
              </p>
            </div>
          </motion.div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4" />
                Choose Category
              </label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full" data-testid="select-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <SelectItem key={cat.value} value={cat.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{cat.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between text-sm p-3 bg-muted/50 rounded-md">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-muted-foreground" />
                <span>AI Opponent</span>
              </div>
              <Badge variant="secondary">Smart AI</Badge>
            </div>

            {!isPractice && (
              <div className="flex items-center justify-between text-sm p-3 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-md border border-green-500/20">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span>Stake</span>
                </div>
                <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 border-0">
                  {stake} NGN
                </Badge>
              </div>
            )}

            {isPractice && (
              <div className="flex items-center justify-between text-sm p-3 bg-blue-500/10 rounded-md border border-blue-500/20">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span>Mode</span>
                </div>
                <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-0">
                  Practice
                </Badge>
              </div>
            )}
          </div>

          <Button 
            onClick={startGame} 
            className="w-full gap-2" 
            size="lg"
            data-testid="button-start-trivia"
          >
            <Zap className="h-5 w-5" />
            Start Challenge
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (gamePhase === "loading" || questions.length === 0) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center space-y-6">
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary"
              />
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [1, 0.7, 1]
                }}
                transition={{ duration: 1, repeat: Infinity }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              >
                <Brain className="h-6 w-6 text-primary" />
              </motion.div>
            </div>
            <div className="text-center space-y-2">
              <motion.p 
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="font-medium text-lg"
              >
                {loadingMessage}
              </motion.p>
              <p className="text-sm text-muted-foreground">
                Preparing your trivia challenge...
              </p>
              {selectedCategory !== "all" && (
                <Badge className={getCategoryColor(selectedCategory)}>
                  {CATEGORIES.find(c => c.value === selectedCategory)?.label}
                </Badge>
              )}
            </div>
            <div className="w-full max-w-xs space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4 mx-auto" />
              <div className="space-y-2 mt-4">
                <Skeleton className="h-12 w-full rounded-md" />
                <Skeleton className="h-12 w-full rounded-md" />
                <Skeleton className="h-12 w-full rounded-md" />
                <Skeleton className="h-12 w-full rounded-md" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const winner = playerScore > aiScore ? "player" : playerScore < aiScore ? "ai" : "tie";

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "General Knowledge": return "bg-blue-500/20 text-blue-600 dark:text-blue-400";
      case "Nigerian Culture": return "bg-green-500/20 text-green-600 dark:text-green-400";
      case "Campus Life": return "bg-purple-500/20 text-purple-600 dark:text-purple-400";
      case "Sports": return "bg-orange-500/20 text-orange-600 dark:text-orange-400";
      case "Entertainment": return "bg-pink-500/20 text-pink-600 dark:text-pink-400";
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

  const getDifficultyIcon = (difficulty: string) => {
    switch (difficulty) {
      case "easy": return Star;
      case "medium": return Flame;
      case "hard": return Crown;
      default: return Star;
    }
  };

  const DifficultyIcon = getDifficultyIcon(currentQuestion.difficulty);

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">
      <Card className="overflow-visible">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
              <HelpCircle className="h-5 w-5" />
              Trivia
              {isAIGenerated ? (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                >
                  <Badge className="text-xs bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white border-0 shadow-md">
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI Generated
                  </Badge>
                </motion.div>
              ) : (
                <Badge variant="outline" className="text-xs">
                  <BookOpen className="h-3 w-3 mr-1" />
                  Classic
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {!isPractice && (
                <Badge variant="secondary" className="text-xs">
                  {stake} NGN
                </Badge>
              )}
              {isPractice && (
                <Badge variant="outline" className="text-xs">
                  Practice
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {gamePhase === "playing" && (
            <>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-lg">{playerScore}</span>
                    {streak >= 2 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="ml-1 text-xs text-orange-500"
                      >
                        <Flame className="inline h-3 w-3" />{streak}
                      </motion.span>
                    )}
                  </div>
                </div>
                <div className="flex-1 text-center">
                  <motion.span 
                    key={currentQuestionIndex}
                    initial={{ scale: 1.2, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-sm font-medium"
                  >
                    {currentQuestionIndex + 1} / {questions.length}
                  </motion.span>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="min-w-0">
                    <span className="font-bold text-lg">{aiScore}</span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </div>

              <Progress 
                value={((currentQuestionIndex) / questions.length) * 100} 
                className="h-2"
              />

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Badge className={getCategoryColor(currentQuestion.category)}>
                    {currentQuestion.category}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <Badge className={getDifficultyColor(currentQuestion.difficulty)}>
                      <DifficultyIcon className="h-3 w-3 mr-1" />
                      {currentQuestion.difficulty}
                    </Badge>
                    <motion.div
                      animate={timeLeft <= 5 ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 0.3, repeat: timeLeft <= 5 ? Infinity : 0 }}
                    >
                      <Badge variant={timeLeft <= 5 ? "destructive" : "secondary"}>
                        <Clock className="h-3 w-3 mr-1" />
                        {timeLeft}s
                      </Badge>
                    </motion.div>
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentQuestionIndex}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="p-4 bg-gradient-to-br from-muted/50 to-muted/30 rounded-lg border"
                  >
                    <p className="font-medium text-center text-base leading-relaxed">
                      {currentQuestion.question}
                    </p>
                  </motion.div>
                </AnimatePresence>

                <div className="grid gap-2">
                  {currentQuestion.options.map((option, index) => {
                    let buttonStyle = "";
                    let isCorrect = index === currentQuestion.correctAnswer;
                    let isSelected = index === selectedAnswer;
                    let isWrong = isSelected && !isCorrect;
                    
                    if (showResult) {
                      if (isCorrect) {
                        buttonStyle = "bg-green-500/20 border-green-500 text-green-700 dark:text-green-300 ring-2 ring-green-500/50";
                      } else if (isWrong) {
                        buttonStyle = "bg-red-500/20 border-red-500 text-red-700 dark:text-red-300";
                      }
                    }
                    
                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Button
                          variant="outline"
                          className={`w-full justify-start text-left h-auto py-3 px-4 transition-all duration-200 ${buttonStyle} ${
                            selectedAnswer === index && !showResult ? "ring-2 ring-primary shadow-md" : ""
                          }`}
                          onClick={() => !showResult && handleAnswer(index)}
                          disabled={showResult}
                          data-testid={`answer-${index}`}
                        >
                          <motion.span 
                            animate={showResult && isCorrect ? { scale: [1, 1.2, 1] } : {}}
                            transition={{ duration: 0.3 }}
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mr-3 flex-shrink-0 ${
                              showResult && isCorrect 
                                ? "bg-green-500 text-white" 
                                : showResult && isWrong 
                                ? "bg-red-500 text-white"
                                : "bg-muted"
                            }`}
                          >
                            {showResult && isCorrect ? (
                              <Check className="h-4 w-4" />
                            ) : showResult && isWrong ? (
                              <X className="h-4 w-4" />
                            ) : (
                              String.fromCharCode(65 + index)
                            )}
                          </motion.span>
                          <span className="flex-1">{option}</span>
                        </Button>
                      </motion.div>
                    );
                  })}
                </div>

                <AnimatePresence>
                  {showResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm border"
                    >
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {selectedAnswer === currentQuestion.correctAnswer ? (
                          <motion.span 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="text-green-600 dark:text-green-400 font-medium"
                          >
                            Correct! +{currentQuestion.difficulty === "easy" ? 10 : currentQuestion.difficulty === "medium" ? 15 : 20}
                          </motion.span>
                        ) : selectedAnswer === null ? (
                          <span className="text-muted-foreground">Time's up!</span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400">Wrong!</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {aiAnswer === currentQuestion.correctAnswer ? (
                          <span className="text-green-600 dark:text-green-400 text-xs">AI correct</span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400 text-xs">AI wrong</span>
                        )}
                        <Bot className="h-4 w-4" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}

          {gamePhase === "results" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-6 py-4"
            >
              <motion.div 
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="flex items-center justify-center gap-3"
              >
                <div className={`p-4 rounded-full ${
                  winner === "player" 
                    ? "bg-gradient-to-br from-yellow-400 to-orange-500" 
                    : winner === "tie" 
                    ? "bg-gradient-to-br from-blue-400 to-purple-500"
                    : "bg-muted"
                }`}>
                  <Trophy className={`h-10 w-10 ${
                    winner === "player" || winner === "tie" ? "text-white" : "text-muted-foreground"
                  }`} />
                </div>
              </motion.div>
              
              <div>
                <motion.p 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-2xl font-bold"
                >
                  {winner === "player" ? "Victory!" : winner === "tie" ? "It's a Tie!" : "AI Wins!"}
                </motion.p>
                <p className="text-sm text-muted-foreground mt-1">
                  {isAIGenerated ? "AI-Generated Questions" : "Classic Questions"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <motion.div 
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className={`p-4 rounded-lg ${
                    winner === "player" ? "bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30" : "bg-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <User className="h-5 w-5 text-primary" />
                    <span className="font-medium">You</span>
                    {winner === "player" && <Crown className="h-4 w-4 text-yellow-500" />}
                  </div>
                  <p className="text-3xl font-bold">{playerScore}</p>
                  <p className="text-sm text-muted-foreground">
                    {playerAnswers.filter((a, i) => a === questions[i]?.correctAnswer).length}/{questions.length} correct
                  </p>
                  {maxStreak >= 2 && (
                    <p className="text-xs text-orange-500 mt-1">
                      <Flame className="inline h-3 w-3" /> Best streak: {maxStreak}
                    </p>
                  )}
                </motion.div>
                <motion.div 
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className={`p-4 rounded-lg ${
                    winner === "ai" ? "bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30" : "bg-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Bot className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">AI</span>
                    {winner === "ai" && <Crown className="h-4 w-4 text-yellow-500" />}
                  </div>
                  <p className="text-3xl font-bold">{aiScore}</p>
                  <p className="text-sm text-muted-foreground">
                    {aiAnswers.filter((a, i) => a === questions[i]?.correctAnswer).length}/{questions.length} correct
                  </p>
                </motion.div>
              </div>

              {!isPractice && (
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className={`p-3 rounded-lg ${
                    winner === "player" 
                      ? "bg-green-500/10 border border-green-500/30" 
                      : winner === "tie"
                      ? "bg-blue-500/10 border border-blue-500/30"
                      : "bg-red-500/10 border border-red-500/30"
                  }`}
                >
                  <p className="text-sm font-medium">
                    {winner === "player" 
                      ? `You earned ${Math.floor(stake * 2 * 0.95)} NGN!` 
                      : winner === "tie"
                      ? "Stakes returned to wallet."
                      : `You lost ${stake} NGN.`}
                  </p>
                </motion.div>
              )}

              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <Button onClick={resetGame} variant="outline" className="gap-2" data-testid="button-play-again">
                  <RotateCcw className="h-4 w-4" />
                  Play Again
                </Button>
              </motion.div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
