// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "forge-std/Test.sol";
import "../src/AgentTab.sol";
import "../src/MockStable.sol";

contract AgentTabTest is Test {
    AgentTab tab; MockStable usd;
    uint256 pk = 0xA11CE; address payer; address provider = address(0xB0B);

    function setUp() public {
        tab = new AgentTab(); usd = new MockStable(); payer = vm.addr(pk);
        usd.mint(payer, 100e6);
        vm.prank(payer); usd.approve(address(tab), type(uint256).max);
    }
    function _open() internal returns (uint256 id) { vm.prank(payer); id = tab.open(provider, address(usd), 10e6, uint64(block.timestamp + 1 days)); }
    function _sig(uint256 id, uint256 c, uint256 k) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(k, tab.digest(id, c)); return abi.encodePacked(r, s, v);
    }
    function testSettleBatches() public {
        uint256 id = _open();
        bytes memory a = _sig(id, 3e6, pk); bytes memory b = _sig(id, 5e6, pk);
        vm.startPrank(provider);
        tab.settle(id, 3e6, a);
        tab.settle(id, 5e6, b);
        vm.stopPrank();
        assertEq(usd.balanceOf(provider), 5e6);
    }
    function testRejectBadSigAndStale() public {
        uint256 id = _open();
        bytes memory bad = _sig(id, 1e6, 0xBAD); bytes memory s2 = _sig(id, 2e6, pk); bytes memory s11 = _sig(id, 11e6, pk);
        vm.startPrank(provider);
        vm.expectRevert(AgentTab.BadSig.selector); tab.settle(id, 1e6, bad);
        tab.settle(id, 2e6, s2);
        vm.expectRevert(AgentTab.Stale.selector); tab.settle(id, 2e6, s2);
        vm.expectRevert(AgentTab.Exceeds.selector); tab.settle(id, 11e6, s11);
        vm.stopPrank();
        bytes memory g = _sig(id, 3e6, pk);
        vm.expectRevert(AgentTab.NotProvider.selector); tab.settle(id, 3e6, g);
    }
    function testRefundAfterExpiry() public {
        uint256 id = _open();
        bytes memory g = _sig(id, 4e6, pk); vm.prank(provider); tab.settle(id, 4e6, g);
        vm.prank(payer); vm.expectRevert(AgentTab.NotExpired.selector); tab.refund(id);
        vm.warp(block.timestamp + 2 days);
        vm.prank(payer); tab.refund(id);
        assertEq(usd.balanceOf(payer), 96e6);
    }
    function testTopUp() public {
        uint256 id = _open();
        vm.prank(payer); tab.topUp(id, 5e6, 0);
        bytes memory g = _sig(id, 15e6, pk); vm.prank(provider); tab.settle(id, 15e6, g);
        assertEq(usd.balanceOf(provider), 15e6);
    }

    // ---- Portaldot port: native tPOTv3 tabs ----
    function testNativeTab() public {
        vm.deal(payer, 10 ether);
        vm.prank(payer); uint256 id = tab.open{value: 1 ether}(provider, address(0), 1 ether, uint64(block.timestamp + 1 days));
        bytes memory g = _sig(id, 0.4 ether, pk); vm.prank(provider); tab.settle(id, 0.4 ether, g);
        assertEq(provider.balance, 0.4 ether);
        vm.warp(block.timestamp + 2 days);
        vm.prank(payer); tab.refund(id);
        assertEq(payer.balance, 9.6 ether);
        assertEq(tab.remaining(id), 0);
    }
    function testNativeBadValue() public {
        vm.deal(payer, 10 ether);
        vm.prank(payer); vm.expectRevert(AgentTab.BadValue.selector);
        tab.open{value: 1}(provider, address(0), 1 ether, uint64(block.timestamp + 1 days));
        vm.prank(payer); vm.expectRevert(AgentTab.BadValue.selector);
        tab.open{value: 1}(provider, address(usd), 1e6, uint64(block.timestamp + 1 days));
    }
    function testTopUpUnknownTab() public {
        vm.expectRevert(AgentTab.NoTab.selector); tab.topUp(999, 1, 0);
    }
}
