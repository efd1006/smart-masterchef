const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const contracts = require('../helpers/contracts.json');

describe("AAVE Strategy", () => {
    let strategy, owner, user1, user2, vault;

    let whaleAddress = "0xf977814e90da44bfa03b6295a0616a897441acec";
    let whale 
    let usdc
    before(async () => {
        [owner, operator, admin, user1, user2, vault] = await ethers.getSigners();

        const Strategy = await ethers.getContractFactory("AaveStrategy");
        strategy = await upgrades.deployProxy(Strategy, [`${owner.address}`, `${vault.address}`, `${vault.address}`], { initializer: "initialize" })
        await strategy.deployed();

        console.log("Strategy Proxy address: ", strategy.address)
        console.log("Implementation Address: ", await upgrades.erc1967.getImplementationAddress(strategy.address))
        console.log("Admin Address: ", await upgrades.erc1967.getAdminAddress(strategy.address))  

        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [whaleAddress],
          });
        whale = await ethers.getSigner(whaleAddress);

        usdc = new ethers.Contract(contracts.USDC.address, contracts.USDC.abi, whale);
    })

    it("Should should set params", async () => {
        await strategy.setAaveProvider("0xd05e3E715d945B59290df0ae8eF85c1BdB684744") // polygon mainnet aave provider address
        await strategy.setTokens(contracts.USDC.address, "0x1a13F4Ca1d028320A707D99520AbFefca3998b7F") // polygon mainnet usdc and amusdc address
    })

    it("Should stake to aave", async () => {

        await usdc.connect(vault).approve(strategy.address, ethers.constants.MaxUint256)
        await usdc.connect(whale).transfer(vault.address, ethers.utils.parseUnits('10000', 6))
        
        await strategy.stake(contracts.USDC.address, await usdc.balanceOf(vault.address))
        expect(await usdc.balanceOf(vault.address)).to.eq(0)
        expect(await strategy.netAssetValue()).to.gt(0)
    })

    it("Should unstake", async () => {
        // console.log("Balance without interest: ", await strategy.netAssetValue())
        await strategy.unstake(contracts.USDC.address, ethers.utils.parseUnits('3000', 6)) // unstake 3k out of 10k
        expect(await usdc.balanceOf(vault.address)).to.eq(ethers.utils.parseUnits('3000', 6))
        expect(await strategy.netAssetValue()).to.gte(ethers.utils.parseUnits('7000', 6)) // remaining balance on aave + interest yield
    })

    it("Should unstake full", async () => {
        // since we partially unstake from above lets get the remaining 7k + aave interest yield using unstakeFull method
        await strategy.unstakeFull(contracts.USDC.address)
        // console.log("Balance after with interest: ", await usdc.balanceOf(vault.address))
        expect(await usdc.balanceOf(vault.address)).to.gte(ethers.utils.parseUnits('7000', 6))
    })

})