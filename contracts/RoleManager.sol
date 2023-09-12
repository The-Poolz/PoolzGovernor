// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "./GovernorState.sol";

contract RoleManager is GovernorState, AccessControlEnumerable {

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

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
            hasRole(ADMIN_ROLE, msg.sender) || 
            hasRole(ContractSelectorToPermission[_contract][_selector].role, msg.sender
        ), "PoolzGovernor: must be admin or have contract role");
    }

    function AddNewFunction(address _contract, string calldata _funcSig, uint8 _requiredVotes)
        public
        onlyRole(ADMIN_ROLE)
    {
        require(_requiredVotes > 0, "PoolzGovernor: requiredVotes must be greater than 0");
        bytes4 selector = getSelectorFromSignature(_funcSig);
        bytes32 role = keccak256(abi.encodePacked(_contract, selector));
        _setRoleAdmin(role, ADMIN_ROLE);
        ContractSelectorToPermission[_contract][selector] = Permission(role, _requiredVotes);
        AllContracts.push(_contract);
        emit ContractAdded(_contract, _requiredVotes);
    }

    function RemoveFunction(address _contract, string calldata _funcSig)
        external
        onlyRole(ADMIN_ROLE)
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

    function grantAdmin(address _admin) external onlyRole(ADMIN_ROLE) {
        PermissionStatus storage permissionStatus = GrantAdminVotes[_admin];
        require(hasRole(ADMIN_ROLE, _admin) == false, "PoolzGovernor: user already admin");
        require(permissionStatus.voters[msg.sender] == false, "PoolzGovernor: you already voted");
        ++permissionStatus.votes;
        permissionStatus.voters[msg.sender] = true;
        if(permissionStatus.votes >= getRoleMemberCount(ADMIN_ROLE)){
            _setupRole(ADMIN_ROLE, _admin);
            resetVotes(permissionStatus);
        }
    }

    function revokeAdmin(address _admin) external onlyRole(ADMIN_ROLE) {
        PermissionStatus storage permissionStatus = RevokeAdminVotes[_admin];
        require(hasRole(ADMIN_ROLE, _admin) == true, "PoolzGovernor: user not admin");
        require(permissionStatus.voters[msg.sender] == false, "PoolzGovernor: you already voted");
        ++permissionStatus.votes;
        permissionStatus.voters[msg.sender] = true;
        if(permissionStatus.votes >= getRoleMemberCount(ADMIN_ROLE) - 1){
            revokeRole(ADMIN_ROLE, _admin);
            resetVotes(permissionStatus);
        }
    }

    function resetVotes(PermissionStatus storage _votes) private {
        _votes.votes = 0;
        _votes.isGranted = false;
        uint256 totalAdmins = getRoleMemberCount(ADMIN_ROLE);
        for(uint i = 0; i < totalAdmins; i++){
            _votes.voters[getRoleMember(ADMIN_ROLE, i)] = false;
        }
    }

    function renounceRole(bytes32 role, address account) public override(AccessControl, IAccessControl) {
        if(role == ADMIN_ROLE){
            require(getRoleMemberCount(role) > 2, "PoolzGoverner: Need atleat 2 admins");
        }
        super.renounceRole(role, account);
    }

    function grantRoleOfFunction(address _contract, string calldata _funcSig, address _user)
        external
        onlyRole(ADMIN_ROLE)
        roleExistsFor(_contract, getSelectorFromSignature(_funcSig))
    {
        bytes4 selector = getSelectorFromSignature(_funcSig);
        bytes32 role = ContractSelectorToPermission[_contract][selector].role;
        require(hasRole(role, _user) == false, "PoolzGovernor: user already has role");
        PermissionStatus storage PermissionStatus = UsersToPermission[_user][_contract][selector];
        require(PermissionStatus.voters[msg.sender] == false, "PoolzGovernor: you already voted");
        ++PermissionStatus.votes;
        PermissionStatus.voters[msg.sender] = true;
        if(PermissionStatus.votes >= getRoleMemberCount(ADMIN_ROLE)){
            PermissionStatus.isGranted = true;
            _grantRole(role, _user);
            emit RoleGranted(_contract, _user);
        }
    }

    function revokeRoleOfFunction(address _contract, string calldata _funcSig, address _user)
        external
        onlyRole(ADMIN_ROLE)
        roleExistsFor(_contract, getSelectorFromSignature(_funcSig))
    {
        bytes4 selector = getSelectorFromSignature(_funcSig);
        bytes32 role = ContractSelectorToPermission[_contract][selector].role;
        require(hasRole(role, _user), "PoolzGovernor: user has no role");
        PermissionStatus storage permissionStatus = UsersToPermission[_user][_contract][selector];
        revokeRole(role, _user);
        resetVotes(permissionStatus);
        emit RoleRevoked(_contract, _user);
    }

    function transferRoles(address _to, bytes32[] memory _roles) external {
        uint256 roleslength = _roles.length;
        for(uint i = 0; i < roleslength ; i++){
            require(hasRole(_roles[i], msg.sender), "PoolzGovernor: you have no role");
            revokeRole(_roles[i], msg.sender);
            _setupRole(_roles[i], _to);
        }
    }
}