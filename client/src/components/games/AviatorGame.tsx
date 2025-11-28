import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Plane, 
  Rocket, 
  Trophy, 
  Bot, 
  User, 
  RotateCcw, 
  Play,
  TrendingUp,
  Zap,
  AlertTriangle,
  Crown,
  Flame,
  Target,
  History,
  DollarSign,
  Timer,
  X,
  Check
} from "lucide-react";

interface AviatorGameProps {
  stake: number;
  onGameEnd: (won: boolean, score?: number) => void;
  isPractice: boolean;
}

type GamePhase = "betting" | "flying" | "crashed" | "cashed_out";

interface CrashHistoryItem {
  id: number;
  crashPoint: number;
  timestamp: number;
}

const generateSecureCrashPoint = (): number => {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const randomValue = array[0] / 0x100000000;
  
  const houseEdge = 0.03;
  const crashPoint = (1 - houseEdge) / (1 - randomValue);
  
  return Math.max(1.0, Math.min(crashPoint, 1000));
};

const formatMultiplier = (value: number): string => {
  return value.toFixed(2) + "x";
};

const getCrashPointColor = (crashPoint: number): string => {
  if (crashPoint < 1.5) return "bg-red-500/20 text-red-600 dark:text-red-400";
  if (crashPoint < 2.0) return "bg-orange-500/20 text-orange-600 dark:text-orange-400";
  if (crashPoint < 3.0) return "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400";
  if (crashPoint < 5.0) return "bg-green-500/20 text-green-600 dark:text-green-400";
  if (crashPoint < 10.0) return "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400";
  return "bg-purple-500/20 text-purple-600 dark:text-purple-400";
};

const getMultiplierColor = (multiplier: number): string => {
  if (multiplier < 1.5) return "text-foreground";
  if (multiplier < 2.0) return "text-yellow-500";
  if (multiplier < 3.0) return "text-orange-500";
  if (multiplier < 5.0) return "text-green-500";
  if (multiplier < 10.0) return "text-emerald-500";
  return "text-purple-500";
};

const calculatePotentialWinnings = (stake: number, multiplier: number): number => {
  return Math.round(stake * multiplier);
};

export default function AviatorGame({ stake, onGameEnd, isPractice }: AviatorGameProps) {
  const [gamePhase, setGamePhase] = useState<GamePhase>("betting");
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState<number | null>(null);
  const [cashedOutAt, setCashedOutAt] = useState<number | null>(null);
  const [autoCashoutEnabled, setAutoCashoutEnabled] = useState(false);
  const [autoCashoutTarget, setAutoCashoutTarget] = useState("2.00");
  const [crashHistory, setCrashHistory] = useState<CrashHistoryItem[]>([]);
  const [flightPath, setFlightPath] = useState<{ x: number; y: number }[]>([]);
  const [showExplosion, setShowExplosion] = useState(false);
  
  const animationFrameRef = useRef<number | null>(null);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const crashPointRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (gameLoopRef.current) {
        clearTimeout(gameLoopRef.current);
      }
    };
  }, []);

  const startGame = useCallback(() => {
    const newCrashPoint = generateSecureCrashPoint();
    setCrashPoint(newCrashPoint);
    crashPointRef.current = newCrashPoint;
    setCurrentMultiplier(1.0);
    setCashedOutAt(null);
    setShowExplosion(false);
    setFlightPath([{ x: 0, y: 0 }]);
    setGamePhase("flying");
    startTimeRef.current = Date.now();
    
    const updateMultiplier = () => {
      if (!startTimeRef.current || !crashPointRef.current) return;
      
      const elapsed = Date.now() - startTimeRef.current;
      const growthRate = 0.00006;
      const newMultiplier = Math.exp(growthRate * elapsed);
      
      if (newMultiplier >= crashPointRef.current) {
        setCurrentMultiplier(crashPointRef.current);
        setGamePhase("crashed");
        setShowExplosion(true);
        
        setCrashHistory(prev => {
          const newHistory = [
            { 
              id: Date.now(), 
              crashPoint: crashPointRef.current!, 
              timestamp: Date.now() 
            },
            ...prev
          ].slice(0, 10);
          return newHistory;
        });
        
        onGameEnd(false, 0);
        return;
      }
      
      setCurrentMultiplier(newMultiplier);
      
      setFlightPath(prev => {
        const x = Math.min(100, (elapsed / 100) * 2);
        const y = Math.min(100, (newMultiplier - 1) * 20);
        return [...prev, { x, y }].slice(-50);
      });
      
      if (autoCashoutEnabled) {
        const targetMultiplier = parseFloat(autoCashoutTarget);
        if (!isNaN(targetMultiplier) && newMultiplier >= targetMultiplier) {
          handleCashOut(newMultiplier);
          return;
        }
      }
      
      animationFrameRef.current = requestAnimationFrame(updateMultiplier);
    };
    
    animationFrameRef.current = requestAnimationFrame(updateMultiplier);
  }, [autoCashoutEnabled, autoCashoutTarget, onGameEnd]);

  const handleCashOut = useCallback((multiplierAtCashout?: number) => {
    if (gamePhase !== "flying") return;
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    const finalMultiplier = multiplierAtCashout || currentMultiplier;
    setCashedOutAt(finalMultiplier);
    setGamePhase("cashed_out");
    
    const winnings = calculatePotentialWinnings(stake, finalMultiplier);
    onGameEnd(true, winnings);
  }, [gamePhase, currentMultiplier, stake, onGameEnd]);

  const resetGame = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (gameLoopRef.current) {
      clearTimeout(gameLoopRef.current);
    }
    
    setGamePhase("betting");
    setCurrentMultiplier(1.0);
    setCrashPoint(null);
    crashPointRef.current = null;
    setCashedOutAt(null);
    setShowExplosion(false);
    setFlightPath([]);
    startTimeRef.current = null;
  }, []);

  const potentialWinnings = calculatePotentialWinnings(stake, currentMultiplier);

  if (gamePhase === "betting") {
    return (
      <div className="w-full max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl flex items-center gap-2">
              <Rocket className="h-6 w-6 text-primary" />
              Aviator
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
                    y: [-5, 5, -5],
                    rotate: [0, 5, -5, 0]
                  }}
                  transition={{ 
                    duration: 3, 
                    repeat: Infinity,
                    repeatType: "reverse"
                  }}
                  className="w-full h-full rounded-full bg-gradient-to-br from-red-500 via-orange-500 to-yellow-500 flex items-center justify-center shadow-lg"
                >
                  <Plane className="h-12 w-12 text-white -rotate-45" />
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
                  className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-green-400 flex items-center justify-center"
                >
                  <TrendingUp className="h-4 w-4 text-green-800" />
                </motion.div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold">Take Off Before It Crashes</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Watch the multiplier rise and cash out before the plane flies away!
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
                    <span>Place your bet and watch the multiplier rise</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">2.</span>
                    <span>Cash out anytime to secure your winnings</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">3.</span>
                    <span>If the plane crashes before you cash out, you lose!</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">4.</span>
                    <span>Higher multipliers = bigger wins, but higher risk!</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-3 p-4 bg-muted/30 rounded-md">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="auto-cashout" className="text-sm">Auto Cash Out</Label>
                  </div>
                  <Switch
                    id="auto-cashout"
                    checked={autoCashoutEnabled}
                    onCheckedChange={setAutoCashoutEnabled}
                    data-testid="switch-auto-cashout"
                  />
                </div>
                
                <AnimatePresence>
                  {autoCashoutEnabled && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2"
                    >
                      <Label htmlFor="target-multiplier" className="text-xs text-muted-foreground">
                        Target Multiplier
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="target-multiplier"
                          type="number"
                          step="0.1"
                          min="1.1"
                          max="100"
                          value={autoCashoutTarget}
                          onChange={(e) => setAutoCashoutTarget(e.target.value)}
                          className="w-24"
                          data-testid="input-auto-cashout-target"
                        />
                        <span className="text-sm text-muted-foreground">x</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {crashHistory.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <History className="h-4 w-4 text-muted-foreground" />
                    Recent Crashes
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {crashHistory.slice(0, 8).map((item) => (
                      <Badge
                        key={item.id}
                        className={getCrashPointColor(item.crashPoint)}
                        data-testid={`badge-history-${item.id}`}
                      >
                        {formatMultiplier(item.crashPoint)}
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
              onClick={startGame} 
              className="w-full" 
              size="lg"
              data-testid="button-start-aviator"
            >
              <Play className="h-5 w-5 mr-2" />
              Place Bet & Take Off
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (gamePhase === "flying") {
    return (
      <div className="w-full max-w-2xl mx-auto space-y-4">
        <Card className="overflow-visible">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="text-xl flex items-center gap-2">
                <Rocket className="h-6 w-6 text-primary" />
                Aviator
              </CardTitle>
              <Badge className="bg-green-500/20 text-green-600 dark:text-green-400" data-testid="badge-flying">
                <Plane className="h-3 w-3 mr-1 -rotate-45" />
                Flying...
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div 
              className="relative w-full aspect-video rounded-lg bg-gradient-to-br from-sky-900 via-sky-700 to-sky-500 dark:from-sky-950 dark:via-sky-900 dark:to-sky-800 overflow-hidden"
              data-testid="flight-area"
            >
              <div className="absolute inset-0">
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1 h-1 bg-white rounded-full opacity-50"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                    }}
                    animate={{
                      x: [-10, -50],
                      opacity: [0.5, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: Math.random() * 2,
                    }}
                  />
                ))}
              </div>
              
              <svg className="absolute inset-0 w-full h-full">
                <defs>
                  <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(34, 197, 94, 0.3)" />
                    <stop offset="100%" stopColor="rgba(34, 197, 94, 0.8)" />
                  </linearGradient>
                </defs>
                <motion.path
                  d={flightPath.length > 1 
                    ? `M ${flightPath.map(p => `${p.x}% ${100 - p.y}%`).join(" L ")}` 
                    : "M 0% 100%"
                  }
                  fill="none"
                  stroke="url(#pathGradient)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>

              <motion.div
                className="absolute"
                style={{
                  left: `${Math.min(85, flightPath[flightPath.length - 1]?.x || 0)}%`,
                  bottom: `${Math.min(85, flightPath[flightPath.length - 1]?.y || 0)}%`,
                }}
                animate={{
                  y: [-2, 2, -2],
                }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                }}
              >
                <div className="relative">
                  <motion.div
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  >
                    <Plane className="h-10 w-10 text-white drop-shadow-lg -rotate-45" />
                  </motion.div>
                  <motion.div
                    className="absolute -bottom-2 -left-2 w-8 h-4"
                    animate={{ opacity: [1, 0.5, 1], scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.2, repeat: Infinity }}
                  >
                    <div className="w-full h-full bg-gradient-to-l from-orange-500 to-transparent rounded-full blur-sm" />
                  </motion.div>
                </div>
              </motion.div>

              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  className="text-center"
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                >
                  <motion.p
                    className={`text-6xl font-black drop-shadow-lg ${getMultiplierColor(currentMultiplier)}`}
                    data-testid="text-multiplier"
                  >
                    {formatMultiplier(currentMultiplier)}
                  </motion.p>
                  {autoCashoutEnabled && (
                    <p className="text-sm text-white/70 mt-2">
                      Auto: {autoCashoutTarget}x
                    </p>
                  )}
                </motion.div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/30 rounded-md text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Potential Win</span>
                </div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-potential-win">
                  {potentialWinnings.toLocaleString()} NGN
                </p>
              </div>
              <div className="p-4 bg-muted/30 rounded-md text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Current Multiplier</span>
                </div>
                <p className={`text-2xl font-bold ${getMultiplierColor(currentMultiplier)}`}>
                  {formatMultiplier(currentMultiplier)}
                </p>
              </div>
            </div>

            <Button 
              onClick={() => handleCashOut()} 
              className="w-full bg-green-600 hover:bg-green-700" 
              size="lg"
              data-testid="button-cash-out"
            >
              <Zap className="h-5 w-5 mr-2" />
              Cash Out @ {formatMultiplier(currentMultiplier)} ({potentialWinnings.toLocaleString()} NGN)
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-xl flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Flight Complete!
            {gamePhase === "crashed" && (
              <Badge className="ml-2 bg-red-500/20 text-red-600 dark:text-red-400" data-testid="badge-crashed">
                Crashed @ {crashPoint ? formatMultiplier(crashPoint) : "---"}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <AnimatePresence>
            {showExplosion && gamePhase === "crashed" && (
              <motion.div
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: 2, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <div className="w-32 h-32 bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 rounded-full blur-xl" />
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            {gamePhase === "cashed_out" ? (
              <div className="space-y-2">
                <motion.div
                  animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  <Crown className="h-16 w-16 mx-auto text-yellow-500" />
                </motion.div>
                <h3 className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-result">
                  You Cashed Out!
                </h3>
                <p className="text-muted-foreground">
                  {isPractice 
                    ? `Great timing! You cashed out at ${formatMultiplier(cashedOutAt || 1)}`
                    : `You won ${calculatePotentialWinnings(stake, cashedOutAt || 1).toLocaleString()} NGN!`
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
                  Crashed!
                </h3>
                <p className="text-muted-foreground">
                  {isPractice 
                    ? `The plane crashed at ${formatMultiplier(crashPoint || 1)}. Better luck next time!`
                    : `You lost ${stake.toLocaleString()} NGN. The plane crashed at ${formatMultiplier(crashPoint || 1)}`
                  }
                </p>
              </div>
            )}
          </motion.div>

          <div className="grid grid-cols-2 gap-4">
            <Card className={`p-4 ${gamePhase === "cashed_out" ? 'ring-2 ring-green-500' : ''}`}>
              <div className="flex items-center gap-2 mb-3">
                <User className="h-5 w-5 text-blue-500" />
                <span className="font-medium">Your Result</span>
                {gamePhase === "cashed_out" && (
                  <Badge className="ml-auto bg-green-500/20 text-green-600">
                    <Check className="h-3 w-3 mr-1" />
                    Win
                  </Badge>
                )}
              </div>
              {gamePhase === "cashed_out" && cashedOutAt ? (
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-cashout-multiplier">
                    {formatMultiplier(cashedOutAt)}
                  </p>
                  <p className="text-sm text-green-600">
                    +{calculatePotentialWinnings(stake, cashedOutAt).toLocaleString()} NGN
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-red-500" data-testid="text-lost">
                    {formatMultiplier(crashPoint || 1)}
                  </p>
                  <p className="text-sm text-red-500">
                    -{stake.toLocaleString()} NGN
                  </p>
                </div>
              )}
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Flame className="h-5 w-5 text-orange-500" />
                <span className="font-medium">Crash Point</span>
              </div>
              <div className="space-y-1">
                <p className={`text-2xl font-bold ${getCrashPointColor(crashPoint || 1).replace('bg-', 'text-').replace('/20', '')}`} data-testid="text-crash-point">
                  {formatMultiplier(crashPoint || 1)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {crashPoint && crashPoint >= 2 ? "Good run!" : "Early crash"}
                </p>
              </div>
            </Card>
          </div>

          {crashHistory.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <History className="h-4 w-4 text-muted-foreground" />
                Recent Crashes
              </div>
              <div className="flex flex-wrap gap-2">
                {crashHistory.slice(0, 10).map((item) => (
                  <Badge
                    key={item.id}
                    className={getCrashPointColor(item.crashPoint)}
                    data-testid={`badge-history-${item.id}`}
                  >
                    {formatMultiplier(item.crashPoint)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button 
              onClick={resetGame} 
              variant="outline"
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
