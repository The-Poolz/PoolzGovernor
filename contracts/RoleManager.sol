// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./GovernorState.sol";

contract RoleManager is GovernorState, AccessControl {
    modifier roleExistsFor(address _contract) {
        require(ContractToPermissions[_contract].role != bytes32(0), "PoolzGovernor: role does not exist for contract");
        _;
    }

    modifier isAdminOrContractRole(address _contract) {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) || 
            hasRole(ContractToPermissions[_contract].role, msg.sender
        ), "PoolzGovernor: must be admin or have contract role");
        _;
    }

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function AddNewContract(address _contract, uint8 _requiredVotes)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_requiredVotes > 0, "PoolzGovernor: requiredVotes must be greater than 0");
        bytes32 role = keccak256(abi.encodePacked(_contract));
        ContractToPermissions[_contract] = ContractPermission(role, _requiredVotes);
        AllContracts.push(_contract);
        emit ContractAdded(_contract, _requiredVotes);
    }

    function RemoveContract(address _contract)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        roleExistsFor(_contract)
    {
        delete ContractToPermissions[_contract];
        for(uint i = 0; i < AllContracts.length; i++){
            if(AllContracts[i] == _contract){
                AllContracts[i] = AllContracts[AllContracts.length - 1];
                AllContracts.pop();
                break;
            }
        }
        emit ContractRemoved(_contract);
    }

    function grantRoleByContract(address _contract, address _user)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        roleExistsFor(_contract)
    {
        bytes32 role = ContractToPermissions[_contract].role;
        require(hasRole(role, _user) == false, "PoolzGovernor: user already has role");
        grantRole(role, _user);
        emit RoleGranted(_contract, _user);
    }

    function revokeRoleByContract(address _contract, address _user)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        roleExistsFor(_contract)
    {
        bytes32 role = ContractToPermissions[_contract].role;
        require(hasRole(role, _user), "PoolzGovernor: user already has role");
        revokeRole(role, _user);
        emit RoleRevoked(_contract, _user);
    }
}