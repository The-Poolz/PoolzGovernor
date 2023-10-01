// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./GovernorState.sol";

contract RoleManager is GovernorState, AccessControlEnumerable, Pausable {

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PAUSE_ROLE = keccak256("PAUSE_ROLE");
    bytes32 public constant SELF_ROLE = keccak256("SELF_ROLE");

    modifier isAdminOrFunctionRole(address _contract, bytes memory txData) {
        bytes4 selector = getSelectorFromData(txData);
        _isAdminOrFunctionRole(_contract, selector);
        _;
    }

    modifier isAdminOrPauseRole() {
        require(hasRole(ADMIN_ROLE, msg.sender) || hasRole(PAUSE_ROLE, msg.sender), "PoolzGovernor: must be admin or have pause role");
        _;
    }

    function _isAdminOrFunctionRole(address _contract, bytes4 _selector) private view {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || 
            hasRole(getRoleOfSelector(_contract, _selector), msg.sender
        ), "PoolzGovernor: must be admin or have contract role");
    }

    function setRequiredVotesOfFunction(address _contract, string calldata _funcSig, uint8 _requiredVotes)
        external
        onlyRole(SELF_ROLE)
    {
        bytes4 selector = getSelectorFromSignature(_funcSig);
        SelectorToRequiredVotes[_contract][selector] =  _requiredVotes;
        emit RequiredVotesUpdated(_contract, selector, _requiredVotes);
    }

    function grantAdminRole(address _admin) external onlyRole(SELF_ROLE) {
        require(!hasRole(ADMIN_ROLE, _admin), "PoolzGovernor: user already admin");
        _grantRole(ADMIN_ROLE, _admin);
    }

    function revokeAdminRole(address _admin) external onlyRole(SELF_ROLE) {
        require(hasRole(ADMIN_ROLE, _admin), "PoolzGovernor: user not admin");
        _revokeRole(ADMIN_ROLE, _admin);
    }

    function renounceRole(bytes32 role, address account) public override(AccessControl, IAccessControl) {
        if(role == ADMIN_ROLE){
            require(getRoleMemberCount(role) > 2, "PoolzGoverner: Need atleast 2 admins");
        }
        super.renounceRole(role, account);
    }

    function grantRoleOfFunction(address _contract, string calldata _funcSig, address _user)
        external
        onlyRole(SELF_ROLE)
    {
        bytes4 selector = getSelectorFromSignature(_funcSig);
        bytes32 role = getRoleOfSelector(_contract, selector);
        require(!hasRole(role, _user), "PoolzGovernor: user already has role");
        _grantRole(role, _user);
        emit FunctionGranted(_contract, selector, _user);
    }

    function revokeRoleOfFunction(address _contract, string calldata _funcSig, address _user)
        external
        onlyRole(SELF_ROLE)
    {
        bytes4 selector = getSelectorFromSignature(_funcSig);
        bytes32 role = getRoleOfSelector(_contract, selector);
        require(hasRole(role, _user), "PoolzGovernor: user has no role");
        revokeRole(role, _user);
        emit FunctionRevoked(_contract, selector, _user);
    }

    function grantPauseRole(address _pauser) external onlyRole(SELF_ROLE) {
        require(!hasRole(PAUSE_ROLE, _pauser), "PoolzGovernor: user already has role");
        _grantRole(PAUSE_ROLE, _pauser);
    }

    function revokePauseRole(address _pauser) external onlyRole(SELF_ROLE) {
        require(hasRole(PAUSE_ROLE, _pauser), "PoolzGovernor: user has no role");
        revokeRole(PAUSE_ROLE, _pauser);
    }

    function pause() external isAdminOrPauseRole {
        _pause();
    }

    function unpause() external onlyRole(SELF_ROLE) {
        _unpause();
    }

    function transferRoles(address _to, bytes32[] memory _roles) external {
        uint256 roleslength = _roles.length;
        for(uint i = 0; i < roleslength ; i++){
            require(hasRole(_roles[i], msg.sender), "PoolzGovernor: you have no role");
            _revokeRole(_roles[i], msg.sender);
            _grantRole(_roles[i], _to);
        }
    }
}