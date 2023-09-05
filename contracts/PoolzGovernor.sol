// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./RoleManager.sol";

contract PoolzGovernor is RoleManager {

    modifier transactionExists(uint txId) {
        require(txId < transactionCount, "PoolzGovernor: transaction does not exist");
        _;
    }

    function proposeTransaction(address _destination, bytes memory _data)
        public
        roleExistsFor(_destination)
        isAdminOrContractRole(_destination)
        payable
        returns (uint txId)
    {
        txId  = transactionCount++;
        Transaction storage transaction = transactions[txId];
        transaction.destination = _destination;
        transaction.value = msg.value;
        transaction.data = _data;
        transaction.votes = 1;
        transaction.voters[msg.sender] = true;
        transaction.executed = false;
        emit TransactionProposed(txId, _destination, msg.value, _data);
        executeTransaction(txId);
    }

    function approveTransaction(uint txId)
        public
        transactionExists(txId)
        isAdminOrContractRole(transactions[txId].destination)
    {
        Transaction storage transaction = transactions[txId];
        require(transaction.executed == false, "PoolzGovernor: transaction already executed");
        require(transaction.voters[msg.sender] == false, "PoolzGovernor: user already voted");
        transaction.votes++;
        transaction.voters[msg.sender] = true;
        emit TransactionApproved(txId, transaction.destination, transaction.votes);
        executeTransaction(txId);
    }

    function executeTransaction(uint txId) private {
        Transaction storage transaction = transactions[txId];
        if(transaction.votes >= ContractToPermissions[transaction.destination].requiredVotes){
            transaction.executed = true;
            (bool success, ) = transaction.destination.call{value: transaction.value}(transaction.data);
            require(success, "PoolzGovernor: transaction execution reverted.");
            emit TransactionExecuted(txId, transaction.destination, transaction.value, transaction.data);
        }
    }

}
