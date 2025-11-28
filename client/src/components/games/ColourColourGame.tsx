import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  RotateCcw, 
  Trophy, 
  Play,
  Target,
  History,
  Sparkles,
  Crown,
  X,
  Coins,
  Palette,
  Hash,
  Check,
  Loader2
} from "lucide-react";

interface ColourColourGameProps {
  stake: number;
  onGameEnd: (won: boolean, score?: number) => void;
  isPractice: boolean;
}

type GamePhase = "betting" | "spinning" | "result";
type WheelColor = "red" | "green" | "purple" | "yellow";

interface Bet {
  type: "color" | "number";
  value: WheelColor | number;
  amount: number;
}

interface WheelSegment {
  color: WheelColor;
  number: number;
}

interface SpinResult {
  segment: WheelSegment;
  timestamp: number;
}

const COLORS: WheelColor[] = ["red", "green", "purple", "yellow"];
const COLOR_PAYOUT = 1.95;
const NUMBER_PAYOUT = 9;

const WHEEL_SEGMENTS: WheelSegment[] = [];
for (let i = 0; i < 10; i++) {
  const color = COLORS[i % 4];
  WHEEL_SEGMENTS.push({ color, number: i });
}

const COLOR_STYLES: Record<WheelColor, { bg: string; text: string; border: string; gradient: string }> = {
  red: { 
    bg: "bg-red-500", 
    text: "text-red-600 dark:text-red-400", 
    border: "border-red-500",
    gradient: "from-red-500 to-red-600"
  },
  green: { 
    bg: "bg-green-500", 
    text: "text-green-600 dark:text-green-400", 
    border: "border-green-500",
    gradient: "from-green-500 to-green-600"
  },
  purple: { 
    bg: "bg-purple-500", 
    text: "text-purple-600 dark:text-purple-400", 
    border: "border-purple-500",
    gradient: "from-purple-500 to-purple-600"
  },
  yellow: { 
    bg: "bg-yellow-500", 
    text: "text-yellow-600 dark:text-yellow-400", 
    border: "border-yellow-500",
    gradient: "from-yellow-500 to-yellow-600"
  },
};

const generateSecureResult = (): WheelSegment => {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const randomIndex = array[0] % WHEEL_SEGMENTS.length;
  return WHEEL_SEGMENTS[randomIndex];
};

const formatCurrency = (amount: number): string => {
  return amount.toLocaleString() + " NGN";
};

const calculateWinnings = (bets: Bet[], result: WheelSegment): number => {
  let totalWinnings = 0;
  
  for (const bet of bets) {
    if (bet.type === "color" && bet.value === result.color) {
      totalWinnings += Math.round(bet.amount * COLOR_PAYOUT);
    } else if (bet.type === "number" && bet.value === result.number) {
      totalWinnings += Math.round(bet.amount * NUMBER_PAYOUT);
    }
  }
  
  return totalWinnings;
};

const hasWinningBet = (bets: Bet[], result: WheelSegment): boolean => {
  return bets.some(bet => 
    (bet.type === "color" && bet.value === result.color) ||
    (bet.type === "number" && bet.value === result.number)
  );
};

const SpinningWheel = ({ 
  rotation, 
  isSpinning, 
  resultSegment 
}: { 
  rotation: number; 
  isSpinning: boolean;
  resultSegment: WheelSegment | null;
}) => {
  const segmentAngle = 360 / WHEEL_SEGMENTS.length;
  
  return (
    <div className="relative w-64 h-64 mx-auto" data-testid="wheel-container">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-20">
        <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-primary drop-shadow-lg" />
      </div>
      
      <motion.div
        className="relative w-full h-full rounded-full border-4 border-primary shadow-2xl overflow-hidden"
        style={{ transformOrigin: "center center" }}
        animate={{ rotate: rotation }}
        transition={isSpinning ? {
          duration: 5,
          ease: [0.2, 0.8, 0.3, 1],
        } : {
          duration: 0.3,
          ease: "easeOut"
        }}
        data-testid="wheel-spinner"
      >
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {WHEEL_SEGMENTS.map((segment, index) => {
            const startAngle = index * segmentAngle;
            const endAngle = startAngle + segmentAngle;
            const startRad = (startAngle - 90) * (Math.PI / 180);
            const endRad = (endAngle - 90) * (Math.PI / 180);
            
            const x1 = 50 + 50 * Math.cos(startRad);
            const y1 = 50 + 50 * Math.sin(startRad);
            const x2 = 50 + 50 * Math.cos(endRad);
            const y2 = 50 + 50 * Math.sin(endRad);
            
            const largeArcFlag = segmentAngle > 180 ? 1 : 0;
            
            const d = `M 50 50 L ${x1} ${y1} A 50 50 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
            
            const textAngle = startAngle + segmentAngle / 2 - 90;
            const textRad = textAngle * (Math.PI / 180);
            const textX = 50 + 35 * Math.cos(textRad);
            const textY = 50 + 35 * Math.sin(textRad);
            
            const colors: Record<WheelColor, string> = {
              red: "#ef4444",
              green: "#22c55e",
              purple: "#a855f7",
              yellow: "#eab308",
            };
            
            return (
              <g key={index}>
                <path
                  d={d}
                  fill={colors[segment.color]}
                  stroke="#fff"
                  strokeWidth="0.5"
                />
                <text
                  x={textX}
                  y={textY}
                  fill="white"
                  fontSize="8"
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ 
                    transform: `rotate(${startAngle + segmentAngle / 2}deg)`,
                    transformOrigin: `${textX}px ${textY}px`,
                    textShadow: "1px 1px 2px rgba(0,0,0,0.5)"
                  }}
                >
                  {segment.number}
                </text>
              </g>
            );
          })}
          
          <circle cx="50" cy="50" r="10" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="1" />
          <text x="50" y="50" fill="hsl(var(--foreground))" fontSize="6" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
            SPIN
          </text>
        </svg>
      </motion.div>
      
      {!isSpinning && resultSegment && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5, type: "spring" }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${COLOR_STYLES[resultSegment.color].gradient} flex items-center justify-center shadow-xl border-4 border-white dark:border-gray-800`}>
            <span className="text-3xl font-black text-white drop-shadow-lg">
              {resultSegment.number}
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
};

const BettingOptions = ({
  selectedColorBets,
  selectedNumberBets,
  onToggleColorBet,
  onToggleNumberBet,
  stake,
}: {
  selectedColorBets: Set<WheelColor>;
  selectedNumberBets: Set<number>;
  onToggleColorBet: (color: WheelColor) => void;
  onToggleNumberBet: (number: number) => void;
  stake: number;
}) => {
  const betPerSelection = stake;
  
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Bet on Color ({COLOR_PAYOUT}x payout)</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {COLORS.map((color) => {
            const isSelected = selectedColorBets.has(color);
            const styles = COLOR_STYLES[color];
            
            return (
              <motion.button
                key={color}
                className={`
                  relative p-4 rounded-lg border-2 transition-all
                  ${isSelected 
                    ? `${styles.bg} ${styles.border} text-white ring-2 ring-offset-2 ring-primary` 
                    : `bg-muted/30 border-muted-foreground/20 ${styles.text}`
                  }
                `}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onToggleColorBet(color)}
                data-testid={`button-bet-color-${color}`}
              >
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-6 h-6 rounded-full ${styles.bg} ${isSelected ? 'ring-2 ring-white' : ''}`} />
                  <span className="text-xs font-medium capitalize">{color}</span>
                </div>
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center"
                  >
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Bet on Number ({NUMBER_PAYOUT}x payout)</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
            const isSelected = selectedNumberBets.has(num);
            const segment = WHEEL_SEGMENTS.find(s => s.number === num)!;
            const styles = COLOR_STYLES[segment.color];
            
            return (
              <motion.button
                key={num}
                className={`
                  relative p-3 rounded-lg border-2 transition-all
                  ${isSelected 
                    ? `bg-gradient-to-br ${styles.gradient} border-transparent text-white ring-2 ring-offset-2 ring-primary` 
                    : `bg-muted/30 border-muted-foreground/20`
                  }
                `}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onToggleNumberBet(num)}
                data-testid={`button-bet-number-${num}`}
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="text-lg font-bold">{num}</span>
                  <div className={`w-3 h-3 rounded-full ${styles.bg}`} />
                </div>
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center"
                  >
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
      
      {(selectedColorBets.size > 0 || selectedNumberBets.size > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-muted/50 rounded-md space-y-2"
        >
          <div className="text-sm font-medium flex items-center gap-2">
            <Coins className="h-4 w-4 text-primary" />
            Your Bets
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from(selectedColorBets).map(color => (
              <Badge 
                key={`color-${color}`} 
                className={`${COLOR_STYLES[color].bg} text-white`}
                data-testid={`badge-bet-color-${color}`}
              >
                {color.charAt(0).toUpperCase() + color.slice(1)} ({formatCurrency(betPerSelection)})
              </Badge>
            ))}
            {Array.from(selectedNumberBets).map(num => {
              const segment = WHEEL_SEGMENTS.find(s => s.number === num)!;
              return (
                <Badge 
                  key={`number-${num}`} 
                  className={`${COLOR_STYLES[segment.color].bg} text-white`}
                  data-testid={`badge-bet-number-${num}`}
                >
                  #{num} ({formatCurrency(betPerSelection)})
                </Badge>
              );
            })}
          </div>
          <div className="text-xs text-muted-foreground">
            Total bet: {formatCurrency(betPerSelection * (selectedColorBets.size + selectedNumberBets.size))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default function ColourColourGame({ stake, onGameEnd, isPractice }: ColourColourGameProps) {
  const [gamePhase, setGamePhase] = useState<GamePhase>("betting");
  const [selectedColorBets, setSelectedColorBets] = useState<Set<WheelColor>>(new Set());
  const [selectedNumberBets, setSelectedNumberBets] = useState<Set<number>>(new Set());
  const [wheelRotation, setWheelRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [resultSegment, setResultSegment] = useState<WheelSegment | null>(null);
  const [spinHistory, setSpinHistory] = useState<SpinResult[]>([]);
  const [winnings, setWinnings] = useState(0);
  const [totalBetAmount, setTotalBetAmount] = useState(0);
  
  const spinTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current) {
        clearTimeout(spinTimeoutRef.current);
      }
    };
  }, []);

  const toggleColorBet = useCallback((color: WheelColor) => {
    setSelectedColorBets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(color)) {
        newSet.delete(color);
      } else {
        newSet.add(color);
      }
      return newSet;
    });
  }, []);

  const toggleNumberBet = useCallback((num: number) => {
    setSelectedNumberBets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(num)) {
        newSet.delete(num);
      } else {
        newSet.add(num);
      }
      return newSet;
    });
  }, []);

  const getBets = useCallback((): Bet[] => {
    const bets: Bet[] = [];
    const betAmount = stake;
    
    selectedColorBets.forEach(color => {
      bets.push({ type: "color", value: color, amount: betAmount });
    });
    
    selectedNumberBets.forEach(num => {
      bets.push({ type: "number", value: num, amount: betAmount });
    });
    
    return bets;
  }, [selectedColorBets, selectedNumberBets, stake]);

  const spinWheel = useCallback(() => {
    if (selectedColorBets.size === 0 && selectedNumberBets.size === 0) return;
    
    const result = generateSecureResult();
    const bets = getBets();
    const totalBet = bets.reduce((sum, bet) => sum + bet.amount, 0);
    
    setTotalBetAmount(totalBet);
    setGamePhase("spinning");
    setIsSpinning(true);
    setResultSegment(null);
    
    const segmentIndex = WHEEL_SEGMENTS.findIndex(
      s => s.color === result.color && s.number === result.number
    );
    const segmentAngle = 360 / WHEEL_SEGMENTS.length;
    const targetAngle = segmentIndex * segmentAngle;
    
    const fullRotations = 5 * 360;
    const finalRotation = wheelRotation + fullRotations + (360 - targetAngle) + segmentAngle / 2;
    
    setWheelRotation(finalRotation);
    
    spinTimeoutRef.current = setTimeout(() => {
      setIsSpinning(false);
      setResultSegment(result);
      
      const calculatedWinnings = calculateWinnings(bets, result);
      setWinnings(calculatedWinnings);
      
      setSpinHistory(prev => [
        { segment: result, timestamp: Date.now() },
        ...prev
      ].slice(0, 10));
      
      setGamePhase("result");
      
      const won = calculatedWinnings > 0;
      onGameEnd(won, won ? calculatedWinnings : 0);
    }, 5000);
  }, [selectedColorBets, selectedNumberBets, getBets, wheelRotation, onGameEnd]);

  const resetGame = useCallback(() => {
    setGamePhase("betting");
    setSelectedColorBets(new Set());
    setSelectedNumberBets(new Set());
    setResultSegment(null);
    setWinnings(0);
    setTotalBetAmount(0);
  }, []);

  const hasBets = selectedColorBets.size > 0 || selectedNumberBets.size > 0;

  if (gamePhase === "betting") {
    return (
      <div className="w-full max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl flex items-center gap-2">
              <Palette className="h-6 w-6 text-primary" />
              Colour Colour
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-4"
            >
              <SpinningWheel rotation={wheelRotation} isSpinning={false} resultSegment={null} />
              
              <div>
                <h3 className="text-lg font-semibold">Pick Your Lucky Colour or Number</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Bet on colors for 1.95x or exact numbers for 9x payout!
                </p>
              </div>
            </motion.div>

            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-md space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  How to Play
                </h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">1.</span>
                    <span>Select one or more colors and/or numbers to bet on</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">2.</span>
                    <span>Color bets pay 1.95x your stake</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">3.</span>
                    <span>Number bets pay 9x your stake</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">4.</span>
                    <span>Spin the wheel and win if it lands on your selection!</span>
                  </li>
                </ul>
              </div>

              <BettingOptions
                selectedColorBets={selectedColorBets}
                selectedNumberBets={selectedNumberBets}
                onToggleColorBet={toggleColorBet}
                onToggleNumberBet={toggleNumberBet}
                stake={stake}
              />

              {spinHistory.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <History className="h-4 w-4 text-muted-foreground" />
                    Recent Spins
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {spinHistory.slice(0, 8).map((result, index) => (
                      <Badge
                        key={result.timestamp}
                        className={`${COLOR_STYLES[result.segment.color].bg} text-white`}
                        data-testid={`badge-history-${index}`}
                      >
                        {result.segment.number}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {!isPractice && (
                <div className="flex items-center justify-between gap-4 p-3 bg-primary/10 rounded-md">
                  <span className="text-sm font-medium">Stake per Selection</span>
                  <Badge variant="secondary" data-testid="badge-stake">
                    {formatCurrency(stake)}
                  </Badge>
                </div>
              )}
            </div>

            <Button 
              onClick={spinWheel} 
              className="w-full" 
              size="lg"
              disabled={!hasBets}
              data-testid="button-spin"
            >
              <Play className="h-5 w-5 mr-2" />
              {hasBets 
                ? `Spin the Wheel (${formatCurrency(stake * (selectedColorBets.size + selectedNumberBets.size))})` 
                : "Select at least one bet"
              }
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (gamePhase === "spinning") {
    return (
      <div className="w-full max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="text-xl flex items-center gap-2">
                <Palette className="h-6 w-6 text-primary" />
                Colour Colour
              </CardTitle>
              <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400" data-testid="badge-spinning">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Spinning...
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <SpinningWheel rotation={wheelRotation} isSpinning={isSpinning} resultSegment={resultSegment} />
            
            <motion.div
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              className="text-center"
            >
              <p className="text-lg font-medium text-muted-foreground">
                Good luck! The wheel is spinning...
              </p>
            </motion.div>

            <div className="p-4 bg-muted/30 rounded-md">
              <div className="text-sm font-medium mb-2 flex items-center gap-2">
                <Coins className="h-4 w-4 text-primary" />
                Your Active Bets
              </div>
              <div className="flex flex-wrap gap-2">
                {Array.from(selectedColorBets).map(color => (
                  <Badge 
                    key={`color-${color}`} 
                    className={`${COLOR_STYLES[color].bg} text-white`}
                  >
                    {color.charAt(0).toUpperCase() + color.slice(1)}
                  </Badge>
                ))}
                {Array.from(selectedNumberBets).map(num => {
                  const segment = WHEEL_SEGMENTS.find(s => s.number === num)!;
                  return (
                    <Badge 
                      key={`number-${num}`} 
                      className={`${COLOR_STYLES[segment.color].bg} text-white`}
                    >
                      #{num}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const won = winnings > 0;
  const bets = getBets();
  const hasWinningColorBet = resultSegment && Array.from(selectedColorBets).includes(resultSegment.color);
  const hasWinningNumberBet = resultSegment && Array.from(selectedNumberBets).includes(resultSegment.number);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-xl flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Spin Complete!
            <Badge 
              className={won 
                ? "ml-2 bg-green-500/20 text-green-600 dark:text-green-400" 
                : "ml-2 bg-red-500/20 text-red-600 dark:text-red-400"
              }
              data-testid="badge-result"
            >
              {resultSegment && (
                <>
                  <div className={`w-3 h-3 rounded-full ${COLOR_STYLES[resultSegment.color].bg} mr-1`} />
                  {resultSegment.color.charAt(0).toUpperCase() + resultSegment.color.slice(1)} {resultSegment.number}
                </>
              )}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <SpinningWheel rotation={wheelRotation} isSpinning={false} resultSegment={resultSegment} />

          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            {won ? (
              <div className="space-y-2">
                <motion.div
                  animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  <Crown className="h-16 w-16 mx-auto text-yellow-500" />
                </motion.div>
                <h3 className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-result">
                  You Won!
                </h3>
                <div className="space-y-1">
                  {hasWinningColorBet && (
                    <p className="text-sm text-muted-foreground">
                      Color bet on {resultSegment?.color} won! ({COLOR_PAYOUT}x)
                    </p>
                  )}
                  {hasWinningNumberBet && (
                    <p className="text-sm text-muted-foreground">
                      Number bet on #{resultSegment?.number} won! ({NUMBER_PAYOUT}x)
                    </p>
                  )}
                </div>
                <p className="text-lg font-semibold text-green-600 dark:text-green-400" data-testid="text-winnings">
                  {isPractice 
                    ? `Practice win: ${formatCurrency(winnings)}!`
                    : `You won ${formatCurrency(winnings)}!`
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.3 }}
                >
                  <X className="h-16 w-16 mx-auto text-red-500" />
                </motion.div>
                <h3 className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-result">
                  No Match
                </h3>
                <p className="text-muted-foreground">
                  {isPractice 
                    ? `The wheel landed on ${resultSegment?.color} ${resultSegment?.number}. Try again!`
                    : `You lost ${formatCurrency(totalBetAmount)}. The wheel landed on ${resultSegment?.color} ${resultSegment?.number}.`
                  }
                </p>
              </div>
            )}
          </motion.div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-muted/30 rounded-md text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Your Bets</span>
              </div>
              <div className="flex flex-wrap gap-1 justify-center">
                {Array.from(selectedColorBets).map(color => {
                  const isWinner = color === resultSegment?.color;
                  return (
                    <Badge 
                      key={`color-${color}`} 
                      className={`${isWinner ? 'ring-2 ring-green-500' : 'opacity-50'} ${COLOR_STYLES[color].bg} text-white`}
                    >
                      {color}
                      {isWinner && <Check className="h-3 w-3 ml-1" />}
                    </Badge>
                  );
                })}
                {Array.from(selectedNumberBets).map(num => {
                  const isWinner = num === resultSegment?.number;
                  const segment = WHEEL_SEGMENTS.find(s => s.number === num)!;
                  return (
                    <Badge 
                      key={`number-${num}`} 
                      className={`${isWinner ? 'ring-2 ring-green-500' : 'opacity-50'} ${COLOR_STYLES[segment.color].bg} text-white`}
                    >
                      #{num}
                      {isWinner && <Check className="h-3 w-3 ml-1" />}
                    </Badge>
                  );
                })}
              </div>
            </div>
            <div className="p-4 bg-muted/30 rounded-md text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Result</span>
              </div>
              {resultSegment && (
                <div className="flex items-center justify-center gap-2">
                  <div className={`w-6 h-6 rounded-full ${COLOR_STYLES[resultSegment.color].bg}`} />
                  <span className="text-xl font-bold">{resultSegment.number}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={resetGame} 
              className="flex-1" 
              size="lg"
              data-testid="button-play-again"
            >
              <RotateCcw className="h-5 w-5 mr-2" />
              Play Again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
