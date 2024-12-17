import { TOKEN_PROGRAM_ID, AccountLayout } from "@solana/spl-token";
import { clusterApiUrl, Connection, Keypair, PublicKey } from "@solana/web3.js";

const connection = new Connection(clusterApiUrl("devnet"));

// Define the specific token mint (token type) we're interested in tracking
const mint = new PublicKey("De31sBPcDejCVpZZh1fq8SNs7AcuWcBKuU3k2jqnkmKc");
const listeners: number[] = [];

process.on("SIGINT", async function () {
  console.log("Caught interrupt signal");
  // Remove all active listeners when the process is interrupted
  await removeListeners(listeners);
});

// List of whitelisted account addresses to monitor
// Only accounts owned by these addresses will trigger further processing
let whitelistedAccounts = [
  "Bux7a8ifBH9zmbh6pJ4erL8v5BjsWZ97G3R7gLyxMGgH",
  "6smCjxLghJ1TeKNqvDuo4hkLMH917Ej3RrSYBHHrUsLj",
];

// Mapping to track the most recent signature for each user's Program Derived Address (PDA)
// This helps in tracking new transactions since the last check
let signatureMap: {
  [userPda: string]: string;
} = {};

async function main() {
  const id1 = connection.onProgramAccountChange(
    TOKEN_PROGRAM_ID, // Listen to all token program account changes
    async (accountInfo, context) => {
      // Extract account and owner information
      let account = accountInfo.accountId;
      let data = accountInfo.accountInfo.data;

      // Decode the account data using the token program's account layout
      let parsedData = AccountLayout.decode(data);
      let accountOwner = parsedData.owner;
      console.log("accountOwner", accountOwner.toString());

      // Skip processing if the account owner is not whitelisted
      if (!whitelistedAccounts.includes(accountOwner.toString())) {
        console.log("account not whitelisted: ", account.toString());
        return;
      }
      console.log("account whitelisted: ", account.toString());

      if (signatureMap[accountOwner.toString()]) {
        let currentSignature = signatureMap[accountOwner.toString()];

        // Retrieve signatures for this account since the last tracked signature
        const latestSignatures = await connection.getSignaturesForAddress(
          account,
          { until: currentSignature }, // Only get signatures before the current known signature
          "confirmed"
        );

        // Process each signature
        for (let signature of latestSignatures) {
          console.log("signature", signature.signature);

          // Retrieve the full transaction details for each signature
          const transaction = await connection.getParsedTransaction(
            signature.signature
          );

          // TODO: Implement specific transaction filtering
          // Check if the signature contains a USDC token-in transfer
          // If it does, call a BuyCard function or perform specific actions
        }

        // Update the signature map with the most recent signature
        signatureMap[accountOwner.toString()] = latestSignatures.map(
          (s) => s.signature
        )[0];
      }
    },
    {
      // Filter to only listen to accounts associated with the specific token mint
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: mint.toString(),
          },
        },
      ],
      commitment: "confirmed",
    }
  );

  listeners.push(id1);
  console.log("listener id:", id1);

  // Keep the script running for the maximum 32-bit signed integer milliseconds
  // Effectively keeps the listener active until manually stopped
  await sleep(2_147_483_647);
}

// Utility function to remove all active listeners
export async function removeListeners(listeners: number[]) {
  await Promise.all(
    listeners.map(async (id) => {
      console.log("unsubscribing listener:", id);
      await connection.removeAccountChangeListener(id);
    })
  );
}

// Simple sleep function to pause execution
export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Main execution with error handling
main()
  .then(async () => {
    // Remove listeners on successful completion
    removeListeners(listeners);
  })
  .catch(async (err) => {
    // Remove listeners if an error occurs
    removeListeners(listeners);
    throw err;
  });
