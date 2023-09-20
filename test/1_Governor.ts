import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ethers } from "hardhat"
import { PoolzGovernor, VaultManager } from "../typechain-types"
import { expect } from 'chai';
import { getRoleOfSelector, getSelectorFromSignature } from "./utils";

describe("Poolz Governor", () => {
    let admins: SignerWithAddress[]
    let users: SignerWithAddress[]
    let poolzGovernor: PoolzGovernor
    let vaultManager: VaultManager
    let ADMIN_ROLE: string
    let DEFAULT_ROLE: string // default admin of all roles
    const createVaultSig = "createNewVault(address)"
    const createVaultSelector = getSelectorFromSignature(createVaultSig)
    const requiredVotes = 2

    before(async () => {
        let allSigners = await ethers.getSigners()
        admins = allSigners.slice(0, 4) // first 3 address are admins
        users = allSigners.slice(4, 10) // next 7 address are users
        poolzGovernor = await (await ethers.getContractFactory("PoolzGovernor")).deploy(admins.map(a => a.address))
        vaultManager = await (await ethers.getContractFactory("VaultManager")).deploy()
        ADMIN_ROLE = await poolzGovernor.ADMIN_ROLE()
        DEFAULT_ROLE = await poolzGovernor.DEFAULT_ADMIN_ROLE()
        await vaultManager.transferOwnership(poolzGovernor.address)
    })

    it("make sure poolzGovernor is the owner of vaultManager", async () => {
        expect(await vaultManager.owner()).to.equal(poolzGovernor.address)
    })

    it("should calculate the correct selector from function signature", async () => {
        const selector = await poolzGovernor.getSelectorFromSignature(createVaultSig)
        expect(createVaultSelector).to.equal(selector)
    })

    
    it("should calculate the correct role from contract address and selector", async () => {
        const role = await poolzGovernor.getRoleOfSelector(vaultManager.address, createVaultSelector)
        const roleTs = getRoleOfSelector(vaultManager.address, createVaultSelector)
        expect(role).to.equal(roleTs)
    })
    
    it("all admins should have ADMIN_ROLE", async () => {
        for (let admin of admins) {
            expect(await poolzGovernor.hasRole(ADMIN_ROLE, admin.address)).to.be.true
        }
    })
    
    it("should add new function", async () => {
        const tx = await poolzGovernor.AddNewFunction(vaultManager.address, createVaultSig, requiredVotes)
        const role = getRoleOfSelector(vaultManager.address, createVaultSelector)
        const votes = await poolzGovernor.SelectorToRequiredVotes(vaultManager.address, createVaultSelector)
        await expect(tx).to.emit(poolzGovernor, "RoleAdminChanged").withArgs(role, DEFAULT_ROLE, ADMIN_ROLE)
        await expect(tx).to.emit(poolzGovernor, "FunctionAdded").withArgs(vaultManager.address, createVaultSelector, requiredVotes)
        expect(votes).to.equal(requiredVotes)
    })

    it("should remove function", async () => {
        const tx = await poolzGovernor.RemoveFunction(vaultManager.address, createVaultSig)
        await expect(tx).to.emit(poolzGovernor, "FunctionRemoved").withArgs(vaultManager.address, createVaultSelector)
        expect(await poolzGovernor.SelectorToRequiredVotes(vaultManager.address, createVaultSelector)).to.equal(0)
        expect(1).to.equal(1)
    })

    describe("Admin CRUD", () => {
        let newAdmin: SignerWithAddress

        before(async () => {
            newAdmin = (await ethers.getSigners())[11]
        })

        it("should cast a vote to add new admin and grant role", async () => {
            for( const [index, admin] of admins.entries()){
                await poolzGovernor.connect(admin).grantAdmin(newAdmin.address)
                const votes = await poolzGovernor.GrantAdminVotes(newAdmin.address)
                const voteOfAdmin = await poolzGovernor.getGrantAdminVoteOf(newAdmin.address, admin.address)
                if(index < admins.length - 1){
                    expect(votes).to.equal(index + 1)
                    expect(voteOfAdmin).to.equal(true)
                }
            }
            for (const admin of admins) {
                expect(await poolzGovernor.getGrantAdminVoteOf(newAdmin.address, admin.address)).to.be.false
            }
            const votes = await poolzGovernor.GrantAdminVotes(newAdmin.address)
            const totalAdmins = await poolzGovernor.getRoleMemberCount(ADMIN_ROLE)
            expect(votes).to.equal(0)
            expect(totalAdmins).to.equal(admins.length + 1)
            expect(await poolzGovernor.hasRole(ADMIN_ROLE, newAdmin.address)).to.be.true
        })

        it("should cast a vote to revoke admin", async () => {
            for( const [index, admin] of admins.entries()){
                await poolzGovernor.connect(admin).revokeAdmin(newAdmin.address)
                const votes = await poolzGovernor.RevokeAdminVotes(newAdmin.address)
                const voteOfAdmin = await poolzGovernor.getRevokeAdminVoteOf(newAdmin.address, admin.address)
                if(index < admins.length - 1){
                    expect(votes).to.equal(index + 1)
                    expect(voteOfAdmin).to.equal(true)
                }
            }
            for (const admin of admins) {
                expect(await poolzGovernor.getRevokeAdminVoteOf(newAdmin.address, admin.address)).to.be.false
            }
            const votes = await poolzGovernor.RevokeAdminVotes(newAdmin.address)
            const totalAdmins = await poolzGovernor.getRoleMemberCount(ADMIN_ROLE)
            expect(votes).to.equal(0)
            expect(totalAdmins).to.equal(admins.length)
            expect(await poolzGovernor.hasRole(ADMIN_ROLE, newAdmin.address)).to.be.false
        })
    })
})