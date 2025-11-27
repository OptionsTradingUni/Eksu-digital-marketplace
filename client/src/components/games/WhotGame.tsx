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
  Spade,
  Hand,
  AlertCircle,
  Sparkles,
  Crown,
  Star,
  Circle,
  Triangle,
  Square,
  Plus,
  X
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface WhotGameProps {
  stake: number;
  onGameEnd: (won: boolean, score?: number) => void;
  isPractice: boolean;
}

type Shape = "circle" | "triangle" | "cross" | "square" | "star" | "whot";
type Player = "player" | "ai";
type GamePhase = "ready" | "playing" | "checkup" | "finished";

interface WhotCard {
  id: string;
  shape: Shape;
  number: number;
}

const SHAPES: Shape[] = ["circle", "triangle", "cross", "square", "star"];

const SHAPE_COLORS: Record<Shape, { bg: string; text: string; border: string }> = {
  circle: { bg: "bg-red-500", text: "text-red-500", border: "border-red-500" },
  triangle: { bg: "bg-blue-500", text: "text-blue-500", border: "border-blue-500" },
  cross: { bg: "bg-yellow-500", text: "text-yellow-500", border: "border-yellow-500" },
  square: { bg: "bg-green-500", text: "text-green-500", border: "border-green-500" },
  star: { bg: "bg-purple-500", text: "text-purple-500", border: "border-purple-500" },
  whot: { bg: "bg-gradient-to-br from-orange-500 to-pink-500", text: "text-orange-500", border: "border-orange-500" },
};

const SHAPE_ICONS: Record<Shape, typeof Circle> = {
  circle: Circle,
  triangle: Triangle,
  cross: Plus,
  square: Square,
  star: Star,
  whot: Sparkles,
};

const SPECIAL_CARDS: Record<number, { name: string; effect: string }> = {
  1: { name: "Hold On", effect: "Blocks the next player" },
  2: { name: "Pick Two", effect: "Next player picks 2 cards" },
  5: { name: "Pick Three", effect: "Next player picks 3 cards" },
  8: { name: "Suspension", effect: "Skip the next player" },
  14: { name: "General Market", effect: "All players pick one card" },
  20: { name: "Whot!", effect: "Wild card - call any shape" },
};

const createDeck = (): WhotCard[] => {
  const deck: WhotCard[] = [];
  let id = 0;
  
  for (const shape of SHAPES) {
    for (let num = 1; num <= 14; num++) {
      deck.push({ id: `${id++}`, shape, number: num });
    }
  }
  
  for (let i = 0; i < 5; i++) {
    deck.push({ id: `${id++}`, shape: "whot", number: 20 });
  }
  
  return deck;
};

const shuffleDeck = (deck: WhotCard[]): WhotCard[] => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const canPlayCard = (card: WhotCard, topCard: WhotCard, calledShape: Shape | null): boolean => {
  if (card.shape === "whot") return true;
  if (calledShape && card.shape === calledShape) return true;
  if (!calledShape) {
    if (card.shape === topCard.shape) return true;
    if (card.number === topCard.number) return true;
  }
  return false;
};

const getCardDisplayNumber = (num: number): string => {
  if (num === 20) return "W";
  return num.toString();
};

const CardComponent = ({ 
  card, 
  onClick, 
  isPlayable = false, 
  isSelected = false,
  isFaceDown = false,
  size = "normal"
}: { 
  card: WhotCard; 
  onClick?: () => void; 
  isPlayable?: boolean;
  isSelected?: boolean;
  isFaceDown?: boolean;
  size?: "small" | "normal" | "large";
}) => {
  const colors = SHAPE_COLORS[card.shape];
  const ShapeIcon = SHAPE_ICONS[card.shape];
  
  const sizeClasses = {
    small: "w-12 h-18 text-xs",
    normal: "w-16 h-24 text-sm",
    large: "w-20 h-30 text-base"
  };
  
  const iconSizes = {
    small: "h-4 w-4",
    normal: "h-6 w-6",
    large: "h-8 w-8"
  };
  
  if (isFaceDown) {
    return (
      <motion.div
        className={`${sizeClasses[size]} rounded-lg bg-gradient-to-br from-green-700 via-green-600 to-green-800 border-2 border-green-500 flex items-center justify-center shadow-lg cursor-pointer`}
        whileHover={{ scale: 1.05 }}
        onClick={onClick}
      >
        <div className="text-green-300 font-bold text-lg">W</div>
      </motion.div>
    );
  }
  
  const isSpecial = SPECIAL_CARDS[card.number];
  
  return (
    <motion.div
      className={`
        ${sizeClasses[size]} rounded-lg bg-white dark:bg-gray-800 border-2 
        ${isPlayable ? `${colors.border} ring-2 ring-offset-2 ring-primary cursor-pointer` : 'border-gray-300 dark:border-gray-600'}
        ${isSelected ? 'ring-4 ring-primary scale-110' : ''}
        flex flex-col items-center justify-between p-1.5 shadow-lg relative overflow-hidden
        ${isPlayable ? 'hover:shadow-xl' : 'opacity-70'}
        transition-all duration-200
      `}
      whileHover={isPlayable ? { scale: 1.08, y: -5 } : {}}
      whileTap={isPlayable ? { scale: 0.95 } : {}}
      onClick={isPlayable ? onClick : undefined}
      layout
    >
      <div className={`absolute top-0 left-0 w-full h-1 ${colors.bg}`} />
      
      <div className="flex items-center justify-between w-full px-0.5">
        <span className={`font-bold ${colors.text}`}>
          {getCardDisplayNumber(card.number)}
        </span>
        <ShapeIcon className={`${iconSizes[size]} ${colors.text}`} />
      </div>
      
      <div className="flex-1 flex items-center justify-center">
        <ShapeIcon className={`${size === "small" ? "h-6 w-6" : size === "normal" ? "h-10 w-10" : "h-14 w-14"} ${colors.text}`} />
      </div>
      
      <div className="flex items-center justify-between w-full px-0.5">
        <ShapeIcon className={`${iconSizes[size]} ${colors.text} rotate-180`} />
        <span className={`font-bold ${colors.text} rotate-180`}>
          {getCardDisplayNumber(card.number)}
        </span>
      </div>
      
      {isSpecial && (
        <motion.div 
          className="absolute inset-0 bg-gradient-to-br from-transparent via-white/10 to-transparent pointer-events-none"
          animate={{ 
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
};

const ShapeSelector = ({ 
  onSelect, 
  onCancel 
}: { 
  onSelect: (shape: Shape) => void;
  onCancel: () => void;
}) => {
  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-orange-500" />
            Call a Shape
          </DialogTitle>
          <DialogDescription>
            You played a Whot card! Choose the shape you want to call.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-5 gap-3 py-4">
          {SHAPES.map((shape) => {
            const ShapeIcon = SHAPE_ICONS[shape];
            const colors = SHAPE_COLORS[shape];
            return (
              <motion.button
                key={shape}
                className={`p-4 rounded-lg ${colors.bg} text-white flex flex-col items-center gap-2 shadow-lg`}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onSelect(shape)}
                data-testid={`button-shape-${shape}`}
              >
                <ShapeIcon className="h-8 w-8" />
                <span className="text-xs font-medium capitalize">{shape}</span>
              </motion.button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default function WhotGame({ stake, onGameEnd, isPractice }: WhotGameProps) {
  const [gamePhase, setGamePhase] = useState<GamePhase>("ready");
  const [deck, setDeck] = useState<WhotCard[]>([]);
  const [discardPile, setDiscardPile] = useState<WhotCard[]>([]);
  const [playerHand, setPlayerHand] = useState<WhotCard[]>([]);
  const [aiHand, setAiHand] = useState<WhotCard[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player>("player");
  const [calledShape, setCalledShape] = useState<Shape | null>(null);
  const [showShapeSelector, setShowShapeSelector] = useState(false);
  const [pendingWhotCard, setPendingWhotCard] = useState<WhotCard | null>(null);
  const [message, setMessage] = useState("Ready to play Whot!");
  const [winner, setWinner] = useState<Player | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [pendingPickUp, setPendingPickUp] = useState(0);
  const [lastPlayedCard, setLastPlayedCard] = useState<WhotCard | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [checkUpCalled, setCheckUpCalled] = useState(false);
  
  const aiTurnRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const initGame = useCallback(() => {
    const newDeck = shuffleDeck(createDeck());
    
    const playerCards = newDeck.splice(0, 5);
    const aiCards = newDeck.splice(0, 5);
    
    let startCard = newDeck.shift()!;
    while (startCard.shape === "whot" || SPECIAL_CARDS[startCard.number]) {
      newDeck.push(startCard);
      startCard = newDeck.shift()!;
    }
    
    setDeck(newDeck);
    setDiscardPile([startCard]);
    setPlayerHand(playerCards);
    setAiHand(aiCards);
    setCurrentPlayer("player");
    setCalledShape(null);
    setShowShapeSelector(false);
    setPendingWhotCard(null);
    setMessage("Your turn! Match by shape or number.");
    setWinner(null);
    setIsBlocked(false);
    setPendingPickUp(0);
    setLastPlayedCard(null);
    setIsAiThinking(false);
    setCheckUpCalled(false);
    setGamePhase("playing");
    aiTurnRef.current = false;
  }, []);

  const drawCard = useCallback((count: number = 1): WhotCard[] => {
    const drawnCards: WhotCard[] = [];
    let currentDeck = [...deck];
    let currentDiscard = [...discardPile];
    
    for (let i = 0; i < count; i++) {
      if (currentDeck.length === 0) {
        if (currentDiscard.length <= 1) break;
        const topCard = currentDiscard.pop()!;
        currentDeck = shuffleDeck(currentDiscard);
        currentDiscard = [topCard];
      }
      
      const card = currentDeck.shift();
      if (card) drawnCards.push(card);
    }
    
    setDeck(currentDeck);
    setDiscardPile(currentDiscard);
    return drawnCards;
  }, [deck, discardPile]);

  const checkWinner = useCallback((player: Player, hand: WhotCard[]) => {
    if (hand.length === 0) {
      setWinner(player);
      setGamePhase("finished");
      const won = player === "player";
      onGameEnd(won, won ? 100 : 0);
      return true;
    }
    return false;
  }, [onGameEnd]);

  const applySpecialEffect = useCallback((card: WhotCard, playedBy: Player) => {
    const opponent = playedBy === "player" ? "ai" : "player";
    
    switch (card.number) {
      case 1: // Hold On
        setIsBlocked(true);
        setMessage(`${playedBy === "player" ? "AI" : "You"} blocked! ${playedBy === "player" ? "You play" : "AI plays"} again.`);
        break;
      case 2: // Pick Two
        setPendingPickUp(prev => prev + 2);
        setMessage(`${opponent === "player" ? "You" : "AI"} must pick 2 cards or play a 2!`);
        break;
      case 5: // Pick Three
        setPendingPickUp(prev => prev + 3);
        setMessage(`${opponent === "player" ? "You" : "AI"} must pick 3 cards or play a 5!`);
        break;
      case 8: // Suspension
        setIsBlocked(true);
        setMessage(`${opponent === "player" ? "You are" : "AI is"} suspended! Turn skipped.`);
        break;
      case 14: // General Market
        const playerPickup = drawCard(1);
        const aiPickup = drawCard(1);
        if (playedBy === "player") {
          setAiHand(prev => [...prev, ...aiPickup]);
        } else {
          setPlayerHand(prev => [...prev, ...playerPickup]);
        }
        setMessage("General Market! Everyone picks a card.");
        break;
    }
  }, [drawCard]);

  const playCard = useCallback((card: WhotCard, player: Player) => {
    if (player === "player") {
      setPlayerHand(prev => prev.filter(c => c.id !== card.id));
    } else {
      setAiHand(prev => prev.filter(c => c.id !== card.id));
    }
    
    setDiscardPile(prev => [...prev, card]);
    setLastPlayedCard(card);
    setCalledShape(null);
    
    if (card.shape === "whot") {
      if (player === "player") {
        setPendingWhotCard(card);
        setShowShapeSelector(true);
      } else {
        const shapes = ["circle", "triangle", "cross", "square", "star"] as Shape[];
        const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
        setCalledShape(randomShape);
        setMessage(`AI called ${randomShape}!`);
      }
    } else if (SPECIAL_CARDS[card.number] && card.number !== 20) {
      applySpecialEffect(card, player);
    }
    
    setPendingPickUp(0);
  }, [applySpecialEffect]);

  const handleShapeSelection = useCallback((shape: Shape) => {
    setShowShapeSelector(false);
    setCalledShape(shape);
    setPendingWhotCard(null);
    setMessage(`You called ${shape}!`);
    
    const updatedHand = playerHand.filter(c => c.id !== pendingWhotCard?.id);
    if (checkWinner("player", updatedHand)) return;
    
    if (!isBlocked) {
      setCurrentPlayer("ai");
    } else {
      setIsBlocked(false);
    }
  }, [playerHand, pendingWhotCard, isBlocked, checkWinner]);

  const handlePlayerCardClick = useCallback((card: WhotCard) => {
    if (gamePhase !== "playing" || currentPlayer !== "player" || isAiThinking) return;
    
    const topCard = discardPile[discardPile.length - 1];
    
    if (pendingPickUp > 0) {
      if ((card.number === 2 && pendingPickUp <= 4) || (card.number === 5 && pendingPickUp <= 6)) {
        playCard(card, "player");
        const updatedHand = playerHand.filter(c => c.id !== card.id);
        if (checkWinner("player", updatedHand)) return;
        setCurrentPlayer("ai");
        return;
      } else {
        setMessage("You must play a matching pick card or draw!");
        return;
      }
    }
    
    if (!canPlayCard(card, topCard, calledShape)) {
      setMessage("Invalid move! Match by shape or number.");
      return;
    }
    
    if (playerHand.length === 2 && !checkUpCalled) {
      setMessage("You must call 'Check Up' before playing second-to-last card!");
      return;
    }
    
    playCard(card, "player");
    
    if (card.shape === "whot") return;
    
    const updatedHand = playerHand.filter(c => c.id !== card.id);
    if (checkWinner("player", updatedHand)) return;
    
    if (!isBlocked && !SPECIAL_CARDS[card.number]) {
      setCurrentPlayer("ai");
      setMessage("AI's turn...");
    } else if (isBlocked) {
      setIsBlocked(false);
      setMessage("Your turn again!");
    }
  }, [gamePhase, currentPlayer, isAiThinking, discardPile, pendingPickUp, calledShape, playerHand, checkUpCalled, playCard, checkWinner, isBlocked]);

  const handlePlayerDraw = useCallback(() => {
    if (gamePhase !== "playing" || currentPlayer !== "player" || isAiThinking) return;
    
    const count = pendingPickUp > 0 ? pendingPickUp : 1;
    const drawnCards = drawCard(count);
    
    if (drawnCards.length > 0) {
      setPlayerHand(prev => [...prev, ...drawnCards]);
      setMessage(`You picked ${drawnCards.length} card(s).`);
      setPendingPickUp(0);
      
      if (!isBlocked) {
        setCurrentPlayer("ai");
      } else {
        setIsBlocked(false);
      }
    }
  }, [gamePhase, currentPlayer, isAiThinking, pendingPickUp, drawCard, isBlocked]);

  const handleCheckUp = useCallback(() => {
    if (playerHand.length === 2 && !checkUpCalled) {
      setCheckUpCalled(true);
      setMessage("Check Up! One card left after this!");
    }
  }, [playerHand.length, checkUpCalled]);

  useEffect(() => {
    if (gamePhase !== "playing" || currentPlayer !== "ai" || aiTurnRef.current) return;
    
    aiTurnRef.current = true;
    setIsAiThinking(true);
    
    timeoutRef.current = setTimeout(() => {
      const topCard = discardPile[discardPile.length - 1];
      
      if (pendingPickUp > 0) {
        const counterCard = aiHand.find(c => 
          (c.number === 2 && pendingPickUp <= 4) || 
          (c.number === 5 && pendingPickUp <= 6)
        );
        
        if (counterCard) {
          playCard(counterCard, "ai");
          const updatedHand = aiHand.filter(c => c.id !== counterCard.id);
          if (checkWinner("ai", updatedHand)) {
            setIsAiThinking(false);
            aiTurnRef.current = false;
            return;
          }
          setCurrentPlayer("player");
          setIsAiThinking(false);
          aiTurnRef.current = false;
          setMessage("Your turn!");
          return;
        } else {
          const drawnCards = drawCard(pendingPickUp);
          setAiHand(prev => [...prev, ...drawnCards]);
          setPendingPickUp(0);
          setMessage(`AI picked ${drawnCards.length} cards. Your turn!`);
          setCurrentPlayer("player");
          setIsAiThinking(false);
          aiTurnRef.current = false;
          return;
        }
      }
      
      const playableCards = aiHand.filter(c => canPlayCard(c, topCard, calledShape));
      
      if (playableCards.length > 0) {
        const specialCards = playableCards.filter(c => SPECIAL_CARDS[c.number]);
        const normalCards = playableCards.filter(c => !SPECIAL_CARDS[c.number]);
        
        let cardToPlay: WhotCard;
        if (aiHand.length <= 3 && normalCards.length > 0) {
          cardToPlay = normalCards[0];
        } else if (specialCards.length > 0 && Math.random() > 0.3) {
          cardToPlay = specialCards[Math.floor(Math.random() * specialCards.length)];
        } else {
          cardToPlay = playableCards[Math.floor(Math.random() * playableCards.length)];
        }
        
        playCard(cardToPlay, "ai");
        
        const updatedHand = aiHand.filter(c => c.id !== cardToPlay.id);
        
        if (updatedHand.length === 1) {
          setMessage("AI calls Check Up!");
        }
        
        if (checkWinner("ai", updatedHand)) {
          setIsAiThinking(false);
          aiTurnRef.current = false;
          return;
        }
        
        if (cardToPlay.shape === "whot") {
          timeoutRef.current = setTimeout(() => {
            if (!isBlocked) {
              setCurrentPlayer("player");
              setMessage("Your turn!");
            } else {
              setIsBlocked(false);
            }
            setIsAiThinking(false);
            aiTurnRef.current = false;
          }, 500);
          return;
        }
        
        if (!isBlocked && !SPECIAL_CARDS[cardToPlay.number]) {
          setCurrentPlayer("player");
          setMessage("Your turn!");
        } else if (isBlocked) {
          setIsBlocked(false);
          setMessage("AI plays again!");
          aiTurnRef.current = false;
          timeoutRef.current = setTimeout(() => {
            setCurrentPlayer("ai");
          }, 500);
          setIsAiThinking(false);
          return;
        }
      } else {
        const drawnCards = drawCard(1);
        if (drawnCards.length > 0) {
          setAiHand(prev => [...prev, ...drawnCards]);
          setMessage("AI picked a card. Your turn!");
        }
        setCurrentPlayer("player");
      }
      
      setIsAiThinking(false);
      aiTurnRef.current = false;
    }, 1200);
  }, [gamePhase, currentPlayer, discardPile, aiHand, calledShape, pendingPickUp, isBlocked, playCard, drawCard, checkWinner]);

  const resetGame = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    aiTurnRef.current = false;
    setGamePhase("ready");
  }, []);

  const topCard = discardPile[discardPile.length - 1];
  
  const playablePlayerCards = playerHand.filter(card => {
    if (pendingPickUp > 0) {
      return (card.number === 2 && pendingPickUp <= 4) || (card.number === 5 && pendingPickUp <= 6);
    }
    return canPlayCard(card, topCard, calledShape);
  });

  if (gamePhase === "ready") {
    return (
      <Card className="overflow-visible">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl flex items-center gap-2">
            <Spade className="h-6 w-6 text-orange-500" />
            Whot Card Game
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-4"
          >
            <div className="relative mx-auto w-32 h-32 mb-4">
              <motion.div
                animate={{ 
                  rotateY: [0, 180, 360],
                }}
                transition={{ 
                  duration: 3, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="w-full h-full rounded-xl bg-gradient-to-br from-green-600 via-green-500 to-green-700 flex items-center justify-center shadow-2xl border-4 border-green-400"
              >
                <span className="text-4xl font-bold text-white">W</span>
              </motion.div>
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{ 
                  duration: 1.5, 
                  repeat: Infinity 
                }}
                className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center shadow-lg"
              >
                <Crown className="h-5 w-5 text-white" />
              </motion.div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold">Nigerian Whot</h3>
              <p className="text-sm text-muted-foreground mt-1">
                The classic Nigerian card game! Match by shape or number.
              </p>
            </div>
          </motion.div>

          <div className="space-y-3 p-4 rounded-lg bg-muted/50">
            <h4 className="font-medium text-sm">Game Rules:</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <Circle className="h-3 w-3 text-red-500" />
                Match cards by shape or number
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="h-3 w-3 text-orange-500" />
                Whot cards are wild - call any shape!
              </li>
              <li className="flex items-center gap-2">
                <Hand className="h-3 w-3 text-blue-500" />
                Special cards: 1 (Hold), 2 (Pick 2), 5 (Pick 3), 8 (Skip), 14 (Market)
              </li>
              <li className="flex items-center gap-2">
                <Trophy className="h-3 w-3 text-yellow-500" />
                First to empty their hand wins!
              </li>
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-3 rounded-lg bg-blue-500/10">
              <User className="h-5 w-5 mx-auto mb-1 text-blue-500" />
              <p className="text-sm font-medium">You</p>
            </div>
            <div className="p-3 rounded-lg bg-red-500/10">
              <Bot className="h-5 w-5 mx-auto mb-1 text-red-500" />
              <p className="text-sm font-medium">AI Opponent</p>
            </div>
          </div>

          {!isPractice && stake > 0 && (
            <div className="text-center p-3 rounded-lg bg-green-500/10">
              <p className="text-sm text-muted-foreground">Stake</p>
              <p className="text-lg font-bold text-green-600">{stake.toLocaleString()} NGN</p>
            </div>
          )}

          <Button 
            onClick={initGame} 
            className="w-full" 
            size="lg"
            data-testid="button-start-whot"
          >
            <Play className="h-5 w-5 mr-2" />
            Start Game
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (gamePhase === "finished") {
    return (
      <Card className="overflow-visible">
        <CardContent className="py-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-center space-y-6"
          >
            <motion.div
              animate={{ 
                rotate: winner === "player" ? [0, 10, -10, 0] : 0,
                scale: winner === "player" ? [1, 1.1, 1] : 1
              }}
              transition={{ duration: 0.5, repeat: winner === "player" ? Infinity : 0, repeatDelay: 1 }}
              className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center ${
                winner === "player" 
                  ? "bg-gradient-to-br from-yellow-400 to-orange-500" 
                  : "bg-gradient-to-br from-gray-400 to-gray-600"
              }`}
            >
              <Trophy className={`h-12 w-12 ${winner === "player" ? "text-white" : "text-gray-300"}`} />
            </motion.div>
            
            <div>
              <h2 className="text-2xl font-bold">
                {winner === "player" ? "You Won!" : "AI Wins!"}
              </h2>
              <p className="text-muted-foreground mt-1">
                {winner === "player" 
                  ? "Congratulations! You emptied your hand first!" 
                  : "The AI emptied their hand first. Better luck next time!"}
              </p>
            </div>

            {!isPractice && stake > 0 && (
              <div className={`p-4 rounded-lg ${winner === "player" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                <p className="text-sm text-muted-foreground">
                  {winner === "player" ? "You won" : "You lost"}
                </p>
                <p className={`text-xl font-bold ${winner === "player" ? "text-green-600" : "text-red-600"}`}>
                  {winner === "player" ? "+" : "-"}{stake.toLocaleString()} NGN
                </p>
              </div>
            )}

            <Button 
              onClick={resetGame} 
              size="lg"
              data-testid="button-play-again"
            >
              <RotateCcw className="h-5 w-5 mr-2" />
              Play Again
            </Button>
          </motion.div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {showShapeSelector && (
        <ShapeSelector 
          onSelect={handleShapeSelection}
          onCancel={() => setShowShapeSelector(false)}
        />
      )}
      
      <div className="flex items-center justify-between gap-4">
        <Badge 
          variant={currentPlayer === "ai" ? "default" : "outline"}
          className="flex items-center gap-1"
        >
          <Bot className="h-3 w-3" />
          AI: {aiHand.length} cards
        </Badge>
        
        <div className="text-center">
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        
        <Badge 
          variant={currentPlayer === "player" ? "default" : "outline"}
          className="flex items-center gap-1"
        >
          <User className="h-3 w-3" />
          You: {playerHand.length} cards
        </Badge>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">AI Hand</span>
          {isAiThinking && (
            <Badge variant="secondary" className="animate-pulse">
              Thinking...
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-1">
          {aiHand.map((_, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="w-8 h-12 rounded bg-gradient-to-br from-green-700 to-green-800 border border-green-500"
            />
          ))}
        </div>
      </Card>

      <div className="flex items-center justify-center gap-6">
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-2">Deck ({deck.length})</p>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="cursor-pointer"
            onClick={handlePlayerDraw}
          >
            <div className="relative">
              {deck.length > 2 && (
                <div className="absolute -top-1 -left-1 w-16 h-24 rounded-lg bg-gradient-to-br from-green-800 to-green-900 border-2 border-green-600" />
              )}
              {deck.length > 1 && (
                <div className="absolute -top-0.5 -left-0.5 w-16 h-24 rounded-lg bg-gradient-to-br from-green-700 to-green-800 border-2 border-green-500" />
              )}
              <div className="relative w-16 h-24 rounded-lg bg-gradient-to-br from-green-600 to-green-700 border-2 border-green-400 flex items-center justify-center shadow-lg">
                <span className="text-2xl font-bold text-green-200">W</span>
              </div>
            </div>
          </motion.div>
          <p className="text-xs text-muted-foreground mt-1">Click to draw</p>
        </div>

        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-2">
            Discard Pile
            {calledShape && (
              <span className="ml-1">
                (Called: <span className={SHAPE_COLORS[calledShape].text}>{calledShape}</span>)
              </span>
            )}
          </p>
          <AnimatePresence mode="wait">
            {topCard && (
              <motion.div
                key={topCard.id}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 180 }}
                transition={{ type: "spring", damping: 15 }}
              >
                <CardComponent card={topCard} size="normal" />
              </motion.div>
            )}
          </AnimatePresence>
          {lastPlayedCard && SPECIAL_CARDS[lastPlayedCard.number] && (
            <Badge variant="secondary" className="mt-2">
              {SPECIAL_CARDS[lastPlayedCard.number].name}
            </Badge>
          )}
        </div>
      </div>

      {pendingPickUp > 0 && currentPlayer === "player" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30"
        >
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span className="text-sm font-medium text-red-500">
            You must pick {pendingPickUp} cards or play a counter card!
          </span>
          <Button 
            variant="destructive" 
            size="sm"
            onClick={handlePlayerDraw}
            data-testid="button-pick-cards"
          >
            Pick {pendingPickUp} Cards
          </Button>
        </motion.div>
      )}

      {playerHand.length === 2 && !checkUpCalled && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center justify-center"
        >
          <Button 
            onClick={handleCheckUp}
            variant="outline"
            className="border-orange-500 text-orange-500"
            data-testid="button-check-up"
          >
            <Hand className="h-4 w-4 mr-2" />
            Call Check Up!
          </Button>
        </motion.div>
      )}

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">Your Hand</span>
          {playerHand.length === 1 && (
            <Badge className="bg-orange-500">Last Card!</Badge>
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <AnimatePresence>
            {playerHand.map((card, index) => {
              const isPlayable = currentPlayer === "player" && 
                !isAiThinking && 
                playablePlayerCards.some(c => c.id === card.id);
              
              return (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 50, scale: 0 }}
                  animate={{ 
                    opacity: 1, 
                    y: 0, 
                    scale: 1,
                    rotate: (index - playerHand.length / 2) * 3
                  }}
                  exit={{ opacity: 0, scale: 0, y: -50 }}
                  transition={{ delay: index * 0.05, type: "spring" }}
                  style={{ 
                    marginLeft: index > 0 ? "-10px" : 0,
                    zIndex: index
                  }}
                >
                  <CardComponent 
                    card={card} 
                    onClick={() => handlePlayerCardClick(card)}
                    isPlayable={isPlayable}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
        
        {playablePlayerCards.length === 0 && currentPlayer === "player" && pendingPickUp === 0 && (
          <p className="text-center text-sm text-muted-foreground mt-3">
            No playable cards. Draw from the deck!
          </p>
        )}
      </Card>

      <div className="flex items-center justify-center">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={resetGame}
          data-testid="button-reset-game"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset Game
        </Button>
      </div>
    </div>
  );
}
