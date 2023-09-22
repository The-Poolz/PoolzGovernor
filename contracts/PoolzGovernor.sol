// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./RoleManager.sol";

contract PoolzGovernor is RoleManager {

    constructor(address[] memory _admins) {
        require(_admins.length >= 2, "PoolzGovernor: Need more than 1 admin");
        for(uint i = 0; i < _admins.length; i++){
            _setupRole(ADMIN_ROLE, _admins[i]);
        }
    }

    modifier transactionExists(uint txId) {
        require(txId < transactionCount, "PoolzGovernor: transaction does not exist");
        _;
    }

    function proposeTransaction(address _destination, bytes memory _data)
        public
        isAdminOrFunctionRole(_destination, _data)
        payable
        returns (uint txId)
    {
        txId  = transactionCount++;
        Transaction storage transaction = transactions[txId];
        transaction.destination = _destination;
        transaction.value = msg.value;
        transaction.data = _data;
        transaction.votes.total = 1;
        transaction.votes.voteOf[msg.sender] = true;
        emit TransactionProposed(txId, _destination, msg.value, _data);
        executeIfApproved(txId);
    }

    function approveTransaction(uint txId)
        public
        transactionExists(txId)
        isAdminOrFunctionRole(transactions[txId].destination, transactions[txId].data)
    {
        Transaction storage transaction = transactions[txId];
        require(!transaction.executed, "PoolzGovernor: transaction already executed");
        require(!transaction.votes.voteOf[msg.sender], "PoolzGovernor: user already voted");
        transaction.votes.total++;
        transaction.votes.voteOf[msg.sender] = true;
        emit TransactionApproved(txId, transaction.destination, transaction.votes.total);
        executeIfApproved(txId);
    }

    function executeIfApproved(uint txId) private {
        Transaction storage transaction = transactions[txId];
        bytes4 selector = getSelectorFromData(transaction.data);
        if(transaction.votes.total >= SelectorToRequiredVotes[transaction.destination][selector]){
            transaction.executed = true;
            (bool success, ) = transaction.destination.call{value: transaction.value}(transaction.data);
            require(success, "PoolzGovernor: transaction execution reverted.");
            emit TransactionExecuted(txId, transaction.destination, transaction.value, transaction.data);
        }
    }

}
