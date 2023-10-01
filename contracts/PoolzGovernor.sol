// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./RoleManager.sol";

contract PoolzGovernor is RoleManager {

    constructor(address[] memory _admins, uint8 requiredVotes) {
        require(_admins.length >= 2, "PoolzGovernor: Need more than 1 admin");
        for(uint i = 0; i < _admins.length; i++){
            _setupRole(ADMIN_ROLE, _admins[i]);
        }
        _setupRole(SELF_ROLE, address(this));
        setRequiedVotes(requiredVotes);
    }

    function setRequiedVotes(uint8 requiredVotes) private {
        SelectorToRequiredVotes[address(this)][this.setRequiredVotesOfFunction.selector] = requiredVotes;
        SelectorToRequiredVotes[address(this)][this.grantAdminRole.selector] = requiredVotes;
        SelectorToRequiredVotes[address(this)][this.revokeAdminRole.selector] = requiredVotes;
        SelectorToRequiredVotes[address(this)][this.grantPauseRole.selector] = requiredVotes;
        SelectorToRequiredVotes[address(this)][this.revokePauseRole.selector] = requiredVotes;
        SelectorToRequiredVotes[address(this)][this.unpause.selector] = requiredVotes;
        SelectorToRequiredVotes[address(this)][this.grantRoleOfFunction.selector] = requiredVotes;
        SelectorToRequiredVotes[address(this)][this.revokeRoleOfFunction.selector] = 1;
    }

    modifier transactionExists(uint txId) {
        require(txId < transactionCount, "PoolzGovernor: transaction does not exist");
        _;
    }

    function proposeTransaction(address _destination, bytes memory _data)
        public
        whenNotPaused
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
        whenNotPaused
        transactionExists(txId)
        isAdminOrFunctionRole(transactions[txId].destination, transactions[txId].data)
    {
        Transaction storage transaction = transactions[txId];
        require(!transaction.executed, "PoolzGovernor: transaction already executed");
        // do nothing if tx already approved by msg.sender
        if(!transaction.votes.voteOf[msg.sender]){
            transaction.votes.total++;
            transaction.votes.voteOf[msg.sender] = true;
            emit TransactionApproved(txId, transaction.destination, transaction.votes.total);
        }
        executeIfApproved(txId);
    }

    function executeIfApproved(uint txId) private {
        Transaction storage transaction = transactions[txId];
        bytes4 selector = getSelectorFromData(transaction.data);
        uint8 requiredVotes = SelectorToRequiredVotes[transaction.destination][selector];
        if(requiredVotes == 0) return;  // 0 means function is not allowed
        if(transaction.votes.total >= requiredVotes){
            transaction.executed = true;
            (bool success, ) = transaction.destination.call{value: transaction.value}(transaction.data);
            require(success, "PoolzGovernor: transaction execution reverted.");
            emit TransactionExecuted(txId, transaction.destination, transaction.value, transaction.data);
        }
    }

}
