import { HardhatRuntimeEnvironment } from "hardhat/types";
import { deployFactory } from "./utils";

export default async function (hre: HardhatRuntimeEnvironment) {
    await deployFactory(hre);
}
