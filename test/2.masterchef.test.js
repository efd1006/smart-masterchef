const { expect } = require("chai");
const { ethers } = require("hardhat");

const mineBlocks = async (n) => {
    for (let index = 0; index < n; index++) {
        await ethers.provider.send('evm_mine');
    }
}

describe("MasterChef", () => {
    let ganap, masterchef, owner, developer, treasury, user1, user2;
    const baseDepositFee = 400 // 4%
    const amountToTransfer = 20
    const amountToDeposit = 10

    before(async () => {
        [owner, developer, treasury, user1, user2] = await ethers.getSigners();
        const Ganap = await ethers.getContractFactory("Ganap");
        ganap = await Ganap.deploy(ethers.utils.parseEther('100'));
        await ganap.deployed();
        const startBlock = await ethers.provider.getBlockNumber();
        const MasterChef = await ethers.getContractFactory("MasterChef");
        masterchef = await MasterChef.deploy(ganap.address, developer.address, treasury.address, ethers.utils.parseEther('1'), startBlock);
        await masterchef.deployed();

    });

    it("Need to transfer ownership of token to masterchef contract", async () => {
        ganap.transferOwnership(masterchef.address); // Important Ensure The MasterChef is Token Owner
    });

    it("Should add a staking pool", async () => {
        masterchef.add(1, ganap.address, baseDepositFee, true);
    });

    it("Should be able to deposit", async () => {
        await ganap.transfer(user1.address, ethers.utils.parseEther(`${amountToTransfer}`));
        let user1BalanceAfterTransfer = await ganap.balanceOf(user1.address);
        expect(user1BalanceAfterTransfer).to.gte(ethers.utils.parseEther(`${amountToTransfer}`))

        await ganap.connect(user1).approve(masterchef.address, ethers.utils.parseEther(`${amountToDeposit}`));
        await masterchef.connect(user1).deposit(0, ethers.utils.parseEther(`${amountToDeposit}`));

        let depositFee = ((amountToDeposit * baseDepositFee) / 10000);
        let userLPInfo = await masterchef.userInfo(0, user1.address)
        let userLPBalance = userLPInfo[0]
        // console.log("User 1 LP balance on pool 0: ", user1LPBalance[0])
        expect(userLPBalance).to.gte(ethers.utils.parseEther(`${amountToDeposit - depositFee}`))


    });

    it("Should transfer the deposit fee to treasury", async () => {
        let depositFee = ((amountToDeposit * baseDepositFee) / 10000);
        let treasuryBalance = await ganap.balanceOf(treasury.address)
        expect(treasuryBalance).to.eq(ethers.utils.parseEther(`${depositFee}`))
    })


    it("Should be able to emit rewards", async () => {
        // mine some blocks for rewards
        await mineBlocks(50);

        const pendingReward = await masterchef.pendingReward(0, user1.address)
        // console.log("User 1 pending reward: ", pendingReward)
        expect(pendingReward).to.not.eq(0)
    })

    it("Should be able to withdraw", async () => {
        let userLPInfo = await masterchef.userInfo(0, user1.address)
        let userLPBalance = userLPInfo[0]
        await masterchef.connect(user1).withdraw(0, userLPBalance);
        userLPInfo = await masterchef.userInfo(0, user1.address)
        let userLPBalanceAfterWithdraw = userLPInfo[0]
        expect(userLPBalanceAfterWithdraw).to.eq(0);
    })
    
});