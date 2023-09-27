import { keccak256 } from "ethers/lib/utils";
import { PoolzGovernor } from "../typechain-types";
import { Governee } from "../typechain-types/contracts/tests/Governee.sol";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from 'chai';

export function getSelectorFromSignature(sig: string): string {
    const hash = keccak256(Buffer.from(sig));
    const selector = hash.slice(0, 10);
    return selector;
}

export function getRoleOfSelector(_contract: string, selector: string): string {
    const _contractWithoutPrefix = _contract.replace("0x", "");
    const selectorWithoutPrefix = selector.replace("0x", "");
    const combined = _contractWithoutPrefix + selectorWithoutPrefix;

    const role = keccak256("0x" + combined);

    return role;
}

export function shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];  // Swap elements
    }
    return array;
}

export const grantRoleToUser = async (
    poolzGovernor: PoolzGovernor,
    governee: Governee,
    admins: SignerWithAddress[],
    user: SignerWithAddress,
    signature: string,
    selector: string
) => {
    for( const [index, admin] of admins.entries()){
        const tx = await poolzGovernor.connect(admin).grantRoleOfFunction(governee.address, signature, user.address)
        const [votes, voteOfAdmin] = await Promise.all([
            poolzGovernor.UsersToVotes(user.address, governee.address, selector),
            poolzGovernor.getUserVoteOf(user.address, governee.address, selector, admin.address)
        ])
        if(index < admins.length - 1){
            expect(votes).to.equal(index + 1)
            expect(voteOfAdmin).to.equal(true)
        } else {
            const role = getRoleOfSelector(governee.address, selector)
            await Promise.all([
                expect(tx).to.emit(poolzGovernor, "FunctionGranted").withArgs(governee.address, selector, user.address),
                expect(tx).to.emit(poolzGovernor, "RoleGranted").withArgs(role, user.address, admin.address)
            ])
        }
    }
    for (const admin of admins) {
        expect(await poolzGovernor.getUserVoteOf(user.address, governee.address, selector, admin.address)).to.be.false
    }
};
