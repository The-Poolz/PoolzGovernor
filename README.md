# PoolzGovernor

## Overview

PoolzGovernor is a smart contract designed to govern all contracts, both past and future. By transferring the ownership of any Poolz contract to PoolzGovernor, you can distribute control and streamline administrative tasks, thereby enhancing the security and operability of the entire ecosystem.

## Features

- **Ownership Management**: Provides a unified interface to manage ownership of all Poolz contracts.
- **Upgradability**: Compatible with both existing and future Poolz contracts.
- **Enhanced Security**: Centralized control mitigates risks associated with fragmented governance.
- **Multiple Admins**: Supports the addition of multiple administrators, allowing for a more robust and flexible governance model.
- **Fine-Grained Permissions**: Administrators can delegate the role of specific functions in each contract to designated users, enabling more nuanced control over contract behavior.
  
## Prerequisites

- [Node.js](https://nodejs.org/)
- [Hardhat](https://hardhat.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [Solidity](https://soliditylang.org/)

## Getting Started

1. **Clone the Repository**

    ```bash
    git clone https://github.com/The-Poolz/PoolzGovernor.git
    ```

2. **Install Dependencies**

    ```bash
    cd PoolzGovernor
    npm install
    ```

3. **Compile Contracts**

    ```bash
    npx hardhat compile
    ```

4. **Run Tests**

    ```bash
    npx hardhat test
    ```

5. **Deploy Contracts**

    Update the `hardhat.config.js` file with appropriate network details.

    ```bash
    npx hardhat run scripts/deploy.js --network <network_name>
    ```

## Usage

To use PoolzGovernor, transfer the ownership of your contract to the address of the deployed PoolzGovernor contract.

### 1. Deploy and Admin Setup

To deploy PoolzGovernor, pass an array of admin addresses during deployment. These admins have the authority to add new contracts, functions, and delegate roles to specific users.

After deployment, admins can be added or removed by calling `grantAdmin()` and `revokeAdmin()` respectively. Granting an admin requires unanimous approval from all existing admins, while revoking requires approval from `allAdmins - 1`.

### 2. Setting up Required Approvals for Functions

If a contract function requires more than one approval, an admin can set this up by calling the `AddNewFunction()` function. Provide the contract address, function signature (e.g., "createNewVault(address,address,uint96)"), and `uint8 requiredApprovals`.

To remove a function and set its required approvals to zero, call the `RemoveFunction` function.

### 3. Delegating Users

To delegate a user for a specific function, call `grantRoleOfFunction()`. This function accepts the contract address, function signature, and user address as arguments. Delegation requires the approval of all admins.

To revoke access, call `revokeRoleOfFunction()` with the same arguments. Revoking access only requires one admin and doesn't need unanimous approval.

### 4. Sending Transactions

To initiate a transaction, `proposeTransaction()` must be called either by an admin or a user with function access. This function takes two arguments: `address destination` and `bytes data`, where the destination is the contract address the transaction will be sent to, and data contains the function selector and arguments.

If a function requires fewer than two approvals, the transaction will be executed immediately. Otherwise, `proposeTransaction()` will return a `transactionId` of type `uint`. Using this `transactionId`, admins and approved users can call `approveTransaction()`. The transaction is executed as soon as it receives the required approvals.