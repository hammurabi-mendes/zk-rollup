// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/interfaces/IERC20.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./BatchVerifier.sol";
import "./WithdrawVerifier.sol";

import "hardhat/console.sol";

interface IHasher2 {
	// "pure" ensures that the function does not read or modify state
	function poseidon(bytes32[2] calldata input) pure external returns (bytes32);
	function poseidon(uint256[2] calldata input) pure external returns (uint256);
}

interface IHasher3 {
	// "pure" ensures that the function does not read or modify state
	function poseidon(bytes32[3] calldata input) pure external returns (bytes32);
	function poseidon(uint256[3] calldata input) pure external returns (uint256);
}

contract Rollup is Ownable, ReentrancyGuard {
    IERC20 public immutable token;
	IHasher2 public immutable hasher2;
	IHasher3 public immutable hasher3;

    BatchVerifier immutable batchVerifier;
    WithdrawVerifier immutable withdrawVerifier;

    uint256[] pendingDeposits;
    uint256 nextPendingDeposit;

    uint256 pendingHeight;
    uint256 processedHeight;

    uint256 currentRoot;

    uint256 nextUpdate;

    // Registers transaction batches
    mapping(uint256 => uint256) updates;

    // Registers withdrawals
    mapping(uint256 => bool) withdrawals;

	event PendingDeposit(uint256[2] indexed pubkey, uint256 amount);
	event Update(uint256 oldRoot, uint256 indexed txRoot, uint256 newRoot, uint256 indexed index);
    event Withdraw(address indexed recipient, uint256 amount);

    constructor(IERC20 _token, IHasher2 _hasher2, IHasher3 _hasher3) Ownable(msg.sender) {
        token = IERC20(_token);
        hasher2 = IHasher2(_hasher2);
        hasher3 = IHasher3(_hasher3);

        batchVerifier = new BatchVerifier();
        withdrawVerifier = new WithdrawVerifier();

        nextPendingDeposit = 0;

        pendingHeight = 0;
        processedHeight = 0;

        deposit([uint256(0), uint256(0)], 0);

        currentRoot = pendingDeposits[0];

        nextUpdate = 1;
    }

    // HM: Have to specify memory or calldata for the array
    //  Location specifier calldata == memory at original position
    //  Attributing from calldata to memory copies; from memory to memory only references
    function deposit(uint256[2] memory _pubkey, uint256 _amount) public payable nonReentrant {
        require(token.transferFrom(msg.sender, address(this), _amount), "No funds available");

        uint256 depositHash = hasher3.poseidon([_pubkey[0], _pubkey[1], _amount]);

        pendingDeposits.push(depositHash);
        nextPendingDeposit++;

        compactPendingDeposits();

        emit PendingDeposit(_pubkey, _amount);
    }

    function compactPendingDeposits() internal {
        uint256 current = nextPendingDeposit - 1;
        uint256 currentHeight = 0;

        uint256[4] memory lastTwo;

        while(current % 2 == 1) {
            lastTwo[0] = pendingDeposits[pendingDeposits.length - 2];
            lastTwo[1] = pendingDeposits[pendingDeposits.length - 1];

            // Replace last two with one
            pendingDeposits[pendingDeposits.length - 2] = hasher2.poseidon([lastTwo[0], lastTwo[1]]);
            pendingDeposits.pop(); 

            current = current / 2;
            currentHeight++;
        }

        if(currentHeight > pendingHeight) {
            pendingHeight = currentHeight;
        }
    }

    function processPendingDeposits() public onlyOwner nonReentrant {
        // Before updating the height, verify that the element at the first position
        // in the new height is zero, using the provided proof
        processedHeight = pendingHeight;

        currentRoot = pendingDeposits[0];
    }

    function update(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        // uint[3]: _txRoot, _oldRoot, _newRoot
        uint256 _txRoot, uint256 _oldRoot, uint256 _newRoot) public onlyOwner nonReentrant {
        require(currentRoot == _oldRoot, "Update does not start from oldRoot");

        // Requires a proof that we can correctly drive from _oldRoot to _newRoot with transactions in _txRoot
        require(batchVerifier.verifyProof(a, b, c, [uint(_txRoot), uint(_oldRoot), uint(_newRoot)]), "Update does not drive oldRoot to newRoot");

        currentRoot = _newRoot;

        // Register the transaction batch as processed
        updates[_txRoot] = nextUpdate;
        nextUpdate++;

        emit Update(_oldRoot, _newRoot, _txRoot, nextUpdate - 1);
    }

    function withdraw(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        // uint[3]: _tx, _txRoot, _amount
        address _recipient, uint256 _amount, uint256 _tx, uint256 _txRoot) public nonReentrant {
        require(updates[_txRoot] > 0, "Transaction batch is not recognized");
        require(withdrawals[_tx] == false, "Withdrawal already performed");
        
        // Requires a proof that:
        // 1) Transaction is a withdraw transaction
        // 2) Transaction is properly signed
        // 3) Transaction exists in the Merkle Tree at _txRoot
        require(withdrawVerifier.verifyProof(a, b, c, [uint(_tx), uint(_txRoot), uint(_amount)]), "Withdraw transaction is not present on txRoot");

        withdrawals[_tx] = true;

        require(token.transfer(_recipient, _amount), "Transfer to recipient failed");

        emit Withdraw(_recipient, _amount);
    }
}