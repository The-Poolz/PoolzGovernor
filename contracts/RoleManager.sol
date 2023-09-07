// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./GovernorState.sol";

contract RoleManager is GovernorState, AccessControl {
    modifier roleExistsFor(address _contract, bytes4 _selector) {
        _roleExistsFor(_contract, _selector);
        _;
    }

    modifier isAdminOrFunctionRole(address _contract, bytes memory txData) {
        bytes4 selector = getSelectorFromData(txData);
        _roleExistsFor(_contract, selector);
        _isAdminOrFunctionRole(_contract, selector);
        _;
    }

    function _roleExistsFor(address _contract, bytes4 _selector) private view {
        require(ContractSelectorToPermission[_contract][_selector].role != bytes32(0), "PoolzGovernor: role does not exist for Function");
    }

    function _isAdminOrFunctionRole(address _contract, bytes4 _selector) private view {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) || 
            hasRole(ContractSelectorToPermission[_contract][_selector].role, msg.sender
        ), "PoolzGovernor: must be admin or have contract role");
    }

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function AddNewFunction(address _contract, string calldata _funcSig, uint8 _requiredVotes) external {
        AddNewFunction(_contract, _funcSig, _requiredVotes, 0); // default level is 0. Level can be increased for sensitive functions
    }

    function AddNewFunction(address _contract, string calldata _funcSig, uint8 _requiredVotes, uint8 _accessLevel)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_requiredVotes > 0, "PoolzGovernor: requiredVotes must be greater than 0");
        bytes4 selector = getSelectorFromSignature(_funcSig);
        bytes32 role = keccak256(abi.encodePacked(_contract, _accessLevel));
        ContractSelectorToPermission[_contract][selector] = ContractPermission(role, _requiredVotes, _accessLevel);
        AllContracts.push(_contract);
        emit ContractAdded(_contract, _requiredVotes);
    }

    function RemoveFunction(address _contract, string calldata _funcSig)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        roleExistsFor(_contract, getSelectorFromSignature(_funcSig))
    {
        bytes4 selector = getSelectorFromSignature(_funcSig);
        delete ContractSelectorToPermission[_contract][selector];
        for(uint i = 0; i < AllContracts.length; i++){
            if(AllContracts[i] == _contract){
                AllContracts[i] = AllContracts[AllContracts.length - 1];
                AllContracts.pop();
                break;
            }
        }
        emit ContractRemoved(_contract);
    }

    function grantRoleByContract(address _contract, string calldata _funcSig, address _user)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        roleExistsFor(_contract, getSelectorFromSignature(_funcSig))
    {
        bytes4 selector = getSelectorFromSignature(_funcSig);
        bytes32 role = ContractSelectorToPermission[_contract][selector].role;
        require(hasRole(role, _user) == false, "PoolzGovernor: user already has role");
        grantRole(role, _user);
        emit RoleGranted(_contract, _user);
    }

    function revokeRoleByContract(address _contract, string calldata _funcSig, address _user)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        roleExistsFor(_contract, getSelectorFromSignature(_funcSig))
    {
        bytes4 selector = getSelectorFromSignature(_funcSig);
        bytes32 role = ContractSelectorToPermission[_contract][selector].role;
        require(hasRole(role, _user), "PoolzGovernor: user already has role");
        revokeRole(role, _user);
        emit RoleRevoked(_contract, _user);
    }
}