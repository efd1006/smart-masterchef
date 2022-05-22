const { expect } = require("chai");
const { ethers } = require("hardhat");

const mineBlocks = async (n) => {
    for (let index = 0; index < n; index++) {
        await ethers.provider.send('evm_mine');
    }
}

describe("MasterChef", () => {
    let ganap, masterchef, owner, developer, treasury, user1, user2, stakingReward;
    const baseDepositFee = 400 // 4%
    const amountToTransfer = 20
    const amountToDeposit = 10

    before(async () => {
        [owner, developer, treasury, user1, user2, stakingReward] = await ethers.getSigners();
        const Ganap = await ethers.getContractFactory("Ganap");
        ganap = await Ganap.deploy(ethers.utils.parseEther('100'));
        await ganap.deployed();
        const startTime = 1653242824;
        const endTime = 1684749150;
        const MasterChef = await ethers.getContractFactory("MasterChef");
        masterchef = await MasterChef.deploy(ganap.address, developer.address, treasury.address, ethers.utils.parseEther('0.05'), startTime, endTime, "0x0000000000000000000000000000000000000000");
        await masterchef.deployed();

    });

    it("Need to transfer ownership of token to masterchef contract", async () => {
        // send some ganap token on staking reward before transfering owenrship 
        await ganap.transfer(stakingReward.address, ethers.utils.parseEther(`10`));

        await ganap.connect(stakingReward).approve(masterchef.address, ethers.constants.MaxInt256) // approve to spend ganap token on staking reward

        await ganap.transferOwnership(masterchef.address); // Important Ensure The MasterChef is Token Owner
    });

    it("Should set staking reward address", async () => {
        // revert if not owner of the masterchef
        await expect(masterchef.connect(user1).setStakingRewardAddress(stakingReward.address)).to.be.revertedWith("Ownable: caller is not the owner")

        await masterchef.setStakingRewardAddress(stakingReward.address);
    })

    it("Should add a staking pool", async () => {
       await masterchef.add(400, ganap.address, baseDepositFee, true);
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
        // await mineBlocks(50);
        await ethers.provider.send("evm_setNextBlockTimestamp", [1653242864]);
        await ethers.provider.send("evm_mine");

        const pendingReward = await masterchef.pendingReward(0, user1.address)
        // console.log("User 1 pending reward: ", pendingReward)
        expect(pendingReward).to.not.eq(0)
    })

    it("Should be able to withdraw", async () => {
        let userLPInfo = await masterchef.userInfo(0, user1.address)
        let userLPBalance = userLPInfo[0]
        const pendingRewardBefore = await masterchef.pendingReward(0, user1.address);
        expect(pendingRewardBefore).to.gte(0)
        await masterchef.connect(user1).withdraw(0, userLPBalance);
        userLPInfo = await masterchef.userInfo(0, user1.address)
        let userLPBalanceAfterWithdraw = userLPInfo[0]
        let pendingRewardAfer = await masterchef.pendingReward(0, user1.address)

        expect(userLPBalanceAfterWithdraw).to.eq(0);
        expect(pendingRewardAfer).to.eq(0)
    })

});