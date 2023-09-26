// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./GovernorState.sol";

contract RoleManager is GovernorState, AccessControlEnumerable, Pausable {

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    modifier isAdminOrFunctionRole(address _contract, bytes memory txData) {
        bytes4 selector = getSelectorFromData(txData);
        _isAdminOrFunctionRole(_contract, selector);
        _;
    }


    function _isAdminOrFunctionRole(address _contract, bytes4 _selector) private view {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || 
            hasRole(getRoleOfSelector(_contract, _selector), msg.sender
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
        SelectorToRequiredVotes[_contract][selector] =  _requiredVotes;
        emit FunctionAdded(_contract, selector, _requiredVotes);
    }

    function RemoveFunction(address _contract, string calldata _funcSig)
        external
        onlyRole(ADMIN_ROLE)
    {
        bytes4 selector = getSelectorFromSignature(_funcSig);
        SelectorToRequiredVotes[_contract][selector] = 0;
        emit FunctionRemoved(_contract, selector);
    }

    function grantAdmin(address _admin) external onlyRole(ADMIN_ROLE) {
        Votes storage votes = GrantAdminVotes[_admin];
        require(!hasRole(ADMIN_ROLE, _admin), "PoolzGovernor: user already admin");
        require(!votes.voteOf[msg.sender], "PoolzGovernor: you already voted");
        ++votes.total;
        votes.voteOf[msg.sender] = true;
        if(votes.total >= getRoleMemberCount(ADMIN_ROLE)){
            _setupRole(ADMIN_ROLE, _admin);
            resetVotes(votes);
        }
    }

    function revokeAdmin(address _admin) external onlyRole(ADMIN_ROLE) {
        Votes storage votes = RevokeAdminVotes[_admin];
        require(hasRole(ADMIN_ROLE, _admin), "PoolzGovernor: user not admin");
        require(!votes.voteOf[msg.sender], "PoolzGovernor: you already voted");
        ++votes.total;
        votes.voteOf[msg.sender] = true;
        if(votes.total >= getRoleMemberCount(ADMIN_ROLE) - 1){
            _revokeRole(ADMIN_ROLE, _admin);
            resetVotes(votes);
        }
    }

    function resetVotes(Votes storage _votes) private {
        _votes.total = 0;
        uint256 totalAdmins = getRoleMemberCount(ADMIN_ROLE);
        for(uint i = 0; i < totalAdmins; i++){
            _votes.voteOf[getRoleMember(ADMIN_ROLE, i)] = false;
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
    {
        bytes4 selector = getSelectorFromSignature(_funcSig);
        bytes32 role = getRoleOfSelector(_contract, selector);
        require(!hasRole(role, _user), "PoolzGovernor: user already has role");
        Votes storage votes = UsersToVotes[_user][_contract][selector];
        require(!votes.voteOf[msg.sender], "PoolzGovernor: you already voted");
        ++votes.total;
        votes.voteOf[msg.sender] = true;
        if(votes.total >= getRoleMemberCount(ADMIN_ROLE)){
            _grantRole(role, _user);
            resetVotes(votes);
            emit FunctionGranted(_contract, selector, _user);
        }
    }

    function revokeRoleOfFunction(address _contract, string calldata _funcSig, address _user)
        external
        onlyRole(ADMIN_ROLE)
    {
        bytes4 selector = getSelectorFromSignature(_funcSig);
        bytes32 role = getRoleOfSelector(_contract, selector);
        require(hasRole(role, _user), "PoolzGovernor: user has no role");
        revokeRole(role, _user);
        emit FunctionRevoked(_contract, selector, _user);
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unPause() external onlyRole(ADMIN_ROLE) {
        Votes storage votes = UnPauseVotes;
        require(!votes.voteOf[msg.sender], "PoolzGovernor: you already voted");
        ++votes.total;
        votes.voteOf[msg.sender] = true;
        if(votes.total >= getRoleMemberCount(ADMIN_ROLE)){
            _unpause();
            resetVotes(votes);
        }
    }

    function transferRoles(address _to, bytes32[] memory _roles) external {
        uint256 roleslength = _roles.length;
        for(uint i = 0; i < roleslength ; i++){
            require(hasRole(_roles[i], msg.sender), "PoolzGovernor: you have no role");
            _revokeRole(_roles[i], msg.sender);
            _setupRole(_roles[i], _to);
        }
    }
}