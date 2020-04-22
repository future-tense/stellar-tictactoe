import * as StellarSdk from 'stellar-sdk';
import { performance } from "perf_hooks";
import { move, setup } from '../src';

const keys1 = StellarSdk.Keypair.fromSecret('SB3U6F327CMOLCHYZ6GNGTTL66ORGZH6RETHHGRJVHFMHF5K7AYBKBNB');
const keys2 = StellarSdk.Keypair.fromSecret('SBGFNAWRRHA7AI2KCC47N3UDMYDKQGCT5HX2Q3RTFLTP4V7CRFRK4DMX');
const server = new StellarSdk.Server('https://horizon-testnet.stellar.org');

function transitions(tx: StellarSdk.Transaction) {
    const res = [];
    for (const op of tx.operations) {
        if (op.type === 'setOptions') {
            if ('signer' in op) {
                res.push((op.signer as StellarSdk.Signer.PreAuthTx).preAuthTx.toString('hex'));
            }
        }
    }

    return res;
}

(async function() {
    const player1 = await server.loadAccount(keys1.publicKey());
    const player2 = await server.loadAccount(keys2.publicKey());

    const t0 = performance.now();
    const [board, tx0] = setup([    //  p1 runs setup
        player1,
        player2
    ], 0);

    const t1 = performance.now();
    console.log(t1 - t0);

    const tx1 = move(board, 1, 4);  //  p2
    const tx2 = move(board, 2, 1);  //  p1
    const tx3 = move(board, 3, 0);
    const tx4 = move(board, 4, 8);
    const tx5 = move(board, 5, 3);
    const tx6 = move(board, 6, 5);
    const tx7 = move(board, 7, 6);  //  p2 wins
})();
