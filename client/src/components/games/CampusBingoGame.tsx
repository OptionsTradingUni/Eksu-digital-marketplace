import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Clock, 
  Trophy, 
  Bot, 
  User, 
  RotateCcw, 
  Grid3X3,
  Sparkles,
  Play,
  Star,
  Crown,
  Target,
  ArrowLeft,
  Volume2,
  CheckCircle2,
  Megaphone,
  GraduationCap,
  BookOpen,
  Library,
  School
} from "lucide-react";

interface CampusBingoGameProps {
  stake: number;
  onGameEnd: (won: boolean, score?: number) => void;
  isPractice: boolean;
}

type GamePhase = "ready" | "playing" | "claiming" | "finished";

type WinPattern = "line" | "two_lines" | "full_house" | "campus_L" | "campus_X" | null;

interface BingoCell {
  number: number;
  marked: boolean;
  isFreeSpace: boolean;
  column: "B" | "I" | "N" | "G" | "O";
}

type BingoCard = BingoCell[][];

interface PatternInfo {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  points: number;
  description: string;
}

const PATTERNS: Record<string, PatternInfo> = {
  line: { name: "Line", icon: Target, points: 50, description: "Any horizontal, vertical, or diagonal line" },
  two_lines: { name: "Two Lines", icon: Star, points: 100, description: "Two complete lines" },
  full_house: { name: "Full House", icon: Crown, points: 200, description: "All numbers marked" },
  campus_L: { name: "Library L", icon: Library, points: 75, description: "L-shaped pattern for Library lovers" },
  campus_X: { name: "Exam X", icon: BookOpen, points: 75, description: "X-shaped pattern for exam season" },
};

const BINGO_COLUMNS: ("B" | "I" | "N" | "G" | "O")[] = ["B", "I", "N", "G", "O"];

const CALL_INTERVAL = 3000;

const CAMPUS_ANNOUNCEMENTS = [
  "The Library is calling this number!",
  "Lecture hall vibes!",
  "Hostel energy!",
  "Cafeteria special!",
  "Sports complex alert!",
  "Campus gate number!",
  "Admin block calling!",
  "Faculty of winners!",
  "Student union shout!",
  "Exam hall pressure!",
];

const SOUND_EFFECTS = {
  call: "Bingo ball drops with a satisfying click!",
  mark: "Pop! Number marked on your card",
  bingo: "BINGO! Victory bells ring across campus!",
  aiMark: "AI opponent marks their card...",
  countdown: "Tick... tick... next number coming!",
};

const generateBingoCard = (): BingoCard => {
  const card: BingoCard = [];
  const usedNumbers: Set<number> = new Set();
  
  for (let row = 0; row < 5; row++) {
    const cardRow: BingoCell[] = [];
    for (let col = 0; col < 5; col++) {
      const minNum = col * 15 + 1;
      const maxNum = col * 15 + 15;
      
      if (row === 2 && col === 2) {
        cardRow.push({
          number: 0,
          marked: true,
          isFreeSpace: true,
          column: BINGO_COLUMNS[col],
        });
      } else {
        let num: number;
        do {
          num = Math.floor(Math.random() * 15) + minNum;
        } while (usedNumbers.has(num));
        usedNumbers.add(num);
        
        cardRow.push({
          number: num,
          marked: false,
          isFreeSpace: false,
          column: BINGO_COLUMNS[col],
        });
      }
    }
    card.push(cardRow);
  }
  
  return card;
};

const generateCallableNumbers = (): number[] => {
  const numbers: number[] = [];
  for (let i = 1; i <= 75; i++) {
    numbers.push(i);
  }
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }
  return numbers;
};

const getColumnLetter = (num: number): "B" | "I" | "N" | "G" | "O" => {
  if (num <= 15) return "B";
  if (num <= 30) return "I";
  if (num <= 45) return "N";
  if (num <= 60) return "G";
  return "O";
};

const checkLine = (card: BingoCard): boolean => {
  for (let row = 0; row < 5; row++) {
    if (card[row].every(cell => cell.marked)) return true;
  }
  
  for (let col = 0; col < 5; col++) {
    if (card.every(row => row[col].marked)) return true;
  }
  
  if (card[0][0].marked && card[1][1].marked && card[2][2].marked && card[3][3].marked && card[4][4].marked) {
    return true;
  }
  if (card[0][4].marked && card[1][3].marked && card[2][2].marked && card[3][1].marked && card[4][0].marked) {
    return true;
  }
  
  return false;
};

const countLines = (card: BingoCard): number => {
  let count = 0;
  
  for (let row = 0; row < 5; row++) {
    if (card[row].every(cell => cell.marked)) count++;
  }
  
  for (let col = 0; col < 5; col++) {
    if (card.every(row => row[col].marked)) count++;
  }
  
  if (card[0][0].marked && card[1][1].marked && card[2][2].marked && card[3][3].marked && card[4][4].marked) {
    count++;
  }
  if (card[0][4].marked && card[1][3].marked && card[2][2].marked && card[3][1].marked && card[4][0].marked) {
    count++;
  }
  
  return count;
};

const checkFullHouse = (card: BingoCard): boolean => {
  return card.every(row => row.every(cell => cell.marked));
};

const checkCampusL = (card: BingoCard): boolean => {
  const lPattern = [
    [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
    [4, 1], [4, 2], [4, 3], [4, 4]
  ];
  return lPattern.every(([row, col]) => card[row][col].marked);
};

const checkCampusX = (card: BingoCard): boolean => {
  const xPattern = [
    [0, 0], [1, 1], [2, 2], [3, 3], [4, 4],
    [0, 4], [1, 3], [3, 1], [4, 0]
  ];
  return xPattern.every(([row, col]) => card[row][col].marked);
};

const detectWinPattern = (card: BingoCard): WinPattern => {
  if (checkFullHouse(card)) return "full_house";
  if (countLines(card) >= 2) return "two_lines";
  if (checkCampusX(card)) return "campus_X";
  if (checkCampusL(card)) return "campus_L";
  if (checkLine(card)) return "line";
  return null;
};

const getColumnColor = (column: "B" | "I" | "N" | "G" | "O"): string => {
  switch (column) {
    case "B": return "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30";
    case "I": return "bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30";
    case "N": return "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30";
    case "G": return "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30";
    case "O": return "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30";
  }
};

export default function CampusBingoGame({ stake, onGameEnd, isPractice }: CampusBingoGameProps) {
  const [gamePhase, setGamePhase] = useState<GamePhase>("ready");
  const [playerCard, setPlayerCard] = useState<BingoCard>([]);
  const [aiCard, setAiCard] = useState<BingoCard>([]);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [callableNumbers, setCallableNumbers] = useState<number[]>([]);
  const [nextCallIn, setNextCallIn] = useState(3);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [playerWinPattern, setPlayerWinPattern] = useState<WinPattern>(null);
  const [aiWinPattern, setAiWinPattern] = useState<WinPattern>(null);
  const [winner, setWinner] = useState<"player" | "ai" | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [soundEffect, setSoundEffect] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);

  const callIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (callIntervalRef.current) clearInterval(callIntervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const startGame = useCallback(() => {
    const newPlayerCard = generateBingoCard();
    const newAiCard = generateBingoCard();
    const numbers = generateCallableNumbers();
    
    setPlayerCard(newPlayerCard);
    setAiCard(newAiCard);
    setCallableNumbers(numbers);
    setCalledNumbers([]);
    setCurrentNumber(null);
    setPlayerScore(0);
    setAiScore(0);
    setPlayerWinPattern(null);
    setAiWinPattern(null);
    setWinner(null);
    setNextCallIn(3);
    setGamePhase("playing");
    setAnnouncement("Get ready! First number coming...");
    setSoundEffect(SOUND_EFFECTS.countdown);
  }, []);

  useEffect(() => {
    if (gamePhase !== "playing" || winner) return;

    countdownRef.current = setInterval(() => {
      setNextCallIn(prev => {
        if (prev <= 1) {
          return 3;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [gamePhase, winner]);

  useEffect(() => {
    if (gamePhase !== "playing" || winner) return;

    callIntervalRef.current = setInterval(() => {
      setCallableNumbers(prev => {
        if (prev.length === 0) return prev;
        
        const [nextNum, ...rest] = prev;
        
        setCurrentNumber(nextNum);
        setCalledNumbers(called => [...called, nextNum]);
        setIsAnimating(true);
        
        const letter = getColumnLetter(nextNum);
        setAnnouncement(`${letter}-${nextNum}! ${CAMPUS_ANNOUNCEMENTS[Math.floor(Math.random() * CAMPUS_ANNOUNCEMENTS.length)]}`);
        setSoundEffect(SOUND_EFFECTS.call);
        
        setTimeout(() => setIsAnimating(false), 500);
        
        setAiCard(prevCard => {
          const newCard = prevCard.map(row => 
            row.map(cell => {
              if (cell.number === nextNum && !cell.marked) {
                setSoundEffect(SOUND_EFFECTS.aiMark);
                return { ...cell, marked: true };
              }
              return cell;
            })
          );
          
          const aiPattern = detectWinPattern(newCard);
          if (aiPattern && !aiWinPattern) {
            setAiWinPattern(aiPattern);
            setAiScore(PATTERNS[aiPattern].points);
          }
          
          return newCard;
        });
        
        return rest;
      });
    }, CALL_INTERVAL);

    return () => {
      if (callIntervalRef.current) clearInterval(callIntervalRef.current);
    };
  }, [gamePhase, winner, aiWinPattern]);

  const markNumber = useCallback((row: number, col: number) => {
    if (gamePhase !== "playing" || winner) return;
    
    const cell = playerCard[row][col];
    if (cell.isFreeSpace || cell.marked) return;
    
    if (!calledNumbers.includes(cell.number)) {
      setAnnouncement("That number hasn't been called yet!");
      return;
    }
    
    setSoundEffect(SOUND_EFFECTS.mark);
    
    setPlayerCard(prevCard => {
      const newCard = prevCard.map((r, ri) => 
        r.map((c, ci) => {
          if (ri === row && ci === col) {
            return { ...c, marked: true };
          }
          return c;
        })
      );
      
      const pattern = detectWinPattern(newCard);
      if (pattern) {
        setPlayerWinPattern(pattern);
        setPlayerScore(PATTERNS[pattern].points);
      }
      
      return newCard;
    });
  }, [gamePhase, winner, playerCard, calledNumbers]);

  const claimBingo = useCallback(() => {
    if (!playerWinPattern) {
      setAnnouncement("You don't have a winning pattern yet!");
      return;
    }
    
    setGamePhase("claiming");
    setSoundEffect(SOUND_EFFECTS.bingo);
    
    if (callIntervalRef.current) clearInterval(callIntervalRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    
    const playerPoints = PATTERNS[playerWinPattern].points;
    const aiPoints = aiWinPattern ? PATTERNS[aiWinPattern].points : 0;
    
    if (playerPoints >= aiPoints) {
      setWinner("player");
      setAnnouncement(`BINGO! You won with ${PATTERNS[playerWinPattern].name}!`);
    } else {
      setWinner("ai");
      setAnnouncement(`AI already had ${PATTERNS[aiWinPattern!].name}! You still get points though.`);
    }
    
    setTimeout(() => {
      setGamePhase("finished");
      const won = playerPoints >= aiPoints;
      onGameEnd(won, playerPoints);
    }, 2000);
  }, [playerWinPattern, aiWinPattern, onGameEnd]);

  useEffect(() => {
    if (aiWinPattern && !playerWinPattern && gamePhase === "playing") {
      setTimeout(() => {
        if (callIntervalRef.current) clearInterval(callIntervalRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
        
        setWinner("ai");
        setAnnouncement(`AI got ${PATTERNS[aiWinPattern].name}! Better luck next time!`);
        setGamePhase("finished");
        onGameEnd(false, playerScore);
      }, 1500);
    }
  }, [aiWinPattern, playerWinPattern, gamePhase, onGameEnd, playerScore]);

  const resetGame = useCallback(() => {
    if (callIntervalRef.current) clearInterval(callIntervalRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setGamePhase("ready");
    setPlayerCard([]);
    setAiCard([]);
    setCalledNumbers([]);
    setCurrentNumber(null);
    setCallableNumbers([]);
    setPlayerScore(0);
    setAiScore(0);
    setPlayerWinPattern(null);
    setAiWinPattern(null);
    setWinner(null);
    setNextCallIn(3);
    setAnnouncement("");
    setSoundEffect("");
  }, []);

  if (gamePhase === "ready") {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            <Grid3X3 className="h-16 w-16 mx-auto text-green-500 mb-4" />
          </motion.div>
          <CardTitle className="text-2xl">Campus Bingo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              Mark numbers on your 5x5 card as they're called. First to complete a pattern wins!
            </p>
            <p className="text-sm text-muted-foreground">
              Numbers called every 3 seconds. Beat the AI to shout BINGO!
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(PATTERNS).map(([key, pattern]) => {
              const Icon = pattern.icon;
              return (
                <div key={key} className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Icon className="h-4 w-4" />
                    <span className="font-semibold">{pattern.name}</span>
                  </div>
                  <div className="text-lg font-bold text-green-600 dark:text-green-400">{pattern.points} pts</div>
                  <div className="text-xs text-muted-foreground">{pattern.description}</div>
                </div>
              );
            })}
          </div>
          
          <div className="flex flex-col gap-3">
            {!isPractice && stake > 0 && (
              <div className="text-center p-3 rounded-lg bg-amber-500/10">
                <div className="text-sm text-muted-foreground">Stake Amount</div>
                <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
                  {stake.toLocaleString()} NGN
                </div>
              </div>
            )}
            
            <Button 
              size="lg" 
              onClick={startGame}
              className="w-full"
              data-testid="button-start-bingo"
            >
              <Play className="h-5 w-5 mr-2" />
              {isPractice ? "Start Practice Game" : "Start Game"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-lg flex items-center gap-2">
              <Grid3X3 className="h-5 w-5 text-green-500" />
              Campus Bingo
            </CardTitle>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-blue-500" />
                <span className="font-semibold">{playerScore}</span>
              </div>
              <span className="text-muted-foreground">vs</span>
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-red-500" />
                <span className="font-semibold">{aiScore}</span>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">{announcement || "Get ready..."}</span>
            </div>
            {gamePhase === "playing" && !winner && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="text-sm">Next: {nextCallIn}s</span>
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            {currentNumber && (
              <motion.div
                key={currentNumber}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, opacity: 0 }}
                className="flex justify-center"
              >
                <div className={`w-20 h-20 rounded-full flex flex-col items-center justify-center shadow-lg ${getColumnColor(getColumnLetter(currentNumber))}`}>
                  <span className="text-xs font-bold">{getColumnLetter(currentNumber)}</span>
                  <span className="text-2xl font-bold">{currentNumber}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-center">
            <div className="inline-block">
              <div className="grid grid-cols-5 gap-1 mb-2">
                {BINGO_COLUMNS.map(letter => (
                  <div 
                    key={letter}
                    className={`w-12 h-10 sm:w-14 sm:h-12 flex items-center justify-center font-bold text-lg rounded-t-md ${getColumnColor(letter)}`}
                  >
                    {letter}
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-5 gap-1">
                {playerCard.map((row, rowIndex) => (
                  row.map((cell, colIndex) => (
                    <motion.button
                      key={`${rowIndex}-${colIndex}`}
                      whileHover={!cell.marked && !cell.isFreeSpace ? { scale: 1.05 } : {}}
                      whileTap={!cell.marked && !cell.isFreeSpace ? { scale: 0.95 } : {}}
                      onClick={() => markNumber(rowIndex, colIndex)}
                      disabled={cell.marked || cell.isFreeSpace || gamePhase !== "playing"}
                      className={`
                        w-12 h-12 sm:w-14 sm:h-14 
                        rounded-md border-2 
                        flex items-center justify-center 
                        font-bold text-lg
                        transition-all duration-200
                        ${cell.isFreeSpace 
                          ? "bg-gradient-to-br from-green-500 to-emerald-600 text-white border-green-400" 
                          : cell.marked
                            ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white border-blue-400 shadow-md"
                            : calledNumbers.includes(cell.number)
                              ? `${getColumnColor(cell.column)} border-current cursor-pointer`
                              : "bg-card border-border"
                        }
                      `}
                      data-testid={`bingo-cell-${rowIndex}-${colIndex}`}
                    >
                      {cell.isFreeSpace ? (
                        <div className="text-center">
                          <GraduationCap className="h-5 w-5 mx-auto" />
                          <span className="text-[10px]">FREE</span>
                        </div>
                      ) : cell.marked ? (
                        <CheckCircle2 className="h-6 w-6" />
                      ) : (
                        cell.number
                      )}
                    </motion.button>
                  ))
                ))}
              </div>
            </div>
          </div>

          {playerWinPattern && gamePhase === "playing" && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex justify-center"
            >
              <Button 
                size="lg"
                onClick={claimBingo}
                className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8"
                data-testid="button-claim-bingo"
              >
                <Sparkles className="h-5 w-5 mr-2" />
                BINGO! Claim {PATTERNS[playerWinPattern].name} ({PATTERNS[playerWinPattern].points} pts)
              </Button>
            </motion.div>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Volume2 className="h-4 w-4" />
              <span className="italic">{soundEffect}</span>
            </div>
            
            <div className="space-y-1">
              <div className="text-sm font-medium">Called Numbers ({calledNumbers.length}/75)</div>
              <ScrollArea className="h-16 rounded-md border p-2">
                <div className="flex flex-wrap gap-1">
                  {calledNumbers.map((num, index) => (
                    <Badge 
                      key={index}
                      variant="secondary"
                      className={`text-xs ${getColumnColor(getColumnLetter(num))}`}
                    >
                      {getColumnLetter(num)}-{num}
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </CardContent>
      </Card>

      {gamePhase === "finished" && (
        <Card>
          <CardContent className="pt-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-4"
            >
              {winner === "player" ? (
                <>
                  <Trophy className="h-16 w-16 mx-auto text-yellow-500" />
                  <h3 className="text-2xl font-bold">BINGO! You Won!</h3>
                  <p className="text-muted-foreground">
                    {playerWinPattern && `${PATTERNS[playerWinPattern].name} - ${PATTERNS[playerWinPattern].points} points!`}
                  </p>
                </>
              ) : (
                <>
                  <Bot className="h-16 w-16 mx-auto text-red-500" />
                  <h3 className="text-2xl font-bold">AI Wins!</h3>
                  <p className="text-muted-foreground">
                    {aiWinPattern && `AI got ${PATTERNS[aiWinPattern].name} first!`}
                  </p>
                </>
              )}
              
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="text-center p-3 rounded-lg bg-blue-500/10">
                  <User className="h-5 w-5 mx-auto text-blue-500 mb-1" />
                  <div className="text-lg font-bold">{playerScore} pts</div>
                  <div className="text-xs text-muted-foreground">Your Score</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-red-500/10">
                  <Bot className="h-5 w-5 mx-auto text-red-500 mb-1" />
                  <div className="text-lg font-bold">{aiScore} pts</div>
                  <div className="text-xs text-muted-foreground">AI Score</div>
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
            </motion.div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
