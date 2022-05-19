// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Ganap is ERC20, Ownable {
    constructor(uint256 _initialSupply) ERC20("GANAP", "GNP") {
        _mint(msg.sender, _initialSupply);
    }

    function _afterTokenTransfer(
        address _from,
        address _to,
        uint256 _amount
    ) internal override(ERC20) {
        super._afterTokenTransfer(_from, _to, _amount);
    }

    function _mint(address _to, uint256 _amount)
        internal
        override(ERC20)
    {
        super._mint(_to, _amount);
    }

    function _burn(address _account, uint256 _amount)
        internal
        override(ERC20)
    {
        super._burn(_account, _amount);
    }

    // Mint function required for Masterchef contract to create new tokens
    function mint(address _to, uint256 _amount) public onlyOwner {
        _mint(_to, _amount);
    }
}
