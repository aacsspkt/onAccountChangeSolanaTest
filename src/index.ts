import assert from "assert";
import bs58 from "bs58";
import dotenv from "dotenv";

import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { clusterApiUrl, Connection, Keypair, PublicKey } from "@solana/web3.js";

const connection = new Connection(clusterApiUrl("devnet"));
const signers = getSigners();
const mint = new PublicKey("De31sBPcDejCVpZZh1fq8SNs7AcuWcBKuU3k2jqnkmKc");
const sender = signers[1];
const receiver = signers[2];
const listeners: number[] = [];

console.log("sender:", sender.publicKey.toString());
console.log("receiver:", receiver.publicKey.toString());

const receiverTokenAccount = getAssociatedTokenAddressSync(mint, receiver.publicKey);

process.on("SIGINT", async function () {
	console.log("Caught interrupt signal");
	await removeListeners(listeners);
});

let amount = BigInt(0);
let latestSignature =
	"31QPy7VtwMptsrjSyzH9hHgEmYLTNi1LCt1jmZLr74nYH2uzWRafSvgAS37iwjCUXtgbTDLRFF95ABaSepYf2foT";

async function main() {
	// const amountResponse = await connection.getTokenAccountBalance(
	// 	receiverTokenAccount,
	// 	"confirmed",
	// );
	// amount = BigInt(amountResponse.value.amount);

	console.log("subscribing listener...");
	const id = connection.onAccountChange(
		receiverTokenAccount,
		async (accountInfo, context) => {
			console.log("slot:", context.slot);
			console.log("latest sig:", latestSignature);
			const signatures = await connection.getSignaturesForAddress(
				receiverTokenAccount,
				{ until: latestSignature },
				"confirmed",
			);
			console.log(
				"signatures",
				signatures.map((s) => s.signature),
			);
			latestSignature = signatures.map((s) => s.signature)[0];
			console.log("latest sig:", latestSignature);

			// const rawAccount = AccountLayout.decode(accountInfo.data);
			// const newAmount = rawAccount.amount;
			// console.log("\n");
			// console.log("prev amount:", amount);
			// console.log("after amount:", newAmount);
			// console.log("difference:", newAmount - amount);
			// console.log("\n");

			// amount = newAmount;
		},
		{
			commitment: "finalized",
		},
	);

	// listeners.push(id);
	// console.log("listener id:", id);
	const id1 = connection.onProgramAccountChange(
		TOKEN_PROGRAM_ID,
		(accountInfo, context) => {
			console.log("\n");
			console.log("slot:", context.slot);
			console.log("account id:", accountInfo.accountId.toString());
			console.log("account data", accountInfo.accountInfo.data.toString("base64"));
			console.log("account lamports", accountInfo.accountInfo.lamports);
			console.log("account executable", accountInfo.accountInfo.executable);
			console.log("account owner", accountInfo.accountInfo.owner.toString());
		},
		{
			filters: [
				{
					memcmp: {
						offset: 0,
						bytes: mint.toString(),
					},
				},
			],
			commitment: "confirmed",
			// encoding: "base64",
		},
	);
	listeners.push(id1);
	console.log("listener id:", id1);

	await sleep(2_147_483_647); // max 32 bit signed integer
}

export async function removeListeners(listeners: number[]) {
	await Promise.all(
		listeners.map(async (id) => {
			console.log("unsubscribing listener:", id);
			await connection.removeAccountChangeListener(id);
		}),
	);
}

export function sleep(ms: number) {
	return new Promise((r) => setTimeout(r, ms));
}

export function getSigners() {
	dotenv.config();

	const SECRET_KEYS = process.env.SECRET_KEYS;

	assert(SECRET_KEYS && SECRET_KEYS != "", "missing env var: SECRET_KEYS");
	const keypairs: Keypair[] = [];
	try {
		const secretKeys = JSON.parse(SECRET_KEYS);

		assert(Array.isArray(secretKeys), "Invalid format for SECRET_KEYS");

		for (const keys of secretKeys) {
			// console.log("secret key", keys);
			assert(keys && typeof keys === "string" && keys != "", "Invalid secret key");

			const keypair = Keypair.fromSecretKey(bs58.decode(keys));

			keypairs.push(keypair);
		}
	} catch (err: any) {
		throw new Error("Some error occured parsing secret key: " + err.message);
	}

	return keypairs;
}

main()
	.then(async () => {
		removeListeners(listeners);
	})
	.catch(async (err) => {
		removeListeners(listeners);
		throw err;
	});
