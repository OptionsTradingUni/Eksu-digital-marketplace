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
  Clock,
  Crown
} from "lucide-react";

interface ChessBlitzGameProps {
  stake: number;
  onGameEnd: (won: boolean, score?: number) => void;
  isPractice: boolean;
}

type Player = "white" | "black";
type PieceType = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";
type GamePhase = "ready" | "playing" | "finished";

interface Piece {
  type: PieceType;
  color: Player;
  hasMoved?: boolean;
}

interface Position { row: number; col: number; }

interface Move {
  from: Position;
  to: Position;
  capture?: Piece;
  promotion?: PieceType;
  isCastle?: "kingside" | "queenside";
  isEnPassant?: boolean;
}

interface GameState {
  board: Board;
  enPassantTarget: Position | null;
}

type Board = (Piece | null)[][];

const BOARD_SIZE = 8;
const TIME_LIMIT = 180;

const PIECE_SYMBOLS: Record<PieceType, Record<Player, string>> = {
  king: { white: "♔", black: "♚" },
  queen: { white: "♕", black: "♛" },
  rook: { white: "♖", black: "♜" },
  bishop: { white: "♗", black: "♝" },
  knight: { white: "♘", black: "♞" },
  pawn: { white: "♙", black: "♟" },
};

const PIECE_VALUES: Record<PieceType, number> = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 100 };

const createInitialBoard = (): Board => {
  const board: Board = Array(8).fill(null).map(() => Array(8).fill(null));
  const backRow: PieceType[] = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];
  for (let col = 0; col < 8; col++) {
    board[0][col] = { type: backRow[col], color: "black" };
    board[1][col] = { type: "pawn", color: "black" };
    board[6][col] = { type: "pawn", color: "white" };
    board[7][col] = { type: backRow[col], color: "white" };
  }
  return board;
};

const copyBoard = (board: Board): Board => board.map(row => row.map(cell => cell ? { ...cell } : null));

const isValid = (r: number, c: number): boolean => r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;

const findKing = (board: Board, color: Player): Position | null => {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = board[r][c];
      if (p && p.type === "king" && p.color === color) return { row: r, col: c };
    }
  }
  return null;
};

const getRawMoves = (state: GameState, pos: Position, piece: Piece): Move[] => {
  const moves: Move[] = [];
  const { board, enPassantTarget } = state;
  const { row, col } = pos;
  
  const addMove = (tr: number, tc: number): boolean => {
    if (!isValid(tr, tc)) return false;
    const target = board[tr][tc];
    if (target && target.color === piece.color) return false;
    moves.push({ from: pos, to: { row: tr, col: tc }, capture: target || undefined });
    return !target;
  };
  
  switch (piece.type) {
    case "pawn": {
      const dir = piece.color === "white" ? -1 : 1;
      const start = piece.color === "white" ? 6 : 1;
      const promoRow = piece.color === "white" ? 0 : 7;
      
      if (isValid(row + dir, col) && !board[row + dir][col]) {
        if (row + dir === promoRow) {
          moves.push({ from: pos, to: { row: row + dir, col }, promotion: "queen" });
        } else {
          moves.push({ from: pos, to: { row: row + dir, col } });
        }
        if (row === start && !board[row + dir * 2][col]) {
          moves.push({ from: pos, to: { row: row + dir * 2, col } });
        }
      }
      
      for (const dc of [-1, 1]) {
        const tr = row + dir, tc = col + dc;
        if (isValid(tr, tc)) {
          const target = board[tr][tc];
          if (target && target.color !== piece.color) {
            if (tr === promoRow) {
              moves.push({ from: pos, to: { row: tr, col: tc }, capture: target, promotion: "queen" });
            } else {
              moves.push({ from: pos, to: { row: tr, col: tc }, capture: target });
            }
          }
          if (enPassantTarget && enPassantTarget.row === tr && enPassantTarget.col === tc) {
            moves.push({ from: pos, to: { row: tr, col: tc }, isEnPassant: true, capture: board[row][tc] || undefined });
          }
        }
      }
      break;
    }
    case "knight": {
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) addMove(row + dr, col + dc);
      break;
    }
    case "bishop": {
      for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
        for (let i = 1; i < BOARD_SIZE; i++) if (!addMove(row + dr * i, col + dc * i)) break;
      }
      break;
    }
    case "rook": {
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        for (let i = 1; i < BOARD_SIZE; i++) if (!addMove(row + dr * i, col + dc * i)) break;
      }
      break;
    }
    case "queen": {
      for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        for (let i = 1; i < BOARD_SIZE; i++) if (!addMove(row + dr * i, col + dc * i)) break;
      }
      break;
    }
    case "king": {
      for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) addMove(row + dr, col + dc);
      break;
    }
  }
  return moves;
};

const isSquareAttacked = (board: Board, pos: Position, by: Player): boolean => {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = board[r][c];
      if (p && p.color === by) {
        if (p.type === "pawn") {
          const dir = p.color === "white" ? -1 : 1;
          if (pos.row === r + dir && (pos.col === c - 1 || pos.col === c + 1)) return true;
        } else {
          const state: GameState = { board, enPassantTarget: null };
          const moves = getRawMoves(state, { row: r, col: c }, p);
          if (moves.some(m => m.to.row === pos.row && m.to.col === pos.col)) return true;
        }
      }
    }
  }
  return false;
};

const isInCheck = (board: Board, color: Player): boolean => {
  const k = findKing(board, color);
  return k ? isSquareAttacked(board, k, color === "white" ? "black" : "white") : false;
};

const applyMove = (state: GameState, move: Move): GameState => {
  const newBoard = copyBoard(state.board);
  const piece = newBoard[move.from.row][move.from.col];
  if (!piece) return state;
  
  newBoard[move.from.row][move.from.col] = null;
  
  let newEnPassant: Position | null = null;
  
  if (move.isCastle) {
    const backRank = piece.color === "white" ? 7 : 0;
    if (move.isCastle === "kingside") {
      newBoard[backRank][7] = null;
      newBoard[backRank][5] = { type: "rook", color: piece.color, hasMoved: true };
      newBoard[backRank][6] = { ...piece, hasMoved: true };
    } else {
      newBoard[backRank][0] = null;
      newBoard[backRank][3] = { type: "rook", color: piece.color, hasMoved: true };
      newBoard[backRank][2] = { ...piece, hasMoved: true };
    }
    return { board: newBoard, enPassantTarget: null };
  }
  
  if (move.isEnPassant) {
    const captureRow = move.to.row + (piece.color === "white" ? 1 : -1);
    newBoard[captureRow][move.to.col] = null;
  }
  
  if (piece.type === "pawn" && Math.abs(move.to.row - move.from.row) === 2) {
    newEnPassant = { row: (move.from.row + move.to.row) / 2, col: move.from.col };
  }
  
  if (move.promotion) {
    newBoard[move.to.row][move.to.col] = { type: move.promotion, color: piece.color, hasMoved: true };
  } else {
    newBoard[move.to.row][move.to.col] = { ...piece, hasMoved: true };
  }
  
  return { board: newBoard, enPassantTarget: newEnPassant };
};

const getValidMoves = (state: GameState, player: Player): Move[] => {
  const allMoves: Move[] = [];
  const { board } = state;
  
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (piece && piece.color === player) {
        const moves = getRawMoves(state, { row: r, col: c }, piece);
        for (const m of moves) {
          const newState = applyMove(state, m);
          if (!isInCheck(newState.board, player)) allMoves.push(m);
        }
        
        if (piece.type === "king" && !piece.hasMoved && !isInCheck(board, player)) {
          const backRank = player === "white" ? 7 : 0;
          if (r === backRank && c === 4) {
            const ksRook = board[backRank][7];
            if (ksRook && ksRook.type === "rook" && !ksRook.hasMoved &&
                !board[backRank][5] && !board[backRank][6] &&
                !isSquareAttacked(board, { row: backRank, col: 5 }, player === "white" ? "black" : "white") &&
                !isSquareAttacked(board, { row: backRank, col: 6 }, player === "white" ? "black" : "white")) {
              allMoves.push({ from: { row: r, col: c }, to: { row: backRank, col: 6 }, isCastle: "kingside" });
            }
            
            const qsRook = board[backRank][0];
            if (qsRook && qsRook.type === "rook" && !qsRook.hasMoved &&
                !board[backRank][1] && !board[backRank][2] && !board[backRank][3] &&
                !isSquareAttacked(board, { row: backRank, col: 3 }, player === "white" ? "black" : "white") &&
                !isSquareAttacked(board, { row: backRank, col: 2 }, player === "white" ? "black" : "white")) {
              allMoves.push({ from: { row: r, col: c }, to: { row: backRank, col: 2 }, isCastle: "queenside" });
            }
          }
        }
      }
    }
  }
  return allMoves;
};

const evaluateBoard = (board: Board): number => {
  let score = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = board[r][c];
      if (p) {
        const v = PIECE_VALUES[p.type];
        const posBonus = p.type === "pawn" ? (p.color === "white" ? (6 - r) * 0.1 : (r - 1) * 0.1) : 0;
        score += (p.color === "black" ? 1 : -1) * (v + posBonus);
      }
    }
  }
  return score;
};

const minimax = (state: GameState, depth: number, alpha: number, beta: number, isMax: boolean): { score: number; move: Move | null } => {
  const player = isMax ? "black" : "white";
  const moves = getValidMoves(state, player);
  
  if (depth === 0) return { score: evaluateBoard(state.board), move: null };
  
  if (moves.length === 0) {
    if (isInCheck(state.board, player)) return { score: isMax ? -1000 : 1000, move: null };
    return { score: 0, move: null };
  }
  
  moves.sort((a, b) => (b.capture ? PIECE_VALUES[b.capture.type] : 0) - (a.capture ? PIECE_VALUES[a.capture.type] : 0));
  
  let best: Move | null = null;
  
  if (isMax) {
    let maxS = -Infinity;
    for (const m of moves) {
      const ns = applyMove(state, m);
      const res = minimax(ns, depth - 1, alpha, beta, false);
      if (res.score > maxS) { maxS = res.score; best = m; }
      alpha = Math.max(alpha, res.score);
      if (beta <= alpha) break;
    }
    return { score: maxS, move: best };
  } else {
    let minS = Infinity;
    for (const m of moves) {
      const ns = applyMove(state, m);
      const res = minimax(ns, depth - 1, alpha, beta, true);
      if (res.score < minS) { minS = res.score; best = m; }
      beta = Math.min(beta, res.score);
      if (beta <= alpha) break;
    }
    return { score: minS, move: best };
  }
};

const getAIMove = (state: GameState): Move | null => minimax(state, 3, -Infinity, Infinity, true).move;

export default function ChessBlitzGame({ stake, onGameEnd, isPractice }: ChessBlitzGameProps) {
  const [gamePhase, setGamePhase] = useState<GamePhase>("ready");
  const [gameState, setGameState] = useState<GameState>({ board: createInitialBoard(), enPassantTarget: null });
  const [currentPlayer, setCurrentPlayer] = useState<Player>("white");
  const [selectedPiece, setSelectedPiece] = useState<Position | null>(null);
  const [validMoves, setValidMoves] = useState<Move[]>([]);
  const [winner, setWinner] = useState<Player | "draw" | null>(null);
  const [message, setMessage] = useState("Click Start to begin!");
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [whiteTime, setWhiteTime] = useState(TIME_LIMIT);
  const [blackTime, setBlackTime] = useState(TIME_LIMIT);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (gamePhase === "playing" && !winner) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        if (currentPlayer === "white") {
          setWhiteTime(prev => {
            if (prev <= 1) {
              setWinner("black");
              setGamePhase("finished");
              setMessage("Time's up! AI wins!");
              return 0;
            }
            return prev - 1;
          });
        } else {
          setBlackTime(prev => {
            if (prev <= 1) {
              setWinner("white");
              setGamePhase("finished");
              setMessage("Time's up! You win!");
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gamePhase, currentPlayer, winner]);

  const checkGameEnd = useCallback((state: GameState, nextPlayer: Player) => {
    const moves = getValidMoves(state, nextPlayer);
    if (moves.length === 0) {
      if (isInCheck(state.board, nextPlayer)) {
        const w = nextPlayer === "white" ? "black" : "white";
        setWinner(w);
        setGamePhase("finished");
        setMessage(w === "white" ? "Checkmate! You win!" : "Checkmate! AI wins!");
      } else {
        setWinner("draw");
        setGamePhase("finished");
        setMessage("Stalemate! It's a draw!");
      }
      return true;
    }
    if (isInCheck(state.board, nextPlayer)) {
      setMessage(nextPlayer === "white" ? "Check! Defend your king!" : "Check!");
    }
    return false;
  }, []);

  const makeAIMove = useCallback(() => {
    setIsAIThinking(true);
    setMessage("AI is thinking...");
    setTimeout(() => {
      const aiMove = getAIMove(gameState);
      if (aiMove) {
        const newState = applyMove(gameState, aiMove);
        setGameState(newState);
        if (!checkGameEnd(newState, "white")) {
          setCurrentPlayer("white");
          if (!isInCheck(newState.board, "white")) setMessage("Your turn");
        }
      } else {
        setWinner("white");
        setGamePhase("finished");
        setMessage("You win!");
      }
      setIsAIThinking(false);
    }, 600);
  }, [gameState, checkGameEnd]);

  useEffect(() => {
    if (gamePhase === "playing" && currentPlayer === "black" && !isAIThinking && !winner) makeAIMove();
  }, [currentPlayer, gamePhase, isAIThinking, makeAIMove, winner]);

  const startGame = () => {
    setGameState({ board: createInitialBoard(), enPassantTarget: null });
    setCurrentPlayer("white");
    setSelectedPiece(null);
    setValidMoves([]);
    setWinner(null);
    setGamePhase("playing");
    setMessage("Your turn");
    setWhiteTime(TIME_LIMIT);
    setBlackTime(TIME_LIMIT);
  };

  const handleCellClick = (row: number, col: number) => {
    if (gamePhase !== "playing" || currentPlayer !== "white" || isAIThinking) return;
    
    const piece = gameState.board[row][col];
    
    if (selectedPiece) {
      const move = validMoves.find(m => m.to.row === row && m.to.col === col);
      if (move) {
        const newState = applyMove(gameState, move);
        setGameState(newState);
        setSelectedPiece(null);
        setValidMoves([]);
        if (!checkGameEnd(newState, "black")) setCurrentPlayer("black");
        return;
      }
      if (piece && piece.color === "white") {
        const allMoves = getValidMoves(gameState, "white");
        const pieceMoves = allMoves.filter(m => m.from.row === row && m.from.col === col);
        setSelectedPiece({ row, col });
        setValidMoves(pieceMoves);
        return;
      }
      setSelectedPiece(null);
      setValidMoves([]);
      return;
    }
    
    if (piece && piece.color === "white") {
      const allMoves = getValidMoves(gameState, "white");
      const pieceMoves = allMoves.filter(m => m.from.row === row && m.from.col === col);
      if (pieceMoves.length > 0) {
        setSelectedPiece({ row, col });
        setValidMoves(pieceMoves);
      }
    }
  };

  const handleGameEnd = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    onGameEnd(winner === "white");
  };

  const formatTime = (s: number): string => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const renderCell = (row: number, col: number) => {
    const isDark = (row + col) % 2 === 1;
    const piece = gameState.board[row][col];
    const isSelected = selectedPiece?.row === row && selectedPiece?.col === col;
    const isValidMove = validMoves.some(m => m.to.row === row && m.to.col === col);
    const isCapture = validMoves.some(m => m.to.row === row && m.to.col === col && (m.capture || m.isEnPassant));
    
    return (
      <motion.div
        key={`${row}-${col}`}
        className={`w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center relative cursor-pointer
          ${isDark ? "bg-emerald-700 dark:bg-emerald-800" : "bg-emerald-100 dark:bg-emerald-200"}
          ${isSelected ? "ring-2 ring-yellow-500" : ""}
          ${isValidMove && !isCapture ? "ring-2 ring-blue-500" : ""}
          ${isCapture ? "ring-2 ring-red-500" : ""}`}
        onClick={() => handleCellClick(row, col)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {piece && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
            className={`text-2xl sm:text-3xl select-none ${piece.color === "white" ? "text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]" : "text-gray-900 drop-shadow-[0_1px_1px_rgba(255,255,255,0.3)]"}`}>
            {PIECE_SYMBOLS[piece.type][piece.color]}
          </motion.span>
        )}
        {isValidMove && !piece && <div className="w-3 h-3 rounded-full bg-blue-500/50" />}
      </motion.div>
    );
  };

  if (gamePhase === "ready") {
    return (
      <Card className="border-2">
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Crown className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl">Chess Blitz</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">3-minute rapid chess against AI</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 text-sm text-muted-foreground">
            <h3 className="font-semibold text-foreground">How to Play:</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Standard chess rules apply</li>
              <li>Each player has 3 minutes on their clock</li>
              <li>Tap a piece to see valid moves</li>
              <li>Tap a highlighted square to move</li>
              <li>Checkmate the opponent's king to win</li>
              <li>Running out of time loses the game</li>
            </ul>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2"><User className="h-5 w-5" /><span>You (White)</span></div>
            <span className="text-muted-foreground">vs</span>
            <div className="flex items-center gap-2"><span>AI (Black)</span><Bot className="h-5 w-5" /></div>
          </div>
          {!isPractice && (
            <div className="p-3 bg-amber-500/10 rounded-lg text-center">
              <p className="text-sm"><span className="font-semibold">Stake:</span> {stake.toLocaleString()} NGN</p>
            </div>
          )}
          <Button onClick={startGame} className="w-full" size="lg" data-testid="button-start-chess">
            <Play className="h-5 w-5 mr-2" />Start Game
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-2">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-lg flex items-center gap-2"><Crown className="h-5 w-5" />Chess Blitz</CardTitle>
            {!isPractice && <Badge variant="secondary">{stake.toLocaleString()} NGN</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <div className={`flex items-center gap-2 p-2 rounded ${currentPlayer === "white" ? "bg-primary/10" : ""}`}>
              <User className="h-4 w-4" /><span className="text-sm font-medium">You</span>
              <Badge variant={whiteTime < 30 ? "destructive" : "outline"} className="tabular-nums"><Clock className="h-3 w-3 mr-1" />{formatTime(whiteTime)}</Badge>
            </div>
            <div className={`flex items-center gap-2 p-2 rounded ${currentPlayer === "black" ? "bg-primary/10" : ""}`}>
              <Badge variant={blackTime < 30 ? "destructive" : "outline"} className="tabular-nums"><Clock className="h-3 w-3 mr-1" />{formatTime(blackTime)}</Badge>
              <span className="text-sm font-medium">AI</span><Bot className="h-4 w-4" />
            </div>
          </div>
          <div className="flex justify-center">
            <div className="border-4 border-emerald-900 rounded-md overflow-hidden shadow-xl">
              {Array(BOARD_SIZE).fill(null).map((_, row) => (
                <div key={row} className="flex">{Array(BOARD_SIZE).fill(null).map((_, col) => renderCell(row, col))}</div>
              ))}
            </div>
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={message} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="text-center text-sm text-muted-foreground">
              {message}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>
      <AnimatePresence>
        {gamePhase === "finished" && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
            <Card className={`border-2 ${winner === "white" ? "border-green-500" : winner === "draw" ? "border-yellow-500" : "border-red-500"}`}>
              <CardContent className="p-6 text-center space-y-4">
                <div className={`inline-flex p-4 rounded-full ${winner === "white" ? "bg-green-500/10" : winner === "draw" ? "bg-yellow-500/10" : "bg-red-500/10"}`}>
                  <Trophy className={`h-10 w-10 ${winner === "white" ? "text-green-500" : winner === "draw" ? "text-yellow-500" : "text-red-500"}`} />
                </div>
                <h2 className="text-2xl font-bold">{winner === "white" ? "Victory!" : winner === "draw" ? "Draw!" : "Defeat"}</h2>
                <p className="text-muted-foreground">
                  {winner === "white" ? "Congratulations! You defeated the AI!" : winner === "draw" ? "The game ended in a stalemate." : "The AI was victorious this time."}
                </p>
                {!isPractice && (
                  <p className={`font-semibold ${winner === "white" ? "text-green-600" : winner === "draw" ? "text-yellow-600" : "text-red-600"}`}>
                    {winner === "white" ? `+${(stake * 0.95 * 2).toLocaleString()} NGN` : winner === "draw" ? "Stake returned" : `-${stake.toLocaleString()} NGN`}
                  </p>
                )}
                <div className="flex gap-2 justify-center flex-wrap">
                  <Button onClick={startGame} variant="outline"><RotateCcw className="h-4 w-4 mr-2" />Play Again</Button>
                  <Button onClick={handleGameEnd} data-testid="button-finish-chess">Finish</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
