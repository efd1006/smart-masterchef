const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Ganap", () => {

  let owner, user1, user2, ganap;

  beforeEach(async () => {
    [owner, user1, user2] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("Ganap");
    ganap = await factory.deploy(100);
    await ganap.deployed();
  });

  it("Should deploy with correct constructor arguments", async () => {
    // Check Total Supply
    expect(await ganap.totalSupply()).to.equal(100);
  });

  it("Should be able to mint", async () => {
    // mint new token to user1
    await ganap.mint(user1.address, 20);

    expect(await ganap.balanceOf(user1.address)).to.equal(20);
  })

  it("Should be able to transfer", async () => {
    // Check Standard Transfer
    await ganap.transfer(user1.address, 20);
    expect(await ganap.balanceOf(owner.address)).to.equal(80);
    expect(await ganap.balanceOf(user1.address)).to.equal(20);
  })

});