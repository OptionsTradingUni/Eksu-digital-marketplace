import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { 
  Clock, 
  Trophy, 
  Bot, 
  User, 
  RotateCcw, 
  Tag,
  Sparkles,
  Play,
  CheckCircle2,
  XCircle,
  Target,
  Star,
  Crown,
  ArrowRight,
  ShoppingBag,
  Smartphone,
  Shirt,
  Book,
  UtensilsCrossed,
  Home,
  Package
} from "lucide-react";

interface GuessThePriceGameProps {
  stake: number;
  onGameEnd: (won: boolean, score?: number) => void;
  isPractice: boolean;
}

type GamePhase = "ready" | "playing" | "result" | "finished";
type ProductCategory = "electronics" | "fashion" | "books" | "food" | "household";

interface Product {
  id: number;
  name: string;
  category: ProductCategory;
  actualPrice: number;
  minPrice: number;
  maxPrice: number;
  image: string;
  description: string;
}

interface RoundResult {
  product: Product;
  guessedPrice: number;
  actualPrice: number;
  points: number;
  percentageOff: number;
}

const PRODUCTS: Product[] = [
  {
    id: 1,
    name: "iPhone 12 (UK Used)",
    category: "electronics",
    actualPrice: 280000,
    minPrice: 100000,
    maxPrice: 500000,
    image: "https://images.unsplash.com/photo-1611472173362-3f53dbd65d80?w=400&h=400&fit=crop",
    description: "128GB, Good condition"
  },
  {
    id: 2,
    name: "Samsung Galaxy A54",
    category: "electronics",
    actualPrice: 195000,
    minPrice: 100000,
    maxPrice: 350000,
    image: "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400&h=400&fit=crop",
    description: "Brand new, 128GB"
  },
  {
    id: 3,
    name: "HP Laptop 15 (Refurbished)",
    category: "electronics",
    actualPrice: 165000,
    minPrice: 80000,
    maxPrice: 300000,
    image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=400&fit=crop",
    description: "Core i5, 8GB RAM, 256GB SSD"
  },
  {
    id: 4,
    name: "JBL Bluetooth Speaker",
    category: "electronics",
    actualPrice: 45000,
    minPrice: 15000,
    maxPrice: 100000,
    image: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&h=400&fit=crop",
    description: "Portable, Waterproof"
  },
  {
    id: 5,
    name: "Wireless Earbuds",
    category: "electronics",
    actualPrice: 8500,
    minPrice: 3000,
    maxPrice: 25000,
    image: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&h=400&fit=crop",
    description: "Noise cancelling, 24hr battery"
  },
  {
    id: 6,
    name: "Power Bank 20000mAh",
    category: "electronics",
    actualPrice: 12000,
    minPrice: 5000,
    maxPrice: 30000,
    image: "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=400&h=400&fit=crop",
    description: "Fast charging, LED display"
  },
  {
    id: 7,
    name: "Nike Air Force 1",
    category: "fashion",
    actualPrice: 38000,
    minPrice: 15000,
    maxPrice: 80000,
    image: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400&h=400&fit=crop",
    description: "Original, White, Size 42"
  },
  {
    id: 8,
    name: "Adidas Tracksuit",
    category: "fashion",
    actualPrice: 25000,
    minPrice: 10000,
    maxPrice: 50000,
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=400&fit=crop",
    description: "Complete set, Black"
  },
  {
    id: 9,
    name: "Designer Wristwatch",
    category: "fashion",
    actualPrice: 15000,
    minPrice: 5000,
    maxPrice: 40000,
    image: "https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=400&h=400&fit=crop",
    description: "Stainless steel, Water resistant"
  },
  {
    id: 10,
    name: "Campus Backpack",
    category: "fashion",
    actualPrice: 8500,
    minPrice: 3000,
    maxPrice: 20000,
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop",
    description: "Laptop compartment, USB port"
  },
  {
    id: 11,
    name: "Native Agbada Set",
    category: "fashion",
    actualPrice: 45000,
    minPrice: 20000,
    maxPrice: 100000,
    image: "https://images.unsplash.com/photo-1590735213920-68192a487bc2?w=400&h=400&fit=crop",
    description: "Premium Atiku fabric, Custom made"
  },
  {
    id: 12,
    name: "Ladies Gown (Ankara)",
    category: "fashion",
    actualPrice: 18000,
    minPrice: 8000,
    maxPrice: 40000,
    image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&h=400&fit=crop",
    description: "Beautiful Ankara print"
  },
  {
    id: 13,
    name: "Medical Textbook Bundle",
    category: "books",
    actualPrice: 25000,
    minPrice: 10000,
    maxPrice: 50000,
    image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&h=400&fit=crop",
    description: "5 essential medical books"
  },
  {
    id: 14,
    name: "Engineering Calculator",
    category: "books",
    actualPrice: 15000,
    minPrice: 5000,
    maxPrice: 35000,
    image: "https://images.unsplash.com/photo-1564466809058-bf4114d55352?w=400&h=400&fit=crop",
    description: "Scientific calculator, Solar powered"
  },
  {
    id: 15,
    name: "Notebook Bundle (10 pcs)",
    category: "books",
    actualPrice: 3500,
    minPrice: 1500,
    maxPrice: 8000,
    image: "https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=400&h=400&fit=crop",
    description: "A4 size, 80 leaves each"
  },
  {
    id: 16,
    name: "Law Textbooks Set",
    category: "books",
    actualPrice: 35000,
    minPrice: 15000,
    maxPrice: 60000,
    image: "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400&h=400&fit=crop",
    description: "Nigerian Constitution + 4 core texts"
  },
  {
    id: 17,
    name: "Bag of Rice (50kg)",
    category: "food",
    actualPrice: 75000,
    minPrice: 40000,
    maxPrice: 120000,
    image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&h=400&fit=crop",
    description: "Premium Nigerian rice"
  },
  {
    id: 18,
    name: "Carton of Indomie (40 packs)",
    category: "food",
    actualPrice: 12000,
    minPrice: 6000,
    maxPrice: 20000,
    image: "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400&h=400&fit=crop",
    description: "Chicken flavour, Student favourite"
  },
  {
    id: 19,
    name: "5L Groundnut Oil",
    category: "food",
    actualPrice: 8500,
    minPrice: 4000,
    maxPrice: 15000,
    image: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&h=400&fit=crop",
    description: "Pure vegetable oil"
  },
  {
    id: 20,
    name: "Garri (Paint Bucket)",
    category: "food",
    actualPrice: 4500,
    minPrice: 2000,
    maxPrice: 10000,
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=400&fit=crop",
    description: "White garri, 10kg"
  },
  {
    id: 21,
    name: "Electric Kettle",
    category: "household",
    actualPrice: 6500,
    minPrice: 3000,
    maxPrice: 15000,
    image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop",
    description: "1.8L, Stainless steel"
  },
  {
    id: 22,
    name: "Hot Plate (Electric Stove)",
    category: "household",
    actualPrice: 8000,
    minPrice: 4000,
    maxPrice: 18000,
    image: "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400&h=400&fit=crop",
    description: "Single burner, 1000W"
  },
  {
    id: 23,
    name: "Standing Fan",
    category: "household",
    actualPrice: 22000,
    minPrice: 10000,
    maxPrice: 45000,
    image: "https://images.unsplash.com/photo-1587212805787-e17e9f0c8980?w=400&h=400&fit=crop",
    description: "18 inches, 3 speed settings"
  },
  {
    id: 24,
    name: "Iron Pressing",
    category: "household",
    actualPrice: 7500,
    minPrice: 3000,
    maxPrice: 15000,
    image: "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400&h=400&fit=crop",
    description: "Steam iron, Non-stick sole"
  },
  {
    id: 25,
    name: "Rechargeable Lamp",
    category: "household",
    actualPrice: 5500,
    minPrice: 2500,
    maxPrice: 12000,
    image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400&h=400&fit=crop",
    description: "LED, 8 hours battery life"
  },
];

const TOTAL_ROUNDS = 5;
const TIME_PER_ROUND = 15;

const getCategoryIcon = (category: ProductCategory) => {
  switch (category) {
    case "electronics": return Smartphone;
    case "fashion": return Shirt;
    case "books": return Book;
    case "food": return UtensilsCrossed;
    case "household": return Home;
  }
};

const getCategoryColor = (category: ProductCategory) => {
  switch (category) {
    case "electronics": return "bg-blue-500/20 text-blue-600 dark:text-blue-400";
    case "fashion": return "bg-pink-500/20 text-pink-600 dark:text-pink-400";
    case "books": return "bg-amber-500/20 text-amber-600 dark:text-amber-400";
    case "food": return "bg-green-500/20 text-green-600 dark:text-green-400";
    case "household": return "bg-purple-500/20 text-purple-600 dark:text-purple-400";
  }
};

const getPointsForAccuracy = (guessedPrice: number, actualPrice: number): { points: number; percentageOff: number } => {
  const percentageOff = Math.abs((guessedPrice - actualPrice) / actualPrice) * 100;
  
  if (percentageOff === 0) return { points: 100, percentageOff: 0 };
  if (percentageOff <= 10) return { points: 80, percentageOff };
  if (percentageOff <= 25) return { points: 50, percentageOff };
  if (percentageOff <= 50) return { points: 20, percentageOff };
  return { points: 0, percentageOff };
};

const getPointsBadgeColor = (points: number) => {
  if (points === 100) return "bg-green-500 text-white";
  if (points >= 80) return "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400";
  if (points >= 50) return "bg-amber-500/20 text-amber-600 dark:text-amber-400";
  if (points >= 20) return "bg-orange-500/20 text-orange-600 dark:text-orange-400";
  return "bg-red-500/20 text-red-600 dark:text-red-400";
};

const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-NG').format(price);
};

export default function GuessThePriceGame({ stake, onGameEnd, isPractice }: GuessThePriceGameProps) {
  const [gamePhase, setGamePhase] = useState<GamePhase>("ready");
  const [currentRound, setCurrentRound] = useState(1);
  const [totalScore, setTotalScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_ROUND);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [guessedPrice, setGuessedPrice] = useState<number>(0);
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);
  const [usedProductIds, setUsedProductIds] = useState<Set<number>>(new Set());
  const [showResult, setShowResult] = useState(false);
  const [lastRoundResult, setLastRoundResult] = useState<RoundResult | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (gamePhase === "playing" && timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (gamePhase === "playing" && timeLeft === 0) {
      handleSubmitGuess();
    }
    
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [gamePhase, timeLeft]);

  const getRandomProduct = useCallback((): Product => {
    const available = PRODUCTS.filter(p => !usedProductIds.has(p.id));
    if (available.length === 0) {
      const shuffled = shuffleArray(PRODUCTS);
      return shuffled[0];
    }
    const shuffled = shuffleArray(available);
    return shuffled[0];
  }, [usedProductIds]);

  const simulateAIGuess = (product: Product): number => {
    const variance = 0.15 + Math.random() * 0.25;
    const direction = Math.random() > 0.5 ? 1 : -1;
    const aiGuess = product.actualPrice * (1 + direction * variance * Math.random());
    return Math.round(aiGuess / 100) * 100;
  };

  const startGame = useCallback(() => {
    const product = getRandomProduct();
    setCurrentProduct(product);
    setGuessedPrice(Math.round((product.minPrice + product.maxPrice) / 2));
    setUsedProductIds(prev => new Set(Array.from(prev).concat(product.id)));
    setGamePhase("playing");
    setTimeLeft(TIME_PER_ROUND);
    setImageLoaded(false);
    setCurrentRound(1);
    setTotalScore(0);
    setAiScore(0);
    setRoundResults([]);
  }, [getRandomProduct]);

  const handleSubmitGuess = useCallback(() => {
    if (!currentProduct) return;

    const { points, percentageOff } = getPointsForAccuracy(guessedPrice, currentProduct.actualPrice);
    
    const aiGuess = simulateAIGuess(currentProduct);
    const { points: aiPoints } = getPointsForAccuracy(aiGuess, currentProduct.actualPrice);
    
    const result: RoundResult = {
      product: currentProduct,
      guessedPrice,
      actualPrice: currentProduct.actualPrice,
      points,
      percentageOff,
    };

    setLastRoundResult(result);
    setRoundResults(prev => [...prev, result]);
    setTotalScore(prev => prev + points);
    setAiScore(prev => prev + aiPoints);
    setShowResult(true);
    setGamePhase("result");
  }, [currentProduct, guessedPrice]);

  const nextRound = useCallback(() => {
    if (currentRound >= TOTAL_ROUNDS) {
      setGamePhase("finished");
      const won = totalScore > aiScore;
      onGameEnd(won, totalScore);
    } else {
      const product = getRandomProduct();
      setCurrentProduct(product);
      setGuessedPrice(Math.round((product.minPrice + product.maxPrice) / 2));
      setUsedProductIds(prev => new Set(Array.from(prev).concat(product.id)));
      setCurrentRound(prev => prev + 1);
      setTimeLeft(TIME_PER_ROUND);
      setShowResult(false);
      setLastRoundResult(null);
      setImageLoaded(false);
      setGamePhase("playing");
    }
  }, [currentRound, getRandomProduct, totalScore, aiScore, onGameEnd]);

  const resetGame = useCallback(() => {
    setGamePhase("ready");
    setCurrentRound(1);
    setTotalScore(0);
    setAiScore(0);
    setTimeLeft(TIME_PER_ROUND);
    setCurrentProduct(null);
    setGuessedPrice(0);
    setRoundResults([]);
    setUsedProductIds(new Set());
    setShowResult(false);
    setLastRoundResult(null);
    setImageLoaded(false);
  }, []);

  const handleSliderChange = (value: number[]) => {
    setGuessedPrice(value[0]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value.replace(/,/g, ''), 10);
    if (!isNaN(value) && currentProduct) {
      const clampedValue = Math.max(currentProduct.minPrice, Math.min(currentProduct.maxPrice, value));
      setGuessedPrice(clampedValue);
    }
  };

  const progressPercentage = (currentRound / TOTAL_ROUNDS) * 100;
  const timerPercentage = (timeLeft / TIME_PER_ROUND) * 100;

  if (gamePhase === "ready") {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            <Tag className="h-16 w-16 mx-auto text-amber-500 mb-4" />
          </motion.div>
          <CardTitle className="text-2xl">Guess the Price</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              Can you guess the market price of campus products? The closer your guess, the more points you earn!
            </p>
            <p className="text-sm text-muted-foreground">
              5 rounds, 15 seconds each. Beat the AI to win!
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 rounded-lg bg-green-500/10">
              <div className="text-lg font-bold text-green-600 dark:text-green-400">100 pts</div>
              <div className="text-xs text-muted-foreground">Exact match</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-emerald-500/10">
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">80 pts</div>
              <div className="text-xs text-muted-foreground">Within 10%</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-amber-500/10">
              <div className="text-lg font-bold text-amber-600 dark:text-amber-400">50 pts</div>
              <div className="text-xs text-muted-foreground">Within 25%</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-orange-500/10">
              <div className="text-lg font-bold text-orange-600 dark:text-orange-400">20 pts</div>
              <div className="text-xs text-muted-foreground">Within 50%</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 flex-wrap">
            {(["electronics", "fashion", "books", "food", "household"] as ProductCategory[]).map(category => {
              const Icon = getCategoryIcon(category);
              return (
                <Badge key={category} className={getCategoryColor(category)} >
                  <Icon className="h-3 w-3 mr-1" />
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </Badge>
              );
            })}
          </div>
          
          {!isPractice && stake > 0 && (
            <div className="text-center p-3 bg-primary/10 rounded-lg">
              <p className="text-sm font-medium">Stake: {formatPrice(stake)} NGN</p>
              <p className="text-xs text-muted-foreground">Win to double your stake!</p>
            </div>
          )}
          
          <Button 
            onClick={startGame} 
            size="lg" 
            className="w-full"
            data-testid="button-start-game"
          >
            <Play className="h-5 w-5 mr-2" />
            Start Game
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (gamePhase === "finished") {
    const won = totalScore > aiScore;
    const tied = totalScore === aiScore;
    
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            {won ? (
              <Trophy className="h-20 w-20 mx-auto text-yellow-500 mb-4" />
            ) : tied ? (
              <Target className="h-20 w-20 mx-auto text-blue-500 mb-4" />
            ) : (
              <Bot className="h-20 w-20 mx-auto text-red-500 mb-4" />
            )}
          </motion.div>
          <CardTitle className="text-2xl">
            {won ? "You Won!" : tied ? "It's a Tie!" : "AI Wins!"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <motion.div 
              className={`p-4 rounded-lg text-center ${won ? 'bg-green-500/10 ring-2 ring-green-500' : 'bg-muted/50'}`}
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <User className="h-8 w-8 mx-auto mb-2 text-blue-500" />
              <div className="text-sm text-muted-foreground">Your Score</div>
              <div className="text-2xl font-bold">{totalScore}</div>
            </motion.div>
            <motion.div 
              className={`p-4 rounded-lg text-center ${!won && !tied ? 'bg-green-500/10 ring-2 ring-green-500' : 'bg-muted/50'}`}
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Bot className="h-8 w-8 mx-auto mb-2 text-purple-500" />
              <div className="text-sm text-muted-foreground">AI Score</div>
              <div className="text-2xl font-bold">{aiScore}</div>
            </motion.div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm">Round Results</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {roundResults.map((result, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-xs text-muted-foreground shrink-0">R{index + 1}</span>
                    <span className="text-sm truncate">{result.product.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-xs text-right">
                      <div className="text-muted-foreground">Guess: {formatPrice(result.guessedPrice)}</div>
                      <div className="font-medium">Actual: {formatPrice(result.actualPrice)}</div>
                    </div>
                    <Badge className={getPointsBadgeColor(result.points)} >
                      +{result.points}
                    </Badge>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {!isPractice && (
            <div className="text-center p-3 rounded-lg bg-muted/50">
              {won ? (
                <p className="text-green-600 dark:text-green-400 font-medium">
                  You won {formatPrice(stake * 1.9)} NGN!
                </p>
              ) : (
                <p className="text-muted-foreground">
                  You lost {formatPrice(stake)} NGN. Better luck next time!
                </p>
              )}
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
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-lg">Guess the Price</CardTitle>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline">
              Round {currentRound}/{TOTAL_ROUNDS}
            </Badge>
            <Badge variant="secondary">
              Score: {totalScore}
            </Badge>
          </div>
        </div>
        <Progress value={progressPercentage} className="h-1 mt-2" />
      </CardHeader>
      
      <CardContent className="space-y-4">
        <AnimatePresence mode="wait">
          {gamePhase === "result" && lastRoundResult ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="space-y-4"
            >
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="flex items-center justify-center gap-2 mb-2">
                  {lastRoundResult.points > 0 ? (
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                  ) : (
                    <XCircle className="h-8 w-8 text-red-500" />
                  )}
                  <Badge className={getPointsBadgeColor(lastRoundResult.points)} >
                    +{lastRoundResult.points} points
                  </Badge>
                </div>
                
                <h3 className="font-semibold text-lg mb-1">{lastRoundResult.product.name}</h3>
                
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">Your Guess</div>
                    <div className="text-lg font-semibold">{formatPrice(lastRoundResult.guessedPrice)} NGN</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">Actual Price</div>
                    <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                      {formatPrice(lastRoundResult.actualPrice)} NGN
                    </div>
                  </div>
                </div>
                
                {lastRoundResult.percentageOff > 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    You were {lastRoundResult.percentageOff.toFixed(1)}% off
                  </p>
                )}
              </div>
              
              <Button 
                onClick={nextRound} 
                className="w-full"
                data-testid="button-next-round"
              >
                {currentRound >= TOTAL_ROUNDS ? (
                  <>See Results</>
                ) : (
                  <>
                    Next Product
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </motion.div>
          ) : currentProduct && (
            <motion.div
              key="playing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className={`flex items-center justify-between p-2 rounded-lg ${timerPercentage < 30 ? 'bg-red-500/10' : 'bg-muted/50'}`}>
                <div className="flex items-center gap-2">
                  <Clock className={`h-4 w-4 ${timerPercentage < 30 ? 'text-red-500' : 'text-muted-foreground'}`} />
                  <span className={`font-mono font-bold ${timerPercentage < 30 ? 'text-red-500' : ''}`}>
                    {timeLeft}s
                  </span>
                </div>
                <Progress 
                  value={timerPercentage} 
                  className={`w-24 h-2 ${timerPercentage < 30 ? '[&>div]:bg-red-500' : ''}`} 
                />
              </div>

              <div className="relative rounded-lg overflow-hidden bg-muted/30">
                <div className="aspect-square max-h-48 mx-auto relative">
                  {!imageLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                      <Package className="h-12 w-12 text-muted-foreground animate-pulse" />
                    </div>
                  )}
                  <img
                    src={currentProduct.image}
                    alt={currentProduct.name}
                    className={`w-full h-full object-cover transition-opacity ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageLoaded(true)}
                  />
                </div>
              </div>

              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <Badge className={getCategoryColor(currentProduct.category)} >
                    {(() => {
                      const Icon = getCategoryIcon(currentProduct.category);
                      return <Icon className="h-3 w-3 mr-1" />;
                    })()}
                    {currentProduct.category.charAt(0).toUpperCase() + currentProduct.category.slice(1)}
                  </Badge>
                </div>
                <h3 className="text-xl font-bold">{currentProduct.name}</h3>
                <p className="text-sm text-muted-foreground">{currentProduct.description}</p>
              </div>

              <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">Your Guess</div>
                  <div className="text-3xl font-bold text-primary">
                    {formatPrice(guessedPrice)} NGN
                  </div>
                </div>

                <Slider
                  value={[guessedPrice]}
                  min={currentProduct.minPrice}
                  max={currentProduct.maxPrice}
                  step={Math.round((currentProduct.maxPrice - currentProduct.minPrice) / 100)}
                  onValueChange={handleSliderChange}
                  className="w-full"
                  data-testid="slider-price-guess"
                />

                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatPrice(currentProduct.minPrice)} NGN</span>
                  <span>{formatPrice(currentProduct.maxPrice)} NGN</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Or type:</span>
                  <Input
                    type="text"
                    value={formatPrice(guessedPrice)}
                    onChange={handleInputChange}
                    className="flex-1 text-center font-mono"
                    data-testid="input-price-guess"
                  />
                  <span className="text-sm text-muted-foreground">NGN</span>
                </div>
              </div>

              <Button 
                onClick={handleSubmitGuess}
                className="w-full"
                size="lg"
                data-testid="button-submit-guess"
              >
                <Target className="h-5 w-5 mr-2" />
                Lock In Guess
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
