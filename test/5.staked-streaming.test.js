const { expect } = require('chai');
const { ethers } = require('hardhat');
const pairJson = require("@uniswap/v2-core/build/UniswapV2Pair.json");
const factoryJson = require("@uniswap/v2-core/build/UniswapV2Factory.json");
const routerJson = require("@uniswap/v2-periphery/build/UniswapV2Router02.json");


describe("Staking GANAP-USDC LP tokens to get rewards", () => {
    let ganap, masterchef, owner, developer, treasury, user1, user2, rewardManager, deadline, usdc, uniswapPair;
    const initialSupply = ethers.utils.parseEther('100000')
    before(async () => {
        [owner, developer, user1, user2, treasury] = await ethers.getSigners();
        deadline = (await ethers.provider.getBlock('latest')).timestamp * 2; // uniswap dealine params

        // Ganap token
        const Ganap = await ethers.getContractFactory("Ganap")
        ganap = await Ganap.deploy(initialSupply)
        await ganap.deployed()

        // USDC mock token
        const USDC = await ethers.getContractFactory("Ganap")
        usdc = await USDC.deploy(initialSupply);
        await usdc.deployed()

        // Deploy Masterchef contract
        const startTime = (await ethers.provider.getBlock('latest')).timestamp
        const endTime = startTime * 2;
        const MasterChef = await ethers.getContractFactory("MasterChef");
        masterchef = await MasterChef.deploy(ganap.address, developer.address, treasury.address, ethers.utils.parseEther('0.05'), startTime, endTime, "0x0000000000000000000000000000000000000000");
        await masterchef.deployed();

        // Deploy RewardManager contract
        const RewardManager = await ethers.getContractFactory("RewardManager")
        rewardManager = await RewardManager.deploy()
        await rewardManager.deployed()

        // Setup Factory
        this.uniswapFactory = await (new ethers.ContractFactory(factoryJson.abi, factoryJson.bytecode, owner)).deploy(ethers.constants.AddressZero);
        this.uniswapRouter = await (new ethers.ContractFactory(routerJson.abi, routerJson.bytecode, owner)).deploy(this.uniswapFactory.address, usdc.address);

        // Approve tokens and create Uniswap v2 lp pair against Ganap and add liquidity
        const initialTokenAmount = ethers.utils.parseEther('10000')
        await ganap.approve(this.uniswapRouter.address, initialTokenAmount)
        const initialUSDCAmount = ethers.utils.parseEther("5000");
        await usdc.approve(this.uniswapRouter.address, initialUSDCAmount)

        await this.uniswapRouter.addLiquidity(
            ganap.address,
            usdc.address,
            initialTokenAmount,
            initialUSDCAmount,
            1,
            1,
            owner.address,
            deadline
        )
        const UniswapPairFactory = new ethers.ContractFactory(pairJson.abi, pairJson.bytecode, owner)
        uniswapPair = await UniswapPairFactory.attach(await this.uniswapFactory.getPair(ganap.address, usdc.address))
    })

    it("Should check liquidity pool addresses", async () => {
        expect(await uniswapPair.token0()).to.be.oneOf([usdc.address, ganap.address])
        expect(await uniswapPair.token1()).to.be.oneOf([usdc.address, ganap.address])
        expect(await uniswapPair.balanceOf(owner.address)).to.be.gt('0')
    })

    it("Should set reward manager on masterchef contract", async () => {
        await masterchef.setRewardManager(rewardManager.address)
    })

    it("Should set masterchef on reward manager contract", async () => {
        await rewardManager.setMasterchef(masterchef.address)
    })

    it("Should topup reward on reward manager contract", async () => {
        await ganap.transfer(rewardManager.address, ethers.utils.parseEther('10000'))
    })

    it("Should approve masterchef contract to take erc20 token on reward manager", async () => {
        await rewardManager.setApproval(ganap.address)
    })

    it("Should add Ganap-USDC pool on masterchef", async () => {
        // console.log("Uniswap pair address: ", uniswapPair.address)
        await masterchef.add(400, uniswapPair.address, 0, true)
    })

    it("Should be able to deposit the LP Tokens", async () => {
        // Transfer some funds to user1
        const tokenAmount = await ethers.utils.parseEther("100")
        await ganap.transfer(user1.address, tokenAmount)
        const usdcAmount = await ethers.utils.parseEther("500")
        await usdc.transfer(user1.address, usdcAmount)

        // approve uniswap router to spend tokens
        await ganap.connect(user1).approve(this.uniswapRouter.address, tokenAmount)
        await usdc.connect(user1).approve(this.uniswapRouter.address, usdcAmount)

        // provide liquidity
        await this.uniswapRouter.connect(user1).addLiquidity(ganap.address, usdc.address, tokenAmount, usdcAmount, 0, 0, user1.address, deadline)

        // checking of balances
        let user1TokenBalance = await ganap.balanceOf(user1.address)
        expect(user1TokenBalance).to.lt(tokenAmount)
        let user1USDCBalance = await usdc.balanceOf(user1.address)
        expect(user1USDCBalance).to.lt(usdcAmount)
        const user1LPBalance = await uniswapPair.balanceOf(user1.address)
        // console.log("User1 Uniswap LP balance: ", user1LPBalance)
        expect(await uniswapPair.balanceOf(owner.address)).to.be.gt(0)

        // get current treasury balance before deposit
        let treasuryBalanceBefore = await uniswapPair.balanceOf(treasury.address)
        expect(treasuryBalanceBefore).to.eq(0)

        // get user1 pending reward before deposit
        let user1PendingRewardBefore = await masterchef.pendingReward(0, user1.address)
        expect(user1PendingRewardBefore).to.eq(0) 

        // approve lp token  and deposit LP to masterchef
        await uniswapPair.connect(user1).approve(masterchef.address, user1LPBalance)
        await masterchef.connect(user1).deposit(0, user1LPBalance)
        let user1LPBalanceAfter = await uniswapPair.balanceOf(user1.address)
        expect(user1LPBalanceAfter).to.eq(0)

        // mine some blocks to increase pending rewards
        let t = (await ethers.provider.getBlock('latest')).timestamp + 10000
        await ethers.provider.send("evm_setNextBlockTimestamp", [t]);
        await ethers.provider.send("evm_mine");

        let user1PendingRewardAfter = await masterchef.pendingReward(0, user1.address)
        // console.log(user1PendingRewardAfter)
        expect(user1PendingRewardAfter).to.gt(0)
    })

    it("Should harvest pending reward", async () => {
        let user1RewardBefore = await masterchef.pendingReward(0, user1.address)
        expect(user1RewardBefore).to.gt(0)
        // console.log(user1RewardBefore)

        // harvest the reward
        await masterchef.connect(user1).harvestAll()
        let user1RewardAfter = await masterchef.pendingReward(0, user1.address)
        expect(user1RewardAfter).to.eq(0)
    })

    it("Should be able to withdraw the LP tokens on the masterchef pool", async () => {
        let user1Info = await masterchef.userInfo(0, user1.address)
        let user1LPBalanceBefore = user1Info[0]
        // console.log("User1 LP Balance on the pool before withdrawal: ", user1LPBalanceBefore)
        expect(user1LPBalanceBefore).to.gt(0)
        
        // withdraw from the pool
        await masterchef.connect(user1).withdraw(0, user1LPBalanceBefore)

        // update userinfo
        user1Info = await masterchef.userInfo(0, user1.address)
        let user1LPBalanceAfter = user1Info[0]
        expect(user1LPBalanceAfter).to.eq(0)

    })

})