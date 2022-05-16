const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");
const c = require('./helpers/constants.json');

describe("StakingContract", function() {
  /***
   * Variables for staking contract constructor
   */
  const depositFee = c.depositFee;
  const withdrawalFee = c.withdrawalFee;
  const performanceFee = c.performanceFee;
  const poolId = c.poolId;
  const BPSP = c.BPSP;

  let deployer_address = c.deployer_address;
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

  it("Should get and set admin", async function() {
    await contract.deployed();

    // get the current admin
    const currentAdmin = await contract.getAdmin();
    expect(currentAdmin.toLocaleLowerCase()).to.equal(deployer_address.toLocaleLowerCase());
    
    // set new admin
    await contract.setAdmin(c.account1);
    const newAdmin = await contract.getAdmin();
    expect(newAdmin.toLocaleLowerCase()).to.equal(c.account1.toLocaleLowerCase());
  });

  it("Should get and set deposit fee", async function() {
    await contract.deployed();

    // get current deposit fee 
    const currentDepositFee = await contract.getDepositFee();
    expect(currentDepositFee).to.equal(depositFee);

    // set new deposit fee
    await contract.setDepositFee(1);
    const newDepositFee = await contract.getDepositFee();
    expect(newDepositFee).to.equal(1);
  });

  it("Should get and set withdrawal fee", async function() {
    await contract.deployed();

    // get current withdrawal fee 
    const currentWithdrawalFee = await contract.getWithdrawalFee();
    expect(currentWithdrawalFee).to.equal(withdrawalFee);

    // set new withdrawal fee
    await contract.setWithdrawalFee(10);
    const newWithdrawalFee = await contract.getWithdrawalFee();
    expect(newWithdrawalFee).to.equal(10);
  });

  it("Should get and set performance fee", async function() {
    await contract.deployed();

    // get current performance fee 
    const currentPerformanceFee = await contract.getPerformanceFee();
    expect(currentPerformanceFee).to.equal(performanceFee);

    // set new performance fee
    await contract.setPerformanceFee(20);
    const newPerformanceFee = await contract.getPerformanceFee();
    expect(newPerformanceFee).to.equal(20);
  });

  it("Should allow user", async function() {
    await contract.deployed();

    // allow user
    await contract.setAllowed(c.account1, true);

    // check allowed user
    const isAllowed = await contract.isAllowed(c.account1);
    expect(isAllowed).to.equal(true);
  });

  it("Should not allow user", async function() {
    await contract.deployed();

    // allow users
    await contract.setAllowed(c.account1, true);
    let isAllowed = await contract.isAllowed(c.account1);
    expect(isAllowed).to.equal(true);
    
    // not allow user
    await contract.setAllowed(c.account1, false);
    isAllowed = await contract.isAllowed(c.account1);
    expect(isAllowed).to.equal(false);
  });
});