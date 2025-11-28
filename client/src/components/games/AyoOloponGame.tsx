import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  RotateCcw, 
  Trophy, 
  Bot, 
  User, 
  Play,
  Circle,
  Crown,
  Sparkles,
  Target,
  Hand,
  Home
} from "lucide-react";

interface AyoOloponGameProps {
  stake: number;
  onGameEnd: (won: boolean, score?: number) => void;
  isPractice: boolean;
}

type Player = "player" | "ai";
type GamePhase = "ready" | "playing" | "animating" | "finished";

interface GameState {
  pits: number[];
  playerStore: number;
  aiStore: number;
  currentPlayer: Player;
}

const PITS_PER_SIDE = 6;
const INITIAL_SEEDS = 4;
const TOTAL_PITS = PITS_PER_SIDE * 2;

const createInitialState = (): GameState => ({
  pits: Array(TOTAL_PITS).fill(INITIAL_SEEDS),
  playerStore: 0,
  aiStore: 0,
  currentPlayer: "player",
});

const Pit = ({
  seeds,
  index,
  isPlayable,
  isHighlighted,
  onClick,
  isPlayerSide,
  isAnimating,
}: {
  seeds: number;
  index: number;
  isPlayable: boolean;
  isHighlighted: boolean;
  onClick?: () => void;
  isPlayerSide: boolean;
  isAnimating?: boolean;
}) => {
  return (
    <motion.button
      className={`
        relative w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 
        flex items-center justify-center
        transition-all duration-200
        ${isPlayable 
          ? 'cursor-pointer border-primary ring-2 ring-primary/30' 
          : 'cursor-default border-muted-foreground/30'
        }
        ${isHighlighted ? 'ring-4 ring-yellow-500/50 border-yellow-500' : ''}
        ${isPlayerSide 
          ? 'bg-amber-900/30 dark:bg-amber-800/20' 
          : 'bg-emerald-900/30 dark:bg-emerald-800/20'
        }
      `}
      onClick={isPlayable ? onClick : undefined}
      whileHover={isPlayable ? { scale: 1.1 } : {}}
      whileTap={isPlayable ? { scale: 0.95 } : {}}
      data-testid={`pit-${index}`}
      disabled={!isPlayable}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={seeds}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="flex flex-col items-center"
        >
          <div className="flex flex-wrap justify-center gap-0.5 max-w-[40px]">
            {seeds <= 8 ? (
              [...Array(seeds)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={isAnimating ? { scale: 0, y: -20 } : {}}
                  animate={{ scale: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`w-2 h-2 rounded-full ${
                    isPlayerSide 
                      ? 'bg-amber-500 dark:bg-amber-400' 
                      : 'bg-emerald-500 dark:bg-emerald-400'
                  }`}
                />
              ))
            ) : (
              <span className={`text-lg font-bold ${
                isPlayerSide 
                  ? 'text-amber-600 dark:text-amber-400' 
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}>
                {seeds}
              </span>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
      
      {isPlayable && (
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-primary"
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.2, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
    </motion.button>
  );
};

const Store = ({
  seeds,
  player,
  isActive,
}: {
  seeds: number;
  player: Player;
  isActive: boolean;
}) => {
  const isPlayerStore = player === "player";
  
  return (
    <motion.div
      className={`
        relative w-16 h-28 sm:w-20 sm:h-32 rounded-full border-2
        flex flex-col items-center justify-center gap-1
        ${isActive ? 'border-primary ring-2 ring-primary/30' : 'border-muted-foreground/30'}
        ${isPlayerStore 
          ? 'bg-amber-900/40 dark:bg-amber-800/30' 
          : 'bg-emerald-900/40 dark:bg-emerald-800/30'
        }
      `}
      animate={isActive ? { scale: [1, 1.02, 1] } : {}}
      transition={{ duration: 1, repeat: isActive ? Infinity : 0 }}
      data-testid={`store-${player}`}
    >
      <div className="flex items-center gap-1 mb-1">
        {isPlayerStore ? (
          <User className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        ) : (
          <Bot className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        )}
      </div>
      
      <AnimatePresence mode="wait">
        <motion.span
          key={seeds}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          className={`text-2xl sm:text-3xl font-bold ${
            isPlayerStore 
              ? 'text-amber-600 dark:text-amber-400' 
              : 'text-emerald-600 dark:text-emerald-400'
          }`}
        >
          {seeds}
        </motion.span>
      </AnimatePresence>
      
      <span className="text-[10px] text-muted-foreground">
        {isPlayerStore ? "You" : "AI"}
      </span>
    </motion.div>
  );
};

const Board = ({
  gameState,
  currentPlayer,
  onPitClick,
  isAnimating,
  lastMovedPit,
}: {
  gameState: GameState;
  currentPlayer: Player;
  onPitClick: (index: number) => void;
  isAnimating: boolean;
  lastMovedPit: number | null;
}) => {
  const getPlayablePits = (): number[] => {
    if (isAnimating || currentPlayer !== "player") return [];
    
    const playable: number[] = [];
    for (let i = 0; i < PITS_PER_SIDE; i++) {
      if (gameState.pits[i] > 0) {
        playable.push(i);
      }
    }
    return playable;
  };
  
  const playablePits = getPlayablePits();
  
  const aiPits = gameState.pits.slice(PITS_PER_SIDE).reverse();
  const aiPitIndices = [...Array(PITS_PER_SIDE)].map((_, i) => TOTAL_PITS - 1 - i);
  
  const playerPits = gameState.pits.slice(0, PITS_PER_SIDE);
  const playerPitIndices = [...Array(PITS_PER_SIDE)].map((_, i) => i);
  
  return (
    <div className="flex items-center justify-center gap-3 sm:gap-4 p-4 bg-gradient-to-br from-amber-950/20 via-background to-emerald-950/20 rounded-xl border-2 border-muted" data-testid="game-board">
      <Store 
        seeds={gameState.aiStore} 
        player="ai" 
        isActive={currentPlayer === "ai" && !isAnimating}
      />
      
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex gap-2 sm:gap-3">
          {aiPits.map((seeds, visualIndex) => {
            const actualIndex = aiPitIndices[visualIndex];
            return (
              <Pit
                key={actualIndex}
                seeds={seeds}
                index={actualIndex}
                isPlayable={false}
                isHighlighted={lastMovedPit === actualIndex}
                isPlayerSide={false}
                isAnimating={isAnimating && lastMovedPit === actualIndex}
              />
            );
          })}
        </div>
        
        <div className="flex gap-2 sm:gap-3">
          {playerPits.map((seeds, visualIndex) => {
            const actualIndex = playerPitIndices[visualIndex];
            return (
              <Pit
                key={actualIndex}
                seeds={seeds}
                index={actualIndex}
                isPlayable={playablePits.includes(actualIndex)}
                isHighlighted={lastMovedPit === actualIndex}
                onClick={() => onPitClick(actualIndex)}
                isPlayerSide={true}
                isAnimating={isAnimating && lastMovedPit === actualIndex}
              />
            );
          })}
        </div>
      </div>
      
      <Store 
        seeds={gameState.playerStore} 
        player="player" 
        isActive={currentPlayer === "player" && !isAnimating}
      />
    </div>
  );
};

const sowSeeds = (
  state: GameState,
  pitIndex: number,
  player: Player
): { newState: GameState; captured: number; endsInStore: boolean; lastPit: number } => {
  const newState: GameState = {
    pits: [...state.pits],
    playerStore: state.playerStore,
    aiStore: state.aiStore,
    currentPlayer: state.currentPlayer,
  };
  
  let seeds = newState.pits[pitIndex];
  newState.pits[pitIndex] = 0;
  
  let currentIndex = pitIndex;
  let captured = 0;
  let endsInStore = false;
  let lastPit = pitIndex;
  
  const playerStorePosition = PITS_PER_SIDE;
  const aiStorePosition = TOTAL_PITS + 1;
  
  while (seeds > 0) {
    currentIndex++;
    
    if (currentIndex === TOTAL_PITS) {
      if (player === "player") {
        newState.playerStore++;
        seeds--;
        if (seeds === 0) {
          endsInStore = true;
          lastPit = -1;
        }
        continue;
      }
      currentIndex = 0;
    }
    
    if (player === "ai" && currentIndex === 0 && seeds > 0) {
      newState.aiStore++;
      seeds--;
      if (seeds === 0) {
        endsInStore = true;
        lastPit = -2;
      }
      if (seeds === 0) continue;
    }
    
    if (currentIndex >= TOTAL_PITS) {
      currentIndex = 0;
    }
    
    if (seeds > 0) {
      newState.pits[currentIndex]++;
      seeds--;
      lastPit = currentIndex;
    }
  }
  
  if (!endsInStore && lastPit >= 0) {
    const isPlayerSide = lastPit < PITS_PER_SIDE;
    const isAiSide = lastPit >= PITS_PER_SIDE;
    
    if (player === "player" && isAiSide) {
      const finalSeeds = newState.pits[lastPit];
      if (finalSeeds === 2 || finalSeeds === 3) {
        captured = finalSeeds;
        newState.playerStore += finalSeeds;
        newState.pits[lastPit] = 0;
        
        let checkPit = lastPit - 1;
        while (checkPit >= PITS_PER_SIDE) {
          const pitSeeds = newState.pits[checkPit];
          if (pitSeeds === 2 || pitSeeds === 3) {
            captured += pitSeeds;
            newState.playerStore += pitSeeds;
            newState.pits[checkPit] = 0;
            checkPit--;
          } else {
            break;
          }
        }
      }
    } else if (player === "ai" && isPlayerSide) {
      const finalSeeds = newState.pits[lastPit];
      if (finalSeeds === 2 || finalSeeds === 3) {
        captured = finalSeeds;
        newState.aiStore += finalSeeds;
        newState.pits[lastPit] = 0;
        
        let checkPit = lastPit + 1;
        while (checkPit < PITS_PER_SIDE) {
          const pitSeeds = newState.pits[checkPit];
          if (pitSeeds === 2 || pitSeeds === 3) {
            captured += pitSeeds;
            newState.aiStore += pitSeeds;
            newState.pits[checkPit] = 0;
            checkPit++;
          } else {
            break;
          }
        }
      }
    }
  }
  
  return { newState, captured, endsInStore, lastPit };
};

const checkGameEnd = (state: GameState): boolean => {
  const playerSideEmpty = state.pits.slice(0, PITS_PER_SIDE).every(p => p === 0);
  const aiSideEmpty = state.pits.slice(PITS_PER_SIDE).every(p => p === 0);
  return playerSideEmpty || aiSideEmpty;
};

const collectRemainingSeeds = (state: GameState): GameState => {
  const newState = { ...state, pits: [...state.pits] };
  
  const playerSideSeeds = newState.pits.slice(0, PITS_PER_SIDE).reduce((a, b) => a + b, 0);
  const aiSideSeeds = newState.pits.slice(PITS_PER_SIDE).reduce((a, b) => a + b, 0);
  
  newState.playerStore += playerSideSeeds;
  newState.aiStore += aiSideSeeds;
  
  for (let i = 0; i < TOTAL_PITS; i++) {
    newState.pits[i] = 0;
  }
  
  return newState;
};

const evaluateMove = (state: GameState, pitIndex: number, player: Player): number => {
  const result = sowSeeds(state, pitIndex, player);
  let score = 0;
  
  score += result.captured * 10;
  
  if (result.endsInStore) {
    score += 15;
  }
  
  if (player === "ai") {
    score += result.newState.aiStore - state.aiStore;
    
    const aiSideSeeds = result.newState.pits.slice(PITS_PER_SIDE).reduce((a, b) => a + b, 0);
    score += aiSideSeeds * 0.5;
  }
  
  return score;
};

const getAiMove = (state: GameState): number => {
  const validMoves: number[] = [];
  for (let i = PITS_PER_SIDE; i < TOTAL_PITS; i++) {
    if (state.pits[i] > 0) {
      validMoves.push(i);
    }
  }
  
  if (validMoves.length === 0) return -1;
  
  let bestMove = validMoves[0];
  let bestScore = -Infinity;
  
  for (const move of validMoves) {
    const score = evaluateMove(state, move, "ai");
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  
  if (bestScore <= 0 && Math.random() < 0.2) {
    return validMoves[Math.floor(Math.random() * validMoves.length)];
  }
  
  return bestMove;
};

export default function AyoOloponGame({ stake, onGameEnd, isPractice }: AyoOloponGameProps) {
  const [gamePhase, setGamePhase] = useState<GamePhase>("ready");
  const [gameState, setGameState] = useState<GameState>(createInitialState());
  const [currentPlayer, setCurrentPlayer] = useState<Player>("player");
  const [message, setMessage] = useState("Click a pit to sow seeds!");
  const [winner, setWinner] = useState<Player | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [lastMovedPit, setLastMovedPit] = useState<number | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  
  const aiTurnRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const startGame = useCallback(() => {
    setGameState(createInitialState());
    setCurrentPlayer("player");
    setGamePhase("playing");
    setMessage("Your turn! Click a pit to sow seeds.");
    setWinner(null);
    setIsAnimating(false);
    setLastMovedPit(null);
    aiTurnRef.current = false;
  }, []);

  const endGame = useCallback((finalState: GameState) => {
    const collectedState = collectRemainingSeeds(finalState);
    setGameState(collectedState);
    setGamePhase("finished");
    
    const playerTotal = collectedState.playerStore;
    const aiTotal = collectedState.aiStore;
    
    if (playerTotal > aiTotal) {
      setWinner("player");
      setMessage(`You win! ${playerTotal} vs ${aiTotal}`);
      onGameEnd(true, playerTotal * 10);
    } else if (aiTotal > playerTotal) {
      setWinner("ai");
      setMessage(`AI wins! ${aiTotal} vs ${playerTotal}`);
      onGameEnd(false, 0);
    } else {
      setWinner(null);
      setMessage(`It's a tie! ${playerTotal} vs ${aiTotal}`);
      onGameEnd(false, playerTotal * 5);
    }
  }, [onGameEnd]);

  const makeMove = useCallback((pitIndex: number, player: Player) => {
    if (gameState.pits[pitIndex] === 0) return;
    
    setIsAnimating(true);
    setLastMovedPit(pitIndex);
    
    const result = sowSeeds(gameState, pitIndex, player);
    
    timeoutRef.current = setTimeout(() => {
      setGameState(result.newState);
      setLastMovedPit(result.lastPit >= 0 ? result.lastPit : null);
      
      if (result.captured > 0) {
        setMessage(`${player === "player" ? "You" : "AI"} captured ${result.captured} seeds!`);
      }
      
      timeoutRef.current = setTimeout(() => {
        setIsAnimating(false);
        
        if (checkGameEnd(result.newState)) {
          endGame(result.newState);
          return;
        }
        
        if (result.endsInStore) {
          setMessage(`${player === "player" ? "You get" : "AI gets"} another turn!`);
          if (player === "ai") {
            aiTurnRef.current = true;
          }
        } else {
          const nextPlayer = player === "player" ? "ai" : "player";
          setCurrentPlayer(nextPlayer);
          
          if (nextPlayer === "player") {
            setMessage("Your turn! Click a pit to sow seeds.");
          } else {
            setMessage("AI is thinking...");
            aiTurnRef.current = true;
          }
        }
      }, 300);
    }, 600);
  }, [gameState, endGame]);

  const handlePitClick = useCallback((pitIndex: number) => {
    if (gamePhase !== "playing" || isAnimating) return;
    if (currentPlayer !== "player") return;
    if (pitIndex >= PITS_PER_SIDE) return;
    if (gameState.pits[pitIndex] === 0) return;
    
    makeMove(pitIndex, "player");
  }, [gamePhase, isAnimating, currentPlayer, gameState.pits, makeMove]);

  useEffect(() => {
    if (gamePhase !== "playing") return;
    if (isAnimating) return;
    if (currentPlayer !== "ai") return;
    
    if (!aiTurnRef.current) {
      aiTurnRef.current = true;
    }
    
    setIsAiThinking(true);
    
    timeoutRef.current = setTimeout(() => {
      const aiMove = getAiMove(gameState);
      
      if (aiMove === -1) {
        endGame(gameState);
        setIsAiThinking(false);
        return;
      }
      
      setIsAiThinking(false);
      makeMove(aiMove, "ai");
    }, 800 + Math.random() * 400);
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [gamePhase, isAnimating, currentPlayer, gameState, makeMove, endGame]);

  const resetGame = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setGamePhase("ready");
    setGameState(createInitialState());
    setCurrentPlayer("player");
    setWinner(null);
    setIsAnimating(false);
    setLastMovedPit(null);
    setIsAiThinking(false);
    aiTurnRef.current = false;
  }, []);

  if (gamePhase === "ready") {
    return (
      <div className="w-full max-w-3xl mx-auto space-y-4">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl flex items-center gap-2">
              <Circle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              Ayo Olopon (Mancala)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-4"
            >
              <Board
                gameState={gameState}
                currentPlayer="player"
                onPitClick={() => {}}
                isAnimating={false}
                lastMovedPit={null}
              />
              
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Classic Nigerian Board Game</h3>
                <p className="text-sm text-muted-foreground">
                  Capture more seeds than your opponent to win!
                </p>
              </div>
            </motion.div>

            <div className="p-4 bg-muted/50 rounded-md space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                How to Play
              </h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">1.</span>
                  <span>Click any pit on your side (bottom row) to sow seeds counter-clockwise</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">2.</span>
                  <span>Seeds are dropped one per pit, including your store (right side)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">3.</span>
                  <span>Landing in opponent's pit with 2 or 3 seeds captures them</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">4.</span>
                  <span>The game ends when one side is empty. Most seeds wins!</span>
                </li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-amber-500/10 rounded-md">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
                  <User className="h-4 w-4" />
                  Your Side
                </div>
                <p className="text-xs text-muted-foreground mt-1">Bottom row + right store</p>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-md">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  <Bot className="h-4 w-4" />
                  AI Side
                </div>
                <p className="text-xs text-muted-foreground mt-1">Top row + left store</p>
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

            <Button 
              onClick={startGame} 
              className="w-full" 
              size="lg"
              data-testid="button-start-game"
            >
              <Play className="h-5 w-5 mr-2" />
              Start Game
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (gamePhase === "playing" || gamePhase === "animating") {
    return (
      <div className="w-full max-w-3xl mx-auto space-y-4">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="text-xl flex items-center gap-2">
                <Circle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                Ayo Olopon
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge 
                  className={currentPlayer === "player" 
                    ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" 
                    : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                  }
                  data-testid="badge-current-player"
                >
                  {currentPlayer === "player" ? (
                    <>
                      <User className="h-3 w-3 mr-1" />
                      Your Turn
                    </>
                  ) : (
                    <>
                      <Bot className="h-3 w-3 mr-1" />
                      AI Turn
                    </>
                  )}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Board
              gameState={gameState}
              currentPlayer={currentPlayer}
              onPitClick={handlePitClick}
              isAnimating={isAnimating}
              lastMovedPit={lastMovedPit}
            />

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center"
            >
              <p className="text-sm font-medium text-muted-foreground" data-testid="text-message">
                {isAiThinking ? (
                  <motion.span
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    AI is thinking...
                  </motion.span>
                ) : (
                  message
                )}
              </p>
            </motion.div>

            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-md">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/20 rounded-md">
                  <User className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span className="font-bold text-amber-600 dark:text-amber-400" data-testid="text-player-score">
                    {gameState.playerStore}
                  </span>
                </div>
                <span className="text-muted-foreground">vs</span>
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/20 rounded-md">
                  <Bot className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-ai-score">
                    {gameState.aiStore}
                  </span>
                </div>
              </div>
              
              {!isPractice && (
                <Badge variant="secondary" data-testid="badge-stake-playing">
                  {stake.toLocaleString()} NGN
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const playerTotal = gameState.playerStore;
  const aiTotal = gameState.aiStore;
  const isDraw = playerTotal === aiTotal;
  const playerWon = playerTotal > aiTotal;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-xl flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Game Over!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Board
            gameState={gameState}
            currentPlayer="player"
            onPitClick={() => {}}
            isAnimating={false}
            lastMovedPit={null}
          />

          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center space-y-4"
          >
            <AnimatePresence>
              {playerWon && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex justify-center"
                >
                  <Crown className="h-16 w-16 text-yellow-500" />
                </motion.div>
              )}
            </AnimatePresence>

            {playerWon ? (
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-result">
                  You Win!
                </h3>
                <p className="text-muted-foreground">
                  {isPractice 
                    ? `Great game! You captured ${playerTotal} seeds vs AI's ${aiTotal}`
                    : `You won ${(playerTotal * 10).toLocaleString()} points!`
                  }
                </p>
              </div>
            ) : isDraw ? (
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-muted-foreground" data-testid="text-result">
                  It's a Draw!
                </h3>
                <p className="text-muted-foreground">
                  Both players captured {playerTotal} seeds each
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-result">
                  AI Wins!
                </h3>
                <p className="text-muted-foreground">
                  {isPractice 
                    ? `AI captured ${aiTotal} seeds vs your ${playerTotal}. Try again!`
                    : "Better luck next time!"
                  }
                </p>
              </div>
            )}
          </motion.div>

          <div className="flex items-center justify-center gap-6 p-4 bg-muted/30 rounded-md">
            <div className="text-center">
              <div className={`text-3xl font-bold ${playerWon ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                {playerTotal}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1 justify-center mt-1">
                <User className="h-3 w-3" />
                You
              </div>
            </div>
            <div className="text-2xl text-muted-foreground">vs</div>
            <div className="text-center">
              <div className={`text-3xl font-bold ${!playerWon && !isDraw ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                {aiTotal}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1 justify-center mt-1">
                <Bot className="h-3 w-3" />
                AI
              </div>
            </div>
          </div>

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
