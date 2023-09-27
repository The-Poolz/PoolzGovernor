import { ethers } from "hardhat"
import { PoolzGovernor } from "../typechain-types"
import { Governee } from "../typechain-types/contracts/tests/Governee.sol"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from 'chai';

describe("Pause and UnPause", () => {
    let poolzGovernor: PoolzGovernor
    let governee: Governee
    let admins: SignerWithAddress[]
    let pauser: SignerWithAddress
    let PAUSE_ROLE: string

    before(async () => {
        let allSigners = await ethers.getSigners()
        admins = allSigners.slice(0, 4) // first 4 address are admins
        pauser = allSigners[4]
        poolzGovernor = await (await ethers.getContractFactory("PoolzGovernor")).deploy(admins.map(a => a.address))
        governee = await (await ethers.getContractFactory("Governee")).deploy(poolzGovernor.address)
        PAUSE_ROLE = await poolzGovernor.PAUSE_ROLE()
    })

    it("should allow admin to able to pause", async () => {
        const admin = admins[0]
        const isPausedBefore = await poolzGovernor.paused()
        const tx = await poolzGovernor.connect(admin).pause()
        const isPausedAfter = await poolzGovernor.paused()
        expect(isPausedBefore).to.be.false
        expect(isPausedAfter).to.be.true
        await expect(tx).to.emit(poolzGovernor, "Paused").withArgs(admin.address)
    })

    it("should require votes of all admins to unpause", async () => {
        for( const [index, admin] of admins.entries()){
            const tx = await poolzGovernor.connect(admin).unpause()
            const isPaused = await poolzGovernor.paused()
            if(index < admins.length - 1){
                expect(isPaused).to.be.true
            } else {
                await expect(tx).to.emit(poolzGovernor, "Unpaused").withArgs(admin.address)
                expect(isPaused).to.be.false
            }
        }
    })

    it("should grant pause role to pauser after all admins vote", async () => {
        for( const [index, admin] of admins.entries()){
            const tx = await poolzGovernor.connect(admin).grantPauseRole(pauser.address)
            if(index < admins.length - 1){
                const [voteOfAdmin, hasRole, totalVotes] = await Promise.all([
                    poolzGovernor.getGrantPauseVoteOf(pauser.address, admin.address),
                    poolzGovernor.hasRole(PAUSE_ROLE, pauser.address),
                    poolzGovernor.GrantPauseVotes(pauser.address)
                ])
                expect(voteOfAdmin).to.be.true
                expect(hasRole).to.be.false
                expect(totalVotes).to.equal(index + 1)
            }
        }
        for(const admin of admins){
            expect(await poolzGovernor.getGrantPauseVoteOf(pauser.address, admin.address)).to.be.false
        }
        const [hasRole, totalVotes] = await Promise.all([
            poolzGovernor.hasRole(PAUSE_ROLE, pauser.address),
            poolzGovernor.GrantPauseVotes(pauser.address)
        ])
        expect(hasRole).to.be.true
        expect(totalVotes).to.equal(0)        
    })

    it("should allow pauser to pause", async () => {
        const isPausedBefore = await poolzGovernor.paused()
        const tx = await poolzGovernor.connect(pauser).pause()
        const isPausedAfter = await poolzGovernor.paused()
        expect(isPausedBefore).to.be.false
        expect(isPausedAfter).to.be.true
        await expect(tx).to.emit(poolzGovernor, "Paused").withArgs(pauser.address)
    })

    it("should not allow to propoase transaction when paused", async () => {
        const admin = admins[0]
        const tx = poolzGovernor.connect(admin).proposeTransaction(governee.address, "0x")
        await expect(tx).to.be.revertedWith("Pausable: paused")
    })
})