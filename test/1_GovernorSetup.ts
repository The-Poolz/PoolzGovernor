import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ethers } from "hardhat"
import { PoolzGovernor, Governee } from "../typechain-types"
import { expect, assert } from 'chai';
import { getRoleOfSelector, getSelectorFromSignature } from "./utils";
import { BigNumber } from "ethers";

describe("PoolzGovernor base setup", () => {
    let admins: SignerWithAddress[]
    let users: SignerWithAddress[]
    let poolzGovernor: PoolzGovernor
    let ADMIN_ROLE: string
    let DEFAULT_ADMIN_ROLE: string // default admin of all roles
    let SELF_ROLE: string // role granted to PoolzGovernor contract itself
    const governorRequiredVote = 3

    before(async () => {
        let allSigners = await ethers.getSigners()
        admins = allSigners.slice(0, 4) // first 4 address are admins
        users = allSigners.slice(4, 10) // next 6 address are users
        poolzGovernor = await (await ethers.getContractFactory("PoolzGovernor")).deploy(admins.map(a => a.address), governorRequiredVote)
        ADMIN_ROLE = await poolzGovernor.ADMIN_ROLE()
        DEFAULT_ADMIN_ROLE = await poolzGovernor.DEFAULT_ADMIN_ROLE()
        SELF_ROLE = await poolzGovernor.SELF_ROLE()
    })

    it("should not give DEFAULT_ADMIN_ROLE to anyone", async () => {
        expect(await poolzGovernor.getRoleMemberCount(DEFAULT_ADMIN_ROLE)).to.equal(0)
    })

    it("should not give PAUSE_ROLE to anyone", async () => {
        const numberOfMembers = await poolzGovernor.getRoleMemberCount(await poolzGovernor.PAUSE_ROLE())
        expect(numberOfMembers).to.equal(0)
    })

    it("should give ADMIN_ROLE to all admins", async () => {
        const roleStatus = await Promise.all(admins.map(a => poolzGovernor.hasRole(ADMIN_ROLE, a.address)))
        const numberOfAdmins = await poolzGovernor.getRoleMemberCount(ADMIN_ROLE)
        expect(roleStatus).to.deep.equal(admins.map(a => true))
        expect(numberOfAdmins).to.equal(admins.length)
    })

    it("should give SELF_ROLE to only PoolzGovernor contract", async () => {
        const [hasRole, numberOfMembers] = await Promise.all([
            poolzGovernor.hasRole(SELF_ROLE, poolzGovernor.address),
            poolzGovernor.getRoleMemberCount(SELF_ROLE)
        ])        
        expect(hasRole).to.be.true
        expect(numberOfMembers).to.equal(1)
    })

    it("should have correct required votes for Governor Manager Functions", async () => {
        const allVotes = await Promise.all([
            poolzGovernor.getRequiredVotesOfFunction(poolzGovernor.address, "setRequiredVotesOfFunction(address,string,uint8)"),
            poolzGovernor.getRequiredVotesOfFunction(poolzGovernor.address, "grantAdminRole(address)"),
            poolzGovernor.getRequiredVotesOfFunction(poolzGovernor.address, "revokeAdminRole(address)"),
            poolzGovernor.getRequiredVotesOfFunction(poolzGovernor.address, "grantPauseRole(address)"),
            poolzGovernor.getRequiredVotesOfFunction(poolzGovernor.address, "revokePauseRole(address)"),
            poolzGovernor.getRequiredVotesOfFunction(poolzGovernor.address, "unpause()"),
            poolzGovernor.getRequiredVotesOfFunction(poolzGovernor.address, "grantRoleOfFunction(address,string,address)"),
            poolzGovernor.getRequiredVotesOfFunction(poolzGovernor.address, "revokeRoleOfFunction(address,string,address)"),
        ])
        expect(allVotes).to.deep.equal(allVotes.map(v => governorRequiredVote).fill(1, allVotes.length - 1)) // fill to manually set last value as 1
    })

    describe("Calling SetRequiredVotesOfFunction", () => {
        let governee: Governee
        const governeeRequiredVote = 2
        let txId: BigNumber
        const setValueSig = "setValue(uint256)"

        before(async () => {
            governee = await (await ethers.getContractFactory("Governee")).deploy(poolzGovernor.address)
        })

        it("should propose tx to set required votes of governee function", async () => {
            const proposer = admins[0]
            const proposalTx = await poolzGovernor.populateTransaction.setRequiredVotesOfFunction(governee.address, setValueSig, governeeRequiredVote)
            if(!proposalTx.data) assert.fail("Proposal tx data is empty")
            txId = await poolzGovernor.connect(proposer).callStatic.proposeTransaction(poolzGovernor.address, proposalTx.data)
            const tx = await poolzGovernor.connect(proposer).proposeTransaction(poolzGovernor.address, proposalTx.data)
            const [txInfo, voteOfProposer] = await Promise.all([
                poolzGovernor.getTransactionById(txId),
                poolzGovernor.getVoteOfTransactionById(txId, proposer.address),
                expect(tx).to.emit(poolzGovernor, "TransactionProposed").withArgs(txId, poolzGovernor.address, 0, proposalTx.data)
            ])
            expect(txInfo).to.deep.equal([poolzGovernor.address, 0, proposalTx.data, false, 1])
            expect(voteOfProposer).to.be.true
        })

        it("should allow other admins to vote", async () => {
            const approver = admins[1]
            const txInfoBefore = await poolzGovernor.getTransactionById(txId)
            const tx = await poolzGovernor.connect(approver).approveTransaction(txId)
            const [txInfo, voteOfApprover] = await Promise.all([
                poolzGovernor.getTransactionById(txId),
                poolzGovernor.getVoteOfTransactionById(txId, approver.address),
                expect(tx).to.emit(poolzGovernor, "TransactionApproved").withArgs(txId, poolzGovernor.address, txInfoBefore.totalVotes + 1)
            ])
            expect(txInfo).to.deep.equal([poolzGovernor.address, 0, txInfoBefore.data, false, txInfoBefore.totalVotes + 1])
            expect(voteOfApprover).to.be.true
        })

        it("should execute tx after required votes are reached", async () => {
            const approver = admins[2]
            const setValueSelector = getSelectorFromSignature(setValueSig)
            const txInfoBefore = await poolzGovernor.getTransactionById(txId)
            const tx = await poolzGovernor.connect(approver).approveTransaction(txId)
            const [txInfo, voteOfApprover, requiredVotes, requireVotes1] = await Promise.all([
                poolzGovernor.getTransactionById(txId),
                poolzGovernor.getVoteOfTransactionById(txId, approver.address),
                poolzGovernor.SelectorToRequiredVotes(governee.address, setValueSelector),
                poolzGovernor.getRequiredVotesOfFunction(governee.address, setValueSig),
                expect(tx).to.emit(poolzGovernor, "TransactionApproved").withArgs(txId, poolzGovernor.address, txInfoBefore.totalVotes + 1),
                expect(tx).to.emit(poolzGovernor, "TransactionExecuted").withArgs(txId, poolzGovernor.address, 0, txInfoBefore.data),
                expect(tx).to.emit(poolzGovernor, "RequiredVotesUpdated").withArgs(governee.address, setValueSelector, governeeRequiredVote)
            ])
            expect(txInfo).to.deep.equal([poolzGovernor.address, 0, txInfoBefore.data, true, txInfoBefore.totalVotes + 1])
            expect(voteOfApprover).to.be.true
            expect(requiredVotes).to.equal(governeeRequiredVote)
            expect(requireVotes1).to.equal(governeeRequiredVote)
        })
    })

})