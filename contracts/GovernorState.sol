// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract GovernorState {
    mapping (uint => Transaction) public transactions;
    mapping (address => mapping(bytes4 => Permission)) public ContractSelectorToPermission; // [contract][functionSelector] => permission
    mapping (address => mapping(address => mapping(bytes4 => PermissionStatus))) public UsersToPermission; // [user][contract][functionSelector] => PermissionStatus
    mapping (address => PermissionStatus) public GrantAdminVotes;
    mapping (address => PermissionStatus) public RevokeAdminVotes;
    uint public transactionCount;
    address[] public AllContracts;

    struct Transaction {
        address destination;
        uint value;
        bytes data;
        uint8 votes;
        mapping(address => bool) voters;
        bool executed;
    }

    struct Permission {
        bytes32 role;
        uint8 requiredVotes;
    }

    struct PermissionStatus {
        uint8 votes;
        mapping(address => bool) voters;
        bool isGranted;
    }

    event ContractAdded(address indexed _contract, uint8 _requiredVotes);
    event ContractRemoved(address indexed _contract);
    event RoleGranted(address indexed _contract, address indexed _user);
    event RoleRevoked(address indexed _contract, address indexed _user);
    event TransactionProposed(uint txId, address indexed _destination, uint _value, bytes _data);
    event TransactionApproved(uint txId, address indexed _destination, uint8 votes);
    event TransactionExecuted(uint txId, address indexed _destination, uint _value, bytes _data);

    function getTransactionById(uint _txId) external view returns (
        address destination,
        uint value,
        bytes memory data,
        uint8 votes,
        bool executed
    ) {
        Transaction storage transaction = transactions[_txId];
        destination = transaction.destination;
        value = transaction.value;
        data = transaction.data;
        votes = transaction.votes;
        executed = transaction.executed;
    }

    function getSelectorFromData(bytes memory txData) public pure returns (bytes4 selector) {
        selector = bytes4(txData[0]) | bytes4(txData[1]) >> 8 | bytes4(txData[2]) >> 16 | bytes4(txData[3]) >> 24;
    }

    function getSelectorFromSignature(string calldata sig) public pure returns (bytes4 selector) {
        selector = bytes4(keccak256(bytes(sig)));
    }

    function isTransactionVotedBy(uint _txId, address _user) external view returns (bool) {
        return transactions[_txId].voters[_user];
    }

    function getTotalContracts() external view returns (uint) {
        return AllContracts.length;
    }
}