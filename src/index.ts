
import * as StellarSdk from 'stellar-sdk';
import BigNumber from 'bignumber.js';

import {
    createIntermediateTransaction,
    createSetupTransaction,
    createTieTransaction,
    createWinTransaction
} from './transactions';

export interface Board {
    positions: number[];
    available: number;
    bet: number;
    players: Account[];
    escrow: {id: string, keys: StellarSdk.Keypair}[];
    tieTransaction(level: number, position: number): [StellarSdk.Transaction, Buffer];
    winTransaction(level: number, position: number): [StellarSdk.Transaction, Buffer];
}

type Account = {
    id: string;
    sequence: BigNumber;
}

const NUM_GAMES = 255168;

/**
 *
 * @param players -
 * @param bet -
 * @public
 */
export function setup(
    players: StellarSdk.AccountResponse[],
    bet: number = 0
): [Board, StellarSdk.Transaction] {

    const board: Partial<Board> = {
        positions: [0, 0],
        available: 511,
        bet: bet,
        players: players.map((player) => ({
            id: player.id,
            sequence: new BigNumber(player.sequenceNumber())
        }))
    };

    board.escrow = [];
    for (let i = 0; i < 10; i++) {
        const keys = StellarSdk.Keypair.random();
        board.escrow.push({
            id: keys.publicKey(),
            keys: keys
        });
    }

    board.winTransaction = createWinTransaction(board as Board);
    board.tieTransaction = createTieTransaction(board as Board);

    const [numGames, txs] = _play(board as Board, 1);
    if (numGames !== NUM_GAMES) {
        throw new Error('!!!');
    }

    const tx = createSetupTransaction(board as Board, txs);
    tx.sign(board.escrow[0].keys);

    return [board as Board, tx];
}

/**
 *
 * @param board - the current state of the game
 * @param round - the current round
 * @param position - the position we move to
 * @public
 */
export function move(
    board: Board,
    round: number,
    position: number
): StellarSdk.Transaction {
    const [_, tx, hash] = _move(board, round, position);
    if (sourceAccounts(tx).has(board.escrow[round].id)) {
        tx.sign(board.escrow[round].keys);
    }

    const playerId = round & 1;
    board.positions[playerId] ^= 1 << position;
    board.available ^= 1 << position;
    return tx;
}

function isWinningBoard(board: number): boolean {
    return (
        ((board & 273) === 273) ||
        ((board & 146) === 146) ||
        ((board &  84) ===  84) ||
        ((board &  56) ===  56) ||
        ((board &   7) ===   7) ||
        ((board &  73) ===  73) ||
        ((board & 292) === 292) ||
        ((board & 448) === 448)
     );
}

function sourceAccounts(
    tx: StellarSdk.Transaction
): Set<string> {
    const res: Set<string> = new Set();
    for (const op of tx.operations) {
        res.add(op.source as string);
    }

    return res;
}

const cache: {[key: number]: [number, StellarSdk.Transaction, Buffer]} = {}

/**
 *
 * @param board - the current state of the game
 * @param round - the current round
 * @param position - the position we move to
 * @private
 */

function _move(
    board: Board,
    round: number,
    position: number
): [number, StellarSdk.Transaction, Buffer] {

    const playerId = round & 1;
    const mask = 1 << position;
    board.positions[playerId] ^= mask;
    board.available ^= mask;

    let res: [number, StellarSdk.Transaction, Buffer];

    //  was this a winning move?
    if ((round >= 5) && (isWinningBoard(board.positions[playerId]))) {
        const [tx, hash] = board.winTransaction(round, position);
        res = [1, tx, hash];
    }

    //  or a tie?
    else if (round === 9) {
        const [tx, hash] = board.tieTransaction(round, position);
        res = [1, tx, hash];
    }

    //  if neither, continue traversing the game tree
    else {
        const boardIndex = board.positions[0] << 9 | board.positions[1];
        if (boardIndex in cache) {
            res = cache[boardIndex];
        } else {
            const [numGames, txs] = _play(board, round + 1);
            const [tx, hash] = createIntermediateTransaction(board, round, position, txs);
            res = [numGames, tx, hash];
            cache[boardIndex] = res;
        }
    }

    board.available ^= mask;
    board.positions[playerId] ^= mask;

    return res;
}

/**
 * Play all the possible moves a player can make in this round
 *
 * @param board - the current state of the game
 * @param round - the current round
 * @returns the number of games that can be played from this position,
 *          and the transaction hashes for the moves
 * @private
 */
function _play(
    board: Board,
    round: number
): [number, Buffer[]] {

    let sum = 0;
    const res: Buffer[] = [];
    const playerId = round & 1;
    const player = board.players[playerId];
    for (let i = 0; i < 9; i++) {
        if (board.available & (1 << i)) {
            const [numGames, _, hash] = _move(board, round, i);
            res.push(hash);
            sum += numGames;
        }
    }
    return [sum, res];
}
