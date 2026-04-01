'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Chess, Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { PuzzlePieceIcon, LightBulbIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface PuzzleData {
  id: string;
  fen: string;
  moves: string;
  rating: number;
  themes: string[];
  hint?: string;
}

interface CandidatePuzzleWidgetProps {
  applicationToken: string;
  className?: string;
  onPuzzleEvent?: (event: 'attempted' | 'solved', streak?: number) => void;
}

type PuzzleState = 'loading' | 'playing' | 'correct' | 'incorrect' | 'complete';

function uciToMove(uci: string) {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci[4] : undefined,
  };
}

// Theme descriptions for better hints
const THEME_HINTS: Record<string, string> = {
  mateIn1: 'Find checkmate in 1 move!',
  mateIn2: 'Find checkmate in 2 moves!',
  fork: 'Attack two pieces at once!',
  pin: 'Pin a piece to the king!',
  skewer: 'Attack through one piece to another!',
  discoveredAttack: 'Move a piece to reveal an attack!',
  backRankMate: 'Checkmate on the back rank!',
  smotheredMate: 'Checkmate with a knight!',
  hangingPiece: 'Capture the undefended piece!',
  default: 'Find the best move!',
};

// Puzzles organized by difficulty (rating ranges)
const ALL_PUZZLES: PuzzleData[] = [
  // Easy (400-600) - Simple captures and mate in 1
  {
    id: 'easy-1',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    moves: 'h5f7',
    rating: 400,
    themes: ['mateIn1'],
    hint: 'The queen and bishop are both attacking f7...',
  },
  {
    id: 'easy-2',
    fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2',
    moves: 'd8h4',
    rating: 400,
    themes: ['mateIn1'],
    hint: 'The king has no escape squares...',
  },
  {
    id: 'easy-3',
    fen: 'rnbqkbnr/ppp2ppp/8/3pp3/4P3/3P4/PPP2PPP/RNBQKBNR w KQkq - 0 3',
    moves: 'e4d5',
    rating: 500,
    themes: ['hangingPiece'],
    hint: 'Capture the undefended pawn!',
  },
  {
    id: 'easy-4',
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 3',
    moves: 'f3g5',
    rating: 550,
    themes: ['fork'],
    hint: 'Can you attack f7 and threaten the knight?',
  },
  // Medium (600-800)
  {
    id: 'med-1',
    fen: 'r2qkb1r/ppp2ppp/2n1bn2/3pp3/4P3/1PN2N2/PBPP1PPP/R2QKB1R w KQkq - 4 5',
    moves: 'e4d5 e6d5 f3e5',
    rating: 650,
    themes: ['fork'],
    hint: 'Clear the center, then attack!',
  },
  {
    id: 'med-2',
    fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
    moves: 'f3g5',
    rating: 700,
    themes: ['fork'],
    hint: 'Attack f7 with multiple pieces!',
  },
  {
    id: 'med-3',
    fen: 'r1bqk2r/ppppbppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
    moves: 'f3g5 d7d5 g5f7',
    rating: 750,
    themes: ['fork', 'mateIn2'],
    hint: 'Threaten f7, then capture with check!',
  },
  // Hard (800+)
  {
    id: 'hard-1',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
    moves: 'f3g5 d7d5 g5f7 e8e7 c4d5',
    rating: 850,
    themes: ['fork', 'discoveredAttack'],
    hint: 'Multiple tactics in sequence!',
  },
  {
    id: 'hard-2',
    fen: 'r2q1rk1/ppp2ppp/2n1bn2/3p4/3P4/2NBPN2/PP3PPP/R1BQ1RK1 w - - 0 9',
    moves: 'd3h7 g8h7 d1h5 h7g8 h5f7',
    rating: 900,
    themes: ['mateIn2', 'sacrifice'],
    hint: 'Sacrifice to open the king!',
  },
];

// Storage key for progress
const STORAGE_KEY = 'chess-puzzle-progress';

interface PuzzleProgress {
  completedIds: string[];
  currentRating: number;
  totalSolved: number;
  totalAttempted: number;
  bestStreak: number;
}

function getProgress(): PuzzleProgress {
  if (typeof window === 'undefined') {
    return { completedIds: [], currentRating: 400, totalSolved: 0, totalAttempted: 0, bestStreak: 0 };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { completedIds: [], currentRating: 400, totalSolved: 0, totalAttempted: 0, bestStreak: 0 };
}

function saveProgress(progress: PuzzleProgress) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {}
}

export function CandidatePuzzleWidget({
  applicationToken,
  className = '',
  onPuzzleEvent,
}: CandidatePuzzleWidgetProps) {
  const [game, setGame] = useState<Chess | null>(null);
  const [state, setState] = useState<PuzzleState>('loading');
  const [currentPuzzle, setCurrentPuzzle] = useState<PuzzleData | null>(null);
  const [moveIndex, setMoveIndex] = useState(0);
  const [solved, setSolved] = useState(0);
  const [attempted, setAttempted] = useState(0);
  const [streak, setStreak] = useState(0);
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const [squareStyles, setSquareStyles] = useState<Record<string, React.CSSProperties>>({});
  const [dismissed, setDismissed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [progress, setProgress] = useState<PuzzleProgress>(getProgress);
  const moveListRef = useRef<string[]>([]);

  // Get next puzzle based on progress
  const getNextPuzzle = useCallback(() => {
    const availablePuzzles = ALL_PUZZLES
      .filter(p => !progress.completedIds.includes(p.id))
      .filter(p => p.rating <= progress.currentRating + 200) // Don't jump too far ahead
      .sort((a, b) => a.rating - b.rating);

    if (availablePuzzles.length === 0) {
      // All puzzles completed at this level, unlock harder ones or reset
      if (progress.currentRating < 1000) {
        const newProgress = { ...progress, currentRating: progress.currentRating + 100 };
        setProgress(newProgress);
        saveProgress(newProgress);
        return ALL_PUZZLES.find(p => p.rating <= newProgress.currentRating + 200);
      }
      // Reset progress if all puzzles done
      return ALL_PUZZLES[0];
    }

    return availablePuzzles[0];
  }, [progress]);

  // Initialize first puzzle
  useEffect(() => {
    const savedProgress = getProgress();
    setProgress(savedProgress);
    setSolved(savedProgress.totalSolved);
    setAttempted(savedProgress.totalAttempted);

    const puzzle = ALL_PUZZLES
      .filter(p => !savedProgress.completedIds.includes(p.id))
      .filter(p => p.rating <= savedProgress.currentRating + 200)
      .sort((a, b) => a.rating - b.rating)[0] || ALL_PUZZLES[0];

    setCurrentPuzzle(puzzle);
  }, []);

  // Setup board when puzzle changes
  useEffect(() => {
    if (!currentPuzzle) return;

    const chess = new Chess(currentPuzzle.fen);
    const moves = currentPuzzle.moves.split(' ').filter(Boolean);
    moveListRef.current = moves;

    // Determine player color from whose turn it is
    setBoardOrientation(chess.turn() === 'w' ? 'white' : 'black');
    setGame(chess);
    setMoveIndex(0);
    setSquareStyles({});
    setShowHint(false);
    setState('playing');
  }, [currentPuzzle]);

  const handlePieceDrop = useCallback(
    (sourceSquare: string, targetSquare: string, piece: string) => {
      if (state !== 'playing' || !game) return false;

      const moves = moveListRef.current;
      const expected = moves[moveIndex];
      if (!expected) return false;

      const expectedMove = uciToMove(expected);
      const isPromotion =
        piece[1] === 'P' &&
        ((piece[0] === 'w' && targetSquare[1] === '8') ||
          (piece[0] === 'b' && targetSquare[1] === '1'));
      const promotion = isPromotion ? expectedMove.promotion || 'q' : undefined;

      const isCorrect =
        sourceSquare === expectedMove.from &&
        targetSquare === expectedMove.to;

      if (isCorrect) {
        const newGame = new Chess(game.fen());
        try {
          newGame.move({
            from: sourceSquare as Square,
            to: targetSquare as Square,
            promotion: promotion as any,
          });
        } catch {
          return false;
        }

        setGame(newGame);
        setSquareStyles({
          [sourceSquare]: { backgroundColor: 'rgba(34, 197, 94, 0.3)' },
          [targetSquare]: { backgroundColor: 'rgba(34, 197, 94, 0.5)' },
        });

        const nextMoveIdx = moveIndex + 1;

        // Check if puzzle is complete (no more player moves)
        if (nextMoveIdx >= moves.length) {
          // Puzzle solved!
          setState('correct');
          const newSolved = solved + 1;
          const newAttempted = attempted + 1;
          const newStreak = streak + 1;
          setSolved(newSolved);
          setAttempted(newAttempted);
          setStreak(newStreak);

          // Update progress
          const newProgress: PuzzleProgress = {
            completedIds: [...progress.completedIds, currentPuzzle!.id],
            currentRating: Math.max(progress.currentRating, currentPuzzle!.rating),
            totalSolved: newSolved,
            totalAttempted: newAttempted,
            bestStreak: Math.max(progress.bestStreak, newStreak),
          };
          setProgress(newProgress);
          saveProgress(newProgress);

          onPuzzleEvent?.('solved', newStreak);
          return true;
        }

        // Play opponent's response
        setMoveIndex(nextMoveIdx);
        setTimeout(() => {
          const oppMove = uciToMove(moves[nextMoveIdx]);
          const afterOpp = new Chess(newGame.fen());
          try {
            afterOpp.move({
              from: oppMove.from as Square,
              to: oppMove.to as Square,
              promotion: oppMove.promotion as any,
            });
            setGame(afterOpp);
            setMoveIndex(nextMoveIdx + 1);

            // Highlight opponent's move briefly
            setSquareStyles({
              [oppMove.from]: { backgroundColor: 'rgba(239, 68, 68, 0.2)' },
              [oppMove.to]: { backgroundColor: 'rgba(239, 68, 68, 0.3)' },
            });
            setTimeout(() => setSquareStyles({}), 500);

            // Check if there are more moves for player
            if (nextMoveIdx + 1 >= moves.length) {
              setState('correct');
              const newSolved = solved + 1;
              const newAttempted = attempted + 1;
              const newStreak = streak + 1;
              setSolved(newSolved);
              setAttempted(newAttempted);
              setStreak(newStreak);

              const newProgress: PuzzleProgress = {
                completedIds: [...progress.completedIds, currentPuzzle!.id],
                currentRating: Math.max(progress.currentRating, currentPuzzle!.rating),
                totalSolved: newSolved,
                totalAttempted: newAttempted,
                bestStreak: Math.max(progress.bestStreak, newStreak),
              };
              setProgress(newProgress);
              saveProgress(newProgress);

              onPuzzleEvent?.('solved', newStreak);
            }
          } catch {}
        }, 400);
        return true;
      } else {
        // Wrong move
        setSquareStyles({
          [targetSquare]: { backgroundColor: 'rgba(239, 68, 68, 0.5)' },
        });
        setTimeout(() => setSquareStyles({}), 600);
        setState('incorrect');
        setAttempted(a => a + 1);
        setStreak(0);

        const newProgress = { ...progress, totalAttempted: progress.totalAttempted + 1 };
        setProgress(newProgress);
        saveProgress(newProgress);

        onPuzzleEvent?.('attempted', 0);
        return false;
      }
    },
    [state, game, moveIndex, solved, attempted, streak, progress, currentPuzzle, onPuzzleEvent]
  );

  const nextPuzzle = useCallback(() => {
    const puzzle = getNextPuzzle();
    if (puzzle) {
      setCurrentPuzzle(puzzle);
    } else {
      setState('complete');
    }
  }, [getNextPuzzle]);

  const retryPuzzle = useCallback(() => {
    if (!currentPuzzle) return;
    const chess = new Chess(currentPuzzle.fen);
    setGame(chess);
    setMoveIndex(0);
    setSquareStyles({});
    setShowHint(false);
    setState('playing');
  }, [currentPuzzle]);

  const handleShowHint = useCallback(() => {
    if (state !== 'playing' && state !== 'incorrect') return;
    const moves = moveListRef.current;
    const expected = moves[moveIndex];
    if (!expected) return;
    const expectedMove = uciToMove(expected);

    // Highlight source square
    setSquareStyles({
      [expectedMove.from]: {
        backgroundColor: 'rgba(59, 169, 218, 0.6)',
        boxShadow: 'inset 0 0 12px rgba(59, 169, 218, 0.9)',
      },
    });
    setShowHint(true);

    // Clear after 3 seconds
    setTimeout(() => {
      setSquareStyles({});
    }, 3000);
  }, [state, moveIndex]);

  const getThemeHint = () => {
    if (!currentPuzzle) return THEME_HINTS.default;
    if (currentPuzzle.hint) return currentPuzzle.hint;
    const theme = currentPuzzle.themes[0];
    return THEME_HINTS[theme] || THEME_HINTS.default;
  };

  if (dismissed) return null;

  if (state === 'loading' || !currentPuzzle) {
    return (
      <div className={`bg-white rounded-2xl p-6 shadow-lg border border-gray-100 ${className}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
            <PuzzlePieceIcon className="w-6 h-6 text-[#6A469D]" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg">While You Wait...</h3>
            <p className="text-sm text-gray-500">Loading chess puzzle</p>
          </div>
        </div>
        <div className="h-64 flex items-center justify-center">
          <div className="w-10 h-10 border-3 border-[#6A469D]/30 border-t-[#6A469D] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (state === 'complete') {
    return (
      <div className={`bg-white rounded-2xl p-6 shadow-lg border border-gray-100 ${className}`}>
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-success-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🏆</span>
          </div>
          <h3 className="font-bold text-xl text-gray-900 mb-2">All Puzzles Complete!</h3>
          <p className="text-gray-500 mb-4">You&apos;ve solved all {progress.totalSolved} puzzles!</p>
          <button
            onClick={() => {
              const resetProgress: PuzzleProgress = {
                completedIds: [],
                currentRating: 400,
                totalSolved: 0,
                totalAttempted: 0,
                bestStreak: progress.bestStreak,
              };
              setProgress(resetProgress);
              saveProgress(resetProgress);
              setSolved(0);
              setAttempted(0);
              setCurrentPuzzle(ALL_PUZZLES[0]);
            }}
            className="px-5 py-2 text-sm font-medium text-[#6A469D] bg-[#6A469D]/10 rounded-xl hover:bg-[#6A469D]/20 transition-colors"
          >
            <ArrowPathIcon className="w-4 h-4 inline mr-2" />
            Start Over
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-[#E8FBFF] rounded-2xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#50C8DF]/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
              <PuzzlePieceIcon className="w-5 h-5 text-[#6A469D]" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                Acme Talent Challenge
              </h3>
              <p className="text-gray-500 text-xs">
                {solved > 0 ? (
                  <span className="flex items-center gap-1.5">
                    <span className="text-[#34B256] font-medium">{solved} solved</span>
                    <span className="text-gray-300">·</span>
                    <span>{attempted} attempted</span>
                    {streak > 1 && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span className="text-[#F79A30] font-medium">{streak} streak</span>
                      </>
                    )}
                  </span>
                ) : (
                  'Test your skills while you wait'
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none p-1.5 hover:bg-white/60 rounded-lg transition-colors"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      </div>

      {/* Board & Status */}
      <div className="p-6">
        {/* Goal/Status Message */}
        <div className="mb-4">
          {state === 'playing' && (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#6A469D]/10 border border-[#6A469D]/20 rounded-xl">
                <div className={`w-4 h-4 rounded ${boardOrientation === 'white' ? 'bg-white border border-gray-300 shadow-sm' : 'bg-gray-800'}`} />
                <span className="text-[#6A469D] font-semibold text-sm">
                  {showHint ? getThemeHint() : `${boardOrientation === 'white' ? 'White' : 'Black'} to move — find the best move!`}
                </span>
              </div>
              {showHint && (
                <p className="text-center text-xs text-[#3BA9DA]">
                  The highlighted square shows which piece to move
                </p>
              )}
            </div>
          )}
          {state === 'correct' && (
            <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-success-50 border border-success-200 rounded-xl">
              <span className="text-lg text-success-600">✓</span>
              <span className="text-success-700 font-semibold text-sm">Correct! Well done.</span>
            </div>
          )}
          {state === 'incorrect' && (
            <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-danger-50 border border-danger-200 rounded-xl">
              <span className="text-lg text-danger-500">✗</span>
              <span className="text-danger-600 font-semibold text-sm">Not quite — try again or use a hint!</span>
            </div>
          )}
        </div>

        {/* Chessboard */}
        <div className="max-w-[480px] mx-auto">
          {game && (
            <Chessboard
              id="candidate-puzzle"
              position={game.fen()}
              onPieceDrop={handlePieceDrop}
              boardOrientation={boardOrientation}
              arePiecesDraggable={state === 'playing' || state === 'incorrect'}
              animationDuration={200}
              customBoardStyle={{
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(106, 70, 157, 0.15)',
              }}
              customDarkSquareStyle={{ backgroundColor: '#6A469D' }}
              customLightSquareStyle={{ backgroundColor: '#F3F0FF' }}
              customSquareStyles={squareStyles}
            />
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 mt-5">
          {(state === 'playing' || state === 'incorrect') && (
            <button
              onClick={handleShowHint}
              className="px-4 py-2 text-sm font-medium text-[#3BA9DA] bg-[#3BA9DA]/10 rounded-xl hover:bg-[#3BA9DA]/20 transition-colors border border-[#3BA9DA]/20 flex items-center gap-2"
            >
              <LightBulbIcon className="w-4 h-4" />
              Hint
            </button>
          )}
          {state === 'incorrect' && (
            <button
              onClick={retryPuzzle}
              className="px-5 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors border border-gray-200"
            >
              Retry
            </button>
          )}
          {state === 'correct' && (
            <button
              onClick={nextPuzzle}
              className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-[#6A469D] to-[#3BA9DA] rounded-xl hover:opacity-90 transition-opacity shadow-md"
            >
              Next Puzzle →
            </button>
          )}
        </div>

        {/* Puzzle Info */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FACC29]/20 text-[#6A469D]">
            Rating: {currentPuzzle.rating}
          </span>
          {progress.completedIds.length > 0 && (
            <span className="text-xs text-gray-400">
              {progress.completedIds.length}/{ALL_PUZZLES.length} complete
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
