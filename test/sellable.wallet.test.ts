import { expect } from "chai";
import { SellableWallet } from "../frontend/src/utils/sellable-wallet-utils";
import * as zks from "zksync-web3";
import { deployAccount, deployFactory, getProvider, getWallet } from "../deploy/utils";
import * as hre from 'hardhat';
import { ethers } from "ethers";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

export enum Wallets {
  firstWalletAddress = "0x36615Cf349d7F6344891B1e7CA7C72883F5dc049",
  firstWalletPrivateKey = "0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110",
  secondWalletPrivateKey = "0xd293c684d884d56f8d6abd64fc76757d3664904e309a0645baf8522ab6366d9e",
  secondWalletAddress = "0x0D43eB5B8a47bA8900d84AA36656c92024e9772e",
}

describe("Sellable Wallet Tests", function () {
  let factory: zks.Contract;
  let richWallet: zks.Wallet;
  let richWallet2: zks.Wallet;
  let sellableWallet: SellableWallet;
  let account, erc20, nft: zks.Contract;
  
  before(async function () {
    const provider = getProvider();
    await provider.send("config_setShowCalls", ["user"]);
    await provider.send("config_setResolveHashes", [true]);
    richWallet = new zks.Wallet(Wallets.firstWalletPrivateKey, provider);
    richWallet2 = new zks.Wallet(Wallets.secondWalletPrivateKey, provider);
    factory = await deployFactory(hre);
    const deployer = new Deployer(hre, getWallet());
    const deployer2 = new Deployer(hre, richWallet2);
    const erc20Artifact = await deployer.loadArtifact("MockERC20");
    const nftArtifact = await deployer.loadArtifact("MockNFT");
    erc20 = await deployer.deploy(erc20Artifact, []);
    nft = await deployer2.deploy(nftArtifact, []);
  });

  describe("SellableWallet", function () {
    before(async function () {
      account = await deployAccount(hre, factory.address, richWallet.address);
      sellableWallet = new SellableWallet(account.address, richWallet.privateKey, getProvider());
    });

    it("Should fund sellable wallet", async function () {
      await (
        await richWallet.sendTransaction({
          to: await sellableWallet.getAddress(),
          // You can increase the amount of ETH sent to the multisig
          value: ethers.utils.parseEther("0.1"),
        })
      ).wait();
      const balance = await getProvider().getBalance(await sellableWallet.getAddress());
      expect(balance.toString()).to.be.equal(ethers.utils.parseEther("0.1").toString());
    });

    it("Sellable wallet can send transactions", async function () {
      const balanceBefore = await getProvider().getBalance(richWallet2.address);
      await(
        await (
          sellableWallet.sendTransaction({
            to: richWallet2.address,
            value: ethers.utils.parseEther("0.01"),
          })
        )
      )
      const balanceAfter = await getProvider().getBalance(richWallet2.address);
      
      expect(balanceAfter.sub(balanceBefore).toString()).to.be.equal(ethers.utils.parseEther("0.01").toString());
    });

    it("Can't set for sale if not account calling it", async function () {
      await expect(account.connect(richWallet2).changeSaleState(true)).to.be.revertedWith("Only the account itself can call this method");
      await expect(account.connect(richWallet2).setPurchaseInformation(ethers.constants.AddressZero, ethers.utils.parseEther("0.01"), false, 0)).to.be.revertedWith("Only the account itself can call this method");
    });

    it("Can't set for sale if there is no price defined", async function () {
      const tx = await account.populateTransaction.changeSaleState(true)
      await expect(sellableWallet.sendTransaction(tx)).to.be.revertedWith("Can't set for sale without any token and price defined");  //broken, not sure why
    });

    it("Can set for sale", async function () {
      const value = ethers.utils.parseEther("0.01");
      const tx = await account.populateTransaction.setPurchaseInformation(ethers.constants.AddressZero, value, false, 0)

      await (
        await (
          sellableWallet.sendTransaction(tx)
        )
      )

      const isForSale = await account.isOnSale();
      const purchaseInfo = await account.purchaseInformation();
      expect(isForSale).to.be.true;
      expect(purchaseInfo.amount.toString()).to.be.equal(value.toString());
    });

    it("Can stop sale", async function () {
      const tx = await account.populateTransaction.changeSaleState(false)

      await (
        await (
          sellableWallet.sendTransaction(tx)
        )
      )

      const isForSale = await account.isOnSale();
      expect(isForSale).to.be.false;
    })

    it("Can purchase account", async function () {

      const value = ethers.utils.parseEther("0.1");
      const tx = await account.populateTransaction.setPurchaseInformation(ethers.constants.AddressZero, value, false, 0)

      await(await (
          sellableWallet.sendTransaction(tx)
      ))
      
      const purchaseInfo = await account.purchaseInformation();
      const transaction = account.connect(richWallet2).purchaseAccount({value: purchaseInfo.amount})
      await expect(transaction).to.emit(account, 'SignerChasaaanged') //broken, not sure why
      await transaction.wait();

      const currentSigner = await account.currentSigner();
      expect(currentSigner).to.be.equal(richWallet2.address);
    });

    it("Can purchase account with ERC20", async function () {
      sellableWallet = new SellableWallet(account.address, richWallet2.privateKey, getProvider());
      const value = 50;
      const tx = await account.populateTransaction.setPurchaseInformation(erc20.address, value, false, 0)

      const transaction = await (
          sellableWallet.sendTransaction(tx)
      )
      await transaction.wait();

      const purchaseInfo = await account.purchaseInformation();

      await (await erc20.approve(account.address, purchaseInfo.amount));

      await (await (account.purchaseAccount({value: purchaseInfo.amount})));

      const currentSigner = await account.currentSigner();
      expect(currentSigner).to.be.equal(richWallet.address);
    });

    it("Can purchase account with NFT", async function () {
      sellableWallet = new SellableWallet(account.address, richWallet.privateKey, getProvider());
      const value = 1;
      const tx = await account.populateTransaction.setPurchaseInformation(nft.address, value, true, 1)

      const transaction = await (
          sellableWallet.sendTransaction(tx)
      )
      await transaction.wait();

      const purchaseInfo = await account.purchaseInformation();

      await (await nft.approve(account.address, purchaseInfo.tokenId));

      await (await (account.connect(richWallet2).purchaseAccount()));

      const currentSigner = await account.currentSigner();
      expect(currentSigner).to.be.equal(richWallet2.address);
    });

  });
});
