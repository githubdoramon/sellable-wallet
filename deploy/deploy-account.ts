import { HardhatRuntimeEnvironment } from "hardhat/types";
import { deployAccount, getWallet } from "./utils";

// Put the address of your AA factory
const AA_FACTORY_ADDRESS = "0xb76eD02Dea1ba444609602BE5D587c4bFfd67153";

export default async function (hre: HardhatRuntimeEnvironment) {
  await deployAccount(hre, AA_FACTORY_ADDRESS, getWallet().address);
}
