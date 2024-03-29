// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract GovernorState {
    mapping (uint => Transaction) internal transactions;
    mapping (address => mapping(bytes4 => uint8)) public SelectorToRequiredVotes; // [contract][functionSelector] => permission
    mapping (address => mapping(address => mapping(bytes4 => Votes))) public UsersToVotes; // [user][contract][functionSelector] => Votes
    mapping (address => Votes) public GrantAdminVotes;
    mapping (address => Votes) public RevokeAdminVotes;
    mapping (address => Votes) public GrantPauseVotes;
    Votes public UnPauseVotes;
    uint public transactionCount;

    struct Transaction {
        address destination;
        uint value;
        bytes data;
        bool executed;
        Votes votes;
    }

    struct Votes {
        uint8 total;
        mapping(address => bool) voteOf;
    }

    struct TransactionView {
        address destination;
        uint value;
        bytes data;
        bool executed;
        uint8 totalVotes;
    }

    event FunctionAdded(address indexed _contract, bytes4 indexed _selector, uint8 _requiredVotes);
    event FunctionRemoved(address indexed _contract, bytes4 indexed _selector);
    event FunctionGranted(address indexed _contract, bytes4 indexed _selector, address indexed _user);
    event FunctionRevoked(address indexed _contract, bytes4 indexed _selector, address indexed _user);
    event TransactionProposed(uint txId, address indexed _destination, uint _value, bytes _data);
    event TransactionApproved(uint txId, address indexed _destination, uint8 votes);
    event TransactionExecuted(uint txId, address indexed _destination, uint _value, bytes _data);

    function getTransactionById(uint _txId) external view returns (TransactionView memory transaction) {
        Transaction storage _tx = transactions[_txId];
        transaction = TransactionView(
            _tx.destination,
            _tx.value,
            _tx.data,
            _tx.executed,
            _tx.votes.total
        );
    }

    function getVoteOfTransactionById(uint _txId, address _user) external view returns (bool) {
        return transactions[_txId].votes.voteOf[_user];
    }

    function getGrantAdminVoteOf(address _user, address _admin) external view returns (bool) {
        return GrantAdminVotes[_user].voteOf[_admin];
    }

    function getRevokeAdminVoteOf(address _user, address _admin) external view returns (bool) {
        return RevokeAdminVotes[_user].voteOf[_admin];
    }

    function getGrantPauseVoteOf(address _pauser, address _admin) external view returns (bool) {
        return GrantPauseVotes[_pauser].voteOf[_admin];
    }

    function getUserVoteOf(address _user, address _contract, bytes4 _selector, address _admin) external view returns (bool) {
        return UsersToVotes[_user][_contract][_selector].voteOf[_admin];
    }

    function getRoleOfSelector(address _contract, bytes4 selector) public pure returns(bytes32 role) {
        role = keccak256(abi.encodePacked(_contract, selector));
    }

    function getSelectorFromData(bytes memory txData) public pure returns (bytes4 selector) {
        selector = bytes4(txData[0]) | bytes4(txData[1]) >> 8 | bytes4(txData[2]) >> 16 | bytes4(txData[3]) >> 24;
    }

    function getSelectorFromSignature(string calldata sig) public pure returns (bytes4 selector) {
        selector = bytes4(keccak256(bytes(sig)));
    }

    function isTransactionVotedBy(uint _txId, address _user) external view returns (bool) {
        return transactions[_txId].votes.voteOf[_user];
    }

}