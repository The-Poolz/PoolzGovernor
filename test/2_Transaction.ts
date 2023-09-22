import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ethers } from "hardhat"
import { PoolzGovernor, Vault, VaultManager, Vault__factory } from "../typechain-types"
import { expect } from 'chai';
import { getRoleOfSelector, getSelectorFromSignature } from "./utils";
import { BigNumber } from "ethers";

describe("Poolz Governor", () => {
    let admins: SignerWithAddress[]
    let users: SignerWithAddress[]
    let token: string
    let poolzGovernor: PoolzGovernor
    let vaultManager: VaultManager
    let vaultFactory: Vault__factory
    let ADMIN_ROLE: string
    let DEFAULT_ROLE: string // default admin of all roles
    let msgData: string
    let txId: BigNumber
    const createVaultSig = "createNewVault(address)"
    const createVaultSelector = getSelectorFromSignature(createVaultSig)
    const requiredVotes = 3

    before(async () => {
        let allSigners = await ethers.getSigners()
        admins = allSigners.slice(0, 3) // first 3 address are admins
        users = allSigners.slice(3, 10) // next 7 address are users
        token = allSigners[11].address
        poolzGovernor = await (await ethers.getContractFactory("PoolzGovernor")).deploy(admins.map(a => a.address))
        vaultManager = await (await ethers.getContractFactory("VaultManager")).deploy()
        vaultFactory = await ethers.getContractFactory("Vault")
        ADMIN_ROLE = await poolzGovernor.ADMIN_ROLE()
        // DEFAULT_ROLE = await poolzGovernor.DEFAULT_ADMIN_ROLE()
        await vaultManager.transferOwnership(poolzGovernor.address)
        await poolzGovernor.AddNewFunction(vaultManager.address, createVaultSig, requiredVotes)
        const tx = await vaultManager.populateTransaction["createNewVault(address)"](token)
        msgData = tx.data ? tx.data : ""
        for(let admin of admins) {
            await poolzGovernor.connect(admin).grantRoleOfFunction(vaultManager.address, createVaultSig, users[0].address)
        }
    })

    it("admin should be able to propose transaction", async () => {
        const admin = admins[0]
        const value = 0
        txId = await poolzGovernor.connect(admin).callStatic.proposeTransaction(vaultManager.address, msgData, {value})
        const tx = await poolzGovernor.connect(admin).proposeTransaction(vaultManager.address, msgData, {value})
        const txInfo = await poolzGovernor.getTransactionById(txId)
        const voteOfAdmin = await poolzGovernor.getVoteOfTransactionById(txId, admin.address)
        await expect(tx).to.emit(poolzGovernor, "TransactionProposed").withArgs(txId, vaultManager.address, value, msgData)
        expect(txInfo).to.deep.equal([vaultManager.address, value, msgData, 1, false])
        expect(voteOfAdmin).to.be.true
    })

    it("user should be able to vote for transaction", async () => {
        const user = users[0]
        const tx = await poolzGovernor.connect(user).approveTransaction(txId)
        const txInfo = await poolzGovernor.getTransactionById(txId)
        const voteOfUser = await poolzGovernor.getVoteOfTransactionById(txId, user.address)
        await expect(tx).to.emit(poolzGovernor, "TransactionApproved").withArgs(txId, vaultManager.address, 2)
        expect(txInfo).to.deep.equal([vaultManager.address, 0, msgData, 2, false])
        expect(voteOfUser).to.be.true
    })

    it("transaction should be executed after required votes", async () => {
        const admin = admins[1]
        const numberOfVaultsBefore = await vaultManager.totalVaults()
        const tx = await poolzGovernor.connect(admin).approveTransaction(txId)
        const txInfo = await poolzGovernor.getTransactionById(txId)
        const voteOfUser = await poolzGovernor.getVoteOfTransactionById(txId, admin.address)
        await expect(tx).to.emit(poolzGovernor, "TransactionExecuted").withArgs(txId, vaultManager.address, txInfo.value, msgData)
        const vaultAddress = await vaultManager.vaultIdToVault(numberOfVaultsBefore)
        const vault = vaultFactory.attach(vaultAddress)
        expect(txInfo).to.deep.equal([vaultManager.address, 0, msgData, 3, true])
        expect(voteOfUser).to.be.true
        expect(await vaultManager.totalVaults()).to.equal(1)
        expect(await vault.tokenAddress()).to.equal(token)
    })

})