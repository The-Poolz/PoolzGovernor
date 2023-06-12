import { ethers } from "hardhat";
import { expect } from "chai";
import { PoolzGovernor } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";


describe("Admin Tests", function () {
  let poolzGovernor: PoolzGovernor;
  let allSigners: SignerWithAddress[];
  let mockContract: SignerWithAddress;

  beforeEach(async function () {
    const PoolzGovernor = await ethers.getContractFactory("PoolzGovernor");
    poolzGovernor = await PoolzGovernor.deploy();
    await poolzGovernor.deployed();
    allSigners = await ethers.getSigners()
    mockContract = allSigners[allSigners.length - 1] // last signer is the mock contract
  });

  it("should allow the admin to add a new contract with the required votes", async function () {
    const tx = await poolzGovernor.AddNewContract(mockContract.address, 3);

    const contractPermission = await poolzGovernor.ContractToPermissions(mockContract.address);

    expect(contractPermission.role).to.equal(ethers.utils.keccak256(mockContract.address));
    expect(contractPermission.requiredVotes).to.equal(3);
  });

  it("should emit an event when a new contract is added", async function () {
    await expect(poolzGovernor.AddNewContract(mockContract.address, 3))
      .to.emit(poolzGovernor, "ContractAdded")
      .withArgs(mockContract.address, 3);
  });

  it("should allow the admin to remove an existing contract", async function () {
    await poolzGovernor.AddNewContract(mockContract.address, 3);

    await poolzGovernor.RemoveContract(mockContract.address);

    const contractPermission = await poolzGovernor.ContractToPermissions(mockContract.address);

    expect(contractPermission.role).to.equal(ethers.constants.HashZero);
  });

  it("should emit an event when a contract is removed", async function () {
    await poolzGovernor.AddNewContract(mockContract.address, 3);

    await expect(poolzGovernor.RemoveContract(mockContract.address))
      .to.emit(poolzGovernor, "ContractRemoved")
      .withArgs(mockContract.address);
  });

  it("should allow the admin to grant a role to a user for a specific contract", async function () {
    const user = allSigners[1];

    await poolzGovernor.AddNewContract(mockContract.address, 3);

    await poolzGovernor.grantRoleByContract(mockContract.address, user.address);
    
    const contractPermissions = await poolzGovernor.ContractToPermissions(mockContract.address);
    
    expect(await poolzGovernor.hasRole(contractPermissions.role, user.address)).to.equal(true);
  });

  it("should emit an event when a role is granted", async function () {
    const user = allSigners[1];

    await poolzGovernor.AddNewContract(mockContract.address, 3);

    await expect(poolzGovernor.grantRoleByContract(mockContract.address, user.address))
      .to.emit(poolzGovernor, "ContractRoleGranted")
      .withArgs(mockContract.address, user.address);
  });

  it("should allow the admin to revoke a role from a user for a specific contract", async function () {
    const user = allSigners[1];

    await poolzGovernor.AddNewContract(mockContract.address, 3);

    await poolzGovernor.grantRoleByContract(mockContract.address, user.address);

    await poolzGovernor.revokeRoleByContract(mockContract.address, user.address);

    const contractPermissions = await poolzGovernor.ContractToPermissions(mockContract.address);

    expect(await poolzGovernor.hasRole(contractPermissions.role, user.address)).to.equal(false);
  });

  it("should emit an event when a role is revoked", async function () {
    const user = allSigners[1];

    await poolzGovernor.AddNewContract(mockContract.address, 3);

    await poolzGovernor.grantRoleByContract(mockContract.address, user.address);

    await expect(poolzGovernor.revokeRoleByContract(mockContract.address, user.address))
      .to.emit(poolzGovernor, "ContractRoleRevoked")
      .withArgs(mockContract.address, user.address);
  });

});