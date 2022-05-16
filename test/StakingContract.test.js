const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");

describe("StakingContract", function() {
  /***
   * Variables for staking contract constructor
   */
  const depositFee = 0;
  const withdrawalFee = 0;
  const performanceFee = 0;
  const poolId = "0x06df3b2bbb68adc8b0e302443692037ed9f91b42000000000000000000000012";
  const BPSP = "0x06Df3b2bbB68adc8B0e302443692037ED9f91b42";

  let deployer_address = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
  let contract;
  
  beforeEach(async () => {
    // We get the contract to deploy
    const StakingContract = await ethers.getContractFactory("StakingContract");
    contract = await StakingContract.deploy(depositFee, withdrawalFee, performanceFee, poolId, BPSP);
  });

  it("Should deploy the contract with correct constructor arguments", async function() {
    await contract.deployed();

    const contractCreator = await contract.getContractCreator();
    const contractAdmin = await contract.getAdmin();

    expect(contractCreator.toLocaleLowerCase()).to.equal(deployer_address.toLocaleLowerCase());
    expect(contractAdmin.toLocaleLowerCase()).to.equal(deployer_address.toLocaleLowerCase());
    expect(await contract.getDepositFee()).to.equal(depositFee);
    expect(await contract.getWithdrawalFee()).to.equal(withdrawalFee);
    expect(await contract.getPerformanceFee()).to.equal(performanceFee);
  });

});