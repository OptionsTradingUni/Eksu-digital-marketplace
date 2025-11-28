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
  Volume2,
  CheckCircle2,
  Megaphone,
  GraduationCap,
  Zap,
  CornerDownRight
} from "lucide-react";

interface CampusBingoGameProps {
  stake: number;
  onGameEnd: (won: boolean, score?: number) => void;
  isPractice: boolean;
}

type GamePhase = "ready" | "playing" | "claiming" | "finished";

type WinPattern = "line" | "four_corners" | "full_house" | null;

interface BingoCell {
  phrase: string;
  marked: boolean;
  isFreeSpace: boolean;
}

type BingoCard = BingoCell[][];

interface PatternInfo {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  multiplier: number;
  description: string;
}

const PATTERNS: Record<string, PatternInfo> = {
  line: { name: "Line", icon: Target, multiplier: 0.20, description: "Any horizontal, vertical, or diagonal line" },
  four_corners: { name: "Four Corners", icon: CornerDownRight, multiplier: 0.30, description: "All four corner cells marked" },
  full_house: { name: "Full House", icon: Crown, multiplier: 0.50, description: "All cells marked" },
};

const CAMPUS_PHRASES: string[] = [
  "Lecturer no come",
  "NEPA take light",
  "Sign out",
  "No water in hostel",
  "Carry over",
  "Project defense",
  "Clear course",
  "Sorority party",
  "Night class",
  "No data on phone",
  "Broke before month end",
  "SUG election",
  "School fees deadline",
  "Crush sat beside me",
  "Extra credit assignment",
  "Last minute studying",
  "Cafe food spoil",
  "Roommate wahala",
  "Generator don spoil",
  "TDB on result",
  "Surprise test",
  "Extension on deadline",
  "Departmental party",
  "Hostel allocation stress",
  "Course registration closed",
  "Library full",
  "Porter catch you",
  "VC speech too long",
  "Convocation postponed",
  "Textbook too expensive",
  "Group project drama",
  "Lab practical cancelled",
  "Exam hall too hot",
  "Result delayed",
  "Power bank die",
  "Wifi down again",
  "Class cancelled last minute",
  "Sign my clearance form",
  "Missed attendance",
  "Course clash",
  "Retake semester",
  "Dean's list achievement",
  "All-night reading",
  "Transport fare increase",
  "Handout not ready",
  "Lecturer ask question",
  "Phone confiscated",
  "Hostel inspection",
  "ID card expired",
  "Burst pipe in hostel",
];

const CALL_INTERVAL = 4000;

const CAMPUS_ANNOUNCEMENTS = [
  "The Registrar announces:",
  "Hostel living experience:",
  "Campus survival moment:",
  "Academic wahala:",
  "Student life reality:",
  "Nigerian university vibes:",
  "Campus chronicle:",
  "Hall of residence news:",
  "Faculty announcement:",
  "Student union broadcast:",
];

const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const generateBingoCard = (): BingoCard => {
  const shuffledPhrases = shuffleArray([...CAMPUS_PHRASES]);
  const card: BingoCard = [];
  let phraseIndex = 0;
  
  for (let row = 0; row < 5; row++) {
    const cardRow: BingoCell[] = [];
    for (let col = 0; col < 5; col++) {
      if (row === 2 && col === 2) {
        cardRow.push({
          phrase: "FREE SPACE",
          marked: true,
          isFreeSpace: true,
        });
      } else {
        cardRow.push({
          phrase: shuffledPhrases[phraseIndex++],
          marked: false,
          isFreeSpace: false,
        });
      }
    }
    card.push(cardRow);
  }
  
  return card;
};

const generateCallableList = (): string[] => {
  return shuffleArray([...CAMPUS_PHRASES]);
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

const checkFourCorners = (card: BingoCard): boolean => {
  return card[0][0].marked && card[0][4].marked && card[4][0].marked && card[4][4].marked;
};

const checkFullHouse = (card: BingoCard): boolean => {
  return card.every(row => row.every(cell => cell.marked));
};

const detectWinPattern = (card: BingoCard): WinPattern => {
  if (checkFullHouse(card)) return "full_house";
  if (checkFourCorners(card)) return "four_corners";
  if (checkLine(card)) return "line";
  return null;
};

const calculatePoints = (pattern: WinPattern, stake: number, isPractice: boolean): number => {
  if (!pattern) return 0;
  if (isPractice) {
    return Math.round(PATTERNS[pattern].multiplier * 100);
  }
  return Math.round(stake * PATTERNS[pattern].multiplier);
};

const getPatternColor = (pattern: WinPattern): string => {
  switch (pattern) {
    case "line": return "bg-blue-500/20 text-blue-600 dark:text-blue-400";
    case "four_corners": return "bg-amber-500/20 text-amber-600 dark:text-amber-400";
    case "full_house": return "bg-green-500/20 text-green-600 dark:text-green-400";
    default: return "bg-muted";
  }
};

export default function CampusBingoGame({ stake, onGameEnd, isPractice }: CampusBingoGameProps) {
  const [gamePhase, setGamePhase] = useState<GamePhase>("ready");
  const [playerCard, setPlayerCard] = useState<BingoCard>([]);
  const [aiCard, setAiCard] = useState<BingoCard>([]);
  const [calledPhrases, setCalledPhrases] = useState<string[]>([]);
  const [currentPhrase, setCurrentPhrase] = useState<string | null>(null);
  const [callableList, setCallableList] = useState<string[]>([]);
  const [nextCallIn, setNextCallIn] = useState(4);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [playerWinPattern, setPlayerWinPattern] = useState<WinPattern>(null);
  const [aiWinPattern, setAiWinPattern] = useState<WinPattern>(null);
  const [winner, setWinner] = useState<"player" | "ai" | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);
  const [missedPhrases, setMissedPhrases] = useState<string[]>([]);

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
    const phrases = generateCallableList();
    
    setPlayerCard(newPlayerCard);
    setAiCard(newAiCard);
    setCallableList(phrases);
    setCalledPhrases([]);
    setCurrentPhrase(null);
    setPlayerScore(0);
    setAiScore(0);
    setPlayerWinPattern(null);
    setAiWinPattern(null);
    setWinner(null);
    setNextCallIn(4);
    setMissedPhrases([]);
    setGamePhase("playing");
    setAnnouncement("Get ready! First phrase coming...");
  }, []);

  useEffect(() => {
    if (gamePhase !== "playing" || winner) return;

    countdownRef.current = setInterval(() => {
      setNextCallIn(prev => {
        if (prev <= 1) {
          return 4;
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
      setCallableList(prev => {
        if (prev.length === 0) return prev;
        
        const [nextPhrase, ...rest] = prev;
        
        setCurrentPhrase(nextPhrase);
        setCalledPhrases(called => [...called, nextPhrase]);
        setIsAnimating(true);
        
        const randomAnnouncement = CAMPUS_ANNOUNCEMENTS[Math.floor(Math.random() * CAMPUS_ANNOUNCEMENTS.length)];
        setAnnouncement(`${randomAnnouncement} "${nextPhrase}"`);
        
        setTimeout(() => setIsAnimating(false), 500);
        
        setAiCard(prevCard => {
          const newCard = prevCard.map(row => 
            row.map(cell => {
              if (cell.phrase === nextPhrase && !cell.marked) {
                return { ...cell, marked: true };
              }
              return cell;
            })
          );
          
          const aiPattern = detectWinPattern(newCard);
          if (aiPattern && !aiWinPattern) {
            setAiWinPattern(aiPattern);
            setAiScore(calculatePoints(aiPattern, stake, isPractice));
          }
          
          return newCard;
        });
        
        return rest;
      });
    }, CALL_INTERVAL);

    return () => {
      if (callIntervalRef.current) clearInterval(callIntervalRef.current);
    };
  }, [gamePhase, winner, aiWinPattern, stake, isPractice]);

  const markPhrase = useCallback((row: number, col: number) => {
    if (gamePhase !== "playing" || winner) return;
    
    const cell = playerCard[row][col];
    if (cell.isFreeSpace || cell.marked) return;
    
    if (!calledPhrases.includes(cell.phrase)) {
      setAnnouncement(`"${cell.phrase}" hasn't been called yet!`);
      return;
    }
    
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
        setPlayerScore(calculatePoints(pattern, stake, isPractice));
      }
      
      return newCard;
    });
  }, [gamePhase, winner, playerCard, calledPhrases, stake, isPractice]);

  const claimBingo = useCallback(() => {
    if (!playerWinPattern) {
      setAnnouncement("You don't have a winning pattern yet!");
      return;
    }
    
    setGamePhase("claiming");
    
    if (callIntervalRef.current) clearInterval(callIntervalRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    
    const playerPoints = calculatePoints(playerWinPattern, stake, isPractice);
    const aiPoints = aiWinPattern ? calculatePoints(aiWinPattern, stake, isPractice) : 0;
    
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
  }, [playerWinPattern, aiWinPattern, stake, isPractice, onGameEnd]);

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

  useEffect(() => {
    if (gamePhase === "playing" && currentPhrase) {
      const playerHasPhrase = playerCard.some(row => 
        row.some(cell => cell.phrase === currentPhrase && !cell.marked && !cell.isFreeSpace)
      );
      
      if (playerHasPhrase) {
        const timer = setTimeout(() => {
          const stillUnmarked = playerCard.some(row => 
            row.some(cell => cell.phrase === currentPhrase && !cell.marked && !cell.isFreeSpace)
          );
          if (stillUnmarked) {
            setMissedPhrases(prev => [...prev, currentPhrase]);
          }
        }, CALL_INTERVAL - 500);
        
        return () => clearTimeout(timer);
      }
    }
  }, [currentPhrase, playerCard, gamePhase]);

  const resetGame = useCallback(() => {
    if (callIntervalRef.current) clearInterval(callIntervalRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setGamePhase("ready");
    setPlayerCard([]);
    setAiCard([]);
    setCalledPhrases([]);
    setCurrentPhrase(null);
    setCallableList([]);
    setPlayerScore(0);
    setAiScore(0);
    setPlayerWinPattern(null);
    setAiWinPattern(null);
    setWinner(null);
    setNextCallIn(4);
    setAnnouncement("");
    setMissedPhrases([]);
  }, []);

  const getUnmarkedCalledPhrases = useCallback(() => {
    return calledPhrases.filter(phrase => 
      playerCard.some(row => 
        row.some(cell => cell.phrase === phrase && !cell.marked && !cell.isFreeSpace)
      )
    );
  }, [calledPhrases, playerCard]);

  if (gamePhase === "ready") {
    return (
      <Card className="max-w-2xl mx-auto" data-testid="bingo-ready-screen">
        <CardHeader className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            <GraduationCap className="h-16 w-16 mx-auto text-green-500 mb-4" />
          </motion.div>
          <CardTitle className="text-2xl">Campus Bingo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              Mark Nigerian campus life experiences as they're called. First to complete a pattern wins!
            </p>
            <p className="text-sm text-muted-foreground">
              Phrases called every 4 seconds. Beat the AI to shout BINGO!
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Object.entries(PATTERNS).map(([key, pattern]) => {
              const Icon = pattern.icon;
              const points = isPractice ? Math.round(pattern.multiplier * 100) : Math.round(stake * pattern.multiplier);
              return (
                <div key={key} className={`text-center p-3 rounded-lg ${getPatternColor(key as WinPattern)}`}>
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Icon className="h-4 w-4" />
                    <span className="font-semibold text-sm">{pattern.name}</span>
                  </div>
                  <div className="text-lg font-bold">
                    {isPractice ? `${points} pts` : `${points.toLocaleString()} NGN`}
                  </div>
                  <div className="text-xs text-muted-foreground">{Math.round(pattern.multiplier * 100)}% of stake</div>
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

  const unmarkedCalledPhrases = getUnmarkedCalledPhrases();

  return (
    <div className="max-w-4xl mx-auto space-y-4" data-testid="bingo-game-screen">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-lg flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-green-500" />
              Campus Bingo
            </CardTitle>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-blue-500" />
                <span className="font-semibold" data-testid="player-score">{playerScore}</span>
              </div>
              <span className="text-muted-foreground">vs</span>
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-red-500" />
                <span className="font-semibold" data-testid="ai-score">{aiScore}</span>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Megaphone className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <span className="text-sm font-medium truncate" data-testid="announcement">{announcement || "Get ready..."}</span>
            </div>
            {gamePhase === "playing" && !winner && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <Clock className="h-4 w-4" />
                <span className="text-sm" data-testid="next-call-timer">Next: {nextCallIn}s</span>
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            {currentPhrase && (
              <motion.div
                key={currentPhrase}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="flex justify-center"
              >
                <div className="px-6 py-4 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg text-center">
                  <Zap className="h-5 w-5 mx-auto mb-1" />
                  <span className="text-lg font-bold" data-testid="current-phrase">{currentPhrase}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {unmarkedCalledPhrases.length > 0 && (
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 mb-1">
                <Volume2 className="h-3 w-3" />
                <span>On your card (not marked yet):</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {unmarkedCalledPhrases.slice(-5).map((phrase, index) => (
                  <Badge 
                    key={index}
                    variant="secondary"
                    className="text-xs bg-amber-500/20"
                  >
                    {phrase}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-center overflow-x-auto pb-2">
            <div className="inline-block min-w-fit">
              <div className="grid grid-cols-5 gap-1">
                {playerCard.map((row, rowIndex) => (
                  row.map((cell, colIndex) => {
                    const isCallable = !cell.marked && !cell.isFreeSpace && calledPhrases.includes(cell.phrase);
                    return (
                      <motion.button
                        key={`${rowIndex}-${colIndex}`}
                        whileHover={isCallable ? { scale: 1.02 } : {}}
                        whileTap={isCallable ? { scale: 0.98 } : {}}
                        onClick={() => markPhrase(rowIndex, colIndex)}
                        disabled={cell.marked || cell.isFreeSpace || gamePhase !== "playing"}
                        className={`
                          w-16 h-16 sm:w-20 sm:h-20 
                          rounded-md border-2 
                          flex items-center justify-center 
                          p-1 text-center
                          transition-all duration-200
                          ${cell.isFreeSpace 
                            ? "bg-gradient-to-br from-green-500 to-emerald-600 text-white border-green-400" 
                            : cell.marked
                              ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white border-blue-400 shadow-md"
                              : isCallable
                                ? "bg-amber-500/20 border-amber-500 cursor-pointer ring-2 ring-amber-500/50"
                                : "bg-card border-border"
                          }
                        `}
                        data-testid={`bingo-cell-${rowIndex}-${colIndex}`}
                      >
                        {cell.isFreeSpace ? (
                          <div className="text-center">
                            <GraduationCap className="h-5 w-5 mx-auto" />
                            <span className="text-[8px] font-bold">FREE</span>
                          </div>
                        ) : cell.marked ? (
                          <CheckCircle2 className="h-6 w-6" />
                        ) : (
                          <span className="text-[9px] sm:text-[10px] font-medium leading-tight">
                            {cell.phrase}
                          </span>
                        )}
                      </motion.button>
                    );
                  })
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
                BINGO! Claim {PATTERNS[playerWinPattern].name}
              </Button>
            </motion.div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Called Phrases</span>
              <span className="font-medium">{calledPhrases.length}/{CAMPUS_PHRASES.length}</span>
            </div>
            <Progress value={(calledPhrases.length / CAMPUS_PHRASES.length) * 100} className="h-2" />
            
            <ScrollArea className="h-20 rounded-md border p-2">
              <div className="flex flex-wrap gap-1">
                {calledPhrases.map((phrase, index) => (
                  <Badge 
                    key={index}
                    variant="secondary"
                    className="text-xs"
                    data-testid={`called-phrase-${index}`}
                  >
                    {phrase}
                  </Badge>
                ))}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      {gamePhase === "finished" && (
        <Card data-testid="bingo-result-screen">
          <CardContent className="pt-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-4"
            >
              {winner === "player" ? (
                <>
                  <Trophy className="h-16 w-16 mx-auto text-yellow-500" />
                  <h3 className="text-2xl font-bold" data-testid="result-title">BINGO! You Won!</h3>
                  <p className="text-muted-foreground" data-testid="result-pattern">
                    {playerWinPattern && `${PATTERNS[playerWinPattern].name} - ${isPractice ? `${playerScore} points` : `${playerScore.toLocaleString()} NGN`}!`}
                  </p>
                </>
              ) : (
                <>
                  <Bot className="h-16 w-16 mx-auto text-red-500" />
                  <h3 className="text-2xl font-bold" data-testid="result-title">AI Wins!</h3>
                  <p className="text-muted-foreground" data-testid="result-pattern">
                    {aiWinPattern && `AI got ${PATTERNS[aiWinPattern].name} first!`}
                  </p>
                </>
              )}
              
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="text-center p-3 rounded-lg bg-blue-500/10">
                  <User className="h-5 w-5 mx-auto text-blue-500 mb-1" />
                  <div className="text-lg font-bold" data-testid="final-player-score">
                    {isPractice ? `${playerScore} pts` : `${playerScore.toLocaleString()} NGN`}
                  </div>
                  <div className="text-xs text-muted-foreground">Your Winnings</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-red-500/10">
                  <Bot className="h-5 w-5 mx-auto text-red-500 mb-1" />
                  <div className="text-lg font-bold" data-testid="final-ai-score">
                    {isPractice ? `${aiScore} pts` : `${aiScore.toLocaleString()} NGN`}
                  </div>
                  <div className="text-xs text-muted-foreground">AI Winnings</div>
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
