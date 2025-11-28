import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  RotateCcw, 
  Trophy, 
  Play,
  History,
  Sparkles,
  Crown,
  Star,
  Zap,
  Target,
  ChevronDown
} from "lucide-react";

interface SpinWheelGameProps {
  stake: number;
  onGameEnd: (won: boolean, score?: number) => void;
  isPractice: boolean;
}

type GamePhase = "ready" | "spinning" | "result";

interface WheelSegment {
  multiplier: number;
  label: string;
  color: string;
  textColor: string;
  probability: number;
}

interface SpinHistoryItem {
  id: number;
  multiplier: number;
  timestamp: number;
}

const WHEEL_SEGMENTS: WheelSegment[] = [
  { multiplier: 1, label: "1x", color: "#4B5563", textColor: "#FFFFFF", probability: 0.35 },
  { multiplier: 2, label: "2x", color: "#3B82F6", textColor: "#FFFFFF", probability: 0.30 },
  { multiplier: 1, label: "1x", color: "#6B7280", textColor: "#FFFFFF", probability: 0.35 },
  { multiplier: 5, label: "5x", color: "#10B981", textColor: "#FFFFFF", probability: 0.15 },
  { multiplier: 1, label: "1x", color: "#4B5563", textColor: "#FFFFFF", probability: 0.35 },
  { multiplier: 2, label: "2x", color: "#6366F1", textColor: "#FFFFFF", probability: 0.30 },
  { multiplier: 1, label: "1x", color: "#6B7280", textColor: "#FFFFFF", probability: 0.35 },
  { multiplier: 10, label: "10x", color: "#F59E0B", textColor: "#000000", probability: 0.05 },
  { multiplier: 1, label: "1x", color: "#4B5563", textColor: "#FFFFFF", probability: 0.35 },
  { multiplier: 2, label: "2x", color: "#3B82F6", textColor: "#FFFFFF", probability: 0.30 },
  { multiplier: 1, label: "1x", color: "#6B7280", textColor: "#FFFFFF", probability: 0.35 },
  { multiplier: 50, label: "50x", color: "#EF4444", textColor: "#FFFFFF", probability: 0.008 },
  { multiplier: 1, label: "1x", color: "#4B5563", textColor: "#FFFFFF", probability: 0.35 },
  { multiplier: 2, label: "2x", color: "#6366F1", textColor: "#FFFFFF", probability: 0.30 },
  { multiplier: 1, label: "1x", color: "#6B7280", textColor: "#FFFFFF", probability: 0.35 },
  { multiplier: 100, label: "Jackpot", color: "#8B5CF6", textColor: "#FFFFFF", probability: 0.002 },
];

const WEIGHTED_OUTCOMES: { segmentIndex: number; weight: number }[] = [
  { segmentIndex: 0, weight: 18 },
  { segmentIndex: 1, weight: 10 },
  { segmentIndex: 2, weight: 18 },
  { segmentIndex: 3, weight: 5 },
  { segmentIndex: 4, weight: 18 },
  { segmentIndex: 5, weight: 10 },
  { segmentIndex: 6, weight: 18 },
  { segmentIndex: 7, weight: 1.5 },
  { segmentIndex: 8, weight: 18 },
  { segmentIndex: 9, weight: 10 },
  { segmentIndex: 10, weight: 18 },
  { segmentIndex: 11, weight: 0.35 },
  { segmentIndex: 12, weight: 18 },
  { segmentIndex: 13, weight: 10 },
  { segmentIndex: 14, weight: 18 },
  { segmentIndex: 15, weight: 0.15 },
];

const TOTAL_WEIGHT = WEIGHTED_OUTCOMES.reduce((sum, o) => sum + o.weight, 0);

const generateSecureOutcome = (): number => {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const randomValue = (array[0] / 0x100000000) * TOTAL_WEIGHT;
  
  let cumulativeWeight = 0;
  for (const outcome of WEIGHTED_OUTCOMES) {
    cumulativeWeight += outcome.weight;
    if (randomValue <= cumulativeWeight) {
      return outcome.segmentIndex;
    }
  }
  
  return 0;
};

const getMultiplierColor = (multiplier: number): string => {
  if (multiplier === 1) return "bg-gray-500/20 text-gray-600 dark:text-gray-400";
  if (multiplier === 2) return "bg-blue-500/20 text-blue-600 dark:text-blue-400";
  if (multiplier === 5) return "bg-green-500/20 text-green-600 dark:text-green-400";
  if (multiplier === 10) return "bg-amber-500/20 text-amber-600 dark:text-amber-400";
  if (multiplier === 50) return "bg-red-500/20 text-red-600 dark:text-red-400";
  return "bg-purple-500/20 text-purple-600 dark:text-purple-400";
};

const formatMultiplier = (value: number): string => {
  if (value === 100) return "Jackpot!";
  return value + "x";
};

const SpinWheel = ({ 
  rotation, 
  isSpinning 
}: { 
  rotation: number; 
  isSpinning: boolean;
}) => {
  const segmentCount = WHEEL_SEGMENTS.length;
  const segmentAngle = 360 / segmentCount;
  const radius = 140;
  const centerX = 150;
  const centerY = 150;

  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians)
    };
  };

  const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return [
      "M", x, y,
      "L", start.x, start.y,
      "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
      "Z"
    ].join(" ");
  };

  return (
    <div className="relative w-[300px] h-[300px]" data-testid="spin-wheel">
      <motion.div
        className="absolute inset-0"
        style={{ transformOrigin: 'center center' }}
        animate={{ rotate: rotation }}
        transition={isSpinning ? {
          duration: 5,
          ease: [0.2, 0.8, 0.3, 1],
        } : { duration: 0 }}
      >
        <svg width="300" height="300" viewBox="0 0 300 300">
          <defs>
            <filter id="wheelShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.3"/>
            </filter>
            <radialGradient id="wheelGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.1)" />
            </radialGradient>
          </defs>
          
          <circle cx={centerX} cy={centerY} r={radius + 8} fill="#1F2937" filter="url(#wheelShadow)" />
          <circle cx={centerX} cy={centerY} r={radius + 5} fill="#374151" />
          
          {WHEEL_SEGMENTS.map((segment, index) => {
            const startAngle = index * segmentAngle;
            const endAngle = (index + 1) * segmentAngle;
            const middleAngle = startAngle + segmentAngle / 2;
            const labelRadius = radius * 0.65;
            const labelPos = polarToCartesian(centerX, centerY, labelRadius, middleAngle);
            
            return (
              <g key={index}>
                <path
                  d={describeArc(centerX, centerY, radius, startAngle, endAngle)}
                  fill={segment.color}
                  stroke="#1F2937"
                  strokeWidth="2"
                />
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  fill={segment.textColor}
                  fontSize={segment.multiplier >= 50 ? "11" : "14"}
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${middleAngle}, ${labelPos.x}, ${labelPos.y})`}
                >
                  {segment.label}
                </text>
              </g>
            );
          })}
          
          <circle cx={centerX} cy={centerY} r={radius} fill="url(#wheelGlow)" />
          
          <circle cx={centerX} cy={centerY} r="30" fill="#1F2937" stroke="#4B5563" strokeWidth="3" />
          <circle cx={centerX} cy={centerY} r="20" fill="#374151" />
          <text x={centerX} y={centerY} fill="white" fontSize="10" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
            SPIN
          </text>
          
          {[...Array(16)].map((_, i) => {
            const angle = (i * 360 / 16) - 90;
            const rad = angle * Math.PI / 180;
            const x1 = centerX + (radius + 5) * Math.cos(rad);
            const y1 = centerY + (radius + 5) * Math.sin(rad);
            const x2 = centerX + (radius + 12) * Math.cos(rad);
            const y2 = centerY + (radius + 12) * Math.sin(rad);
            return (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#9CA3AF" strokeWidth="2" />
            );
          })}
        </svg>
      </motion.div>
      
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10" data-testid="wheel-pointer">
        <div className="relative">
          <ChevronDown className="h-10 w-10 text-yellow-500 drop-shadow-lg" strokeWidth={4} />
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            animate={isSpinning ? {} : { scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <ChevronDown className="h-10 w-10 text-yellow-400 opacity-50" strokeWidth={4} />
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default function SpinWheelGame({ stake, onGameEnd, isPractice }: SpinWheelGameProps) {
  const [gamePhase, setGamePhase] = useState<GamePhase>("ready");
  const [rotation, setRotation] = useState(0);
  const [winningSegmentIndex, setWinningSegmentIndex] = useState<number | null>(null);
  const [spinHistory, setSpinHistory] = useState<SpinHistoryItem[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const [currentWinnings, setCurrentWinnings] = useState(0);
  
  const spinTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current) {
        clearTimeout(spinTimeoutRef.current);
      }
    };
  }, []);

  const spinWheel = useCallback(() => {
    if (gamePhase === "spinning") return;
    
    setGamePhase("spinning");
    setShowCelebration(false);
    
    const winningIndex = generateSecureOutcome();
    setWinningSegmentIndex(winningIndex);
    
    const segmentAngle = 360 / WHEEL_SEGMENTS.length;
    const segmentCenterOffset = segmentAngle / 2;
    
    const targetAngle = 360 - (winningIndex * segmentAngle) - segmentCenterOffset;
    
    const fullRotations = 5 + Math.floor(Math.random() * 3);
    const finalRotation = rotation + (fullRotations * 360) + targetAngle + (Math.random() * (segmentAngle * 0.6) - segmentAngle * 0.3);
    
    setRotation(finalRotation);
    
    spinTimeoutRef.current = setTimeout(() => {
      const segment = WHEEL_SEGMENTS[winningIndex];
      const winnings = Math.round(stake * segment.multiplier);
      setCurrentWinnings(winnings);
      
      setSpinHistory(prev => {
        const newHistory = [
          { 
            id: Date.now(), 
            multiplier: segment.multiplier, 
            timestamp: Date.now() 
          },
          ...prev
        ].slice(0, 10);
        return newHistory;
      });
      
      if (segment.multiplier >= 5) {
        setShowCelebration(true);
      }
      
      setGamePhase("result");
      
      const won = segment.multiplier > 1;
      onGameEnd(won, won ? winnings : 0);
    }, 5200);
  }, [gamePhase, rotation, stake, onGameEnd]);

  const resetGame = useCallback(() => {
    setGamePhase("ready");
    setWinningSegmentIndex(null);
    setShowCelebration(false);
    setCurrentWinnings(0);
  }, []);

  const getWinningSegment = () => {
    if (winningSegmentIndex === null) return null;
    return WHEEL_SEGMENTS[winningSegmentIndex];
  };

  if (gamePhase === "ready") {
    return (
      <div className="w-full max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl flex items-center gap-2">
              <Target className="h-6 w-6 text-primary" />
              Spin The Wheel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center space-y-4"
            >
              <SpinWheel rotation={rotation} isSpinning={false} />
              
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold">Test Your Luck!</h3>
                <p className="text-sm text-muted-foreground">
                  Spin the wheel and win up to 100x your stake!
                </p>
              </div>
            </motion.div>

            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-md space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Multipliers
                </h4>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-gray-500/20 text-gray-600 dark:text-gray-400">1x</Badge>
                  <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400">2x</Badge>
                  <Badge className="bg-green-500/20 text-green-600 dark:text-green-400">5x</Badge>
                  <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400">10x</Badge>
                  <Badge className="bg-red-500/20 text-red-600 dark:text-red-400">50x</Badge>
                  <Badge className="bg-purple-500/20 text-purple-600 dark:text-purple-400">Jackpot (100x)</Badge>
                </div>
              </div>

              {spinHistory.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <History className="h-4 w-4 text-muted-foreground" />
                    Recent Spins
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {spinHistory.slice(0, 8).map((item) => (
                      <Badge
                        key={item.id}
                        className={getMultiplierColor(item.multiplier)}
                        data-testid={`badge-history-${item.id}`}
                      >
                        {formatMultiplier(item.multiplier)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

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
              onClick={spinWheel} 
              className="w-full" 
              size="lg"
              data-testid="button-spin"
            >
              <Play className="h-5 w-5 mr-2" />
              Spin The Wheel
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
                <Target className="h-6 w-6 text-primary" />
                Spin The Wheel
              </CardTitle>
              <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400" data-testid="badge-spinning">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="mr-1"
                >
                  <Zap className="h-3 w-3" />
                </motion.div>
                Spinning...
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center space-y-4">
              <SpinWheel rotation={rotation} isSpinning={true} />
              
              <motion.p
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-lg font-semibold text-muted-foreground"
              >
                Good luck!
              </motion.p>
            </div>

            {!isPractice && (
              <div className="flex items-center justify-between gap-4 p-3 bg-primary/10 rounded-md">
                <span className="text-sm font-medium">Stake Amount</span>
                <Badge variant="secondary" data-testid="badge-stake-spinning">
                  {stake.toLocaleString()} NGN
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const winningSegment = getWinningSegment();
  const won = winningSegment && winningSegment.multiplier > 1;
  const isBigWin = winningSegment && winningSegment.multiplier >= 10;
  const isJackpot = winningSegment && winningSegment.multiplier === 100;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <Card className="overflow-visible">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Spin Complete!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <AnimatePresence>
            {showCelebration && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 pointer-events-none overflow-hidden"
              >
                {[...Array(20)].map((_, i) => (
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
                    <Star className={`h-6 w-6 ${isJackpot ? 'text-purple-500' : 'text-yellow-500'}`} />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col items-center space-y-4">
            <SpinWheel rotation={rotation} isSpinning={false} />
          </div>

          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            {isJackpot ? (
              <div className="space-y-3">
                <motion.div
                  animate={{ 
                    rotate: [0, -10, 10, -10, 10, 0],
                    scale: [1, 1.1, 1]
                  }}
                  transition={{ duration: 0.5, repeat: 3 }}
                >
                  <Crown className="h-20 w-20 mx-auto text-purple-500" />
                </motion.div>
                <h3 className="text-3xl font-black text-purple-600 dark:text-purple-400" data-testid="text-result">
                  JACKPOT!!!
                </h3>
                <p className="text-xl font-bold text-foreground">
                  {isPractice 
                    ? "You hit the jackpot!"
                    : `You won ${currentWinnings.toLocaleString()} NGN!`
                  }
                </p>
              </div>
            ) : isBigWin ? (
              <div className="space-y-2">
                <motion.div
                  animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  <Crown className="h-16 w-16 mx-auto text-yellow-500" />
                </motion.div>
                <h3 className="text-2xl font-bold text-yellow-600 dark:text-yellow-400" data-testid="text-result">
                  Big Win! {winningSegment?.label}
                </h3>
                <p className="text-muted-foreground">
                  {isPractice 
                    ? `Amazing! You landed on ${winningSegment?.label}!`
                    : `You won ${currentWinnings.toLocaleString()} NGN!`
                  }
                </p>
              </div>
            ) : won ? (
              <div className="space-y-2">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.3 }}
                >
                  <Trophy className="h-16 w-16 mx-auto text-green-500" />
                </motion.div>
                <h3 className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-result">
                  You Win! {winningSegment?.label}
                </h3>
                <p className="text-muted-foreground">
                  {isPractice 
                    ? `Nice! You landed on ${winningSegment?.label}!`
                    : `You won ${currentWinnings.toLocaleString()} NGN!`
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="h-16 w-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                  <span className="text-3xl font-bold text-muted-foreground">1x</span>
                </div>
                <h3 className="text-2xl font-bold text-muted-foreground" data-testid="text-result">
                  Break Even
                </h3>
                <p className="text-muted-foreground">
                  {isPractice 
                    ? "You landed on 1x. Your stake is returned!"
                    : `You get back ${stake.toLocaleString()} NGN`
                  }
                </p>
              </div>
            )}
          </motion.div>

          <div className="flex items-center justify-center gap-2 p-4 bg-muted/30 rounded-md">
            <span className="text-sm font-medium">Result:</span>
            <Badge className={getMultiplierColor(winningSegment?.multiplier || 1)} data-testid="badge-result">
              {formatMultiplier(winningSegment?.multiplier || 1)}
            </Badge>
            {!isPractice && (
              <>
                <span className="text-muted-foreground mx-2">|</span>
                <span className="text-sm font-medium">Winnings:</span>
                <Badge variant="secondary" data-testid="badge-winnings">
                  {currentWinnings.toLocaleString()} NGN
                </Badge>
              </>
            )}
          </div>

          {spinHistory.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <History className="h-4 w-4 text-muted-foreground" />
                Recent Spins
              </div>
              <div className="flex flex-wrap gap-2">
                {spinHistory.slice(0, 8).map((item) => (
                  <Badge
                    key={item.id}
                    className={getMultiplierColor(item.multiplier)}
                    data-testid={`badge-history-result-${item.id}`}
                  >
                    {formatMultiplier(item.multiplier)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Button 
            onClick={resetGame} 
            className="w-full" 
            size="lg"
            data-testid="button-spin-again"
          >
            <RotateCcw className="h-5 w-5 mr-2" />
            Spin Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
