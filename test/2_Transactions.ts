import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ethers } from "hardhat"
import { PoolzGovernor, Governee, contracts } from "../typechain-types"
import { expect, assert } from 'chai';
import { getRoleOfSelector, getSelectorFromSignature, grantRoleToUser, shuffle } from "./utils";
import { BigNumber } from "ethers";

describe("External Transactions", () => {
    let admins: SignerWithAddress[]
    let users: SignerWithAddress[]
    let poolzGovernor: PoolzGovernor
    let governee: Governee
    
    before(async () => {
        let allSigners = await ethers.getSigners()
        admins = allSigners.slice(0, 3) // first 3 address are admins
        users = allSigners.slice(3, 10) // next 7 address are users
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
            await grantRoleToUser(poolzGovernor, governee, admins, user, signature, selector)
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

    describe("Approvals of all admins and users needed", () => {
        const signature = "setUser(address)"
        const selector = getSelectorFromSignature(signature)
        const addressToSet = "0xee226379dB83CfFC681495730c11fDDE79BA4c0C" // random address
        let opearators: SignerWithAddress[] // all admins and users in random order
        let txId: BigNumber

        before(() => {
            opearators = shuffle([...admins, ...users])
        })

        it("should set required votes to admins + users", async () => {
            const requiredVotes = admins.length + users.length
            const tx = await poolzGovernor.connect(admins[0]).AddNewFunction(governee.address, signature, requiredVotes)
            const votes = await poolzGovernor.SelectorToRequiredVotes(governee.address, selector)
            await expect(tx).to.emit(poolzGovernor, "FunctionAdded").withArgs(governee.address, selector, requiredVotes)
            expect(votes).to.equal(requiredVotes)
        })

        it("should give all users access to the function", async () => {
            const grantPromises = users.map(user => grantRoleToUser(poolzGovernor, governee, admins, user, signature, selector))
            await Promise.all(grantPromises)
            const role = getRoleOfSelector(governee.address, selector)
            const rolePromises = users.map(user => poolzGovernor.hasRole(role, user.address))
            const roles = await Promise.all(rolePromises)
            const totalUsers = await poolzGovernor.getRoleMemberCount(role)
            roles.forEach(role => expect(role).to.be.true)
            expect(totalUsers).to.equal(users.length)
        })

        it("the first operator should be able to propose transaction", async () => {
            const operator = opearators[0]
            const tx = await governee.populateTransaction.setUser(addressToSet)
            if(!tx.data) assert(false, "tx.data is null")
            txId = await poolzGovernor.connect(operator).callStatic.proposeTransaction(governee.address, tx.data)
            const transaction = await poolzGovernor.connect(operator).proposeTransaction(governee.address, tx.data)
            const txInfo = await poolzGovernor.getTransactionById(txId)
            const voteOfOperator = await poolzGovernor.getVoteOfTransactionById(txId, operator.address)
            await expect(transaction).to.emit(poolzGovernor, "TransactionProposed").withArgs(txId, governee.address, 0, tx.data)
            expect(txInfo).to.deep.equal([governee.address, 0, tx.data, false, 1])
            expect(voteOfOperator).to.be.true
        })

        it("all operators (except first and last) should be able to vote for transaction", async () => {
            const ops = opearators.slice(1, opearators.length - 1)
            for(const [index, operator] of ops.entries()){
                const tx = await poolzGovernor.connect(operator).approveTransaction(txId)
                const voteOfOperator = await poolzGovernor.getVoteOfTransactionById(txId, operator.address)
                await expect(tx).to.emit(poolzGovernor, "TransactionApproved").withArgs(txId, governee.address, index + 2) // index + 2 because first vote is from proposer
                expect(voteOfOperator).to.be.true
            }
            const txInfo = await poolzGovernor.getTransactionById(txId)
            expect(txInfo).to.deep.equal([governee.address, 0, txInfo.data, false, ops.length + 1])
        })

        it("transaction should be executed after vote of last operator", async () => {
            const operator = opearators[opearators.length - 1]
            const transaction = await poolzGovernor.connect(operator).approveTransaction(txId)
            const txInfo = await poolzGovernor.getTransactionById(txId)
            const voteOfOperator = await poolzGovernor.getVoteOfTransactionById(txId, operator.address)
            const address = await governee.user()
            expect(address).to.equal(addressToSet)
            await expect(transaction).to.emit(poolzGovernor, "TransactionExecuted").withArgs(txId, governee.address, 0, txInfo.data)
            await expect(transaction).to.emit(poolzGovernor, "TransactionApproved").withArgs(txId, governee.address, opearators.length)
            expect(txInfo).to.deep.equal([governee.address, 0, txInfo.data, true, opearators.length])
            expect(voteOfOperator).to.be.true
        })
    })
})