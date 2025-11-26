import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, RotateCcw, Trophy, Bot, User } from "lucide-react";

interface LudoGameProps {
  stake: number;
  onGameEnd: (won: boolean, score?: number) => void;
  isPractice: boolean;
}

type Player = "player" | "ai";

interface Token {
  id: number;
  player: Player;
  position: number;
  isHome: boolean;
  isFinished: boolean;
}

const BOARD_SIZE = 15;
const TOTAL_PATH_LENGTH = 52;
const HOME_STRETCH_LENGTH = 6;

const PLAYER_START = 0;
const AI_START = 26;

const SAFE_ZONES = [0, 8, 13, 21, 26, 34, 39, 47];

const PLAYER_PATH: { x: number; y: number }[] = [];
const AI_PATH: { x: number; y: number }[] = [];

const generatePaths = () => {
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

const DiceIcon = ({ value }: { value: number }) => {
  const icons = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];
  const Icon = icons[value - 1] || Dice1;
  return <Icon className="h-12 w-12" />;
};

export default function LudoGame({ stake, onGameEnd, isPractice }: LudoGameProps) {
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
  const [diceValue, setDiceValue] = useState<number>(1);
  const [isRolling, setIsRolling] = useState(false);
  const [hasRolled, setHasRolled] = useState(false);
  const [message, setMessage] = useState("Roll the dice to start!");
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [consecutiveSixes, setConsecutiveSixes] = useState(0);
  const [movableTokens, setMovableTokens] = useState<number[]>([]);
  const [captureAnimation, setCaptureAnimation] = useState<{ x: number; y: number } | null>(null);

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

  const canMoveToken = useCallback((token: Token, dice: number): boolean => {
    if (token.isFinished) return false;
    
    if (token.isHome) {
      return dice === 6;
    }
    
    const newPosition = token.position + dice;
    const maxPosition = TOTAL_PATH_LENGTH + HOME_STRETCH_LENGTH - 1;
    
    return newPosition <= maxPosition;
  }, []);

  const getMovableTokens = useCallback((player: Player, dice: number): number[] => {
    return tokens
      .filter((t) => t.player === player && canMoveToken(t, dice))
      .map((t) => t.id);
  }, [tokens, canMoveToken]);

  const getTokenPosition = (token: Token): { x: number; y: number } => {
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
  };

  const isSafeZone = (position: number): boolean => {
    return SAFE_ZONES.includes(position % TOTAL_PATH_LENGTH);
  };

  const moveToken = useCallback((tokenId: number, dice: number) => {
    setTokens((prevTokens) => {
      const newTokens = [...prevTokens];
      const tokenIndex = newTokens.findIndex((t) => t.id === tokenId);
      if (tokenIndex === -1) return prevTokens;
      
      const token = { ...newTokens[tokenIndex] };
      
      if (token.isHome && dice === 6) {
        token.isHome = false;
        token.position = 0;
        setMessage(`${token.player === "player" ? "You" : "AI"} brought a token out!`);
      } else if (!token.isHome) {
        token.position += dice;
        
        const maxPosition = TOTAL_PATH_LENGTH + HOME_STRETCH_LENGTH - 1;
        if (token.position >= maxPosition) {
          token.isFinished = true;
          token.position = maxPosition;
          setMessage(`${token.player === "player" ? "Your" : "AI's"} token reached home!`);
        }
      }
      
      if (!token.isHome && !token.isFinished && token.position < TOTAL_PATH_LENGTH) {
        const tokenPos = getTokenPosition(token);
        
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
  }, []);

  const rollDice = useCallback(() => {
    if (isRolling || hasRolled || gameOver) return;
    
    setIsRolling(true);
    
    let rollCount = 0;
    const rollInterval = setInterval(() => {
      setDiceValue(Math.floor(Math.random() * 6) + 1);
      rollCount++;
      
      if (rollCount >= 10) {
        clearInterval(rollInterval);
        const finalValue = Math.floor(Math.random() * 6) + 1;
        setDiceValue(finalValue);
        setIsRolling(false);
        setHasRolled(true);
        
        if (finalValue === 6) {
          setConsecutiveSixes((prev) => prev + 1);
          if (consecutiveSixes >= 2) {
            setMessage("Three sixes in a row! Turn forfeited.");
            setConsecutiveSixes(0);
            endTurn(false);
            return;
          }
        } else {
          setConsecutiveSixes(0);
        }
        
        const movable = getMovableTokens(currentPlayer, finalValue);
        setMovableTokens(movable);
        
        if (movable.length === 0) {
          setMessage(`No valid moves. ${currentPlayer === "player" ? "AI's" : "Your"} turn.`);
          setTimeout(() => endTurn(false), 1000);
        } else if (movable.length === 1) {
          handleTokenClick(movable[0]);
        } else {
          setMessage(`${currentPlayer === "player" ? "Click a token to move" : "AI is thinking..."}`);
        }
      }
    }, 100);
  }, [isRolling, hasRolled, gameOver, currentPlayer, consecutiveSixes, getMovableTokens]);

  const endTurn = useCallback((gotSix: boolean) => {
    const newWinner = checkWinner();
    if (newWinner) {
      setWinner(newWinner);
      setGameOver(true);
      onGameEnd(newWinner === "player", newWinner === "player" ? 100 : 0);
      return;
    }
    
    setHasRolled(false);
    setMovableTokens([]);
    
    if (!gotSix) {
      setCurrentPlayer((prev) => (prev === "player" ? "ai" : "player"));
    }
  }, [checkWinner, onGameEnd]);

  const handleTokenClick = useCallback((tokenId: number) => {
    if (!hasRolled || !movableTokens.includes(tokenId) || currentPlayer !== "player") return;
    
    moveToken(tokenId, diceValue);
    
    setTimeout(() => {
      endTurn(diceValue === 6);
    }, 300);
  }, [hasRolled, movableTokens, currentPlayer, diceValue, moveToken, endTurn]);

  const aiMove = useCallback(() => {
    if (currentPlayer !== "ai" || gameOver) return;
    
    setTimeout(() => {
      rollDice();
    }, 1000);
  }, [currentPlayer, gameOver, rollDice]);

  useEffect(() => {
    if (currentPlayer === "ai" && hasRolled && movableTokens.length > 0 && !gameOver) {
      setTimeout(() => {
        const aiTokensOnBoard = movableTokens.filter((id) => {
          const token = tokens.find((t) => t.id === id);
          return token && !token.isHome;
        });
        
        const aiTokensAtHome = movableTokens.filter((id) => {
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
              const newPos = token.position + diceValue;
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
          selectedToken = movableTokens[0];
        }
        
        moveToken(selectedToken, diceValue);
        
        setTimeout(() => {
          endTurn(diceValue === 6);
        }, 500);
      }, 1000);
    }
  }, [currentPlayer, hasRolled, movableTokens, gameOver, tokens, diceValue, moveToken, endTurn]);

  useEffect(() => {
    if (currentPlayer === "ai" && !hasRolled && !gameOver) {
      aiMove();
    }
  }, [currentPlayer, hasRolled, gameOver, aiMove]);

  const playerFinished = tokens.filter((t) => t.player === "player" && t.isFinished).length;
  const aiFinished = tokens.filter((t) => t.player === "ai" && t.isFinished).length;

  const resetGame = () => {
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
    setDiceValue(1);
    setHasRolled(false);
    setGameOver(false);
    setWinner(null);
    setConsecutiveSixes(0);
    setMovableTokens([]);
    setMessage("Roll the dice to start!");
  };

  const renderBoard = () => {
    const cells: JSX.Element[] = [];
    
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        let bgColor = "bg-muted/30";
        
        if ((x >= 0 && x <= 5 && y >= 9 && y <= 14)) {
          bgColor = "bg-red-500/20";
        } else if ((x >= 9 && x <= 14 && y >= 0 && y <= 5)) {
          bgColor = "bg-blue-500/20";
        } else if ((x >= 0 && x <= 5 && y >= 0 && y <= 5)) {
          bgColor = "bg-green-500/20";
        } else if ((x >= 9 && x <= 14 && y >= 9 && y <= 14)) {
          bgColor = "bg-yellow-500/20";
        }
        
        if (x === 7 && y >= 1 && y <= 6) {
          bgColor = "bg-blue-500/40";
        } else if (x === 7 && y >= 8 && y <= 13) {
          bgColor = "bg-red-500/40";
        } else if (y === 7 && x >= 1 && x <= 6) {
          bgColor = "bg-green-500/40";
        } else if (y === 7 && x >= 8 && x <= 13) {
          bgColor = "bg-yellow-500/40";
        }
        
        if (x >= 6 && x <= 8 && y >= 6 && y <= 8) {
          bgColor = "bg-primary/30";
        }
        
        const isOnPath = PLAYER_PATH.some((p) => p.x === x && p.y === y) || 
                        AI_PATH.some((p) => p.x === x && p.y === y);
        
        if (isOnPath && !((x >= 6 && x <= 8 && y >= 6 && y <= 8))) {
          const isSafe = PLAYER_PATH.findIndex((p) => p.x === x && p.y === y);
          if (isSafe !== -1 && SAFE_ZONES.includes(isSafe)) {
            bgColor += " ring-2 ring-primary/50";
          }
        }
        
        cells.push(
          <div
            key={`${x}-${y}`}
            className={`aspect-square border border-border/30 ${bgColor} relative`}
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
      
      return (
        <motion.div
          key={token.id}
          className={`absolute w-[5.5%] h-[5.5%] rounded-full border-2 cursor-pointer
            ${token.player === "player" 
              ? "bg-red-500 border-red-700" 
              : "bg-blue-500 border-blue-700"}
            ${isMovable ? "ring-2 ring-primary ring-offset-1 animate-pulse" : ""}
          `}
          style={{
            left: `${(pos.x / BOARD_SIZE) * 100 + 0.5}%`,
            top: `${(pos.y / BOARD_SIZE) * 100 + 0.5}%`,
          }}
          initial={{ scale: 0.8 }}
          animate={{ 
            scale: isMovable ? 1.1 : 1,
            boxShadow: isMovable ? "0 0 10px rgba(0,0,0,0.3)" : "none"
          }}
          whileHover={isMovable ? { scale: 1.2 } : {}}
          onClick={() => isMovable && handleTokenClick(token.id)}
          data-testid={`token-${token.player}-${token.id}`}
        >
          <div className="absolute inset-1 rounded-full bg-white/30" />
        </motion.div>
      );
    });
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">
      <Card>
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
            <div className="flex items-center gap-2">
              <Badge className="bg-red-500/20 text-red-600 dark:text-red-400">
                <User className="h-3 w-3 mr-1" /> {playerFinished}/4
              </Badge>
              <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400">
                <Bot className="h-3 w-3 mr-1" /> {aiFinished}/4
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative aspect-square w-full bg-card border rounded-md overflow-hidden">
            <div className="grid grid-cols-15 gap-0 w-full h-full" style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }}>
              {renderBoard()}
            </div>
            {renderTokens()}
            
            <AnimatePresence>
              {captureAnimation && (
                <motion.div
                  initial={{ scale: 1, opacity: 1 }}
                  animate={{ scale: 2, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute w-8 h-8 rounded-full bg-yellow-500"
                  style={{
                    left: `${(captureAnimation.x / BOARD_SIZE) * 100}%`,
                    top: `${(captureAnimation.y / BOARD_SIZE) * 100}%`,
                  }}
                />
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">
                {currentPlayer === "player" ? "Your Turn" : "AI's Turn"}
              </p>
              <p className="text-xs text-muted-foreground">{message}</p>
            </div>
            
            <motion.div
              animate={isRolling ? { rotate: 360 } : { rotate: 0 }}
              transition={{ duration: 0.3, repeat: isRolling ? Infinity : 0 }}
              className={`p-2 rounded-md ${currentPlayer === "player" ? "bg-red-500/20" : "bg-blue-500/20"}`}
            >
              <DiceIcon value={diceValue} />
            </motion.div>
            
            <Button
              onClick={rollDice}
              disabled={isRolling || hasRolled || currentPlayer !== "player" || gameOver}
              data-testid="button-roll-dice"
            >
              Roll
            </Button>
          </div>

          {gameOver && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-4 p-4 bg-muted/50 rounded-md"
            >
              <div className="flex items-center justify-center gap-2">
                <Trophy className={`h-8 w-8 ${winner === "player" ? "text-yellow-500" : "text-muted-foreground"}`} />
                <p className="text-xl font-bold">
                  {winner === "player" ? "You Won!" : "AI Won!"}
                </p>
              </div>
              {!isPractice && (
                <p className="text-sm text-muted-foreground">
                  {winner === "player" 
                    ? `You earned ${stake * 2 * 0.95} NGN!` 
                    : `You lost ${stake} NGN.`}
                </p>
              )}
              <Button onClick={resetGame} variant="outline" data-testid="button-play-again">
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
