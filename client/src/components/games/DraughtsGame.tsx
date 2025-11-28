import { useState, useEffect, useCallback } from "react";
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
  Crown,
  Target
} from "lucide-react";

interface DraughtsGameProps {
  stake: number;
  onGameEnd: (won: boolean, score?: number) => void;
  isPractice: boolean;
}

type Player = "player" | "ai";
type PieceType = "normal" | "king";
type GamePhase = "ready" | "playing" | "finished";

interface Piece {
  owner: Player;
  type: PieceType;
}

interface Position {
  row: number;
  col: number;
}

interface Move {
  from: Position;
  to: Position;
  captures: Position[];
  isJump: boolean;
}

type Board = (Piece | null)[][];

const BOARD_SIZE = 10;

const createInitialBoard = (): Board => {
  const board: Board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
  
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if ((row + col) % 2 === 1) {
        board[row][col] = { owner: "ai", type: "normal" };
      }
    }
  }
  
  for (let row = 6; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if ((row + col) % 2 === 1) {
        board[row][col] = { owner: "player", type: "normal" };
      }
    }
  }
  
  return board;
};

const copyBoard = (board: Board): Board => {
  return board.map(row => row.map(cell => cell ? { ...cell } : null));
};

const posEqual = (a: Position, b: Position): boolean => a.row === b.row && a.col === b.col;

const getSimpleMoves = (board: Board, pos: Position, piece: Piece): Move[] => {
  const moves: Move[] = [];
  const directions = piece.type === "king" 
    ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
    : piece.owner === "player" 
      ? [[-1, -1], [-1, 1]]
      : [[1, -1], [1, 1]];
  
  const maxDist = piece.type === "king" ? BOARD_SIZE - 1 : 1;
  
  for (const [dr, dc] of directions) {
    for (let d = 1; d <= maxDist; d++) {
      const nr = pos.row + dr * d;
      const nc = pos.col + dc * d;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
      if (board[nr][nc] !== null) break;
      moves.push({ from: pos, to: { row: nr, col: nc }, captures: [], isJump: false });
    }
  }
  return moves;
};

const getJumpMoves = (board: Board, pos: Position, piece: Piece, capturedSoFar: Position[]): Move[] => {
  const moves: Move[] = [];
  const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  
  for (const [dr, dc] of directions) {
    if (piece.type === "normal") {
      const jumpRow = pos.row + dr;
      const jumpCol = pos.col + dc;
      const landRow = pos.row + dr * 2;
      const landCol = pos.col + dc * 2;
      
      if (landRow < 0 || landRow >= BOARD_SIZE || landCol < 0 || landCol >= BOARD_SIZE) continue;
      if (jumpRow < 0 || jumpRow >= BOARD_SIZE || jumpCol < 0 || jumpCol >= BOARD_SIZE) continue;
      
      const jumped = board[jumpRow][jumpCol];
      if (!jumped || jumped.owner === piece.owner) continue;
      if (capturedSoFar.some(c => posEqual(c, { row: jumpRow, col: jumpCol }))) continue;
      if (board[landRow][landCol] !== null) continue;
      
      const newCaptures = [...capturedSoFar, { row: jumpRow, col: jumpCol }];
      const tempBoard = copyBoard(board);
      tempBoard[pos.row][pos.col] = null;
      tempBoard[jumpRow][jumpCol] = null;
      
      let landingPiece = { ...piece };
      if ((piece.owner === "player" && landRow === 0) || (piece.owner === "ai" && landRow === BOARD_SIZE - 1)) {
        landingPiece.type = "king";
      }
      tempBoard[landRow][landCol] = landingPiece;
      
      const further = getJumpMoves(tempBoard, { row: landRow, col: landCol }, landingPiece, newCaptures);
      
      if (further.length > 0) {
        for (const fj of further) {
          moves.push({ from: pos, to: fj.to, captures: newCaptures.concat(fj.captures.filter(c => !newCaptures.some(nc => posEqual(nc, c)))), isJump: true });
        }
      } else {
        moves.push({ from: pos, to: { row: landRow, col: landCol }, captures: newCaptures, isJump: true });
      }
    } else {
      for (let d = 1; d < BOARD_SIZE; d++) {
        const jumpRow = pos.row + dr * d;
        const jumpCol = pos.col + dc * d;
        if (jumpRow < 0 || jumpRow >= BOARD_SIZE || jumpCol < 0 || jumpCol >= BOARD_SIZE) break;
        
        const cell = board[jumpRow][jumpCol];
        if (cell === null) continue;
        if (cell.owner === piece.owner) break;
        if (capturedSoFar.some(c => posEqual(c, { row: jumpRow, col: jumpCol }))) break;
        
        for (let ld = 1; ld < BOARD_SIZE; ld++) {
          const landRow = jumpRow + dr * ld;
          const landCol = jumpCol + dc * ld;
          if (landRow < 0 || landRow >= BOARD_SIZE || landCol < 0 || landCol >= BOARD_SIZE) break;
          if (board[landRow][landCol] !== null) break;
          
          const newCaptures = [...capturedSoFar, { row: jumpRow, col: jumpCol }];
          const tempBoard = copyBoard(board);
          tempBoard[pos.row][pos.col] = null;
          tempBoard[jumpRow][jumpCol] = null;
          tempBoard[landRow][landCol] = piece;
          
          const further = getJumpMoves(tempBoard, { row: landRow, col: landCol }, piece, newCaptures);
          
          if (further.length > 0) {
            for (const fj of further) {
              moves.push({ from: pos, to: fj.to, captures: newCaptures.concat(fj.captures.filter(c => !newCaptures.some(nc => posEqual(nc, c)))), isJump: true });
            }
          } else {
            moves.push({ from: pos, to: { row: landRow, col: landCol }, captures: newCaptures, isJump: true });
          }
        }
        break;
      }
    }
  }
  return moves;
};

const getValidMoves = (board: Board, player: Player): Move[] => {
  const allJumps: Move[] = [];
  const allSimple: Move[] = [];
  
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const piece = board[row][col];
      if (piece && piece.owner === player) {
        const jumps = getJumpMoves(board, { row, col }, piece, []);
        allJumps.push(...jumps);
        if (allJumps.length === 0) {
          const simple = getSimpleMoves(board, { row, col }, piece);
          allSimple.push(...simple);
        }
      }
    }
  }
  
  if (allJumps.length > 0) {
    const maxCaptures = Math.max(...allJumps.map(m => m.captures.length));
    return allJumps.filter(m => m.captures.length === maxCaptures);
  }
  return allSimple;
};

const applyMove = (board: Board, move: Move): Board => {
  const newBoard = copyBoard(board);
  const piece = newBoard[move.from.row][move.from.col];
  if (!piece) return newBoard;
  
  newBoard[move.from.row][move.from.col] = null;
  move.captures.forEach(cap => { newBoard[cap.row][cap.col] = null; });
  
  if ((piece.owner === "player" && move.to.row === 0) || (piece.owner === "ai" && move.to.row === BOARD_SIZE - 1)) {
    piece.type = "king";
  }
  newBoard[move.to.row][move.to.col] = piece;
  return newBoard;
};

const countPieces = (board: Board): { player: number; ai: number } => {
  let player = 0, ai = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = board[r][c];
      if (p) { p.owner === "player" ? player++ : ai++; }
    }
  }
  return { player, ai };
};

const evaluateBoard = (board: Board): number => {
  let score = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = board[r][c];
      if (p) {
        const val = p.type === "king" ? 3 : 1;
        const posBonus = p.owner === "ai" ? (r / BOARD_SIZE) * 0.3 : ((BOARD_SIZE - 1 - r) / BOARD_SIZE) * 0.3;
        score += (p.owner === "ai" ? 1 : -1) * (val + posBonus);
      }
    }
  }
  return score;
};

const minimax = (board: Board, depth: number, alpha: number, beta: number, isMax: boolean): { score: number; move: Move | null } => {
  const player = isMax ? "ai" : "player";
  const moves = getValidMoves(board, player);
  
  if (depth === 0 || moves.length === 0) {
    return { score: evaluateBoard(board), move: null };
  }
  
  let best: Move | null = null;
  
  if (isMax) {
    let maxS = -Infinity;
    for (const m of moves) {
      const nb = applyMove(board, m);
      const res = minimax(nb, depth - 1, alpha, beta, false);
      if (res.score > maxS) { maxS = res.score; best = m; }
      alpha = Math.max(alpha, res.score);
      if (beta <= alpha) break;
    }
    return { score: maxS, move: best };
  } else {
    let minS = Infinity;
    for (const m of moves) {
      const nb = applyMove(board, m);
      const res = minimax(nb, depth - 1, alpha, beta, true);
      if (res.score < minS) { minS = res.score; best = m; }
      beta = Math.min(beta, res.score);
      if (beta <= alpha) break;
    }
    return { score: minS, move: best };
  }
};

const getAIMove = (board: Board): Move | null => minimax(board, 4, -Infinity, Infinity, true).move;

export default function DraughtsGame({ stake, onGameEnd, isPractice }: DraughtsGameProps) {
  const [gamePhase, setGamePhase] = useState<GamePhase>("ready");
  const [board, setBoard] = useState<Board>(createInitialBoard());
  const [currentPlayer, setCurrentPlayer] = useState<Player>("player");
  const [selectedPiece, setSelectedPiece] = useState<Position | null>(null);
  const [validMoves, setValidMoves] = useState<Move[]>([]);
  const [winner, setWinner] = useState<Player | null>(null);
  const [message, setMessage] = useState("Click Start to begin!");
  const [isAIThinking, setIsAIThinking] = useState(false);

  const checkGameEnd = useCallback((currentBoard: Board, nextPlayer: Player) => {
    const counts = countPieces(currentBoard);
    
    if (counts.player === 0) {
      setWinner("ai");
      setGamePhase("finished");
      setMessage("AI wins! All your pieces were captured.");
      return true;
    }
    
    if (counts.ai === 0) {
      setWinner("player");
      setGamePhase("finished");
      setMessage("You win! You captured all AI pieces!");
      return true;
    }
    
    const moves = getValidMoves(currentBoard, nextPlayer);
    if (moves.length === 0) {
      const w = nextPlayer === "player" ? "ai" : "player";
      setWinner(w);
      setGamePhase("finished");
      setMessage(w === "player" ? "You win! AI has no moves left!" : "AI wins! You have no moves left.");
      return true;
    }
    return false;
  }, []);

  const makeAIMove = useCallback(() => {
    setIsAIThinking(true);
    setMessage("AI is thinking...");
    
    setTimeout(() => {
      const aiMove = getAIMove(board);
      if (aiMove) {
        const newBoard = applyMove(board, aiMove);
        setBoard(newBoard);
        if (!checkGameEnd(newBoard, "player")) {
          setCurrentPlayer("player");
          setMessage("Your turn - select a piece to move");
        }
      } else {
        setWinner("player");
        setGamePhase("finished");
        setMessage("You win! AI has no valid moves!");
      }
      setIsAIThinking(false);
    }, 800);
  }, [board, checkGameEnd]);

  useEffect(() => {
    if (gamePhase === "playing" && currentPlayer === "ai" && !isAIThinking) {
      makeAIMove();
    }
  }, [currentPlayer, gamePhase, isAIThinking, makeAIMove]);

  const startGame = () => {
    setBoard(createInitialBoard());
    setCurrentPlayer("player");
    setSelectedPiece(null);
    setValidMoves([]);
    setWinner(null);
    setGamePhase("playing");
    setMessage("Your turn - select a piece to move");
  };

  const handleCellClick = (row: number, col: number) => {
    if (gamePhase !== "playing" || currentPlayer !== "player" || isAIThinking) return;
    
    const piece = board[row][col];
    
    if (selectedPiece) {
      const move = validMoves.find(m => m.to.row === row && m.to.col === col);
      if (move) {
        const newBoard = applyMove(board, move);
        setBoard(newBoard);
        setSelectedPiece(null);
        setValidMoves([]);
        if (!checkGameEnd(newBoard, "ai")) {
          setCurrentPlayer("ai");
        }
        return;
      }
      
      if (piece && piece.owner === "player") {
        const allMoves = getValidMoves(board, "player");
        const pieceMoves = allMoves.filter(m => m.from.row === row && m.from.col === col);
        if (pieceMoves.length > 0) {
          setSelectedPiece({ row, col });
          setValidMoves(pieceMoves);
        } else {
          setMessage("This piece has no valid moves - you must capture if possible!");
        }
        return;
      }
      
      setSelectedPiece(null);
      setValidMoves([]);
      return;
    }
    
    if (piece && piece.owner === "player") {
      const allMoves = getValidMoves(board, "player");
      const pieceMoves = allMoves.filter(m => m.from.row === row && m.from.col === col);
      
      if (pieceMoves.length > 0) {
        setSelectedPiece({ row, col });
        setValidMoves(pieceMoves);
      } else {
        const hasAnyMoves = allMoves.length > 0;
        setMessage(hasAnyMoves ? "This piece has no valid moves - you must capture if possible!" : "No moves available");
      }
    }
  };

  const handleGameEnd = () => {
    onGameEnd(winner === "player", countPieces(board).player);
  };

  const renderCell = (row: number, col: number) => {
    const isDark = (row + col) % 2 === 1;
    const piece = board[row][col];
    const isSelected = selectedPiece?.row === row && selectedPiece?.col === col;
    const isValidMove = validMoves.some(m => m.to.row === row && m.to.col === col);
    const isCapture = validMoves.some(m => m.captures.some(c => c.row === row && c.col === col));
    
    return (
      <motion.div
        key={`${row}-${col}`}
        className={`
          w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center relative cursor-pointer
          ${isDark ? "bg-amber-800 dark:bg-amber-900" : "bg-amber-100 dark:bg-amber-200"}
          ${isSelected ? "ring-2 ring-blue-500" : ""}
          ${isValidMove ? "ring-2 ring-green-500" : ""}
        `}
        onClick={() => handleCellClick(row, col)}
        whileHover={{ scale: isDark ? 1.05 : 1 }}
        whileTap={{ scale: 0.95 }}
      >
        {isCapture && <div className="absolute inset-0 bg-red-500/30 animate-pulse" />}
        
        {piece && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={`
              w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center
              ${piece.owner === "player" 
                ? "bg-gradient-to-br from-red-400 to-red-600 border-2 border-red-300" 
                : "bg-gradient-to-br from-gray-700 to-gray-900 border-2 border-gray-500"
              }
              shadow-lg
            `}
          >
            {piece.type === "king" && <Crown className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400" />}
          </motion.div>
        )}
        
        {isValidMove && !piece && <div className="w-3 h-3 rounded-full bg-green-500/60 animate-pulse" />}
      </motion.div>
    );
  };

  if (gamePhase === "ready") {
    return (
      <Card className="border-2">
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Target className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl">Draughts (Checkers)</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">10x10 International Draughts with flying kings</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 text-sm text-muted-foreground">
            <h3 className="font-semibold text-foreground">How to Play:</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Move diagonally forward to empty squares</li>
              <li>Capture by jumping over opponent pieces</li>
              <li>Captures are mandatory - you must take the maximum</li>
              <li>Kings can move and capture in all diagonal directions</li>
              <li>Kings fly across the board (multiple squares)</li>
              <li>Win by capturing all opponent pieces or blocking them</li>
            </ul>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-400 to-red-600" />
              <span>You</span>
            </div>
            <span className="text-muted-foreground">vs</span>
            <div className="flex items-center gap-2">
              <span>AI</span>
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-700 to-gray-900" />
            </div>
          </div>
          
          {!isPractice && (
            <div className="p-3 bg-amber-500/10 rounded-lg text-center">
              <p className="text-sm"><span className="font-semibold">Stake:</span> {stake.toLocaleString()} NGN</p>
            </div>
          )}
          
          <Button onClick={startGame} className="w-full" size="lg" data-testid="button-start-draughts">
            <Play className="h-5 w-5 mr-2" />
            Start Game
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
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5" />
              Draughts
            </CardTitle>
            <div className="flex items-center gap-2">
              {!isPractice && <Badge variant="secondary">{stake.toLocaleString()} NGN</Badge>}
              <Badge variant={currentPlayer === "player" ? "default" : "outline"}>
                {currentPlayer === "player" ? <><User className="h-3 w-3 mr-1" />Your Turn</> : <><Bot className="h-3 w-3 mr-1" />AI Turn</>}
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-red-400 to-red-600" />
              <span>You: {countPieces(board).player}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>AI: {countPieces(board).ai}</span>
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-gray-700 to-gray-900" />
            </div>
          </div>
          
          <div className="flex justify-center">
            <div className="border-4 border-amber-900 rounded-md overflow-hidden shadow-xl">
              {Array(BOARD_SIZE).fill(null).map((_, row) => (
                <div key={row} className="flex">
                  {Array(BOARD_SIZE).fill(null).map((_, col) => renderCell(row, col))}
                </div>
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
            <Card className={`border-2 ${winner === "player" ? "border-green-500" : "border-red-500"}`}>
              <CardContent className="p-6 text-center space-y-4">
                <div className={`inline-flex p-4 rounded-full ${winner === "player" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                  <Trophy className={`h-10 w-10 ${winner === "player" ? "text-green-500" : "text-red-500"}`} />
                </div>
                <h2 className="text-2xl font-bold">{winner === "player" ? "Victory!" : "Defeat"}</h2>
                <p className="text-muted-foreground">
                  {winner === "player" ? `You won with ${countPieces(board).player} pieces remaining!` : "The AI was victorious this time."}
                </p>
                {!isPractice && (
                  <p className={`font-semibold ${winner === "player" ? "text-green-600" : "text-red-600"}`}>
                    {winner === "player" ? `+${(stake * 0.95 * 2).toLocaleString()} NGN` : `-${stake.toLocaleString()} NGN`}
                  </p>
                )}
                <div className="flex gap-2 justify-center flex-wrap">
                  <Button onClick={startGame} variant="outline"><RotateCcw className="h-4 w-4 mr-2" />Play Again</Button>
                  <Button onClick={handleGameEnd} data-testid="button-finish-draughts">Finish</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
