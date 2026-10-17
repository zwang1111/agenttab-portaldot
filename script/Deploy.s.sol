// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "forge-std/Script.sol";
import "../src/AgentTab.sol";

/// forge script script/Deploy.s.sol --rpc-url portaldot_testnet --broadcast --private-key $PRIVATE_KEY
contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        AgentTab tab = new AgentTab();
        vm.stopBroadcast();
        console2.log("AgentTab", address(tab));
    }
}
