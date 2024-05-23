import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { TimeVault } from "../target/types/time_vault";
import { publicKey } from "@coral-xyz/anchor/dist/cjs/utils";
import { randomBytes } from "crypto";
import { assert } from "chai";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  getOrCreateAssociatedTokenAccount,
  createMint,
  MINT_SIZE,
  Account,
  mintTo,
  AccountLayout
} from "@solana/spl-token";
import { Keypair, 
  LAMPORTS_PER_SOL, 
  PublicKey, 
  Commitment,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction, 
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";


describe("time-vault", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.TimeVault as Program<TimeVault>;
  const connection = anchor.getProvider().connection;

  let sender = Keypair.generate();

  let receiver = Keypair.generate();
  let receiverAta: anchor.web3.PublicKey = Keypair.generate().publicKey;

  let mintAuthority = Keypair.generate();
  let mint = Keypair.generate();
  const decimals = 9;

  let senderAta = getAssociatedTokenAddressSync(
    mint.publicKey, 
    sender.publicKey, 
    false, 
    TOKEN_2022_PROGRAM_ID
  );


  const confirm = async (signature: string): Promise<string> => {
    const block = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      signature,
      ...block,
    });
    return signature;
  };

  const log = async (signature: string): Promise<string> => {
    console.log(
      `Your transaction signature: https://explorer.solana.com/transaction/${signature}?cluster=custom&customUrl=${connection.rpcEndpoint}`
    );
    return signature;
  };

  
  const seed = new anchor.BN(1);

  const vault = PublicKey.findProgramAddressSync(
    [
      Buffer.from("vault"),
      sender.publicKey.toBuffer(),
      receiver.publicKey.toBuffer(),
      seed.toBuffer('le', 8),
    ],
    program.programId,
  )[0];

  console.log(vault);

  const vault_bank = PublicKey.findProgramAddressSync(
    [
      Buffer.from("vault_bank"),
      vault.toBuffer(),
    ],
    program.programId,
  )[0];


  it("Airdrop", async () => {
    await connection
    .requestAirdrop(sender.publicKey, LAMPORTS_PER_SOL * 10)
    .then(confirm)
    .then(log);
    await connection
    .requestAirdrop(receiver.publicKey, LAMPORTS_PER_SOL * 10)
    .then(confirm)
    .then(log);
    await connection
    .requestAirdrop(mintAuthority.publicKey, LAMPORTS_PER_SOL * 10)
    .then(confirm)
    .then(log);
    await connection
      .requestAirdrop(vault, LAMPORTS_PER_SOL * 10)
      .then(confirm)
      .then(log);
    await connection
      .requestAirdrop(vault_bank, LAMPORTS_PER_SOL * 10)
      .then(confirm)
      .then(log);
  });


  it("Create Mint Account", async () => {


    const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
  
    const transaction = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: mintAuthority.publicKey,
        newAccountPubkey: mint.publicKey,
        space: MINT_SIZE,
        lamports: lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        mint.publicKey,
        decimals,
        mintAuthority.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID,
      ),
      createAssociatedTokenAccountIdempotentInstruction(
        sender.publicKey,
        senderAta,
        sender.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
      ),
      createMintToInstruction(
        mint.publicKey,
        senderAta,
        mintAuthority.publicKey,
        1000000000001,
        [],
        TOKEN_2022_PROGRAM_ID,
      ),
    );
  
    const txSig = await sendAndConfirmTransaction(
      connection,
      transaction,
      [sender, mint],
    );
    console.log(`Transaction Signature: ${txSig}`);
  });  


  it("Open vault", async () => {

    const now = new Date();

    // Add one day (24 hours * 60 minutes * 60 seconds * 1000 milliseconds)
    const oneDayLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Convert to seconds (since u32 might not safely hold the value in milliseconds)
    // and ensure it fits within the u32 range by using bitwise OR 0.
    const end_ts = (oneDayLater.getTime() / 1000) >>> 0;


    const mint = await createMint(
      connection,
      mintAuthority,
      mintAuthority.publicKey, // The mint authority you control
      null, // Freeze authority (null if you don't want to use this feature)
      9, // Decimals
    );

    const amount = new anchor.BN(23);

    // Add your test here.
    const tx = await program.methods.openVault(seed, amount, end_ts).accounts({
      sender: sender.publicKey,
      receiver: receiver.publicKey,
      vault: vault,
      mint: mint,
      vaultBank: vault_bank,
      systemProgram: anchor.web3.SystemProgram.programId,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc()
    .then(confirm)
    .then(log);

    const accountInfo = await connection.getAccountInfo(vault_bank);
    const data = Buffer.from(accountInfo.data);
    const tokenAccountInfo = AccountLayout.decode(data);

    console.log(`vault_bank info: ${tokenAccountInfo}`);

    const vault_log = await program.account.vault.fetch(vault);
    console.log(vault_log);
    
  });




  it("Claim from vault", async () => {

    const mint = await createMint(
      connection,
      mintAuthority,
      mintAuthority.publicKey, // The mint authority you control
      null, // Freeze authority (null if you don't want to use this feature)
      9, // Decimals
    );

    // Get the associated token account address
    const associatedTokenAddress = await getOrCreateAssociatedTokenAccount(
      connection,
      receiver,
      mint,
      receiver.publicKey,
      true,
      "confirmed",
      null,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
  );

    // Add your test here.
    const tx = await program.methods.claimFromVault(seed).accounts({
      sender: sender.publicKey,
      receiver: receiverAta,
      vaultBank: vault_bank,
      mint: mint,
      vault: vault,
      systemProgram: anchor.web3.SystemProgram.programId,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc()
    .then(confirm)
    .then(log);

    const accountInfo = await connection.getAccountInfo(vault_bank);
    const data = Buffer.from(accountInfo.data);
    const tokenAccountInfo = AccountLayout.decode(data);

    console.log(`vault_bank info: ${tokenAccountInfo}`);

    const vault_log = await program.account.vault.fetch(vault);
    console.log(vault_log);
    
  });


  it("Cancel vault", async () => {

    const mint = await createMint(
      connection,
      mintAuthority,
      mintAuthority.publicKey, // The mint authority you control
      null, // Freeze authority (null if you don't want to use this feature)
      9, // Decimals
    );

    // Get the associated token account address
    const associatedTokenAddress = await getOrCreateAssociatedTokenAccount(
      connection,
      receiver,
      mint,
      receiver.publicKey,
      true,
      "confirmed",
      null,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
  );

    // Add your test here.
    const tx = await program.methods.cancelVault(seed).accounts({
      sender: sender.publicKey,
      receiver: receiverAta,
      mint: mint,
      vaultBank: vault_bank,
      vault: vault,
      systemProgram: anchor.web3.SystemProgram.programId,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc()
    .then(confirm)
    .then(log);

    const accountInfo = await connection.getAccountInfo(vault_bank);
    const data = Buffer.from(accountInfo.data);
    const tokenAccountInfo = AccountLayout.decode(data);

    console.log(`vault_bank info: ${tokenAccountInfo}`);

    const vault_log = await program.account.vault.fetch(vault);
    console.log(vault_log);
    
  });


});
