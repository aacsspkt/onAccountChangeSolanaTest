import assert from "assert";
import bs58 from "bs58";
import dotenv from "dotenv";
import { describe } from "mocha";

import {
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

export function getSigners() {
  const SECRET_KEYS = process.env.SECRET_KEYS;

  assert(SECRET_KEYS && SECRET_KEYS != "", "missing env var: SECRET_KEYS");
  const keypairs: Keypair[] = [];
  try {
    const secretKeys = JSON.parse(SECRET_KEYS);

    assert(Array.isArray(secretKeys), "Invalid format for SECRET_KEYS");

    for (const keys of secretKeys) {
      // console.log("secret key", keys);
      assert(
        keys && typeof keys === "string" && keys != "",
        "Invalid secret key"
      );

      const keypair = Keypair.fromSecretKey(bs58.decode(keys));

      keypairs.push(keypair);
    }
  } catch (err: any) {
    throw new Error("Some error occured parsing secret key: " + err.message);
  }

  return keypairs;
}

dotenv.config();

const signers = getSigners();
const connection = new Connection(clusterApiUrl("devnet"));

describe("transfer token", () => {
  it("transfers tokens", async () => {
    const mint = new PublicKey("De31sBPcDejCVpZZh1fq8SNs7AcuWcBKuU3k2jqnkmKc");
    const UNITS_PER_MINT = 1e6;

    const sender = signers[1];
    const receiver = signers[2];

    const source = getAssociatedTokenAddressSync(mint, sender.publicKey);
    const destination = getAssociatedTokenAddressSync(mint, receiver.publicKey);

    let range = [1, 2, 3, 4, 5];

    await Promise.all(
      range.map(async (a) => {
        const amount = a * UNITS_PER_MINT;
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash();
        const message = new TransactionMessage({
          instructions: [
            createTransferInstruction(
              source,
              destination,
              sender.publicKey,
              amount
            ),
          ],
          payerKey: sender.publicKey,
          recentBlockhash: blockhash,
        });

        const tx = new VersionedTransaction(message.compileToV0Message());

        tx.sign([sender]);

        const signature = await connection.sendTransaction(tx, {
          preflightCommitment: "confirmed",
        });
        await connection.confirmTransaction(
          {
            blockhash,
            lastValidBlockHeight,
            signature,
          },
          "finalized"
        );

        console.log({ signature });
      })
    );
  });
});
