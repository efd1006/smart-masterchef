const { expect } = require("chai");
const { ethers } = require("hardhat");

const mineBlocks = async (n) => {
    for (let index = 0; index < n; index++) {
        await ethers.provider.send('evm_mine');
    }
}

describe("Timelock", () => {

    let ganap, masterchef, timelock, owner, developer, treasury, user1, user2, admin;

    before(async () => {
        [owner, user1, user2, developer, treasury, admin] = await ethers.getSigners();

        // deploy token
        const factory = await ethers.getContractFactory("Ganap");
        ganap = await factory.deploy(100);
        await ganap.deployed();

        // Deploy Masterchef
        const startTime = 1653242824;
        const endTime = 1684749150;
        const MasterChef = await ethers.getContractFactory("MasterChef");
        masterchef = await MasterChef.deploy(ganap.address, developer.address, treasury.address, ethers.utils.parseEther('0.05'), startTime, endTime, "0x0000000000000000000000000000000000000000");
        await masterchef.deployed();

        // deploy timelock
        const Timelock = await ethers.getContractFactory("Timelock");
        timelock = await Timelock.deploy(developer.address);
        await timelock.deployed();
    });

    it('Should transfer token ownership to masterchef', async () => {
        await ganap.transferOwnership(masterchef.address)
        expect(await ganap.owner()).to.eq(masterchef.address)
    })

    it("Should transfer masterchef ownership to timelock", async () => {
        await masterchef.transferOwnership(timelock.address)
        expect(await masterchef.owner()).to.eq(timelock.address)
    })

    it("Should deploy with correct constructor arguments", async () => {
        // Check Total Supply
        expect(await timelock.admin()).to.equal(developer.address);
    });

    it("Should set pending admin", async () => {
        await timelock.connect(developer).setPendingAdmin(admin.address);
        expect(await timelock.pendingAdmin()).to.eq(admin.address)
    })

    it("Should be able to accept pending admin", async () => {
        await timelock.connect(admin).acceptAdmin()
        expect(await timelock.admin()).to.eq(admin.address)
        expect(await timelock.pendingAdmin()).to.eq("0x0000000000000000000000000000000000000000")
    })

    it("Should queue transaction", async () => {
        const target = masterchef.address
        const value = 0
        const signature = "add(uint256,address,uint16,bool)"
        const data = ethers.utils.defaultAbiCoder.encode(["uint256", "address", "uint16", "bool"], [1, `${ganap.address}`, 400, true])
        const eta = 1653582952 // Thu May 26 2022 16:35:52 GMT+0000

        const tx = await timelock.connect(admin).queueTransaction(target, value, signature, data, eta);
        expect(tx.hash).to.not.null
        expect(tx.hash).to.not.undefined
        expect(tx.hash).to.not.empty
    })

    it("Should not execute transction if it has not surpassed the delay ", async () => {
        const target = masterchef.address
        const value = 0
        const signature = "add(uint256,address,uint16,bool)"
        const data = ethers.utils.defaultAbiCoder.encode(["uint256", "address", "uint16", "bool"], [1, `${ganap.address}`, 400, true])
        const eta = 1653582952 // Thu May 26 2022 16:35:52 GMT+0000

        await ethers.provider.send("evm_setNextBlockTimestamp", [1653496552]) // Wed May 25 2022 16:35:52 GMT+0000
        await ethers.provider.send('evm_mine')
        await expect(timelock.connect(admin).executeTransaction(target, value, signature, data, eta)).to.be.revertedWith("Timelock::executeTransaction: Transaction hasn't surpassed time lock.")
    })

    it("Should cancel queued transaction", async () => {
        const target = masterchef.address
        const value = 0
        const signature = "add(uint256,address,uint16,bool)"
        const data = ethers.utils.defaultAbiCoder.encode(["uint256", "address", "uint16", "bool"], [1, `${ganap.address}`, 400, true])
        const eta = 1653582952 // Thu May 26 2022 16:35:52 GMT+0000

        tx = await timelock.connect(admin).cancelTransaction(target, value, signature, data, eta);
        expect(tx.hash).to.not.null
        expect(tx.hash).to.not.undefined
        expect(tx.hash).to.not.empty
    })

    it("Should not execute canceled transaction", async () => {
        const target = masterchef.address
        const value = 0
        const signature = "add(uint256,address,uint16,bool)"
        const data = ethers.utils.defaultAbiCoder.encode(["uint256", "address", "uint16", "bool"], [1, `${ganap.address}`, 400, true])
        const eta = 1653582952 // Thu May 26 2022 16:35:52 GMT+0000
        await expect(timelock.connect(admin).executeTransaction(target, value, signature, data, eta)).to.be.revertedWith("Timelock::executeTransaction: Transaction hasn't been queued.")
    })

    it("Should execute transaction", async () => {
        const target = masterchef.address
        const value = 0
        const signature = "add(uint256,address,uint16,bool)"
        const data = ethers.utils.defaultAbiCoder.encode(["uint256", "address", "uint16", "bool"], [1, `${ganap.address}`, 400, true])
        let eta = 1653701752 // Sat May 28 2022 01:35:52 GMT+0000

        await ethers.provider.send("evm_setNextBlockTimestamp", [1653690952]) // Fri May 27 2022 22:35:52 GMT+0000
        await ethers.provider.send('evm_mine')
        await timelock.connect(admin).queueTransaction(target, value, signature, data, eta);

        await ethers.provider.send("evm_setNextBlockTimestamp", [1653716152]) // Sat May 28 2022 05:35:52 GMT+0000
        await ethers.provider.send('evm_mine')

        const tx = await timelock.connect(admin).executeTransaction(target, value, signature, data, eta);
        expect(tx.hash).to.not.null
        expect(tx.hash).to.not.undefined
        expect(tx.hash).to.not.empty
    })

});