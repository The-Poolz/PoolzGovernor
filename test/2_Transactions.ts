import { ethers } from "hardhat";
import { expect } from "chai";
import { PoolzGovernor } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Proposal and Approval", function () {
  let poolzGovernor: PoolzGovernor;
  let allSigners: SignerWithAddress[];
  let admin: SignerWithAddress;
  let mockContract: SignerWithAddress;
  let transactionId: number;

  before(async function () {
    const PoolzGovernor = await ethers.getContractFactory("PoolzGovernor");
    poolzGovernor = await PoolzGovernor.deploy();
    await poolzGovernor.deployed();
    allSigners = await ethers.getSigners()
    mockContract = allSigners[allSigners.length - 1] // last signer is the mock contract
    admin = allSigners[0];
    await poolzGovernor.AddNewContract(mockContract.address, 3);
  });

  it("should allow admin to propose a transaction", async function () {
    transactionId = (await poolzGovernor.callStatic.proposeTransaction(
      mockContract.address, // Destination
      "0", // Value
      ethers.constants.HashZero, // Data
      { value: ethers.utils.parseEther("1")}
    )).toNumber();

    const balanceOfPoolzGovernor = await ethers.provider.getBalance(poolzGovernor.address);
    console.log(balanceOfPoolzGovernor.toString());

    await poolzGovernor.proposeTransaction(
      mockContract.address, // Destination
      ethers.utils.parseEther("1"), // Value
      "0x" // Data
    );

    const transaction = await poolzGovernor.getTransactionById(transactionId);

    // Verify the transaction details
    expect(transaction.destination).to.equal(mockContract.address);
    expect(transaction.value).to.equal(ethers.utils.parseEther("1"));
    expect(transaction.data).to.equal("0x");
    expect(transaction.votes).to.equal(1);
    expect(transaction.executed).to.equal(false);
    expect(await poolzGovernor.isTransactionVotedBy(transactionId, admin.address)).to.equal(true);
  });

  it("should allow a user with the contract role to propose a transaction", async function () {
    const user = allSigners[1];

    await poolzGovernor.grantRoleByContract(mockContract.address, user.address);

    const transactionId = (await poolzGovernor.callStatic.proposeTransaction(
      mockContract.address, // Destination
      ethers.utils.parseEther("1"), // Value
      ethers.constants.HashZero // Data
    )).toNumber();

    await poolzGovernor.connect(user).proposeTransaction(
      mockContract.address, // Destination
      ethers.utils.parseEther("1"), // Value
      "0x" // Data
    );

    const transaction = await poolzGovernor.getTransactionById(transactionId);

    expect(transaction.destination).to.equal(mockContract.address);
    expect(transaction.value).to.equal(ethers.utils.parseEther("1"));
    expect(transaction.data).to.equal("0x");
    expect(transaction.votes).to.equal(1);
    expect(transaction.executed).to.equal(false);
    expect(await poolzGovernor.isTransactionVotedBy(transactionId, user.address)).to.equal(true);
  });

  it("should increment the vote count when a transaction is approved", async function () {
    const user = allSigners[1];

    // Approve the transaction from another account
    await poolzGovernor.connect(user).approveTransaction(transactionId);

    // Retrieve the updated transaction details
    const transaction = await poolzGovernor.getTransactionById(transactionId);

    // Verify the updated vote count
    expect(transaction.votes).to.equal(2);
    expect(await poolzGovernor.isTransactionVotedBy(transactionId, user.address)).to.equal(true);
  });

  it("should execute a transaction when it receives enough votes", async function () {
    const user = allSigners[2];
    
    await poolzGovernor.grantRoleByContract(mockContract.address, user.address);

    // Approve the transaction from two accounts
    await poolzGovernor.connect(user).approveTransaction(transactionId);
    

    // Retrieve the updated transaction details
    const transaction = await poolzGovernor.getTransactionById(transactionId);

    // Verify that the transaction is executed
    expect(transaction.executed).to.equal(true);
  });

  it("should revert when trying to approve a transaction that is already executed", async function () {
    const [account1, account2] = await ethers.getSigners();

    // Propose a transaction
    const proposalTx = await poolzGovernor.proposeTransaction(
      account1.address, // Destination
      ethers.utils.parseEther("1"), // Value
      "0x" // Data
    );

    // Retrieve the transaction ID
    const transactionId = proposalTx.value.toNumber();

    // Approve the transaction
    await poolzGovernor.connect(account2).approveTransaction(transactionId);

    // Try to approve the already executed transaction again
    await expect(poolzGovernor.connect(account2).approveTransaction(transactionId)).to.be.reverted;
  }); 

});