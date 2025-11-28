import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Dice1, 
  Dice2, 
  Dice3, 
  Dice4, 
  Dice5, 
  Dice6, 
  RotateCcw, 
  Trophy, 
  Bot, 
  User, 
  Play,
  Crown,
  Sparkles,
  Zap,
  Target
} from "lucide-react";

interface DiceDuelGameProps {
  stake: number;
  onGameEnd: (won: boolean, score?: number) => void;
  isPractice: boolean;
}

type GamePhase = "ready" | "rolling" | "result";

type HandRank = 
  | "five_of_a_kind"
  | "four_of_a_kind"
  | "full_house"
  | "straight"
  | "three_of_a_kind"
  | "two_pair"
  | "one_pair"
  | "high_card";

interface HandResult {
  rank: HandRank;
  rankValue: number;
  name: string;
  highDice: number[];
}

const HAND_RANKINGS: Record<HandRank, { value: number; name: string }> = {
  five_of_a_kind: { value: 8, name: "Five of a Kind" },
  four_of_a_kind: { value: 7, name: "Four of a Kind" },
  full_house: { value: 6, name: "Full House" },
  straight: { value: 5, name: "Straight" },
  three_of_a_kind: { value: 4, name: "Three of a Kind" },
  two_pair: { value: 3, name: "Two Pair" },
  one_pair: { value: 2, name: "One Pair" },
  high_card: { value: 1, name: "High Card" },
};

const DiceIcons = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];

const secureRandom = (): number => {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] / 0x100000000;
};

const rollDice = (): number[] => {
  const dice: number[] = [];
  for (let i = 0; i < 5; i++) {
    dice.push(Math.floor(secureRandom() * 6) + 1);
  }
  return dice;
};

const evaluateHand = (dice: number[]): HandResult => {
  const counts: Record<number, number> = {};
  dice.forEach(d => {
    counts[d] = (counts[d] || 0) + 1;
  });
  
  const countValues = Object.values(counts).sort((a, b) => b - a);
  const uniqueValues = Object.keys(counts).map(Number).sort((a, b) => b - a);
  const sortedDice = [...dice].sort((a, b) => b - a);
  
  const isStraight = (vals: number[]): boolean => {
    const sorted = Array.from(new Set(vals)).sort((a, b) => a - b);
    if (sorted.length !== 5) return false;
    return sorted[4] - sorted[0] === 4;
  };
  
  if (countValues[0] === 5) {
    return {
      rank: "five_of_a_kind",
      rankValue: HAND_RANKINGS.five_of_a_kind.value,
      name: HAND_RANKINGS.five_of_a_kind.name,
      highDice: [uniqueValues[0]]
    };
  }
  
  if (countValues[0] === 4) {
    const fourKind = uniqueValues.find(v => counts[v] === 4)!;
    return {
      rank: "four_of_a_kind",
      rankValue: HAND_RANKINGS.four_of_a_kind.value,
      name: HAND_RANKINGS.four_of_a_kind.name,
      highDice: [fourKind]
    };
  }
  
  if (countValues[0] === 3 && countValues[1] === 2) {
    const threeKind = uniqueValues.find(v => counts[v] === 3)!;
    const pair = uniqueValues.find(v => counts[v] === 2)!;
    return {
      rank: "full_house",
      rankValue: HAND_RANKINGS.full_house.value,
      name: HAND_RANKINGS.full_house.name,
      highDice: [threeKind, pair]
    };
  }
  
  if (isStraight(dice)) {
    return {
      rank: "straight",
      rankValue: HAND_RANKINGS.straight.value,
      name: HAND_RANKINGS.straight.name,
      highDice: [Math.max(...dice)]
    };
  }
  
  if (countValues[0] === 3) {
    const threeKind = uniqueValues.find(v => counts[v] === 3)!;
    return {
      rank: "three_of_a_kind",
      rankValue: HAND_RANKINGS.three_of_a_kind.value,
      name: HAND_RANKINGS.three_of_a_kind.name,
      highDice: [threeKind]
    };
  }
  
  if (countValues[0] === 2 && countValues[1] === 2) {
    const pairs = uniqueValues.filter(v => counts[v] === 2).sort((a, b) => b - a);
    return {
      rank: "two_pair",
      rankValue: HAND_RANKINGS.two_pair.value,
      name: HAND_RANKINGS.two_pair.name,
      highDice: pairs
    };
  }
  
  if (countValues[0] === 2) {
    const pairValue = uniqueValues.find(v => counts[v] === 2)!;
    return {
      rank: "one_pair",
      rankValue: HAND_RANKINGS.one_pair.value,
      name: HAND_RANKINGS.one_pair.name,
      highDice: [pairValue]
    };
  }
  
  return {
    rank: "high_card",
    rankValue: HAND_RANKINGS.high_card.value,
    name: HAND_RANKINGS.high_card.name,
    highDice: sortedDice
  };
};

const compareHands = (playerHand: HandResult, aiHand: HandResult): "player" | "ai" | "tie" => {
  if (playerHand.rankValue > aiHand.rankValue) return "player";
  if (playerHand.rankValue < aiHand.rankValue) return "ai";
  
  for (let i = 0; i < Math.min(playerHand.highDice.length, aiHand.highDice.length); i++) {
    if (playerHand.highDice[i] > aiHand.highDice[i]) return "player";
    if (playerHand.highDice[i] < aiHand.highDice[i]) return "ai";
  }
  
  return "tie";
};

const getHandColor = (rank: HandRank): string => {
  switch (rank) {
    case "five_of_a_kind":
      return "bg-purple-500/20 text-purple-600 dark:text-purple-400";
    case "four_of_a_kind":
      return "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400";
    case "full_house":
      return "bg-orange-500/20 text-orange-600 dark:text-orange-400";
    case "straight":
      return "bg-blue-500/20 text-blue-600 dark:text-blue-400";
    case "three_of_a_kind":
      return "bg-green-500/20 text-green-600 dark:text-green-400";
    case "two_pair":
      return "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400";
    case "one_pair":
      return "bg-pink-500/20 text-pink-600 dark:text-pink-400";
    default:
      return "bg-gray-500/20 text-gray-600 dark:text-gray-400";
  }
};

const calculateScore = (hand: HandResult): number => {
  const baseScores: Record<HandRank, number> = {
    five_of_a_kind: 100,
    four_of_a_kind: 80,
    full_house: 70,
    straight: 60,
    three_of_a_kind: 50,
    two_pair: 40,
    one_pair: 30,
    high_card: 20,
  };
  return baseScores[hand.rank];
};

const DiceDisplay = ({ 
  dice, 
  isRolling, 
  label,
  isWinner,
  handResult
}: { 
  dice: number[]; 
  isRolling: boolean;
  label: string;
  isWinner: boolean;
  handResult: HandResult | null;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-lg border-2 ${isWinner ? 'border-yellow-500 bg-yellow-500/10' : 'border-muted bg-muted/30'}`}
    >
      <div className="flex items-center gap-2 mb-3">
        {label === "You" ? (
          <User className="h-5 w-5 text-blue-500" />
        ) : (
          <Bot className="h-5 w-5 text-purple-500" />
        )}
        <span className="font-semibold">{label}</span>
        {isWinner && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            <Crown className="h-5 w-5 text-yellow-500" />
          </motion.div>
        )}
      </div>
      
      <div className="flex items-center justify-center gap-2 mb-3">
        {dice.map((value, index) => {
          const DiceIcon = DiceIcons[value - 1] || Dice1;
          return (
            <motion.div
              key={index}
              animate={isRolling ? { 
                rotate: [0, 90, 180, 270, 360],
                scale: [1, 1.1, 1, 1.1, 1]
              } : { rotate: 0 }}
              transition={{ 
                duration: 0.4, 
                repeat: isRolling ? Infinity : 0,
                delay: index * 0.1
              }}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-lg" />
              <DiceIcon className={`h-10 w-10 ${isWinner ? 'text-yellow-600' : ''} drop-shadow-lg`} />
            </motion.div>
          );
        })}
      </div>
      
      {handResult && !isRolling && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <Badge className={getHandColor(handResult.rank)} data-testid={`badge-hand-${label.toLowerCase().replace(' ', '-')}`}>
            {handResult.name}
          </Badge>
        </motion.div>
      )}
    </motion.div>
  );
};

export default function DiceDuelGame({ stake, onGameEnd, isPractice }: DiceDuelGameProps) {
  const [gamePhase, setGamePhase] = useState<GamePhase>("ready");
  const [playerDice, setPlayerDice] = useState<number[]>([1, 2, 3, 4, 5]);
  const [aiDice, setAiDice] = useState<number[]>([1, 2, 3, 4, 5]);
  const [playerHand, setPlayerHand] = useState<HandResult | null>(null);
  const [aiHand, setAiHand] = useState<HandResult | null>(null);
  const [winner, setWinner] = useState<"player" | "ai" | "tie" | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [message, setMessage] = useState("Roll the dice to duel!");
  
  const rollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resultTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (rollTimeoutRef.current) {
        clearTimeout(rollTimeoutRef.current);
      }
      if (resultTimeoutRef.current) {
        clearTimeout(resultTimeoutRef.current);
      }
    };
  }, []);

  const startGame = useCallback(() => {
    setGamePhase("rolling");
    setIsRolling(true);
    setMessage("Rolling dice...");
    setWinner(null);
    setPlayerHand(null);
    setAiHand(null);
    
    let rollCount = 0;
    const maxRolls = 15;
    
    const animateRoll = () => {
      setPlayerDice(rollDice());
      setAiDice(rollDice());
      rollCount++;
      
      if (rollCount < maxRolls) {
        rollTimeoutRef.current = setTimeout(animateRoll, 100);
      } else {
        const finalPlayerDice = rollDice();
        const finalAiDice = rollDice();
        
        setPlayerDice(finalPlayerDice);
        setAiDice(finalAiDice);
        setIsRolling(false);
        
        const pHand = evaluateHand(finalPlayerDice);
        const aHand = evaluateHand(finalAiDice);
        
        setPlayerHand(pHand);
        setAiHand(aHand);
        
        const result = compareHands(pHand, aHand);
        setWinner(result);
        setGamePhase("result");
        
        if (result === "player") {
          setMessage("You win the duel!");
          const score = calculateScore(pHand);
          onGameEnd(true, score);
        } else if (result === "ai") {
          setMessage("AI wins the duel!");
          onGameEnd(false, 0);
        } else {
          setMessage("It's a tie! Dice are rolled again.");
          resultTimeoutRef.current = setTimeout(() => {
            startGame();
          }, 2000);
        }
      }
    };
    
    animateRoll();
  }, [onGameEnd]);

  const resetGame = useCallback(() => {
    if (rollTimeoutRef.current) {
      clearTimeout(rollTimeoutRef.current);
    }
    if (resultTimeoutRef.current) {
      clearTimeout(resultTimeoutRef.current);
    }
    
    setGamePhase("ready");
    setPlayerDice([1, 2, 3, 4, 5]);
    setAiDice([1, 2, 3, 4, 5]);
    setPlayerHand(null);
    setAiHand(null);
    setWinner(null);
    setIsRolling(false);
    setMessage("Roll the dice to duel!");
  }, []);

  if (gamePhase === "ready") {
    return (
      <div className="w-full max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl flex items-center gap-2">
              <Target className="h-6 w-6 text-primary" />
              Dice Duel
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
                    duration: 1.5, 
                    repeat: Infinity,
                    repeatType: "reverse"
                  }}
                  className="w-full h-full rounded-full bg-gradient-to-br from-red-500 via-orange-500 to-yellow-500 flex items-center justify-center shadow-lg"
                >
                  <Dice6 className="h-12 w-12 text-white" />
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
                <h3 className="text-lg font-semibold">Roll for Victory!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Roll 5 dice and get the best poker hand to beat the AI!
                </p>
              </div>
            </motion.div>

            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-md space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Crown className="h-4 w-4 text-yellow-500" />
                  Hand Rankings (Best to Worst)
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-purple-500/20 text-purple-600 dark:text-purple-400">1</Badge>
                    <span>Five of a Kind</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400">2</Badge>
                    <span>Four of a Kind</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-orange-500/20 text-orange-600 dark:text-orange-400">3</Badge>
                    <span>Full House</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400">4</Badge>
                    <span>Straight</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-500/20 text-green-600 dark:text-green-400">5</Badge>
                    <span>Three of a Kind</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-cyan-500/20 text-cyan-600 dark:text-cyan-400">6</Badge>
                    <span>Two Pair</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-pink-500/20 text-pink-600 dark:text-pink-400">7</Badge>
                    <span>One Pair</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-gray-500/20 text-gray-600 dark:text-gray-400">8</Badge>
                    <span>High Card</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-md">
                  <User className="h-4 w-4 text-blue-500" />
                  <span>You</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-md">
                  <Bot className="h-4 w-4 text-purple-500" />
                  <span>AI Opponent</span>
                </div>
              </div>

              {!isPractice && (
                <div className="flex items-center justify-between gap-4 p-3 bg-primary/10 rounded-md">
                  <span className="text-sm font-medium">Stake Amount</span>
                  <Badge variant="secondary" data-testid="badge-stake">
                    {stake.toLocaleString()} NGN
                  </Badge>
                </div>
              )}
            </div>

            <Button 
              onClick={startGame} 
              className="w-full" 
              size="lg"
              data-testid="button-start-diceduel"
            >
              <Play className="h-5 w-5 mr-2" />
              Roll the Dice
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (gamePhase === "rolling") {
    return (
      <div className="w-full max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="text-xl flex items-center gap-2">
                <Target className="h-6 w-6 text-primary" />
                Dice Duel
              </CardTitle>
              <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400" data-testid="badge-rolling">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="mr-1"
                >
                  <Zap className="h-3 w-3" />
                </motion.div>
                Rolling...
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4">
              <DiceDisplay 
                dice={playerDice} 
                isRolling={isRolling}
                label="You"
                isWinner={false}
                handResult={null}
              />
              
              <div className="flex items-center justify-center">
                <Badge variant="outline" className="text-lg px-4 py-1">
                  VS
                </Badge>
              </div>
              
              <DiceDisplay 
                dice={aiDice} 
                isRolling={isRolling}
                label="AI"
                isWinner={false}
                handResult={null}
              />
            </div>

            <motion.p
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-lg font-semibold text-center text-muted-foreground"
              data-testid="text-message"
            >
              {message}
            </motion.p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const playerWon = winner === "player";
  const isTie = winner === "tie";

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <Card className="overflow-visible">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Duel Complete!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <AnimatePresence>
            {playerWon && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 pointer-events-none overflow-hidden"
              >
                {[...Array(15)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute"
                    initial={{ 
                      x: "50%", 
                      y: "50%",
                      scale: 0 
                    }}
                    animate={{ 
                      x: `${Math.random() * 100}%`,
                      y: `${Math.random() * 100}%`,
                      scale: [0, 1, 0],
                      rotate: [0, 180, 360]
                    }}
                    transition={{ 
                      duration: 2,
                      delay: i * 0.1,
                      repeat: 2
                    }}
                  >
                    <Sparkles className="h-6 w-6 text-yellow-500" />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid gap-4">
            <DiceDisplay 
              dice={playerDice} 
              isRolling={false}
              label="You"
              isWinner={playerWon}
              handResult={playerHand}
            />
            
            <div className="flex items-center justify-center">
              <Badge variant="outline" className="text-lg px-4 py-1">
                VS
              </Badge>
            </div>
            
            <DiceDisplay 
              dice={aiDice} 
              isRolling={false}
              label="AI"
              isWinner={winner === "ai"}
              handResult={aiHand}
            />
          </div>

          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            {playerWon ? (
              <div className="space-y-2">
                <motion.div
                  animate={{ 
                    rotate: [0, -10, 10, -10, 10, 0],
                    scale: [1, 1.1, 1]
                  }}
                  transition={{ duration: 0.5 }}
                >
                  <Trophy className="h-16 w-16 mx-auto text-yellow-500" />
                </motion.div>
                <h3 className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-result">
                  You Win!
                </h3>
                <p className="text-muted-foreground">
                  {isPractice 
                    ? `Your ${playerHand?.name} beats AI's ${aiHand?.name}!`
                    : `You won with ${playerHand?.name}!`
                  }
                </p>
              </div>
            ) : isTie ? (
              <div className="space-y-2">
                <div className="h-16 w-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                  <span className="text-3xl font-bold text-muted-foreground">=</span>
                </div>
                <h3 className="text-2xl font-bold text-muted-foreground" data-testid="text-result">
                  It's a Tie!
                </h3>
                <p className="text-muted-foreground">
                  Both rolled {playerHand?.name}. Rolling again...
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="h-16 w-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                  <Bot className="h-10 w-10 text-purple-500" />
                </div>
                <h3 className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-result">
                  AI Wins!
                </h3>
                <p className="text-muted-foreground">
                  AI's {aiHand?.name} beats your {playerHand?.name}
                </p>
              </div>
            )}
          </motion.div>

          {!isTie && (
            <div className="flex items-center justify-center gap-2 p-4 bg-muted/30 rounded-md">
              <span className="text-sm font-medium">Your Hand:</span>
              <Badge className={playerHand ? getHandColor(playerHand.rank) : ""} data-testid="badge-player-hand">
                {playerHand?.name || "Unknown"}
              </Badge>
              <span className="text-muted-foreground mx-2">vs</span>
              <Badge className={aiHand ? getHandColor(aiHand.rank) : ""} data-testid="badge-ai-hand">
                {aiHand?.name || "Unknown"}
              </Badge>
            </div>
          )}

          {!isTie && (
            <Button 
              onClick={resetGame} 
              variant="outline" 
              className="w-full"
              data-testid="button-play-again"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Play Again
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
