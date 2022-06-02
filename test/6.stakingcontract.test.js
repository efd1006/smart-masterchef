const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");
const c = require('./helpers/constants.json');
const contracts = require('./helpers/contracts.json');

describe("StakingContract", function() {
  /***
   * Variables for staking contract constructor
   */
  const depositFee = c.depositFee;
  const withdrawalFee = c.withdrawalFee;
  const performanceFee = c.performanceFee;
  const poolId = c.poolId;
  const BPSP = c.BPSP;
  const balancerGauge = c.balancerGauge;

  let deployer_address = c.deployer_address;
  let contract;
  
  beforeEach(async () => {
    // We get the contract to deploy
    const StakingContract = await ethers.getContractFactory("StakingContract");
    contract = await StakingContract.deploy(depositFee, withdrawalFee, performanceFee, poolId, BPSP, balancerGauge);
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

  it("Should set allow user", async function() {
    await contract.deployed();

    // allow user
    await contract.setAllowed(c.account1, true);

    // check allowed user
    const isAllowed = await contract.isAllowed(c.account1);
    expect(isAllowed).to.equal(true);
  });

  it("Should revoke allowed user", async function() {
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

  it("Should join balancer pool and deposit to balancer gauge", async function() {
    await contract.deployed();

    const whaleAccountToImpersonate = c.whaleAccountToImpersonate;
    const accountToFund = contract.address;

    /***
    * @note 18 decimals, 1 DAI = 1000000000000000000
    * This case lets transfer 300,000 DAI
    */
    const amountToTransfer = BigInt(300000000000000000000000);

    
    // Request hardhat to impersonate account
     await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [whaleAccountToImpersonate],
    });
    const signer = await ethers.getSigner(whaleAccountToImpersonate);

    // load the contracts 
    const DAI_CONTRACT = new ethers.Contract(contracts.DAI.address, contracts.DAI.abi, signer);
    const BALANCER_GAUGE_CONTRACT = new ethers.Contract(contracts.BALANCER_GAUGE.address, contracts.BALANCER_GAUGE.abi, signer);


    const whaleAccountToImpersonateBalance = await DAI_CONTRACT.balanceOf(whaleAccountToImpersonate);
    // console.log("DAI whale balancer: ", whaleAccountToImpersonateBalance / 1e18);

    // Send amountToTransfer from whaleAccountToImpersonate to accountToFund
    await DAI_CONTRACT.connect(signer).transfer(accountToFund, amountToTransfer);
    let accountToFundBalance = await DAI_CONTRACT.balanceOf(accountToFund);
    // console.log("Im a new whale: ", accountToFundBalance / 1e18);

    expect(accountToFundBalance).to.equal(amountToTransfer);

    /**
    * Get intiial BPSP balance of accountToFund BEFORE joining the pool
    * We expect that the initial BPSP Balance of accountToFund BEFORE joining the pool is 0
    */
    const accountToFundInitialBPSPBalanceBefore = await BALANCER_GAUGE_CONTRACT.balanceOf(accountToFund);
    // console.log("BPSP Gauge Balance Before:", accountToFundInitialBPSPBalanceBefore / 1e18);
    expect(accountToFundInitialBPSPBalanceBefore).to.equal(0);

    // join DAI pool
    const r = await contract.joinDAIPool(accountToFundBalance);
    await r.wait();

    /**
     * Get intiial BPSP balance of accountToFund AFTER joining the pool
     * We expect that the initial BPSP Balance of accountToFund AFTER joining the pool is not 0
     */
     const accountToFundInitialBPSPBalanceAfter = await BALANCER_GAUGE_CONTRACT.balanceOf(accountToFund)
    //  console.log("BPSP Gauge Balance After:", accountToFundInitialBPSPBalanceAfter / 1e18);
     expect(accountToFundInitialBPSPBalanceAfter).not.equal(0)
  });

  it("Should leave balancer pool", async function() {
    await contract.deployed();
    
    /**
    * JOIN POOL
    */
    const whaleAccountToImpersonate = c.whaleAccountToImpersonate;
    const accountToFund = contract.address;

    /***
    * @note 18 decimals, 1 DAI = 1000000000000000000
    * This case lets transfer 300,000 DAI
    */
    const amountToTransfer = BigInt(300000000000000000000000);

    
    // Request hardhat to impersonate account
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [whaleAccountToImpersonate],
    });
    const signer = await ethers.getSigner(whaleAccountToImpersonate);

    // load the contracts 
    const DAI_CONTRACT = new ethers.Contract(contracts.DAI.address, contracts.DAI.abi, signer);
    const BALANCER_GAUGE_CONTRACT = new ethers.Contract(contracts.BALANCER_GAUGE.address, contracts.BALANCER_GAUGE.abi, signer);


    const whaleAccountToImpersonateBalance = await DAI_CONTRACT.balanceOf(whaleAccountToImpersonate);
    // console.log("DAI whale balancer: ", whaleAccountToImpersonateBalance / 1e18);

    // Send amountToTransfer from whaleAccountToImpersonate to accountToFund
    await DAI_CONTRACT.connect(signer).transfer(accountToFund, amountToTransfer);
    let accountToFundBalance = await DAI_CONTRACT.balanceOf(accountToFund);
    // console.log("Im a new whale: ", accountToFundBalance / 1e18);

    expect(accountToFundBalance).to.equal(amountToTransfer);

    /**
    * Get intiial BPSP balance of accountToFund BEFORE joining the pool
    * We expect that the initial BPSP Balance of accountToFund BEFORE joining the pool is 0
    */
    const accountToFundInitialBPSPBalanceBefore = await BALANCER_GAUGE_CONTRACT.balanceOf(accountToFund);
    // console.log("BPSP Gauge Balance Before:", accountToFundInitialBPSPBalanceBefore / 1e18);
    expect(accountToFundInitialBPSPBalanceBefore).to.equal(0);

    // join DAI pool
    const r = await contract.joinDAIPool(accountToFundBalance);
    await r.wait();

    /**
    * Get intiial BPSP balance of accountToFund AFTER joining the pool
    * We expect that the initial BPSP Balance of accountToFund AFTER joining the pool is not 0
    */
    const accountToFundInitialBPSPBalanceAfter = await BALANCER_GAUGE_CONTRACT.balanceOf(accountToFund)
    //  console.log("BPSP Gauge Balance After:", accountToFundInitialBPSPBalanceAfter / 1e18);
    expect(accountToFundInitialBPSPBalanceAfter).not.equal(0)


    /**
     * LEAVE POOL
     */
    /***
    * @note 18 decimals, 1 DAI = 1000000000000000000
    * This case lets withdraw 100,000 DAI
    */
    const amountToWithdraw = BigInt(100000000000000000000000);
    
    // get the contract BPSP balance BEFORE the withdrawal
    let contractBPSPBalanceFundBefore = await BALANCER_GAUGE_CONTRACT.balanceOf(contract.address);
    // console.log("Contract BPSP balance AFTER the withdrawal: ", contractBPSPBalanceFundBefore / 1e18);
    // get the contract DAI balance BEFORE the withdrawal
    let contractDAIBalanceFundBefore = await DAI_CONTRACT.balanceOf(contract.address);
    // console.log("Contract DAI balance BEFORE the withdrawal: ", contractDAIBalanceFundBefore / 1e18);

    // leave DAI pool
    const rr = await contract.leaveDAIPool(amountToWithdraw)
    await r.wait();

    // get the contract BPSP balance AFTER the withdrawal 
    const contractBPSPBalanceFundAfter = await BALANCER_GAUGE_CONTRACT.balanceOf(contract.address);
    // console.log("Contract BPSP balance AFTER the withdrawal", contractBPSPBalanceFundAfter / 1e18);
    // get the contract DAI balance AFTER the withdrawal
    let contractDAIBalanceFundAfter = await DAI_CONTRACT.balanceOf(contract.address);
    // console.log("Contract DAI balance AFTER the withdrawal: ", contractDAIBalanceFundAfter / 1e18);

    // this could improve with slippage in factor to get the exact expected result
    expect(contractDAIBalanceFundBefore).to.equal(0);
    expect(contractDAIBalanceFundAfter).to.not.equal(0);
    
  });
});