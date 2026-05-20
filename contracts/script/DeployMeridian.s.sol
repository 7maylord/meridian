// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MeridianMarket} from "../src/MeridianMarket.sol";
import {ResolutionOracle} from "../src/ResolutionOracle.sol";
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

        // 1. Deploy MeridianMarket (oracle set to address(0) initially)
        MeridianMarket market = new MeridianMarket(address(0));
        console.log("MeridianMarket deployed at:", address(market));

        // 2. Deploy ResolutionOracle (pointing at the market)
        ResolutionOracle oracle = new ResolutionOracle(address(market));
        console.log("ResolutionOracle deployed at:", address(oracle));

        // 3. Set the oracle on the market
        market.setOracle(address(oracle));
        console.log("Oracle set on MeridianMarket");

        // 4. Register supported collateral tokens (both 6 decimals)
        market.addCollateral(ARC_USDC, 6);
        market.addCollateral(ARC_EURC, 6);
        console.log("Registered USDC and EURC as collateral");

        // 5. Deploy AgentVault (USDC collateral, USYC yield, Teller bridge, agent, market)
        AgentVault vault = new AgentVault(ARC_USDC, ARC_USYC, ARC_TELLER, deployer, address(market));
        console.log("AgentVault deployed at:", address(vault));

        vm.stopBroadcast();

        // Print summary
        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("USDC (native):      ", ARC_USDC);
        console.log("EURC:               ", ARC_EURC);
        console.log("USYC:               ", ARC_USYC);
        console.log("Teller:             ", ARC_TELLER);
        console.log("MeridianMarket:     ", address(market));
        console.log("ResolutionOracle:   ", address(oracle));
        console.log("AgentVault:         ", address(vault));
        console.log("==========================\n");
    }
}
