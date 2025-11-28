import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, 
  Timer, 
  Trophy, 
  Bot, 
  User, 
  RotateCcw, 
  Play,
  Target,
  Crosshair,
  AlertTriangle,
  Crown,
  Clock,
  Flame,
  Hand,
  Skull
} from "lucide-react";

interface QuickDrawGameProps {
  stake: number;
  onGameEnd: (won: boolean, score?: number) => void;
  isPractice: boolean;
}

type GamePhase = "ready" | "waiting" | "draw" | "finished";
type GameResult = "player_win" | "ai_win" | "player_false_start" | "ai_false_start" | null;

const generateAIReactionTime = (): number => {
  const randomValue = Math.random();
  
  if (randomValue < 0.05) {
    return Math.floor(Math.random() * 50) + 150;
  } else if (randomValue < 0.15) {
    return Math.floor(Math.random() * 50) + 200;
  } else if (randomValue < 0.70) {
    return Math.floor(Math.random() * 150) + 250;
  } else if (randomValue < 0.90) {
    return Math.floor(Math.random() * 150) + 400;
  } else {
    return Math.floor(Math.random() * 200) + 550;
  }
};

const generateRandomDelay = (): number => {
  return Math.floor(Math.random() * 7000) + 3000;
};

const getReactionRating = (time: number): { label: string; color: string; icon: typeof Zap } => {
  if (time < 200) return { label: "Lightning Fast", color: "text-yellow-500", icon: Zap };
  if (time < 250) return { label: "Blazing", color: "text-orange-500", icon: Flame };
  if (time < 300) return { label: "Quick", color: "text-green-500", icon: Target };
  if (time < 400) return { label: "Good", color: "text-blue-500", icon: Crosshair };
  if (time < 500) return { label: "Average", color: "text-cyan-500", icon: Timer };
  return { label: "Slow", color: "text-muted-foreground", icon: Clock };
};

const calculateScore = (reactionTime: number, won: boolean): number => {
  if (!won) return 0;
  const baseScore = 100;
  const timePenalty = Math.max(0, reactionTime - 150) / 5;
  return Math.round(Math.max(10, baseScore - timePenalty));
};

export default function QuickDrawGame({ stake, onGameEnd, isPractice }: QuickDrawGameProps) {
  const [gamePhase, setGamePhase] = useState<GamePhase>("ready");
  const [gameResult, setGameResult] = useState<GameResult>(null);
  const [playerReactionTime, setPlayerReactionTime] = useState<number | null>(null);
  const [aiReactionTime, setAIReactionTime] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [message, setMessage] = useState("Get ready for the duel!");
  const [drawStartTime, setDrawStartTime] = useState<number | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  
  const drawTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const aiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const gameStartedRef = useRef(false);
  const clickedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (drawTimeoutRef.current) {
        clearTimeout(drawTimeoutRef.current);
      }
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
      }
    };
  }, []);

  const startGame = useCallback(() => {
    setGamePhase("waiting");
    setMessage("Wait for it...");
    setCountdown(3);
    gameStartedRef.current = true;
    clickedRef.current = false;
    setPlayerReactionTime(null);
    setAIReactionTime(null);
    setGameResult(null);
    setDrawStartTime(null);
    
    const delay = generateRandomDelay();
    
    drawTimeoutRef.current = setTimeout(() => {
      if (clickedRef.current) return;
      
      setGamePhase("draw");
      setMessage("DRAW!");
      setShowFlash(true);
      const startTime = Date.now();
      setDrawStartTime(startTime);
      
      setTimeout(() => setShowFlash(false), 100);
      
      const aiTime = generateAIReactionTime();
      setAIReactionTime(aiTime);
      
      aiTimeoutRef.current = setTimeout(() => {
        if (!clickedRef.current) {
          const playerTime = Date.now() - startTime;
          setPlayerReactionTime(playerTime > 2000 ? 2000 : playerTime);
          setGameResult("ai_win");
          setGamePhase("finished");
          setMessage("Too slow! AI wins!");
          onGameEnd(false, 0);
        }
      }, aiTime);
    }, delay);
  }, [onGameEnd]);

  const handleClick = useCallback(() => {
    if (gamePhase === "ready") return;
    if (clickedRef.current) return;
    
    clickedRef.current = true;
    
    if (gamePhase === "waiting") {
      if (drawTimeoutRef.current) {
        clearTimeout(drawTimeoutRef.current);
      }
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
      }
      
      setGameResult("player_false_start");
      setGamePhase("finished");
      setMessage("False start! You clicked too early!");
      setPlayerReactionTime(null);
      onGameEnd(false, 0);
      return;
    }
    
    if (gamePhase === "draw" && drawStartTime) {
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
      }
      
      const reactionTime = Date.now() - drawStartTime;
      setPlayerReactionTime(reactionTime);
      
      const aiTime = aiReactionTime || generateAIReactionTime();
      setAIReactionTime(aiTime);
      
      if (reactionTime < aiTime) {
        setGameResult("player_win");
        setMessage("You won! Faster draw!");
        const score = calculateScore(reactionTime, true);
        onGameEnd(true, score);
      } else if (reactionTime === aiTime) {
        if (Math.random() > 0.5) {
          setGameResult("player_win");
          setMessage("Tie breaker - You won!");
          const score = calculateScore(reactionTime, true);
          onGameEnd(true, score);
        } else {
          setGameResult("ai_win");
          setMessage("Tie breaker - AI won!");
          onGameEnd(false, 0);
        }
      } else {
        setGameResult("ai_win");
        setMessage("AI was faster!");
        onGameEnd(false, 0);
      }
      
      setGamePhase("finished");
    }
  }, [gamePhase, drawStartTime, aiReactionTime, onGameEnd]);

  const resetGame = useCallback(() => {
    if (drawTimeoutRef.current) {
      clearTimeout(drawTimeoutRef.current);
    }
    if (aiTimeoutRef.current) {
      clearTimeout(aiTimeoutRef.current);
    }
    
    setGamePhase("ready");
    setGameResult(null);
    setPlayerReactionTime(null);
    setAIReactionTime(null);
    setMessage("Get ready for the duel!");
    setDrawStartTime(null);
    setShowFlash(false);
    gameStartedRef.current = false;
    clickedRef.current = false;
  }, []);

  const playerWon = gameResult === "player_win";
  const playerRating = playerReactionTime ? getReactionRating(playerReactionTime) : null;
  const aiRating = aiReactionTime ? getReactionRating(aiReactionTime) : null;

  if (gamePhase === "ready") {
    return (
      <div className="w-full max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl flex items-center gap-2">
              <Crosshair className="h-6 w-6 text-primary" />
              Quick Draw Duel
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
                  className="w-full h-full rounded-full bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 flex items-center justify-center shadow-lg"
                >
                  <Crosshair className="h-12 w-12 text-white" />
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
                <h3 className="text-lg font-semibold">Test Your Reflexes</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Wait for "DRAW!" to appear, then click as fast as you can!
                </p>
              </div>
            </motion.div>

            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-md space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  Rules
                </h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">1.</span>
                    <span>Wait for the "DRAW!" signal (3-10 seconds delay)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">2.</span>
                    <span>Click/tap as fast as you can when you see "DRAW!"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">3.</span>
                    <span>Clicking before "DRAW!" = instant loss (false start)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">4.</span>
                    <span>First to draw wins the duel!</span>
                  </li>
                </ul>
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
              data-testid="button-start-quickdraw"
            >
              <Play className="h-5 w-5 mr-2" />
              Start Duel
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (gamePhase === "waiting" || gamePhase === "draw") {
    return (
      <div className="w-full max-w-2xl mx-auto space-y-4">
        <Card className="relative overflow-visible">
          <AnimatePresence>
            {showFlash && (
              <motion.div
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
                className="absolute inset-0 bg-yellow-400 z-10 rounded-lg"
              />
            )}
          </AnimatePresence>
          
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="text-xl flex items-center gap-2">
                <Crosshair className="h-6 w-6 text-primary" />
                Quick Draw Duel
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge 
                  className={gamePhase === "draw" 
                    ? "bg-red-500/20 text-red-600 dark:text-red-400" 
                    : "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                  }
                  data-testid="badge-phase"
                >
                  {gamePhase === "draw" ? "DRAW!" : "Waiting..."}
                </Badge>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <motion.div
              className={`
                relative w-full aspect-video rounded-lg flex flex-col items-center justify-center cursor-pointer
                transition-colors duration-100
                ${gamePhase === "draw" 
                  ? "bg-gradient-to-br from-red-500 via-orange-500 to-yellow-500" 
                  : "bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 dark:from-gray-800 dark:via-gray-900 dark:to-black"
                }
              `}
              onClick={handleClick}
              whileTap={{ scale: 0.98 }}
              data-testid="draw-area"
            >
              <AnimatePresence mode="wait">
                {gamePhase === "waiting" && (
                  <motion.div
                    key="waiting"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="text-center space-y-4"
                  >
                    <motion.div
                      animate={{ 
                        scale: [1, 1.05, 1],
                        opacity: [0.5, 1, 0.5]
                      }}
                      transition={{ 
                        duration: 1.5, 
                        repeat: Infinity 
                      }}
                    >
                      <Hand className="h-16 w-16 mx-auto text-white/70" />
                    </motion.div>
                    <div className="space-y-2">
                      <p className="text-2xl font-bold text-white" data-testid="text-waiting">
                        Wait for it...
                      </p>
                      <p className="text-sm text-white/60">
                        Don't click yet!
                      </p>
                    </div>
                  </motion.div>
                )}
                
                {gamePhase === "draw" && (
                  <motion.div
                    key="draw"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    className="text-center space-y-4"
                  >
                    <motion.div
                      animate={{ 
                        rotate: [0, -10, 10, -10, 0],
                        scale: [1, 1.1, 1]
                      }}
                      transition={{ 
                        duration: 0.3,
                        repeat: Infinity,
                        repeatDelay: 0.5
                      }}
                    >
                      <Crosshair className="h-20 w-20 mx-auto text-white drop-shadow-lg" />
                    </motion.div>
                    <motion.p 
                      className="text-5xl font-black text-white drop-shadow-lg"
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 0.2, repeat: Infinity }}
                      data-testid="text-draw"
                    >
                      DRAW!
                    </motion.p>
                    <p className="text-lg text-white/90 font-medium">
                      Click NOW!
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted/30 rounded-md text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <User className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">You</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {gamePhase === "waiting" ? "Waiting..." : "Click to draw!"}
                </p>
              </div>
              <div className="p-3 bg-muted/30 rounded-md text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Bot className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium">AI</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {gamePhase === "waiting" ? "Ready..." : "Drawing..."}
                </p>
              </div>
            </div>
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
            Duel Complete!
            {gameResult === "player_false_start" && (
              <Badge className="ml-2 bg-red-500/20 text-red-600">False Start</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            {playerWon ? (
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
                <p className="text-muted-foreground">
                  {isPractice 
                    ? "Lightning reflexes! You beat the AI."
                    : `You earned ${Math.round(stake * 1.9).toLocaleString()} NGN!`
                  }
                </p>
              </div>
            ) : gameResult === "player_false_start" ? (
              <div className="space-y-2">
                <Skull className="h-16 w-16 mx-auto text-red-500" />
                <h3 className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-result">
                  False Start!
                </h3>
                <p className="text-muted-foreground">
                  {isPractice 
                    ? "You clicked before 'DRAW!' appeared. Patience is key!"
                    : `You lost ${stake.toLocaleString()} NGN. Don't jump the gun!`
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Bot className="h-16 w-16 mx-auto text-muted-foreground" />
                <h3 className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-result">
                  AI Wins
                </h3>
                <p className="text-muted-foreground">
                  {isPractice 
                    ? "The AI was faster this time. Keep practicing!"
                    : `You lost ${stake.toLocaleString()} NGN. Better luck next time!`
                  }
                </p>
              </div>
            )}
          </motion.div>

          <div className="grid grid-cols-2 gap-4">
            <Card className={`p-4 ${playerWon ? 'ring-2 ring-green-500' : ''}`}>
              <div className="flex items-center gap-2 mb-3">
                <User className="h-5 w-5 text-blue-500" />
                <span className="font-medium">You</span>
                {playerWon && (
                  <Badge className="ml-auto bg-green-500/20 text-green-600">Winner</Badge>
                )}
              </div>
              {gameResult === "player_false_start" ? (
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-red-500">FALSE START</p>
                  <p className="text-xs text-muted-foreground">Disqualified</p>
                </div>
              ) : playerReactionTime !== null ? (
                <div className="space-y-1">
                  <p className="text-2xl font-bold" data-testid="text-player-time">
                    {playerReactionTime}ms
                  </p>
                  {playerRating && (
                    <div className={`flex items-center gap-1 ${playerRating.color}`}>
                      <playerRating.icon className="h-3 w-3" />
                      <span className="text-xs">{playerRating.label}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xl text-muted-foreground">--</p>
              )}
            </Card>
            
            <Card className={`p-4 ${!playerWon && gameResult !== "player_false_start" ? 'ring-2 ring-purple-500' : ''}`}>
              <div className="flex items-center gap-2 mb-3">
                <Bot className="h-5 w-5 text-purple-500" />
                <span className="font-medium">AI</span>
                {!playerWon && gameResult !== "player_false_start" && (
                  <Badge className="ml-auto bg-purple-500/20 text-purple-600">Winner</Badge>
                )}
              </div>
              {aiReactionTime !== null ? (
                <div className="space-y-1">
                  <p className="text-2xl font-bold" data-testid="text-ai-time">
                    {aiReactionTime}ms
                  </p>
                  {aiRating && (
                    <div className={`flex items-center gap-1 ${aiRating.color}`}>
                      <aiRating.icon className="h-3 w-3" />
                      <span className="text-xs">{aiRating.label}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xl text-muted-foreground">--</p>
              )}
            </Card>
          </div>

          {playerReactionTime !== null && aiReactionTime !== null && gameResult !== "player_false_start" && (
            <div className="p-4 bg-muted/50 rounded-md">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Time Difference</span>
                <span className={`font-bold ${playerWon ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {playerWon ? '-' : '+'}{Math.abs(playerReactionTime - aiReactionTime)}ms
                </span>
              </div>
            </div>
          )}

          {!isPractice && (
            <div className="p-4 bg-primary/10 rounded-md">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium">Result</span>
                <span className={`font-bold ${playerWon ? 'text-green-600' : 'text-red-600'}`}>
                  {playerWon ? `+${Math.round(stake * 0.9).toLocaleString()}` : `-${stake.toLocaleString()}`} NGN
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button 
              onClick={resetGame} 
              variant="outline" 
              className="flex-1"
              data-testid="button-play-again"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Play Again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
