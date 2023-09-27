// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Governee is Ownable {
    uint public balance;
    uint public value;
    address public user;

    constructor(address _governor) {
        _transferOwnership(_governor);
    }

    function deposit() public onlyOwner payable {
        balance += msg.value;
    }

    function setValue(uint _value) external onlyOwner {
        value = _value;
    }

    function setUser(address _user) external onlyOwner {
        user = _user;
    }

    function incrementValue() external onlyOwner {
        value++;
    }

    function decrementValue() external onlyOwner {
        value--;
    }
}