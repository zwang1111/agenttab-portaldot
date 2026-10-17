// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 v) external returns (bool);
    function transferFrom(address f, address t, uint256 v) external returns (bool);
}

/// @title AgentTab (Portaldot V3 port) - pay-per-call payment tabs for AI agents.
/// @notice A payer (an agent) escrows either native tPOT/POT (token = address(0)) or an ERC-20
///         for a provider. Per API call the payer signs an EIP-712 voucher with the new cumulative
///         amount; the provider settles any time (batching many calls into one tx) and the payer
///         reclaims the unspent balance after expiry.
/// @dev    Ported from AgentTab (Celo/Base). Portaldot V3 changes:
///         - native-token tabs (payable open/topUp), so agents can pay in tPOTv3 without a token contract;
///         - native payouts use call{value:} (no 2300-gas transfer), since gas accounting on
///           pallet-revive differs from Ethereum;
///         - nonReentrant guard on every function that moves value.
contract AgentTab {
    struct Tab { address payer; address provider; address token; uint128 deposit; uint128 claimed; uint64 expiry; }

    address public constant NATIVE = address(0);
    bytes32 public constant VOUCHER_TYPEHASH = keccak256("Voucher(uint256 tabId,uint256 cumulative)");
    bytes32 public immutable DOMAIN_SEPARATOR;
    uint256 public nextId = 1;
    mapping(uint256 => Tab) public tabs;
    uint256 private _lock = 1;

    event Opened(uint256 indexed id, address indexed payer, address indexed provider, address token, uint256 amount, uint64 expiry);
    event ToppedUp(uint256 indexed id, uint256 amount);
    event Settled(uint256 indexed id, uint256 paid, uint256 cumulative);
    event Refunded(uint256 indexed id, uint256 amount);

    error BadSig(); error NotProvider(); error NotPayer(); error Exceeds(); error NotExpired(); error Stale();
    error TransferFailed(); error BadValue(); error Reentrancy(); error NoTab();

    modifier nonReentrant() { if (_lock != 1) revert Reentrancy(); _lock = 2; _; _lock = 1; }

    constructor() {
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("AgentTab"), keccak256("1"), block.chainid, address(this)));
    }

    function open(address provider, address token, uint128 amount, uint64 expiry) external payable nonReentrant returns (uint256 id) {
        if (provider == address(0)) revert NotProvider();
        id = nextId++;
        tabs[id] = Tab(msg.sender, provider, token, amount, 0, expiry);
        _pull(token, amount);
        emit Opened(id, msg.sender, provider, token, amount, expiry);
    }

    function topUp(uint256 id, uint128 amount, uint64 newExpiry) external payable nonReentrant {
        Tab storage t = tabs[id];
        if (t.payer == address(0)) revert NoTab();
        if (msg.sender != t.payer) revert NotPayer();
        t.deposit += amount;
        if (newExpiry > t.expiry) t.expiry = newExpiry;
        _pull(t.token, amount);
        emit ToppedUp(id, amount);
    }

    function digest(uint256 id, uint256 cumulative) public view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, keccak256(abi.encode(VOUCHER_TYPEHASH, id, cumulative))));
    }

    function settle(uint256 id, uint128 cumulative, bytes calldata sig) external nonReentrant {
        Tab storage t = tabs[id];
        if (msg.sender != t.provider) revert NotProvider();
        if (cumulative > t.deposit) revert Exceeds();
        if (cumulative <= t.claimed) revert Stale();
        if (_recover(digest(id, cumulative), sig) != t.payer) revert BadSig();
        uint256 pay = cumulative - t.claimed;
        t.claimed = cumulative;
        _send(t.token, t.provider, pay);
        emit Settled(id, pay, cumulative);
    }

    function refund(uint256 id) external nonReentrant {
        Tab storage t = tabs[id];
        if (msg.sender != t.payer) revert NotPayer();
        if (block.timestamp < t.expiry) revert NotExpired();
        uint256 left = t.deposit - t.claimed;
        t.deposit = t.claimed;
        _send(t.token, t.payer, left);
        emit Refunded(id, left);
    }

    function remaining(uint256 id) external view returns (uint256) { Tab storage t = tabs[id]; return t.deposit - t.claimed; }

    function _pull(address token, uint256 amount) private {
        if (token == NATIVE) { if (msg.value != amount) revert BadValue(); return; }
        if (msg.value != 0) revert BadValue();
        if (!IERC20(token).transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
    }

    function _send(address token, address to, uint256 amount) private {
        if (amount == 0) return;
        if (token == NATIVE) { (bool ok, ) = to.call{value: amount}(""); if (!ok) revert TransferFailed(); return; }
        if (!IERC20(token).transfer(to, amount)) revert TransferFailed();
    }

    function _recover(bytes32 h, bytes calldata sig) private pure returns (address a) {
        if (sig.length != 65) revert BadSig();
        bytes32 r; bytes32 s; uint8 v;
        assembly { r := calldataload(sig.offset) s := calldataload(add(sig.offset, 32)) v := byte(0, calldataload(add(sig.offset, 64))) }
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) revert BadSig();
        a = ecrecover(h, v, r, s);
        if (a == address(0)) revert BadSig();
    }
}
