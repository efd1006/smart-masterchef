const { expect } = require('chai');
const { ethers } = require('hardhat');


describe("RewardManager", () => {
    let ganap, masterchef, rewardManager, owner, developer, treasury, user1, user2, operator, multisig;

    before(async () => {
        [owner, user1, user2, developer, treasury, operator, multisig] = await ethers.getSigners();
        
        // Deploy token contract
        const Ganap = await ethers.getContractFactory("Ganap");
        ganap = await Ganap.deploy(ethers.utils.parseEther('1000000'));
        await ganap.deployed();
        
        // Deploy masterchef contract
        const startTime = 1653242824;
        const endTime = 1684749150;
        const MasterChef = await ethers.getContractFactory("MasterChef");
        masterchef = await MasterChef.deploy(ganap.address, developer.address, treasury.address, ethers.utils.parseEther('0.05'), startTime, endTime, "0x0000000000000000000000000000000000000000");
        await masterchef.deployed();
        
        // Deploy reward manager contract
        const RewardManager = await ethers.getContractFactory("RewardManager")
        rewardManager = await RewardManager.deploy(masterchef.address, multisig.address)
        await rewardManager.deployed()
    })

    it("Should set operator", async () => {
        await rewardManager.setOperator(operator.address)
        await rewardManager.connect(operator).setOperator(owner.address)
    })

    it("Should revert set operator if caller is not allowed", async () => {
        await expect(rewardManager.connect(user1).setOperator(user2.address)).to.be.revertedWith("onlyAllowed: not allowed")

    })

    it("Should set masterchef", async () => {
        await rewardManager.connect(owner).setMasterchef(masterchef.address)
        const masterchefAddress = await rewardManager.masterchef();
        expect(masterchefAddress).to.eq(masterchef.address)
    })

    it("Should revert set masterchef if caller is not allowed", async () => {
        await expect(rewardManager.connect(user1).setMasterchef(masterchef.address)).to.be.revertedWith("onlyAllowed: not allowed")
    })

    it("Should set multisig", async () => {
        await rewardManager.setMultisig(multisig.address);
    })

    it("Should revert set multisig if caller is not allowed", async () => {
        await expect(rewardManager.connect(user1).setMultisig(user2.address)).to.be.revertedWith("onlyAllowed: not allowed")
    })

    it("Should approve token", async () => {
        await rewardManager.setApproval(ganap.address);
    })

    it("Should withdraw erc20", async () => {
        await ganap.transfer(rewardManager.address, ethers.utils.parseEther('10'))
        await rewardManager.connect(multisig).withdrawERC20(ganap.address, ethers.utils.parseEther('10'))
        const balance = await ganap.balanceOf(multisig.address)
        expect(balance).to.eq(ethers.utils.parseEther('10'))
    })

    it("Should not withdraw erc20 if caller is not multisig", async () => {
        await expect(rewardManager.connect(user1).withdrawERC20(ganap.address, ethers.utils.parseEther('10'))).to.be.revertedWith("onlyMultisig: not allowed")
        await expect(rewardManager.connect(owner).withdrawERC20(ganap.address, ethers.utils.parseEther('10'))).to.be.revertedWith("onlyMultisig: not allowed")
        await expect(rewardManager.connect(operator).withdrawERC20(ganap.address, ethers.utils.parseEther('10'))).to.be.revertedWith("onlyMultisig: not allowed")
    })

})

