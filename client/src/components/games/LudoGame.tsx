import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, RotateCcw, Trophy, Bot, User, Settings2, Play } from "lucide-react";

interface LudoGameProps {
  stake: number;
  onGameEnd: (won: boolean, score?: number) => void;
  isPractice: boolean;
}

type Player = "player" | "ai";
type DiceCount = 1 | 2 | 3;
type GamePhase = "settings" | "playing";

interface Token {
  id: number;
  player: Player;
  position: number;
  isHome: boolean;
  isFinished: boolean;
}

interface DiceResult {
  values: number[];
  total: number;
  hasSix: boolean;
}

const BOARD_SIZE = 15;
const TOTAL_PATH_LENGTH = 52;
const HOME_STRETCH_LENGTH = 6;

const SAFE_ZONES = [0, 8, 13, 21, 26, 34, 39, 47];

const PLAYER_PATH: { x: number; y: number }[] = [];
const AI_PATH: { x: number; y: number }[] = [];

const generatePaths = () => {
  if (PLAYER_PATH.length > 0) return;
  
  const basePath: { x: number; y: number }[] = [
    { x: 6, y: 13 }, { x: 6, y: 12 }, { x: 6, y: 11 }, { x: 6, y: 10 }, { x: 6, y: 9 },
    { x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 8 }, { x: 1, y: 8 }, { x: 0, y: 8 },
    { x: 0, y: 7 },
    { x: 0, y: 6 }, { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 },
    { x: 6, y: 5 }, { x: 6, y: 4 }, { x: 6, y: 3 }, { x: 6, y: 2 }, { x: 6, y: 1 }, { x: 6, y: 0 },
    { x: 7, y: 0 },
    { x: 8, y: 0 }, { x: 8, y: 1 }, { x: 8, y: 2 }, { x: 8, y: 3 }, { x: 8, y: 4 }, { x: 8, y: 5 },
    { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 11, y: 6 }, { x: 12, y: 6 }, { x: 13, y: 6 }, { x: 14, y: 6 },
    { x: 14, y: 7 },
    { x: 14, y: 8 }, { x: 13, y: 8 }, { x: 12, y: 8 }, { x: 11, y: 8 }, { x: 10, y: 8 }, { x: 9, y: 8 },
    { x: 8, y: 9 }, { x: 8, y: 10 }, { x: 8, y: 11 }, { x: 8, y: 12 }, { x: 8, y: 13 }, { x: 8, y: 14 },
    { x: 7, y: 14 },
  ];

  const playerHomeStretch = [
    { x: 7, y: 13 }, { x: 7, y: 12 }, { x: 7, y: 11 }, { x: 7, y: 10 }, { x: 7, y: 9 }, { x: 7, y: 8 },
  ];

  const aiHomeStretch = [
    { x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }, { x: 7, y: 4 }, { x: 7, y: 5 }, { x: 7, y: 6 },
  ];

  for (let i = 0; i < basePath.length; i++) {
    PLAYER_PATH.push(basePath[i]);
  }
  for (let i = 0; i < playerHomeStretch.length; i++) {
    PLAYER_PATH.push(playerHomeStretch[i]);
  }

  for (let i = 0; i < basePath.length; i++) {
    AI_PATH.push(basePath[(i + 26) % basePath.length]);
  }
  for (let i = 0; i < aiHomeStretch.length; i++) {
    AI_PATH.push(aiHomeStretch[i]);
  }
};

generatePaths();

const getPlayerHomePositions = (): { x: number; y: number }[] => [
  { x: 2, y: 11 }, { x: 3, y: 11 }, { x: 2, y: 12 }, { x: 3, y: 12 },
];

const getAIHomePositions = (): { x: number; y: number }[] => [
  { x: 11, y: 2 }, { x: 12, y: 2 }, { x: 11, y: 3 }, { x: 12, y: 3 },
];

const secureRandom = (): number => {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] / 0x100000000;
};

const rollSingleDie = (): number => {
  return Math.floor(secureRandom() * 6) + 1;
};

const rollDiceSet = (count: DiceCount): DiceResult => {
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    values.push(rollSingleDie());
  }
  return {
    values,
    total: values.reduce((a, b) => a + b, 0),
    hasSix: values.includes(6),
  };
};

const DiceDisplay = ({ values, isRolling }: { values: number[]; isRolling: boolean }) => {
  const icons = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];
  
  return (
    <div className="flex items-center gap-2">
      {values.map((value, index) => {
        const Icon = icons[value - 1] || Dice1;
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
            <Icon className="h-10 w-10 drop-shadow-lg" />
          </motion.div>
        );
      })}
    </div>
  );
};

const GameSettings = ({ 
  diceCount, 
  onDiceCountChange, 
  onStartGame 
}: { 
  diceCount: DiceCount; 
  onDiceCountChange: (count: DiceCount) => void;
  onStartGame: () => void;
}) => {
  return (
    <Card className="border-2">
      <CardHeader className="text-center pb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Settings2 className="h-6 w-6 text-primary" />
          <CardTitle className="text-xl">Game Settings</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">Configure your Ludo game before starting</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <Label className="text-base font-semibold">Number of Dice</Label>
          <RadioGroup 
            value={String(diceCount)} 
            onValueChange={(v) => onDiceCountChange(Number(v) as DiceCount)}
            className="grid gap-3"
          >
            <div className="flex items-center space-x-3 p-4 rounded-lg border-2 border-muted hover:border-primary/50 transition-colors cursor-pointer" onClick={() => onDiceCountChange(1)}>
              <RadioGroupItem value="1" id="dice-1" />
              <Label htmlFor="dice-1" className="flex-1 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">1 Die (Standard)</p>
                    <p className="text-xs text-muted-foreground">Roll exactly 6 to exit home. Classic rules.</p>
                  </div>
                  <div className="flex gap-1">
                    <Dice6 className="h-6 w-6 text-muted-foreground" />
                  </div>
                </div>
              </Label>
            </div>
            
            <div className="flex items-center space-x-3 p-4 rounded-lg border-2 border-muted hover:border-primary/50 transition-colors cursor-pointer" onClick={() => onDiceCountChange(2)}>
              <RadioGroupItem value="2" id="dice-2" />
              <Label htmlFor="dice-2" className="flex-1 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">2 Dice</p>
                    <p className="text-xs text-muted-foreground">Roll at least one 6 to exit. Sum for movement.</p>
                  </div>
                  <div className="flex gap-1">
                    <Dice5 className="h-6 w-6 text-muted-foreground" />
                    <Dice3 className="h-6 w-6 text-muted-foreground" />
                  </div>
                </div>
              </Label>
            </div>
            
            <div className="flex items-center space-x-3 p-4 rounded-lg border-2 border-muted hover:border-primary/50 transition-colors cursor-pointer" onClick={() => onDiceCountChange(3)}>
              <RadioGroupItem value="3" id="dice-3" />
              <Label htmlFor="dice-3" className="flex-1 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">3 Dice</p>
                    <p className="text-xs text-muted-foreground">Even easier exit. Higher sums possible.</p>
                  </div>
                  <div className="flex gap-1">
                    <Dice4 className="h-6 w-6 text-muted-foreground" />
                    <Dice2 className="h-6 w-6 text-muted-foreground" />
                    <Dice6 className="h-6 w-6 text-muted-foreground" />
                  </div>
                </div>
              </Label>
            </div>
          </RadioGroup>
        </div>
        
        <div className="pt-4 border-t">
          <Button 
            onClick={onStartGame} 
            className="w-full" 
            size="lg"
            data-testid="button-start-ludo"
          >
            <Play className="h-5 w-5 mr-2" />
            Start Game
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default function LudoGame({ stake, onGameEnd, isPractice }: LudoGameProps) {
  const [gamePhase, setGamePhase] = useState<GamePhase>("settings");
  const [diceCount, setDiceCount] = useState<DiceCount>(1);
  
  const [tokens, setTokens] = useState<Token[]>([
    { id: 0, player: "player", position: -1, isHome: true, isFinished: false },
    { id: 1, player: "player", position: -1, isHome: true, isFinished: false },
    { id: 2, player: "player", position: -1, isHome: true, isFinished: false },
    { id: 3, player: "player", position: -1, isHome: true, isFinished: false },
    { id: 4, player: "ai", position: -1, isHome: true, isFinished: false },
    { id: 5, player: "ai", position: -1, isHome: true, isFinished: false },
    { id: 6, player: "ai", position: -1, isHome: true, isFinished: false },
    { id: 7, player: "ai", position: -1, isHome: true, isFinished: false },
  ]);
  
  const [currentPlayer, setCurrentPlayer] = useState<Player>("player");
  const [diceResult, setDiceResult] = useState<DiceResult>({ values: [1], total: 1, hasSix: false });
  const [isRolling, setIsRolling] = useState(false);
  const [hasRolled, setHasRolled] = useState(false);
  const [message, setMessage] = useState("Roll the dice to start!");
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [consecutiveSixes, setConsecutiveSixes] = useState(0);
  const [movableTokens, setMovableTokens] = useState<number[]>([]);
  const [captureAnimation, setCaptureAnimation] = useState<{ x: number; y: number } | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  
  const isProcessingRef = useRef(false);
  const aiTurnRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const getTokensByPlayer = useCallback((player: Player) => {
    return tokens.filter((t) => t.player === player);
  }, [tokens]);

  const checkWinner = useCallback(() => {
    const playerTokens = getTokensByPlayer("player");
    const aiTokens = getTokensByPlayer("ai");
    
    if (playerTokens.every((t) => t.isFinished)) {
      return "player";
    }
    if (aiTokens.every((t) => t.isFinished)) {
      return "ai";
    }
    return null;
  }, [getTokensByPlayer]);

  const canMoveToken = useCallback((token: Token, total: number, hasSix: boolean): boolean => {
    if (token.isFinished) return false;
    
    if (token.isHome) {
      if (diceCount === 1) {
        return total === 6;
      }
      return hasSix;
    }
    
    const newPosition = token.position + total;
    const maxPosition = TOTAL_PATH_LENGTH + HOME_STRETCH_LENGTH - 1;
    
    return newPosition <= maxPosition;
  }, [diceCount]);

  const getMovableTokens = useCallback((player: Player, total: number, hasSix: boolean): number[] => {
    return tokens
      .filter((t) => t.player === player && canMoveToken(t, total, hasSix))
      .map((t) => t.id);
  }, [tokens, canMoveToken]);

  const getTokenPosition = useCallback((token: Token): { x: number; y: number } => {
    if (token.isFinished) {
      return { x: 7, y: 7 };
    }
    
    if (token.isHome) {
      const homePositions = token.player === "player" ? getPlayerHomePositions() : getAIHomePositions();
      const homeIndex = token.id % 4;
      return homePositions[homeIndex];
    }
    
    const path = token.player === "player" ? PLAYER_PATH : AI_PATH;
    if (token.position >= 0 && token.position < path.length) {
      return path[token.position];
    }
    
    return { x: 7, y: 7 };
  }, []);

  const isSafeZone = (position: number): boolean => {
    return SAFE_ZONES.includes(position % TOTAL_PATH_LENGTH);
  };

  const endTurn = useCallback((gotSix: boolean, currentTurnPlayer: Player) => {
    const newWinner = checkWinner();
    if (newWinner) {
      setWinner(newWinner);
      setGameOver(true);
      onGameEnd(newWinner === "player", newWinner === "player" ? 100 : 0);
      isProcessingRef.current = false;
      aiTurnRef.current = false;
      setIsAiThinking(false);
      return;
    }
    
    setHasRolled(false);
    setMovableTokens([]);
    
    if (!gotSix) {
      const nextPlayer = currentTurnPlayer === "player" ? "ai" : "player";
      setCurrentPlayer(nextPlayer);
      if (nextPlayer === "player") {
        aiTurnRef.current = false;
        setIsAiThinking(false);
      }
    } else {
      if (currentTurnPlayer === "ai") {
        aiTurnRef.current = false;
      }
    }
    
    isProcessingRef.current = false;
  }, [checkWinner, onGameEnd]);

  const moveToken = useCallback((tokenId: number, total: number, hasSix: boolean) => {
    setTokens((prevTokens) => {
      const newTokens = [...prevTokens];
      const tokenIndex = newTokens.findIndex((t) => t.id === tokenId);
      if (tokenIndex === -1) return prevTokens;
      
      const token = { ...newTokens[tokenIndex] };
      
      if (token.isHome && (diceCount === 1 ? total === 6 : hasSix)) {
        token.isHome = false;
        token.position = 0;
        setMessage(`${token.player === "player" ? "You" : "AI"} brought a token out!`);
      } else if (!token.isHome) {
        token.position += total;
        
        const maxPosition = TOTAL_PATH_LENGTH + HOME_STRETCH_LENGTH - 1;
        if (token.position >= maxPosition) {
          token.isFinished = true;
          token.position = maxPosition;
          setMessage(`${token.player === "player" ? "Your" : "AI's"} token reached home!`);
        }
      }
      
      if (!token.isHome && !token.isFinished && token.position < TOTAL_PATH_LENGTH) {
        const tokenPos = getTokenPosition({ ...token });
        
        newTokens.forEach((otherToken, idx) => {
          if (otherToken.player !== token.player && !otherToken.isHome && !otherToken.isFinished) {
            const otherPos = getTokenPosition(otherToken);
            
            if (tokenPos.x === otherPos.x && tokenPos.y === otherPos.y) {
              if (!isSafeZone(otherToken.position)) {
                newTokens[idx] = { ...otherToken, isHome: true, position: -1 };
                setCaptureAnimation(otherPos);
                setTimeout(() => setCaptureAnimation(null), 500);
                setMessage(`${token.player === "player" ? "You" : "AI"} captured an opponent token!`);
              }
            }
          }
        });
      }
      
      newTokens[tokenIndex] = token;
      return newTokens;
    });
  }, [diceCount, getTokenPosition]);

  const handleTokenClick = useCallback((tokenId: number) => {
    if (!hasRolled || !movableTokens.includes(tokenId) || currentPlayer !== "player" || isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    moveToken(tokenId, diceResult.total, diceResult.hasSix);
    
    timeoutRef.current = setTimeout(() => {
      endTurn(diceResult.hasSix, "player");
    }, 300);
  }, [hasRolled, movableTokens, currentPlayer, diceResult, moveToken, endTurn]);

  const rollDice = useCallback((forPlayer: Player) => {
    if (isRolling || hasRolled || gameOver || isProcessingRef.current) return;
    if (forPlayer !== currentPlayer) return;
    
    isProcessingRef.current = true;
    setIsRolling(true);
    
    let rollCount = 0;
    const rollInterval = setInterval(() => {
      const tempResult = rollDiceSet(diceCount);
      setDiceResult(tempResult);
      rollCount++;
      
      if (rollCount >= 10) {
        clearInterval(rollInterval);
        const finalResult = rollDiceSet(diceCount);
        setDiceResult(finalResult);
        setIsRolling(false);
        setHasRolled(true);
        
        if (finalResult.hasSix) {
          setConsecutiveSixes((prev) => {
            if (prev >= 2) {
              setMessage("Three sixes in a row! Turn forfeited.");
              timeoutRef.current = setTimeout(() => {
                setHasRolled(false);
                setMovableTokens([]);
                const nextPlayer = forPlayer === "player" ? "ai" : "player";
                setCurrentPlayer(nextPlayer);
                if (nextPlayer === "player") {
                  aiTurnRef.current = false;
                  setIsAiThinking(false);
                }
                isProcessingRef.current = false;
              }, 1000);
              return 0;
            }
            return prev + 1;
          });
        } else {
          setConsecutiveSixes(0);
        }
        
        const movable = getMovableTokens(forPlayer, finalResult.total, finalResult.hasSix);
        setMovableTokens(movable);
        
        if (movable.length === 0) {
          setMessage(`No valid moves. ${forPlayer === "player" ? "AI's" : "Your"} turn.`);
          timeoutRef.current = setTimeout(() => {
            endTurn(false, forPlayer);
          }, 1000);
        } else if (forPlayer === "player") {
          if (movable.length === 1) {
            setMessage("Moving your only available token...");
            timeoutRef.current = setTimeout(() => {
              moveToken(movable[0], finalResult.total, finalResult.hasSix);
              timeoutRef.current = setTimeout(() => {
                endTurn(finalResult.hasSix, "player");
              }, 300);
            }, 500);
          } else {
            setMessage("Click a token to move");
            isProcessingRef.current = false;
          }
        } else {
          setMessage("AI is thinking...");
          isProcessingRef.current = false;
        }
      }
    }, 100);
  }, [isRolling, hasRolled, gameOver, currentPlayer, diceCount, getMovableTokens, moveToken, endTurn]);

  useEffect(() => {
    if (gamePhase !== "playing" || gameOver) return;
    if (currentPlayer !== "ai") return;
    if (!hasRolled || movableTokens.length === 0) return;
    if (isProcessingRef.current || aiTurnRef.current) return;
    
    aiTurnRef.current = true;
    isProcessingRef.current = true;
    
    const savedDiceResult = { ...diceResult };
    const savedMovableTokens = [...movableTokens];
    
    timeoutRef.current = setTimeout(() => {
      const aiTokensOnBoard = savedMovableTokens.filter((id) => {
        const token = tokens.find((t) => t.id === id);
        return token && !token.isHome;
      });
      
      const aiTokensAtHome = savedMovableTokens.filter((id) => {
        const token = tokens.find((t) => t.id === id);
        return token && token.isHome;
      });
      
      let selectedToken: number;
      
      if (aiTokensOnBoard.length > 0) {
        const playerTokens = tokens.filter((t) => t.player === "player" && !t.isHome && !t.isFinished);
        
        let captureToken: number | null = null;
        for (const tokenId of aiTokensOnBoard) {
          const token = tokens.find((t) => t.id === tokenId);
          if (token) {
            const newPos = token.position + savedDiceResult.total;
            const path = AI_PATH;
            if (newPos < path.length) {
              const targetPos = path[newPos];
              for (const pToken of playerTokens) {
                const pPos = getTokenPosition(pToken);
                if (pPos.x === targetPos.x && pPos.y === targetPos.y && !isSafeZone(pToken.position)) {
                  captureToken = tokenId;
                  break;
                }
              }
            }
          }
        }
        
        if (captureToken !== null) {
          selectedToken = captureToken;
        } else {
          const closestToFinish = aiTokensOnBoard.reduce((closest, id) => {
            const token = tokens.find((t) => t.id === id);
            const closestToken = tokens.find((t) => t.id === closest);
            if (!token || !closestToken) return closest;
            return token.position > closestToken.position ? id : closest;
          }, aiTokensOnBoard[0]);
          selectedToken = closestToFinish;
        }
      } else if (aiTokensAtHome.length > 0) {
        selectedToken = aiTokensAtHome[0];
      } else {
        selectedToken = savedMovableTokens[0];
      }
      
      moveToken(selectedToken, savedDiceResult.total, savedDiceResult.hasSix);
      
      timeoutRef.current = setTimeout(() => {
        endTurn(savedDiceResult.hasSix, "ai");
      }, 500);
    }, 1000);
  }, [gamePhase, currentPlayer, hasRolled, movableTokens, gameOver, tokens, diceResult, moveToken, endTurn, getTokenPosition]);

  useEffect(() => {
    if (gamePhase !== "playing" || gameOver) return;
    if (currentPlayer !== "ai") return;
    if (hasRolled) return;
    if (isProcessingRef.current || aiTurnRef.current) return;
    
    aiTurnRef.current = true;
    setIsAiThinking(true);
    
    timeoutRef.current = setTimeout(() => {
      rollDice("ai");
    }, 1000);
  }, [gamePhase, currentPlayer, hasRolled, gameOver, rollDice]);

  const playerFinished = tokens.filter((t) => t.player === "player" && t.isFinished).length;
  const aiFinished = tokens.filter((t) => t.player === "ai" && t.isFinished).length;

  const resetGame = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    isProcessingRef.current = false;
    aiTurnRef.current = false;
    
    setTokens([
      { id: 0, player: "player", position: -1, isHome: true, isFinished: false },
      { id: 1, player: "player", position: -1, isHome: true, isFinished: false },
      { id: 2, player: "player", position: -1, isHome: true, isFinished: false },
      { id: 3, player: "player", position: -1, isHome: true, isFinished: false },
      { id: 4, player: "ai", position: -1, isHome: true, isFinished: false },
      { id: 5, player: "ai", position: -1, isHome: true, isFinished: false },
      { id: 6, player: "ai", position: -1, isHome: true, isFinished: false },
      { id: 7, player: "ai", position: -1, isHome: true, isFinished: false },
    ]);
    setCurrentPlayer("player");
    setDiceResult({ values: Array(diceCount).fill(1), total: diceCount, hasSix: false });
    setHasRolled(false);
    setGameOver(false);
    setWinner(null);
    setConsecutiveSixes(0);
    setMovableTokens([]);
    setIsAiThinking(false);
    setMessage("Roll the dice to start!");
  };

  const startGame = () => {
    setDiceResult({ values: Array(diceCount).fill(1), total: diceCount, hasSix: false });
    setGamePhase("playing");
  };

  const renderBoard = () => {
    const cells: JSX.Element[] = [];
    
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        let bgColor = "bg-amber-50 dark:bg-amber-950/30";
        let extraStyles = "";
        
        if ((x >= 0 && x <= 5 && y >= 9 && y <= 14)) {
          bgColor = "bg-gradient-to-br from-red-400 to-red-600 dark:from-red-700 dark:to-red-900";
          if (x >= 1 && x <= 4 && y >= 10 && y <= 13) {
            bgColor = "bg-gradient-to-br from-red-300 to-red-500 dark:from-red-600 dark:to-red-800";
          }
        } else if ((x >= 9 && x <= 14 && y >= 0 && y <= 5)) {
          bgColor = "bg-gradient-to-br from-blue-400 to-blue-600 dark:from-blue-700 dark:to-blue-900";
          if (x >= 10 && x <= 13 && y >= 1 && y <= 4) {
            bgColor = "bg-gradient-to-br from-blue-300 to-blue-500 dark:from-blue-600 dark:to-blue-800";
          }
        } else if ((x >= 0 && x <= 5 && y >= 0 && y <= 5)) {
          bgColor = "bg-gradient-to-br from-green-400 to-green-600 dark:from-green-700 dark:to-green-900";
          if (x >= 1 && x <= 4 && y >= 1 && y <= 4) {
            bgColor = "bg-gradient-to-br from-green-300 to-green-500 dark:from-green-600 dark:to-green-800";
          }
        } else if ((x >= 9 && x <= 14 && y >= 9 && y <= 14)) {
          bgColor = "bg-gradient-to-br from-yellow-400 to-yellow-600 dark:from-yellow-700 dark:to-yellow-900";
          if (x >= 10 && x <= 13 && y >= 10 && y <= 13) {
            bgColor = "bg-gradient-to-br from-yellow-300 to-yellow-500 dark:from-yellow-600 dark:to-yellow-800";
          }
        }
        
        if (x === 7 && y >= 1 && y <= 6) {
          bgColor = "bg-gradient-to-b from-blue-300 to-blue-500 dark:from-blue-600 dark:to-blue-800";
          extraStyles = "shadow-inner";
        } else if (x === 7 && y >= 8 && y <= 13) {
          bgColor = "bg-gradient-to-b from-red-300 to-red-500 dark:from-red-600 dark:to-red-800";
          extraStyles = "shadow-inner";
        } else if (y === 7 && x >= 1 && x <= 6) {
          bgColor = "bg-gradient-to-r from-green-300 to-green-500 dark:from-green-600 dark:to-green-800";
          extraStyles = "shadow-inner";
        } else if (y === 7 && x >= 8 && x <= 13) {
          bgColor = "bg-gradient-to-r from-yellow-300 to-yellow-500 dark:from-yellow-600 dark:to-yellow-800";
          extraStyles = "shadow-inner";
        }
        
        if (x >= 6 && x <= 8 && y >= 6 && y <= 8) {
          bgColor = "bg-gradient-to-br from-amber-200 via-amber-300 to-amber-400 dark:from-amber-600 dark:via-amber-700 dark:to-amber-800";
          extraStyles = "shadow-lg";
        }
        
        const isOnPath = PLAYER_PATH.some((p) => p.x === x && p.y === y) || 
                        AI_PATH.some((p) => p.x === x && p.y === y);
        
        if (isOnPath && !((x >= 6 && x <= 8 && y >= 6 && y <= 8))) {
          const isSafe = PLAYER_PATH.findIndex((p) => p.x === x && p.y === y);
          if (isSafe !== -1 && SAFE_ZONES.includes(isSafe)) {
            extraStyles += " ring-2 ring-inset ring-white/50 dark:ring-white/30";
          }
        }
        
        cells.push(
          <div
            key={`${x}-${y}`}
            className={`aspect-square border border-black/10 dark:border-white/10 ${bgColor} ${extraStyles} relative transition-colors`}
          />
        );
      }
    }
    
    return cells;
  };

  const renderTokens = () => {
    return tokens.map((token) => {
      if (token.isFinished) return null;
      
      const pos = getTokenPosition(token);
      const isMovable = movableTokens.includes(token.id) && currentPlayer === "player";
      const isPlayerToken = token.player === "player";
      
      return (
        <motion.div
          key={token.id}
          className={`absolute rounded-full cursor-pointer shadow-lg
            ${isPlayerToken 
              ? "bg-gradient-to-br from-red-400 via-red-500 to-red-700 border-2 border-red-800 dark:from-red-500 dark:via-red-600 dark:to-red-800" 
              : "bg-gradient-to-br from-blue-400 via-blue-500 to-blue-700 border-2 border-blue-800 dark:from-blue-500 dark:via-blue-600 dark:to-blue-800"}
            ${isMovable ? "ring-4 ring-white dark:ring-yellow-400 ring-offset-2 ring-offset-transparent" : ""}
          `}
          style={{
            left: `${(pos.x / BOARD_SIZE) * 100 + 1}%`,
            top: `${(pos.y / BOARD_SIZE) * 100 + 1}%`,
            width: "5%",
            height: "5%",
          }}
          initial={{ scale: 0.8 }}
          animate={{ 
            scale: isMovable ? [1, 1.15, 1] : 1,
            boxShadow: isMovable 
              ? ["0 0 0 0 rgba(255,255,255,0.7)", "0 0 20px 10px rgba(255,255,255,0)", "0 0 0 0 rgba(255,255,255,0.7)"]
              : "0 4px 6px rgba(0,0,0,0.3)"
          }}
          transition={{
            duration: isMovable ? 1 : 0.3,
            repeat: isMovable ? Infinity : 0,
            ease: "easeInOut"
          }}
          whileHover={isMovable ? { scale: 1.3 } : {}}
          whileTap={isMovable ? { scale: 0.95 } : {}}
          onClick={() => isMovable && handleTokenClick(token.id)}
          data-testid={`token-${token.player}-${token.id}`}
        >
          <div className="absolute inset-1 rounded-full bg-gradient-to-br from-white/40 to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-1/3 h-1/3 rounded-full bg-white/30" />
          </div>
        </motion.div>
      );
    });
  };

  if (gamePhase === "settings") {
    return (
      <div className="w-full max-w-lg mx-auto space-y-4">
        <Card className="border-0 shadow-none bg-transparent">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg flex items-center gap-2">
                Ludo
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
        </Card>
        
        <GameSettings
          diceCount={diceCount}
          onDiceCountChange={setDiceCount}
          onStartGame={startGame}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">
      <Card className="overflow-hidden border-2">
        <CardHeader className="pb-2 bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/50 dark:to-orange-900/50">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              Ludo
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
              <Badge variant="outline" className="text-xs">
                {diceCount} {diceCount === 1 ? "Die" : "Dice"}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge className="bg-gradient-to-r from-red-500 to-red-600 text-white border-0 shadow-md">
                <User className="h-3 w-3 mr-1" /> {playerFinished}/4
              </Badge>
              <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0 shadow-md">
                <Bot className="h-3 w-3 mr-1" /> {aiFinished}/4
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="relative aspect-square w-full rounded-lg overflow-hidden shadow-xl border-4 border-amber-700 dark:border-amber-600 bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900 dark:to-amber-950">
            <div 
              className="grid gap-0 w-full h-full" 
              style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }}
            >
              {renderBoard()}
            </div>
            {renderTokens()}
            
            <AnimatePresence>
              {captureAnimation && (
                <motion.div
                  initial={{ scale: 1, opacity: 1 }}
                  animate={{ scale: 3, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute w-8 h-8 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500"
                  style={{
                    left: `${(captureAnimation.x / BOARD_SIZE) * 100}%`,
                    top: `${(captureAnimation.y / BOARD_SIZE) * 100}%`,
                  }}
                />
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-gradient-to-r from-muted/50 to-muted">
            <div className="flex-1">
              <p className={`text-sm font-medium mb-1 ${currentPlayer === "player" ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}`}>
                {currentPlayer === "player" ? "Your Turn" : "AI's Turn"}
              </p>
              <p className="text-xs text-muted-foreground">{message}</p>
            </div>
            
            <div className={`p-3 rounded-lg shadow-inner ${currentPlayer === "player" ? "bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/50 dark:to-red-800/50" : "bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/50 dark:to-blue-800/50"}`}>
              <DiceDisplay values={diceResult.values} isRolling={isRolling} />
            </div>
            
            <Button
              onClick={() => rollDice("player")}
              disabled={isRolling || hasRolled || currentPlayer !== "player" || gameOver}
              className="shadow-lg"
              size="lg"
              data-testid="button-roll-dice"
            >
              Roll
            </Button>
          </div>

          {gameOver && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-center space-y-4 p-6 rounded-lg ${winner === "player" ? "bg-gradient-to-br from-green-100 to-emerald-200 dark:from-green-900/50 dark:to-emerald-800/50" : "bg-gradient-to-br from-red-100 to-rose-200 dark:from-red-900/50 dark:to-rose-800/50"}`}
            >
              <div className="flex items-center justify-center gap-2">
                <Trophy className={`h-10 w-10 ${winner === "player" ? "text-yellow-500" : "text-muted-foreground"}`} />
                <p className="text-2xl font-bold">
                  {winner === "player" ? "You Won!" : "AI Won!"}
                </p>
              </div>
              {!isPractice && (
                <p className="text-sm text-muted-foreground">
                  {winner === "player" 
                    ? `You earned ${(stake * 2 * 0.95).toLocaleString()} NGN!` 
                    : `You lost ${stake.toLocaleString()} NGN.`}
                </p>
              )}
              <Button onClick={resetGame} variant="outline" size="lg" className="shadow-md" data-testid="button-play-again">
                <RotateCcw className="h-4 w-4 mr-2" />
                Play Again
              </Button>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
