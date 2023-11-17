import * as hre from "hardhat";

import { EIP712Signer, Provider, types, utils, Wallet } from "zksync-web3";
import { ethers } from "ethers";

// Temporary wallet for testing - that is accepting two private keys - and signs the transaction with both.
export class SellableWallet extends Wallet {
  readonly aaAddress: string;

  // AA_address - is the account abstraction address for which, we'll use the private key to sign transactions.
  constructor(
    aaAddress: string,
    signerKey: string,
    providerL2: Provider,
  ) {
    super(signerKey, providerL2);
    this.aaAddress = aaAddress;
  }

  getAddress(): Promise<string> {
    return Promise.resolve(this.aaAddress);
  }

  async signTransaction(transaction: types.TransactionRequest) {
    const sig1 = await this.eip712.sign(transaction);
    // substring(2) to remove the '0x' from sig2.
    if (transaction.customData === undefined) {
      throw new Error("Transaction customData is undefined");
    }
    transaction.customData.customSignature = sig1;
    return (0, utils.serialize)(transaction);
  }

  async sendTransaction(transaction: ethers.providers.TransactionRequest): Promise<types.TransactionResponse> {
      const tx = {
        ...transaction,
        data: transaction.data || "0x",
        value: transaction.value || 0,
        from: this.aaAddress,
        chainId: (await this.provider.getNetwork()).chainId,
        nonce: await this.provider.getTransactionCount(this.aaAddress),
        type: 113,
        customData: {
          gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
        } as types.Eip712Meta,
      };
    
      tx.gasPrice = await this.provider.getGasPrice();
      if (tx.gasLimit == undefined) {
        tx.gasLimit = await this.provider.estimateGas(tx);
      }

      const signedTxHash = EIP712Signer.getSignedDigest(tx);
      const signature = ethers.utils.arrayify(
        ethers.utils.joinSignature(this._signingKey().signDigest(signedTxHash)),
      );
    
      tx.customData = {
        ...tx.customData,
        customSignature: signature,
      };
  
      return await this.provider.sendTransaction(utils.serialize(tx));
  }
}