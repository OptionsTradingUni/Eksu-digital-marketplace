import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, Trophy, Bot, User, Check, X, RotateCcw, HelpCircle, Sparkles } from "lucide-react";

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

const getRandomQuestions = (count: number): Question[] => {
  const shuffled = shuffleArray(QUESTIONS);
  return shuffled.slice(0, count);
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
  const [gamePhase, setGamePhase] = useState<"playing" | "results">("playing");
  const [playerAnswers, setPlayerAnswers] = useState<(number | null)[]>([]);
  const [aiAnswers, setAIAnswers] = useState<number[]>([]);

  useEffect(() => {
    const gameQuestions = getRandomQuestions(10);
    setQuestions(gameQuestions);
    
    const aiAnswersList = gameQuestions.map((q) => {
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
    
    setAIAnswers(aiAnswersList);
  }, []);

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
    
    if (answerIndex === currentQuestion.correctAnswer) {
      const points = currentQuestion.difficulty === "easy" ? 10 : currentQuestion.difficulty === "medium" ? 15 : 20;
      setPlayerScore((prev) => prev + points);
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
    const gameQuestions = getRandomQuestions(10);
    setQuestions(gameQuestions);
    
    const aiAnswersList = gameQuestions.map((q) => {
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
    
    setAIAnswers(aiAnswersList);
    setCurrentQuestionIndex(0);
    setPlayerScore(0);
    setAIScore(0);
    setTimeLeft(15);
    setSelectedAnswer(null);
    setAIAnswer(null);
    setShowResult(false);
    setGamePhase("playing");
    setPlayerAnswers([]);
  };

  if (questions.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-pulse">Loading questions...</div>
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

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Trivia
              {!isPractice && (
                <Badge variant="secondary" className="text-xs">
                  Stake: {stake} NGN
                </Badge>
              )}
              {isPractice && (
                <Badge variant="outline" className="text-xs">
                  Practice
                </Badge>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {gamePhase === "playing" && (
            <>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <span className="font-bold">{playerScore}</span>
                  <span className="text-xs text-muted-foreground">pts</span>
                </div>
                <div className="flex-1 text-center">
                  <span className="text-sm text-muted-foreground">
                    Question {currentQuestionIndex + 1} / {questions.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">pts</span>
                  <span className="font-bold">{aiScore}</span>
                  <Bot className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              <Progress value={((currentQuestionIndex) / questions.length) * 100} className="h-2" />

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Badge className={getCategoryColor(currentQuestion.category)}>
                    {currentQuestion.category}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <Badge className={getDifficultyColor(currentQuestion.difficulty)}>
                      {currentQuestion.difficulty}
                    </Badge>
                    <Badge variant={timeLeft <= 5 ? "destructive" : "secondary"}>
                      <Clock className="h-3 w-3 mr-1" />
                      {timeLeft}s
                    </Badge>
                  </div>
                </div>

                <motion.div
                  key={currentQuestionIndex}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-muted/30 rounded-md"
                >
                  <p className="font-medium text-center">{currentQuestion.question}</p>
                </motion.div>

                <div className="grid gap-2">
                  {currentQuestion.options.map((option, index) => {
                    let buttonStyle = "";
                    
                    if (showResult) {
                      if (index === currentQuestion.correctAnswer) {
                        buttonStyle = "bg-green-500/20 border-green-500 text-green-700 dark:text-green-300";
                      } else if (index === selectedAnswer && index !== currentQuestion.correctAnswer) {
                        buttonStyle = "bg-red-500/20 border-red-500 text-red-700 dark:text-red-300";
                      }
                    }
                    
                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Button
                          variant="outline"
                          className={`w-full justify-start text-left h-auto py-3 px-4 ${buttonStyle} ${
                            selectedAnswer === index && !showResult ? "ring-2 ring-primary" : ""
                          }`}
                          onClick={() => !showResult && handleAnswer(index)}
                          disabled={showResult}
                          data-testid={`answer-${index}`}
                        >
                          <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold mr-3">
                            {String.fromCharCode(65 + index)}
                          </span>
                          <span className="flex-1">{option}</span>
                          {showResult && index === currentQuestion.correctAnswer && (
                            <Check className="h-5 w-5 text-green-500" />
                          )}
                          {showResult && index === selectedAnswer && index !== currentQuestion.correctAnswer && (
                            <X className="h-5 w-5 text-red-500" />
                          )}
                        </Button>
                      </motion.div>
                    );
                  })}
                </div>

                {showResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-md text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {selectedAnswer === currentQuestion.correctAnswer ? (
                        <span className="text-green-600 dark:text-green-400">Correct!</span>
                      ) : selectedAnswer === null ? (
                        <span className="text-muted-foreground">Time's up!</span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400">Wrong!</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {aiAnswer === currentQuestion.correctAnswer ? (
                        <span className="text-green-600 dark:text-green-400">AI got it right</span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400">AI got it wrong</span>
                      )}
                      <Bot className="h-4 w-4" />
                    </div>
                  </motion.div>
                )}
              </div>
            </>
          )}

          {gamePhase === "results" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-6 py-4"
            >
              <div className="flex items-center justify-center gap-3">
                <Trophy className={`h-10 w-10 ${winner === "player" ? "text-yellow-500" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-2xl font-bold">
                    {winner === "player" ? "You Won!" : winner === "tie" ? "It's a Tie!" : "AI Won!"}
                  </p>
                  <p className="text-sm text-muted-foreground">Game Complete</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="p-4 bg-muted/30 rounded-md">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <User className="h-5 w-5 text-primary" />
                    <span className="font-medium">You</span>
                  </div>
                  <p className="text-3xl font-bold">{playerScore}</p>
                  <p className="text-sm text-muted-foreground">
                    {playerAnswers.filter((a, i) => a === questions[i]?.correctAnswer).length}/{questions.length} correct
                  </p>
                </div>
                <div className="p-4 bg-muted/30 rounded-md">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Bot className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">AI</span>
                  </div>
                  <p className="text-3xl font-bold">{aiScore}</p>
                  <p className="text-sm text-muted-foreground">
                    {aiAnswers.filter((a, i) => a === questions[i]?.correctAnswer).length}/{questions.length} correct
                  </p>
                </div>
              </div>

              {!isPractice && (
                <p className="text-sm text-muted-foreground">
                  {winner === "player" 
                    ? `You earned ${(stake * 2 * 0.95).toFixed(0)} NGN!` 
                    : winner === "tie"
                    ? "Stakes returned."
                    : `You lost ${stake} NGN.`}
                </p>
              )}

              <Button onClick={resetGame} variant="outline" className="gap-2" data-testid="button-play-again">
                <RotateCcw className="h-4 w-4" />
                Play Again
              </Button>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
