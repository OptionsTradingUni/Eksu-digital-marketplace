import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Gamepad2, Trophy, Users, Coins, Dice1, BookOpen, HelpCircle, Play, X, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { Game, User, Wallet } from "@shared/schema";

type GameWithPlayer = Game & { player1: User };

const STAKE_AMOUNTS = ["100", "200", "500", "1000", "2000"];

const GAME_INFO = {
  ludo: {
    name: "Ludo",
    description: "Classic board game. First to get all tokens home wins!",
    icon: Dice1,
    color: "bg-red-500/10 text-red-600 dark:text-red-400",
  },
  word_battle: {
    name: "Word Battle",
    description: "Form words from letters. Highest score wins!",
    icon: BookOpen,
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  trivia: {
    name: "Trivia",
    description: "Answer questions correctly. Most correct answers wins!",
    icon: HelpCircle,
    color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  },
};

export default function GamesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"ludo" | "word_battle" | "trivia">("ludo");
  const [selectedStake, setSelectedStake] = useState("100");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeGame, setActiveGame] = useState<GameWithPlayer | null>(null);
  const [gameInProgress, setGameInProgress] = useState(false);

  const { data: wallet, isLoading: walletLoading } = useQuery<Wallet>({
    queryKey: ["/api/wallet"],
  });

  const { data: availableGames, isLoading: gamesLoading } = useQuery<GameWithPlayer[]>({
    queryKey: ["/api/games", activeTab],
    refetchInterval: 5000,
  });

  const { data: gameHistory, isLoading: historyLoading } = useQuery<Game[]>({
    queryKey: ["/api/games/history"],
  });

  const { data: user } = useQuery<User>({
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
      setActiveGame(game);
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
      setActiveGame(null);
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
      gameType: activeTab,
      stakeAmount: selectedStake,
    });
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

  const simulateGame = (game: GameWithPlayer) => {
    setTimeout(() => {
      const winnerId = Math.random() > 0.5 ? user?.id : game.player1.id;
      if (winnerId) {
        completeGameMutation.mutate({ gameId: game.id, winnerId });
      }
    }, 3000);
  };

  const filteredGames = availableGames?.filter(g => g.gameType === activeTab) || [];
  const userWaitingGames = filteredGames.filter(g => g.player1Id === user?.id);
  const otherGames = filteredGames.filter(g => g.player1Id !== user?.id);

  const GameIcon = GAME_INFO[activeTab].icon;

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

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ludo" className="flex items-center gap-2" data-testid="tab-ludo">
            <Dice1 className="h-4 w-4" />
            <span className="hidden sm:inline">Ludo</span>
          </TabsTrigger>
          <TabsTrigger value="word_battle" className="flex items-center gap-2" data-testid="tab-word-battle">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Word Battle</span>
          </TabsTrigger>
          <TabsTrigger value="trivia" className="flex items-center gap-2" data-testid="tab-trivia">
            <HelpCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Trivia</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-6 mt-6">
          <Card className={GAME_INFO[activeTab].color}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <GameIcon className="h-5 w-5" />
                {GAME_INFO[activeTab].name}
              </CardTitle>
              <CardDescription className="text-inherit opacity-80">
                {GAME_INFO[activeTab].description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-game">
                    <Play className="h-4 w-4 mr-2" />
                    Create Game
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create {GAME_INFO[activeTab].name} Game</DialogTitle>
                    <DialogDescription>
                      Select your stake amount. Winner takes 95% of the total pot.
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
                          {STAKE_AMOUNTS.map((amount) => (
                            <SelectItem key={amount} value={amount}>
                              {parseInt(amount).toLocaleString()} NGN
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Potential Win:</span>
                      <span className="font-bold text-green-600">
                        {(parseFloat(selectedStake) * 2 * 0.95).toLocaleString()} NGN
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Platform Fee:</span>
                      <span>5%</span>
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
            </CardContent>
          </Card>

          {userWaitingGames.length > 0 && (
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
                    Be the first to create a {GAME_INFO[activeTab].name} game!
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
                            <span className="text-xs text-green-600 font-medium">
                              Win: {(parseFloat(game.stakeAmount) * 2 * 0.95).toLocaleString()} NGN
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
                          <div className="flex items-center gap-2">
                            <span className="font-medium capitalize">
                              {game.gameType.replace("_", " ")}
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
        </TabsContent>
      </Tabs>

      <Dialog open={gameInProgress} onOpenChange={setGameInProgress}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GameIcon className="h-5 w-5" />
              {GAME_INFO[activeTab].name} in Progress
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
            {activeGame && (
              <Button
                variant="outline"
                onClick={() => {
                  const winnerId = Math.random() > 0.5 ? user?.id : activeGame.player1.id;
                  if (winnerId) {
                    completeGameMutation.mutate({ gameId: activeGame.id, winnerId });
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
    </div>
  );
}
