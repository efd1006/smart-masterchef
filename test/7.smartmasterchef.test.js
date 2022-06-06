const { expect } = require("chai");
const { ethers } = require("hardhat");
const contracts = require('./helpers/contracts.json');

const mineBlocks = async (n) => {
    for (let index = 0; index < n; index++) {
        await ethers.provider.send('evm_mine');
    }
}

describe("SmartMasterChef", () => {
    let ganap, masterchef, owner, developer, treasury, user1, user2, rewardManager, strategy;
    const baseDepositFee = 400 // 4%
    const amountToTransfer = 20
    const amountToDeposit = 10

    const aUSDC = "0x1a13F4Ca1d028320A707D99520AbFefca3998b7F"
    const aDai = "0x27F8D03b3a2196956ED754baDc28D73be8830A6e"

    let USDCWhaleAddress = "0xf977814e90da44bfa03b6295a0616a897441acec";
    let USDCWhale, usdc

    let DAIWhaleAddress = "0x06959153b974d0d5fdfd87d561db6d8d4fa0bb0b"
    let DAIWhale, dai;

    before(async () => {
        [owner, developer, treasury, user1, user2, rewardManager] = await ethers.getSigners();
        const Ganap = await ethers.getContractFactory("Ganap");
        ganap = await Ganap.deploy(ethers.utils.parseEther('100'));
        await ganap.deployed();
        const startTime = 1653242824;
        const endTime = 1684749150;
        const MasterChef = await ethers.getContractFactory("SmartMasterchef");
        masterchef = await MasterChef.deploy(ganap.address, developer.address, treasury.address, ethers.utils.parseEther('0.05'), startTime, endTime, "0x0000000000000000000000000000000000000000");
        await masterchef.deployed();

        const Strategy = await ethers.getContractFactory("AaveStrategy");
        strategy = await upgrades.deployProxy(Strategy, [`${owner.address}`, `${masterchef.address}`, `${masterchef.address}`], { initializer: "initialize" })
        await strategy.deployed();

        await strategy.setAaveProvider("0xd05e3E715d945B59290df0ae8eF85c1BdB684744") // polygon mainnet aave provider address
        await masterchef.setAaveStrategy(strategy.address)

        console.log("Strategy Proxy address: ", strategy.address)
        console.log("Implementation Address: ", await upgrades.erc1967.getImplementationAddress(strategy.address))
        console.log("Admin Address: ", await upgrades.erc1967.getAdminAddress(strategy.address)) 

        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [USDCWhaleAddress],
          });
        USDCWhale = await ethers.getSigner(USDCWhaleAddress);

        usdc = new ethers.Contract(contracts.USDC.address, contracts.USDC.abi, USDCWhale);

        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [DAIWhaleAddress],
          });
        DAIWhale = await ethers.getSigner(DAIWhaleAddress);

        dai = new ethers.Contract(contracts.DAI.address, contracts.DAI.abi, DAIWhale);

    });

    it("Need to transfer ownership of token to masterchef contract", async () => {
        // send some ganap token on staking reward before transfering owenrship 
        await ganap.transfer(rewardManager.address, ethers.utils.parseEther(`10`));

        await ganap.connect(rewardManager).approve(masterchef.address, ethers.constants.MaxInt256) // approve to spend ganap token on staking reward

        await ganap.transferOwnership(masterchef.address); // Important Ensure The MasterChef is Token Owner
    });

    it("Should set staking reward address", async () => {
        // revert if not owner of the masterchef
        await expect(masterchef.connect(user1).setRewardManager(rewardManager.address)).to.be.revertedWith("Ownable: caller is not the owner")

        await masterchef.setRewardManager(rewardManager.address);
    })

    it("Should whitelist aave collateral token", async () => {
        await masterchef.whitelistAaveCollateral(contracts.USDC.address, aUSDC)
        await masterchef.whitelistAaveCollateral(contracts.DAI.address, aDai)
        const usdc = await masterchef.aaveCollateralList(contracts.USDC.address);
        const dai = await masterchef.aaveCollateralList(contracts.DAI.address);
        expect(usdc.token.toLocaleLowerCase()).to.eq(contracts.USDC.address.toLocaleLowerCase())
        expect(dai.token.toLocaleLowerCase()).to.eq(contracts.DAI.address.toLocaleLowerCase())
    })

    it("Should not whitelist duplicated aave collateral token", async () => {
        await expect(masterchef.whitelistAaveCollateral(contracts.USDC.address, aUSDC)).to.be.revertedWith("whitelistAaveCollateral: aave collateral token is already whitelisted.")
        await expect(masterchef.whitelistAaveCollateral(contracts.DAI.address, aDai)).to.be.revertedWith("whitelistAaveCollateral: aave collateral token is already whitelisted.")
    })

    it("Should add a staking pool", async () => {
       await masterchef.add(400, ganap.address, baseDepositFee, true);
       await masterchef.add(100, contracts.USDC.address, baseDepositFee, true);
       await masterchef.add(100, contracts.DAI.address, baseDepositFee, true);
    });

    it("Should be able to deposit", async () => {
        await ganap.transfer(user1.address, ethers.utils.parseEther(`${amountToTransfer}`));
        let user1BalanceAfterTransfer = await ganap.balanceOf(user1.address);
        expect(user1BalanceAfterTransfer).to.gte(ethers.utils.parseEther(`${amountToTransfer}`))

        await ganap.connect(user1).approve(masterchef.address, ethers.utils.parseEther(`${amountToDeposit}`));
        await masterchef.connect(user1).deposit(0, ethers.utils.parseEther(`${amountToDeposit}`));

        await usdc.connect(USDCWhale).approve(masterchef.address, ethers.constants.MaxUint256)
        await dai.connect(DAIWhale).approve(masterchef.address, ethers.constants.MaxUint256)
        await masterchef.connect(USDCWhale).deposit(1, await usdc.balanceOf(USDCWhaleAddress))
        await masterchef.connect(DAIWhale).deposit(2, await dai.balanceOf(DAIWhaleAddress))

        // console.log("aUSDC bal: ", await strategy.netAssetValue(aUSDC))
        // console.log("aDai bal: ", await strategy.netAssetValue(aDai))
        expect(await strategy.netAssetValue(aUSDC)).to.gt(0)
        expect(await strategy.netAssetValue(aDai)).to.gt(0)

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

        let usdcWhaleLpInfo = await masterchef.userInfo(1, USDCWhaleAddress)
        let daiWhaleLpInfo = await masterchef.userInfo(2, DAIWhaleAddress)

        // console.log(usdcWhaleBal)
        // console.log(daiWhaleBal)
        expect(await usdc.balanceOf(USDCWhaleAddress)).to.eq(0)
        expect(await dai.balanceOf(DAIWhaleAddress)).to.eq(0)
        await masterchef.connect(USDCWhale).withdraw(1, usdcWhaleLpInfo[0])
        await masterchef.connect(DAIWhale).withdraw(2, daiWhaleLpInfo[0])
        expect(await strategy.netAssetValue(aUSDC)).to.lte(usdcWhaleLpInfo[0]) // we expect it to be lessthan the amount deposited because of the accuring aave interest thats why we set it to lte
        expect(await strategy.netAssetValue(aDai)).to.lte(daiWhaleLpInfo[0]) // we expect it to be lessthan the amount deposited because of the accuring aave interest thats why we set it to lte
        expect(await usdc.balanceOf(USDCWhaleAddress)).to.eq(usdcWhaleLpInfo[0])
        expect(await dai.balanceOf(DAIWhaleAddress)).to.eq(daiWhaleLpInfo[0])
        
        userLPInfo = await masterchef.userInfo(0, user1.address)
        let userLPBalanceAfterWithdraw = userLPInfo[0]
        let pendingRewardAfer = await masterchef.pendingReward(0, user1.address)

        expect(userLPBalanceAfterWithdraw).to.eq(0);
        expect(pendingRewardAfer).to.eq(0)
    })

});