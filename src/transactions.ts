import * as StellarSdk from 'stellar-sdk';
import { Board } from './index';

const memoize = (fn: any) => {
    const cache: any = {};
    return (...args: any[]) => {
        const _args = JSON.stringify(args);
        return cache[_args] = typeof cache[_args] === 'undefined' ? fn(...args): cache[_args];
    }
}

export function createIntermediateTransaction(
    board: Board,
    round: number,
    position: number,
    preAuth: Buffer[]
): [StellarSdk.Transaction, Buffer] {

    const playerId = round & 1;
    const player = board.players[playerId];
    const account = new StellarSdk.Account(
        player.id,
        player.sequence.plus(round >> 1).toString()
    );

    const builder = new StellarSdk.TransactionBuilder(account, {
        networkPassphrase: StellarSdk.Networks.TESTNET,
        fee: 1000,
        memo: new StellarSdk.Memo(StellarSdk.MemoID, position.toString())
    });

    builder.addOperation(StellarSdk.Operation.accountMerge({
        source: board.escrow[round - 1].id,
        destination: board.escrow[round].id,
    }));

    preAuth.forEach(tx => {
        builder.addOperation(StellarSdk.Operation.setOptions({
            source: board.escrow[round].id,
            signer: {
                preAuthTx: tx,
                weight: '1'
            }
        }))
    });

    builder.addOperation(StellarSdk.Operation.setOptions({
        source: board.escrow[round].id,
        masterWeight: 0
    }));

    builder.setTimeout(0);
    const tx = builder.build();
    return [tx, tx.hash()];
}

export function createTieTransaction(
    board: Board
) {
    const fn = (
        round: number,
        position: number
    ): [StellarSdk.Transaction, Buffer] => {
        const playerId = round & 1;
        const player = board.players[playerId];
        const account = new StellarSdk.Account(
            player.id,
            player.sequence.plus(round >> 1).toString()
        );

        const tx = new StellarSdk.TransactionBuilder(account, {
            networkPassphrase: StellarSdk.Networks.TESTNET,
            fee: 1000,
            memo: new StellarSdk.Memo(StellarSdk.MemoID, position.toString())
        })
        .addOperation(StellarSdk.Operation.payment({
            source: board.escrow[round - 1].id,
            destination: board.players[0].id,
            amount: '100',
            asset: StellarSdk.Asset.native()
        }))
        .addOperation(StellarSdk.Operation.accountMerge({
            source: board.escrow[round - 1].id,
            destination: board.players[1].id,
        }))
        .setTimeout(0)
        .build();

        return [tx, tx.hash()];
    };

    return memoize(fn);
}

export function createWinTransaction(
    board: Board
) {
    const fn = (
        round: number,
        position: number,
    ): [StellarSdk.Transaction, Buffer] => {
        const playerId = round & 1;
        const player = board.players[playerId];
        const account = new StellarSdk.Account(
            player.id,
            player.sequence.plus(round >> 1).toString()
        );

        const tx = new StellarSdk.TransactionBuilder(account, {
            networkPassphrase: StellarSdk.Networks.TESTNET,
            fee: 1000,
            memo: new StellarSdk.Memo(StellarSdk.MemoID, position.toString())
        })
        .addOperation(StellarSdk.Operation.accountMerge({
            source: board.escrow[round - 1].id,
            destination: player.id
        }))
        .setTimeout(0)
        .build();

        return [tx, tx.hash()];
    }

    return memoize(fn);
}

export function createSetupTransaction(
    board: Board,
    preAuth: Buffer[]
): StellarSdk.Transaction {

    const player = board.players[0];
    const account = new StellarSdk.Account(
        player.id,
        player.sequence.toString()
    );
    player.sequence = player.sequence.plus(1);

    const builder = new StellarSdk.TransactionBuilder(account, {
        networkPassphrase: StellarSdk.Networks.TESTNET,
        fee: 1000
    });

    for (let level = 0; level < 10; level++) {
        builder.addOperation(StellarSdk.Operation.createAccount({
            destination: board.escrow[level].id,
            startingBalance: '2'
        }));
    }

    preAuth.forEach(tx => {
        builder.addOperation(StellarSdk.Operation.setOptions({
            source: board.escrow[0].id,
            signer: {
                preAuthTx: tx,
                weight: '1'
            }
        }))
    });

    builder.addOperation(StellarSdk.Operation.setOptions({
        source: board.escrow[0].id,
        masterWeight: 0
    }));

    builder.setTimeout(0);
    return builder.build();
}
