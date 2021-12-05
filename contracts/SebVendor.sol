// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Seb.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SebVendor is Ownable {
    Seb sebToken;
    uint256 public tokensPerEth = 100;

    event BuyTokens(address buyer, uint256 amountOfEth, uint256 amountOfTokens);
    event SellTokens(
        address seller,
        uint256 amountOfTokens,
        uint256 amountOfEth
    );

    constructor(address tokenAddress) {
        sebToken = Seb(tokenAddress);
    }

    function buyTokens() public payable returns (uint256 tokenAmount) {
        require(msg.value > 0, "Send ETH to buy tokens");

        uint256 amountToBuy = msg.value * tokensPerEth;

        uint256 vendorBalance = sebToken.balanceOf(address(this));
        require(vendorBalance >= amountToBuy, "Vendor has not enough tokens");

        bool sent = sebToken.transfer(msg.sender, amountToBuy);
        require(sent, "Failed to send tokens");

        emit BuyTokens(msg.sender, msg.value, amountToBuy);

        return amountToBuy;
    }

    function sellTokens(uint256 tokenAmount) public {
        require(tokenAmount > 0, "Specify the amount of tokens to sell");

        uint256 userBalance = sebToken.balanceOf(msg.sender);
        require(userBalance >= tokenAmount, "Your balance is lower than the amount of tokens you want to sell");

        uint256 amountOfEthToTransfer = tokenAmount / tokensPerEth;
        uint256 ownerEthBalance = address(this).balance;
        require(
            ownerEthBalance >= amountOfEthToTransfer,
            "Vendor has not enough funds to accept"
        );

        bool sent = sebToken.transferFrom(
            msg.sender,
            address(this),
            tokenAmount
        );
        require(sent, "Failed to transfer tokens to vendor");

        (sent, ) = msg.sender.call{value: amountOfEthToTransfer}("");
        require(sent, "Failed to send ETH to the user");
    }

    function withdraw() public onlyOwner {
        uint256 ownerBalance = address(this).balance;
        require(ownerBalance > 0, "Owner has no funds");

        (bool sent, ) = msg.sender.call{value: address(this).balance}("");
        require(sent, "Cannot send founds");
    }
}
