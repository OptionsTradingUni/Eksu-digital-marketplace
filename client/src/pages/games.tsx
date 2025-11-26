import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Gamepad2, 
  Trophy, 
  Users, 
  Coins, 
  Dice1, 
  BookOpen, 
  HelpCircle, 
  Play, 
  X, 
  Clock, 
  Loader2,
  Spade,
  Pencil,
  Keyboard,
  Grid3X3,
  Heart,
  Tag,
  User,
  Bot,
  Sparkles,
  Medal,
  Crown,
  Target,
  ArrowLeft
} from "lucide-react";
import { format } from "date-fns";
import type { Game, User as UserType, Wallet } from "@shared/schema";
import LudoGame from "@/components/games/LudoGame";
import WordBattleGame from "@/components/games/WordBattleGame";
import TriviaGame from "@/components/games/TriviaGame";

type GameWithPlayer = Game & { player1: UserType };

type GameType = "ludo" | "word_battle" | "trivia" | "whot" | "quick_draw" | "speed_typing" | "campus_bingo" | "truth_or_dare" | "guess_the_price";

type GameMode = "single_player" | "multiplayer";

type SinglePlayerMode = "practice" | "challenge";

interface GameInfoType {
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  stakeAmounts: string[];
  platformFee: number;
  playerType: string;
  supportsSinglePlayer: boolean;
  supportsMultiplayer: boolean;
}

const EXPANDED_STAKES = ["100", "200", "500", "1000", "2000", "5000", "10000", "20000", "50000", "100000"];

const GAME_INFO: Record<GameType, GameInfoType> = {
  ludo: {
    name: "Ludo",
    description: "Classic board game. First to get all tokens home wins!",
    icon: Dice1,
    color: "bg-red-500/10 text-red-600 dark:text-red-400",
    stakeAmounts: EXPANDED_STAKES,
    platformFee: 5,
    playerType: "2-4 Players",
    supportsSinglePlayer: true,
    supportsMultiplayer: true,
  },
  word_battle: {
    name: "Word Battle",
    description: "Form words from letters. Highest score wins!",
    icon: BookOpen,
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    stakeAmounts: EXPANDED_STAKES,
    platformFee: 5,
    playerType: "2 Players",
    supportsSinglePlayer: true,
    supportsMultiplayer: true,
  },
  trivia: {
    name: "Trivia",
    description: "Answer questions correctly. Most correct answers wins!",
    icon: HelpCircle,
    color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    stakeAmounts: EXPANDED_STAKES,
    platformFee: 5,
    playerType: "2+ Players",
    supportsSinglePlayer: true,
    supportsMultiplayer: true,
  },
  whot: {
    name: "Whot",
    description: "Nigerian card game classic. Be the first to empty your hand!",
    icon: Spade,
    color: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    stakeAmounts: ["100", "200", "500", "1000", "2000", "5000"],
    platformFee: 15,
    playerType: "2 Players",
    supportsSinglePlayer: true,
    supportsMultiplayer: true,
  },
  quick_draw: {
    name: "Quick Draw",
    description: "Draw and guess! Like Pictionary but faster and funnier.",
    icon: Pencil,
    color: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
    stakeAmounts: ["100", "200", "500", "1000", "2000", "5000", "10000"],
    platformFee: 15,
    playerType: "2-4 Players",
    supportsSinglePlayer: false,
    supportsMultiplayer: true,
  },
  speed_typing: {
    name: "Speed Typing",
    description: "Type the fastest! Compete on the leaderboard for glory.",
    icon: Keyboard,
    color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    stakeAmounts: ["100", "200", "500", "1000"],
    platformFee: 10,
    playerType: "Leaderboard",
    supportsSinglePlayer: true,
    supportsMultiplayer: false,
  },
  campus_bingo: {
    name: "Campus Bingo",
    description: "Live bingo experience! Mark your numbers and shout BINGO!",
    icon: Grid3X3,
    color: "bg-green-500/10 text-green-600 dark:text-green-400",
    stakeAmounts: ["100", "200", "500", "1000", "2000"],
    platformFee: 15,
    playerType: "Live",
    supportsSinglePlayer: false,
    supportsMultiplayer: true,
  },
  truth_or_dare: {
    name: "Truth or Dare",
    description: "The classic party game! Reveal truths or complete dares.",
    icon: Heart,
    color: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    stakeAmounts: ["100", "200", "500"],
    platformFee: 10,
    playerType: "Multiplayer",
    supportsSinglePlayer: false,
    supportsMultiplayer: true,
  },
  guess_the_price: {
    name: "Guess the Price",
    description: "How well do you know prices? Closest guess wins!",
    icon: Tag,
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    stakeAmounts: ["100", "200", "500", "1000", "2000", "5000", "10000"],
    platformFee: 15,
    playerType: "Multiplayer Quiz",
    supportsSinglePlayer: true,
    supportsMultiplayer: true,
  },
};

const ALL_GAME_TYPES: GameType[] = ["ludo", "word_battle", "trivia", "whot", "quick_draw", "speed_typing", "campus_bingo", "truth_or_dare", "guess_the_price"];

interface LeaderboardEntry {
  rank: number;
  username: string;
  score: number;
  gamesPlayed: number;
  winRate: number;
}

const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, username: "ChampionPlayer", score: 15420, gamesPlayed: 89, winRate: 78 },
  { rank: 2, username: "GameMaster99", score: 12850, gamesPlayed: 76, winRate: 72 },
  { rank: 3, username: "ProGamer_NG", score: 11200, gamesPlayed: 65, winRate: 68 },
  { rank: 4, username: "CampusKing", score: 9800, gamesPlayed: 54, winRate: 64 },
  { rank: 5, username: "QuickFingers", score: 8540, gamesPlayed: 48, winRate: 61 },
  { rank: 6, username: "NaijaChamp", score: 7200, gamesPlayed: 42, winRate: 58 },
  { rank: 7, username: "GameWizard", score: 6150, gamesPlayed: 38, winRate: 55 },
  { rank: 8, username: "SkillMaster", score: 5400, gamesPlayed: 35, winRate: 52 },
  { rank: 9, username: "LuckyPlayer", score: 4800, gamesPlayed: 31, winRate: 49 },
  { rank: 10, username: "RisingStar", score: 4200, gamesPlayed: 28, winRate: 46 },
];

export default function GamesPage() {
  const { toast } = useToast();
  const [gameMode, setGameMode] = useState<GameMode>("multiplayer");
  const [singlePlayerMode, setSinglePlayerMode] = useState<SinglePlayerMode>("practice");
  const [selectedGameType, setSelectedGameType] = useState<GameType>("ludo");
  const currentGameInfo = GAME_INFO[selectedGameType];
  const [selectedStake, setSelectedStake] = useState(currentGameInfo.stakeAmounts[0]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [practiceDialogOpen, setPracticeDialogOpen] = useState(false);
  const [challengeDialogOpen, setChallengeDialogOpen] = useState(false);
  const [currentPlayingGame, setCurrentPlayingGame] = useState<GameWithPlayer | null>(null);
  const [gameInProgress, setGameInProgress] = useState(false);
  const [singlePlayerGameInProgress, setSinglePlayerGameInProgress] = useState(false);
  const [activeGame, setActiveGame] = useState<{ type: GameType; stake: number; isPractice: boolean } | null>(null);

  const { data: wallet, isLoading: walletLoading } = useQuery<Wallet>({
    queryKey: ["/api/wallet"],
  });

  const { data: availableGames, isLoading: gamesLoading } = useQuery<GameWithPlayer[]>({
    queryKey: ["/api/games", selectedGameType],
    refetchInterval: 5000,
  });

  const { data: gameHistory, isLoading: historyLoading } = useQuery<Game[]>({
    queryKey: ["/api/games/history"],
  });

  const { data: user } = useQuery<UserType>({
    queryKey: ["/api/user"],
  });

  const createGameMutation = useMutation({
    mutationFn: async (data: { gameType: string; stakeAmount: string }) => {
      const response = await apiRequest("POST", "/api/games/create", data);
      return response.json();
    },
    onSuccess: (game) => {
      toast({
        title: "Game Created",
        description: `Waiting for opponent to join. Stake: ${game.stakeAmount} NGN`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      setCreateDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create game",
        description: error.message || "Unable to create game lobby",
        variant: "destructive",
      });
    },
  });

  const joinGameMutation = useMutation({
    mutationFn: async (gameId: string) => {
      const response = await apiRequest("POST", `/api/games/join/${gameId}`);
      return response.json();
    },
    onSuccess: (game) => {
      toast({
        title: "Joined Game",
        description: "Game starting now!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      setCurrentPlayingGame(game);
      setGameInProgress(true);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to join game",
        description: error.message || "Unable to join game",
        variant: "destructive",
      });
    },
  });

  const cancelGameMutation = useMutation({
    mutationFn: async (gameId: string) => {
      const response = await apiRequest("POST", `/api/games/${gameId}/cancel`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Game Cancelled",
        description: "Your stake has been refunded",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to cancel game",
        description: error.message || "Unable to cancel game",
        variant: "destructive",
      });
    },
  });

  const completeGameMutation = useMutation({
    mutationFn: async ({ gameId, winnerId }: { gameId: string; winnerId: string }) => {
      const response = await apiRequest("POST", `/api/games/${gameId}/complete`, { winnerId });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.game.winnerId === user?.id) {
        toast({
          title: "You Won!",
          description: `You earned ${data.winnings.toFixed(2)} NGN`,
        });
      } else {
        toast({
          title: "Game Over",
          description: "Better luck next time!",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games/history"] });
      setGameInProgress(false);
      setCurrentPlayingGame(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to complete game",
        description: error.message || "Unable to complete game",
        variant: "destructive",
      });
    },
  });

  const handleCreateGame = () => {
    const stakeNum = parseFloat(selectedStake);
    const walletBalance = parseFloat(wallet?.balance || "0");

    if (walletBalance < stakeNum) {
      toast({
        title: "Insufficient Balance",
        description: `You need ${selectedStake} NGN but have ${wallet?.balance || 0} NGN`,
        variant: "destructive",
      });
      return;
    }

    createGameMutation.mutate({
      gameType: selectedGameType,
      stakeAmount: selectedStake,
    });
  };

  const handleGameTypeChange = (gameType: GameType) => {
    setSelectedGameType(gameType);
    setSelectedStake(GAME_INFO[gameType].stakeAmounts[0]);
  };

  const handleJoinGame = (game: GameWithPlayer) => {
    const stakeNum = parseFloat(game.stakeAmount);
    const walletBalance = parseFloat(wallet?.balance || "0");

    if (walletBalance < stakeNum) {
      toast({
        title: "Insufficient Balance",
        description: `You need ${game.stakeAmount} NGN but have ${wallet?.balance || 0} NGN`,
        variant: "destructive",
      });
      return;
    }

    joinGameMutation.mutate(game.id);
  };

  const handleStartPractice = () => {
    setPracticeDialogOpen(false);
    setActiveGame({
      type: selectedGameType,
      stake: 0,
      isPractice: true,
    });
  };

  const handleStartChallenge = () => {
    const stakeNum = parseFloat(selectedStake);
    const walletBalance = parseFloat(wallet?.balance || "0");

    if (walletBalance < stakeNum) {
      toast({
        title: "Insufficient Balance",
        description: `You need ${selectedStake} NGN but have ${wallet?.balance || 0} NGN`,
        variant: "destructive",
      });
      return;
    }

    setChallengeDialogOpen(false);
    setActiveGame({
      type: selectedGameType,
      stake: stakeNum,
      isPractice: false,
    });
  };

  const handleGameEnd = (won: boolean, score?: number) => {
    const stakeNum = activeGame?.stake || 0;
    const isPractice = activeGame?.isPractice || true;
    const gameInfo = activeGame ? GAME_INFO[activeGame.type] : currentGameInfo;
    const winMultiplier = (100 - gameInfo.platformFee) / 100;
    
    setActiveGame(null);
    
    if (isPractice) {
      toast({
        title: won ? "Practice Complete - You Won!" : "Practice Complete",
        description: won 
          ? `Great job! You beat the AI${score ? ` with a score of ${score}` : ""}. No stakes in practice mode.`
          : "Keep practicing! The AI won this round.",
      });
    } else {
      if (won) {
        const winnings = stakeNum * 2 * winMultiplier;
        toast({
          title: "Challenge Won!",
          description: `You beat the AI and earned ${winnings.toLocaleString()} NGN!`,
        });
      } else {
        toast({
          title: "Challenge Lost",
          description: `The AI won this round. You lost ${stakeNum.toLocaleString()} NGN.`,
          variant: "destructive",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games/history"] });
    }
  };

  const renderActiveGame = () => {
    if (!activeGame) return null;
    
    const commonProps = {
      stake: activeGame.stake,
      onGameEnd: handleGameEnd,
      isPractice: activeGame.isPractice,
    };
    
    switch (activeGame.type) {
      case "ludo":
        return <LudoGame {...commonProps} />;
      case "word_battle":
        return <WordBattleGame {...commonProps} />;
      case "trivia":
        return <TriviaGame {...commonProps} />;
      default:
        return (
          <Card className="p-8 text-center">
            <CardContent>
              <p className="text-muted-foreground mb-4">
                {GAME_INFO[activeGame.type].name} is coming soon!
              </p>
              <Button onClick={() => setActiveGame(null)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Games
              </Button>
            </CardContent>
          </Card>
        );
    }
  };

  const handleModeChange = (mode: GameMode) => {
    setGameMode(mode);
    const currentGame = GAME_INFO[selectedGameType];
    if (mode === "single_player" && !currentGame.supportsSinglePlayer) {
      const singlePlayerGame = ALL_GAME_TYPES.find(g => GAME_INFO[g].supportsSinglePlayer);
      if (singlePlayerGame) {
        setSelectedGameType(singlePlayerGame);
        setSelectedStake(GAME_INFO[singlePlayerGame].stakeAmounts[0]);
      }
    } else if (mode === "multiplayer" && !currentGame.supportsMultiplayer) {
      const multiplayerGame = ALL_GAME_TYPES.find(g => GAME_INFO[g].supportsMultiplayer);
      if (multiplayerGame) {
        setSelectedGameType(multiplayerGame);
        setSelectedStake(GAME_INFO[multiplayerGame].stakeAmounts[0]);
      }
    }
  };

  const filteredGameTypes = ALL_GAME_TYPES.filter(gameType => {
    const info = GAME_INFO[gameType];
    return gameMode === "single_player" ? info.supportsSinglePlayer : info.supportsMultiplayer;
  });

  const filteredGames = availableGames?.filter(g => g.gameType === selectedGameType) || [];
  const userWaitingGames = filteredGames.filter(g => g.player1Id === user?.id);
  const otherGames = filteredGames.filter(g => g.player1Id !== user?.id);

  const GameIcon = currentGameInfo.icon;
  const winMultiplier = (100 - currentGameInfo.platformFee) / 100;

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-4 w-4 text-yellow-500" />;
      case 2:
        return <Medal className="h-4 w-4 text-gray-400" />;
      case 3:
        return <Medal className="h-4 w-4 text-amber-600" />;
      default:
        return <span className="text-xs font-medium text-muted-foreground">#{rank}</span>;
    }
  };

  if (activeGame) {
    return (
      <div className="container max-w-4xl mx-auto p-4 pb-20">
        <div className="mb-4 flex items-center justify-between gap-4">
          <Button variant="ghost" onClick={() => setActiveGame(null)} data-testid="button-back-to-games">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Games
          </Button>
          <div className="flex items-center gap-2">
            {!activeGame.isPractice && (
              <Badge variant="secondary" className="text-sm">
                <Coins className="h-3 w-3 mr-1" />
                Stake: {activeGame.stake.toLocaleString()} NGN
              </Badge>
            )}
            <Badge variant={activeGame.isPractice ? "outline" : "default"} className="text-sm">
              {activeGame.isPractice ? "Practice Mode" : "Challenge Mode"}
            </Badge>
          </div>
        </div>
        {renderActiveGame()}
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-4 pb-20 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-md bg-primary/10">
            <Gamepad2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Games</h1>
            <p className="text-muted-foreground text-sm">Play and win with other students</p>
          </div>
        </div>

        <Card className="w-full sm:w-auto">
          <CardContent className="p-3 flex items-center gap-3">
            <Coins className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="text-xs text-muted-foreground">Balance</p>
              {walletLoading ? (
                <Skeleton className="h-5 w-16" />
              ) : (
                <p className="font-bold" data-testid="text-wallet-balance">{parseFloat(wallet?.balance || "0").toLocaleString()} NGN</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={gameMode} onValueChange={(v) => handleModeChange(v as GameMode)} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="single_player" className="flex items-center gap-2" data-testid="tab-single-player">
            <User className="h-4 w-4" />
            Single Player
          </TabsTrigger>
          <TabsTrigger value="multiplayer" className="flex items-center gap-2" data-testid="tab-multiplayer">
            <Users className="h-4 w-4" />
            Multiplayer
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {gameMode === "single_player" && (
        <div className="flex gap-2">
          <Button
            variant={singlePlayerMode === "practice" ? "default" : "outline"}
            onClick={() => setSinglePlayerMode("practice")}
            className="flex-1"
            data-testid="button-practice-mode"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Practice Mode
            <Badge variant="secondary" className="ml-2 text-[10px]">Free</Badge>
          </Button>
          <Button
            variant={singlePlayerMode === "challenge" ? "default" : "outline"}
            onClick={() => setSinglePlayerMode("challenge")}
            className="flex-1"
            data-testid="button-challenge-mode"
          >
            <Target className="h-4 w-4 mr-2" />
            Challenge AI
            <Badge variant="secondary" className="ml-2 text-[10px]">Stakes</Badge>
          </Button>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h3 className="text-sm font-medium text-muted-foreground">Select Game</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {gameMode === "single_player" && (
              <Badge variant="outline" className="text-xs">
                <Bot className="h-3 w-3 mr-1" />
                vs AI
              </Badge>
            )}
            {gameMode === "multiplayer" && (
              <Badge variant="outline" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                vs Players
              </Badge>
            )}
          </div>
        </div>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-3 pb-4">
            {filteredGameTypes.map((gameType) => {
              const info = GAME_INFO[gameType];
              const Icon = info.icon;
              const isSelected = selectedGameType === gameType;
              return (
                <button
                  key={gameType}
                  onClick={() => handleGameTypeChange(gameType)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-md min-w-[100px] transition-all ${
                    isSelected 
                      ? `${info.color} ring-2 ring-offset-2 ring-offset-background ring-current` 
                      : 'bg-muted/50 hover-elevate'
                  }`}
                  data-testid={`tab-${gameType}`}
                >
                  <div className={`p-2 rounded-md ${info.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-medium text-center whitespace-normal leading-tight">
                    {info.name}
                  </span>
                  <div className="flex gap-1 flex-wrap justify-center">
                    {info.supportsSinglePlayer && info.supportsMultiplayer ? (
                      <Badge variant="secondary" className="text-[10px]">Both</Badge>
                    ) : info.supportsSinglePlayer ? (
                      <Badge variant="secondary" className="text-[10px]">Single</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Multi</Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <div className="space-y-6">
        <Card className={`${currentGameInfo.color} ${gameMode === "single_player" ? "border-2 border-dashed" : ""}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="flex items-center gap-2">
                <GameIcon className="h-5 w-5" />
                {currentGameInfo.name}
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {gameMode === "single_player" ? (
                  <>
                    <Badge variant="outline" className="text-xs">
                      <Bot className="h-3 w-3 mr-1" />
                      AI Opponent
                    </Badge>
                    {singlePlayerMode === "practice" ? (
                      <Badge className="text-xs bg-green-500/20 text-green-600 dark:text-green-400">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Practice
                      </Badge>
                    ) : (
                      <Badge className="text-xs bg-orange-500/20 text-orange-600 dark:text-orange-400">
                        <Target className="h-3 w-3 mr-1" />
                        Challenge
                      </Badge>
                    )}
                  </>
                ) : (
                  <>
                    <Badge variant="outline" className="text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      {currentGameInfo.playerType}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {currentGameInfo.platformFee}% Fee
                    </Badge>
                  </>
                )}
              </div>
            </div>
            <CardDescription className="text-inherit opacity-80">
              {currentGameInfo.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3 flex-wrap">
            {gameMode === "single_player" ? (
              singlePlayerMode === "practice" ? (
                <Dialog open={practiceDialogOpen} onOpenChange={setPracticeDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-start-practice">
                      <Sparkles className="h-4 w-4 mr-2" />
                      Start Practice
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-green-500" />
                        Practice Mode - {currentGameInfo.name}
                      </DialogTitle>
                      <DialogDescription>
                        Play against AI for free. No stakes, no pressure - just practice and improve your skills!
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                      <div className="flex items-center gap-3 p-3 rounded-md bg-green-500/10">
                        <Bot className="h-8 w-8 text-green-500" />
                        <div>
                          <p className="font-medium">AI Opponent</p>
                          <p className="text-sm text-muted-foreground">Adaptive difficulty based on your skill</p>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p>Practice mode benefits:</p>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>No stake required</li>
                          <li>Learn game mechanics</li>
                          <li>Build your strategy</li>
                          <li>Track your progress</li>
                        </ul>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleStartPractice} data-testid="button-confirm-practice">
                        <Play className="h-4 w-4 mr-2" />
                        Start Practice Game
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              ) : (
                <Dialog open={challengeDialogOpen} onOpenChange={setChallengeDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-start-challenge">
                      <Target className="h-4 w-4 mr-2" />
                      Challenge AI
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-orange-500" />
                        Challenge Mode - {currentGameInfo.name}
                      </DialogTitle>
                      <DialogDescription>
                        Play against AI for real stakes. Win and earn {100 - currentGameInfo.platformFee}% of the pot!
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="flex items-center gap-3 p-3 rounded-md bg-orange-500/10">
                        <Bot className="h-8 w-8 text-orange-500" />
                        <div>
                          <p className="font-medium">AI Challenger</p>
                          <p className="text-sm text-muted-foreground">Compete for real stakes</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Stake Amount (NGN)</label>
                        <Select value={selectedStake} onValueChange={setSelectedStake}>
                          <SelectTrigger data-testid="select-challenge-stake">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {currentGameInfo.stakeAmounts.map((amount) => (
                              <SelectItem key={amount} value={amount}>
                                {parseInt(amount).toLocaleString()} NGN
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-between gap-4 text-sm">
                        <span className="text-muted-foreground">Potential Win:</span>
                        <span className="font-bold text-green-600">
                          {(parseFloat(selectedStake) * 2 * winMultiplier).toLocaleString()} NGN
                        </span>
                      </div>
                      <div className="flex justify-between gap-4 text-sm">
                        <span className="text-muted-foreground">Platform Fee:</span>
                        <span>{currentGameInfo.platformFee}%</span>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button 
                        onClick={handleStartChallenge}
                        data-testid="button-confirm-challenge"
                      >
                        <Coins className="h-4 w-4 mr-2" />
                        Stake {parseInt(selectedStake).toLocaleString()} NGN
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )
            ) : (
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-game">
                    <Play className="h-4 w-4 mr-2" />
                    Create Game
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create {currentGameInfo.name} Game</DialogTitle>
                    <DialogDescription>
                      Select your stake amount. Winner takes {100 - currentGameInfo.platformFee}% of the total pot.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Stake Amount (NGN)</label>
                      <Select value={selectedStake} onValueChange={setSelectedStake}>
                        <SelectTrigger data-testid="select-stake">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {currentGameInfo.stakeAmounts.map((amount) => (
                            <SelectItem key={amount} value={amount}>
                              {parseInt(amount).toLocaleString()} NGN
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-between gap-4 text-sm">
                      <span className="text-muted-foreground">Potential Win:</span>
                      <span className="font-bold text-green-600">
                        {(parseFloat(selectedStake) * 2 * winMultiplier).toLocaleString()} NGN
                      </span>
                    </div>
                    <div className="flex justify-between gap-4 text-sm">
                      <span className="text-muted-foreground">Platform Fee:</span>
                      <span>{currentGameInfo.platformFee}%</span>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      onClick={handleCreateGame} 
                      disabled={createGameMutation.isPending}
                      data-testid="button-confirm-create"
                    >
                      {createGameMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Coins className="h-4 w-4 mr-2" />
                      )}
                      Stake {parseInt(selectedStake).toLocaleString()} NGN
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            <span className="text-sm text-muted-foreground">
              {gameMode === "single_player" && singlePlayerMode === "practice" 
                ? "Free to play - no stakes" 
                : `Stakes: ${currentGameInfo.stakeAmounts.slice(0, 5).map(s => `${parseInt(s).toLocaleString()}`).join(', ')}${currentGameInfo.stakeAmounts.length > 5 ? '...' : ''} NGN`
              }
            </span>
          </CardContent>
        </Card>

        {gameMode === "single_player" && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              {currentGameInfo.name} Leaderboard
            </h3>
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {MOCK_LEADERBOARD.slice(0, 5).map((entry) => (
                    <div 
                      key={entry.rank} 
                      className={`flex items-center justify-between gap-4 p-3 ${
                        entry.rank <= 3 ? 'bg-yellow-500/5' : ''
                      }`}
                      data-testid={`leaderboard-entry-${entry.rank}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 flex items-center justify-center">
                          {getRankIcon(entry.rank)}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{entry.username}</p>
                          <p className="text-xs text-muted-foreground">
                            {entry.gamesPlayed} games | {entry.winRate}% win rate
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm">{entry.score.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">points</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Button variant="outline" size="sm" className="w-full" data-testid="button-view-full-leaderboard">
              View Full Leaderboard
            </Button>
          </div>
        )}

        {gameMode === "multiplayer" && userWaitingGames.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Your Waiting Games
            </h3>
            {userWaitingGames.map((game) => (
              <Card key={game.id} className="border-dashed">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={game.player1.profileImageUrl || undefined} />
                      <AvatarFallback>
                        {game.player1.firstName?.[0] || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">Waiting for opponent...</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {parseInt(game.stakeAmount).toLocaleString()} NGN
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          <Users className="h-3 w-3 mr-1" />
                          Multi
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(game.createdAt || new Date()), "MMM d, h:mm a")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-cancel-game-${game.id}`}>
                        <X className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel Game?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Your stake of {parseInt(game.stakeAmount).toLocaleString()} NGN will be refunded to your wallet.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep Waiting</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => cancelGameMutation.mutate(game.id)}
                          disabled={cancelGameMutation.isPending}
                        >
                          Cancel Game
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {gameMode === "multiplayer" && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Available Lobbies
            </h3>
            
            {gamesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="h-9 w-20" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : otherGames.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <GameIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No games available</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Be the first to create a {currentGameInfo.name} game!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {otherGames.map((game) => (
                  <Card key={game.id} data-testid={`card-game-${game.id}`}>
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={game.player1.profileImageUrl || undefined} />
                          <AvatarFallback>
                            {game.player1.firstName?.[0] || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {game.player1.firstName} {game.player1.lastName?.[0]}.
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="text-xs">
                              <Coins className="h-3 w-3 mr-1" />
                              {parseInt(game.stakeAmount).toLocaleString()} NGN
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              <Users className="h-3 w-3 mr-1" />
                              Multi
                            </Badge>
                            <span className="text-xs text-green-600 font-medium">
                              Win: {(parseFloat(game.stakeAmount) * 2 * winMultiplier).toLocaleString()} NGN
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleJoinGame(game)}
                        disabled={joinGameMutation.isPending}
                        data-testid={`button-join-game-${game.id}`}
                      >
                        {joinGameMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Join"
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Recent Games
          </h3>
          
          {historyLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !gameHistory?.length ? (
            <Card>
              <CardContent className="p-4 text-center text-muted-foreground">
                No games played yet
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {gameHistory.slice(0, 5).map((game) => (
                <Card key={game.id} data-testid={`card-history-${game.id}`}>
                  <CardContent className="p-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-md ${GAME_INFO[game.gameType as keyof typeof GAME_INFO]?.color || "bg-muted"}`}>
                        {(() => {
                          const Icon = GAME_INFO[game.gameType as keyof typeof GAME_INFO]?.icon || Gamepad2;
                          return <Icon className="h-4 w-4" />;
                        })()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium capitalize">
                            {game.gameType.replace(/_/g, " ")}
                          </span>
                          <Badge 
                            variant={game.status === "completed" ? "secondary" : "outline"}
                            className="text-xs"
                          >
                            {game.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {game.createdAt && format(new Date(game.createdAt), "MMM d, h:mm a")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {game.status === "completed" && (
                        <Badge 
                          variant={game.winnerId === user?.id ? "default" : "outline"}
                          className={game.winnerId === user?.id ? "bg-green-500" : ""}
                        >
                          {game.winnerId === user?.id ? (
                            <>
                              <Trophy className="h-3 w-3 mr-1" />
                              Won
                            </>
                          ) : (
                            "Lost"
                          )}
                        </Badge>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {parseInt(game.stakeAmount).toLocaleString()} NGN
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={gameInProgress} onOpenChange={setGameInProgress}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GameIcon className="h-5 w-5" />
              {currentGameInfo.name} in Progress
            </DialogTitle>
            <DialogDescription>
              Game simulation running...
            </DialogDescription>
          </DialogHeader>
          <div className="py-8 flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-24 w-24 rounded-full border-4 border-primary/20 flex items-center justify-center">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
              </div>
            </div>
            <p className="text-center text-muted-foreground">
              Playing against opponent...<br />
              <span className="text-sm">Winner will be determined shortly</span>
            </p>
            {currentPlayingGame && (
              <Button
                variant="outline"
                onClick={() => {
                  const winnerId = Math.random() > 0.5 ? user?.id : currentPlayingGame.player1.id;
                  if (winnerId) {
                    completeGameMutation.mutate({ gameId: currentPlayingGame.id, winnerId });
                  }
                }}
                disabled={completeGameMutation.isPending}
              >
                {completeGameMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Simulate Result
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={singlePlayerGameInProgress} onOpenChange={setSinglePlayerGameInProgress}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              {singlePlayerMode === "practice" ? "Practice" : "Challenge"} - {currentGameInfo.name}
            </DialogTitle>
            <DialogDescription>
              {singlePlayerMode === "practice" 
                ? "Practice game in progress..." 
                : "Challenge game in progress..."
              }
            </DialogDescription>
          </DialogHeader>
          <div className="py-8 flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-24 w-24 rounded-full border-4 border-primary/20 flex items-center justify-center">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
              </div>
            </div>
            <p className="text-center text-muted-foreground">
              Playing against AI...<br />
              <span className="text-sm">
                {singlePlayerMode === "practice" 
                  ? "This is just practice - no stakes!" 
                  : `Stakes: ${parseInt(selectedStake).toLocaleString()} NGN`
                }
              </span>
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
