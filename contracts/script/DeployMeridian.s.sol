// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ResolutionOracle} from "../src/ResolutionOracle.sol";
import {MarketFactory} from "../src/MarketFactory.sol";
import {AgentVault} from "../src/AgentVault.sol";

contract DeployMeridian is Script {
    // Arc testnet addresses
    address constant ARC_USDC = 0x3600000000000000000000000000000000000000;
    address constant ARC_EURC = 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a;
    address constant ARC_USYC = 0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C;
    address constant ARC_TELLER = 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deployer:", deployer);
        console.log("Balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy ResolutionOracle
        ResolutionOracle oracle = new ResolutionOracle();
        console.log("ResolutionOracle deployed at:", address(oracle));

        // 2. Deploy MarketFactory
        MarketFactory factory = new MarketFactory(address(oracle));
        console.log("MarketFactory deployed at:", address(factory));

        // 3. Register supported collateral tokens (both 6 decimals)
        factory.addCollateral(ARC_USDC, 6);
        factory.addCollateral(ARC_EURC, 6);
        console.log("Registered USDC and EURC as collateral");

        // 4. Deploy AgentVault (USDC collateral, USYC yield, Teller bridge)
        AgentVault vault = new AgentVault(ARC_USDC, ARC_USYC, ARC_TELLER, deployer);
        console.log("AgentVault deployed at:", address(vault));

        vm.stopBroadcast();

        // Print summary
        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("USDC (native):    ", ARC_USDC);
        console.log("EURC:             ", ARC_EURC);
        console.log("USYC:             ", ARC_USYC);
        console.log("Teller:           ", ARC_TELLER);
        console.log("ResolutionOracle: ", address(oracle));
        console.log("MarketFactory:    ", address(factory));
        console.log("AgentVault:       ", address(vault));
        console.log("==========================\n");
    }
}
