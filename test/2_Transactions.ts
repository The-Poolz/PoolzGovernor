import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ethers } from "hardhat"
import { PoolzGovernor, Governee, contracts } from "../typechain-types"
import { expect, assert } from 'chai';
import { getRoleOfSelector, getSelectorFromSignature } from "./utils";
import { BigNumber } from "ethers";

describe("External Transactions", () => {
    let admins: SignerWithAddress[]
    let users: SignerWithAddress[]
    let poolzGovernor: PoolzGovernor
    let governee: Governee
    
    before(async () => {
        let allSigners = await ethers.getSigners()
        admins = allSigners.slice(0, 4) // first 4 address are admins
        users = allSigners.slice(4, 10) // next 6 address are users
        poolzGovernor = await (await ethers.getContractFactory("PoolzGovernor")).deploy(admins.map(a => a.address))
        governee = await (await ethers.getContractFactory("Governee")).deploy(poolzGovernor.address)
    })

    describe("Approval of 1 admin needed", () => {
        it("admin should be able to execute transaction", async () => {
            const admin = admins[0]
            const tx = await governee.populateTransaction.incrementValue()
            const oldValue = await governee.value()
            if(!tx.data) assert(false, "tx.data is null")
            const txId = await poolzGovernor.callStatic.proposeTransaction(governee.address, tx.data)
            const transaction = await poolzGovernor.connect(admin).proposeTransaction(governee.address, tx.data)
            const newValue = await governee.value()
            const txInfo = await poolzGovernor.getTransactionById(txId)
            const voteOfAdmin = await poolzGovernor.getVoteOfTransactionById(txId, admin.address)
            expect(newValue).to.equal(oldValue.add(1))
            await expect(transaction).to.emit(poolzGovernor, "TransactionProposed").withArgs(txId, governee.address, 0, tx.data)
            await expect(transaction).to.emit(poolzGovernor, "TransactionExecuted").withArgs(txId, governee.address, 0, tx.data)
            expect(txInfo).to.deep.equal([governee.address, 0, tx.data, true, 1])
            expect(voteOfAdmin).to.be.true
        })
    })

    describe("Approval of 2 admins needed", () => {
        const signature = "setValue(uint256)"
        const requiredVotes = 2
        const valueToSet = 100
        let txId: BigNumber
        
        it("should set required votes to 2", async () => {
            const tx = await poolzGovernor.AddNewFunction(governee.address, signature, requiredVotes)
            const votes = await poolzGovernor.SelectorToRequiredVotes(governee.address, getSelectorFromSignature(signature))
            await expect(tx).to.emit(poolzGovernor, "FunctionAdded").withArgs(governee.address, getSelectorFromSignature(signature), 2)
            expect(votes).to.equal(requiredVotes)
        })
        
        it("admin should be able to propose transaction", async () => {
            const admin = admins[0]
            const tx = await governee.populateTransaction.setValue(valueToSet)
            if(!tx.data) assert(false, "tx.data is null")
            txId = await poolzGovernor.callStatic.proposeTransaction(governee.address, tx.data)
            const transaction = await poolzGovernor.connect(admin).proposeTransaction(governee.address, tx.data)
            const txInfo = await poolzGovernor.getTransactionById(txId)
            const voteOfAdmin = await poolzGovernor.getVoteOfTransactionById(txId, admin.address)
            await expect(transaction).to.emit(poolzGovernor, "TransactionProposed").withArgs(txId, governee.address, 0, tx.data)
            expect(txInfo).to.deep.equal([governee.address, 0, tx.data, false, 1])
            expect(voteOfAdmin).to.be.true
        })

        it("user without role should not be able to vote", async () => {
            const user = users[0]
            const tx = poolzGovernor.connect(user).approveTransaction(txId)
            await expect(tx).to.be.revertedWith("PoolzGovernor: must be admin or have contract role")
        })

        it("another admin vote should execute the transaction", async () => {
            const admin = admins[1]
            const transaction = await poolzGovernor.connect(admin).approveTransaction(txId)
            const txInfo = await poolzGovernor.getTransactionById(txId)
            const voteOfAdmin = await poolzGovernor.getVoteOfTransactionById(txId, admin.address)
            await expect(transaction).to.emit(poolzGovernor, "TransactionApproved").withArgs(txId, governee.address, 2)
            expect(txInfo).to.deep.equal([governee.address, 0, txInfo.data, true, 2])
            expect(voteOfAdmin).to.be.true
        })
    })

    describe("Approval of 1 user needed", () => {
        const signature = "decrementValue()"
        const selector = getSelectorFromSignature(signature)
        let oldValue: BigNumber
        let user: SignerWithAddress

        before(async () => {
            user = users[0]
            oldValue = await governee.value()
        })

        it("should give user role of the function", async () => {
            for( const [index, admin] of admins.entries()){
                const tx = await poolzGovernor.connect(admin).grantRoleOfFunction(governee.address, signature, user.address)
                const votes = await poolzGovernor.UsersToVotes(user.address, governee.address, selector)
                const voteOfAdmin = await poolzGovernor.getUserVoteOf(user.address, governee.address, selector, admin.address)
                if(index < admins.length - 1){
                    expect(votes).to.equal(index + 1)
                    expect(voteOfAdmin).to.equal(true)
                } else {
                    const role = getRoleOfSelector(governee.address, selector)
                    await expect(tx).to.emit(poolzGovernor, "FunctionGranted").withArgs(governee.address, selector, user.address)
                    await expect(tx).to.emit(poolzGovernor, "RoleGranted").withArgs(role, user.address, admin.address)
                }
            }
            for (const admin of admins) {
                expect(await poolzGovernor.getUserVoteOf(user.address, governee.address, selector, admin.address)).to.be.false
            }
            const votes = await poolzGovernor.UsersToVotes(user.address, governee.address, selector)
            expect(votes).to.equal(0)
            const role = getRoleOfSelector(governee.address, selector)
            expect(await poolzGovernor.hasRole(role, user.address)).to.be.true
        })

        it("user should be able to execute transaction", async () => {
            const tx = await governee.populateTransaction.decrementValue()
            if(!tx.data) assert(false, "tx.data is null")
            const txId = await poolzGovernor.connect(user).callStatic.proposeTransaction(governee.address, tx.data)
            const transaction = await poolzGovernor.connect(user).proposeTransaction(governee.address, tx.data)
            const newValue = await governee.value()
            const txInfo = await poolzGovernor.getTransactionById(txId)
            const voteOfUser = await poolzGovernor.getVoteOfTransactionById(txId, user.address)
            expect(newValue).to.equal(oldValue.sub(1))
            await expect(transaction).to.emit(poolzGovernor, "TransactionProposed").withArgs(txId, governee.address, 0, tx.data)
            await expect(transaction).to.emit(poolzGovernor, "TransactionExecuted").withArgs(txId, governee.address, 0, tx.data)
            expect(txInfo).to.deep.equal([governee.address, 0, tx.data, true, 1])
            expect(voteOfUser).to.be.true
        })
    })
})