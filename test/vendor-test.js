const { expect } = require('chai')
const { ethers } = require('hardhat')

describe('SebVendor', () => {
    let owner
    let addr1
    let addr2
    let addrs

    let vendorContract
    let tokenContract
    let SebTokenFactory

    let vendorTokensSupply
    let tokensPerEth

    beforeEach(async () => {
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners()

        SebTokenFactory = await ethers.getContractFactory('Seb')
        tokenContract = await SebTokenFactory.deploy(1000)

        const VendorContract = await ethers.getContractFactory('SebVendor')
        vendorContract = await VendorContract.deploy(tokenContract.address)

        await tokenContract.transfer(vendorContract.address, ethers.utils.parseEther('1000'))
        await vendorContract.transferOwnership(owner.address)

        vendorTokensSupply = await tokenContract.balanceOf(vendorContract.address)
        tokensPerEth = await vendorContract.tokensPerEth()
    })

    describe('buyTokens()', () => {
        it('revert if no ETH sent', async () => {
            const amount = ethers.utils.parseEther('0')
            await expect(
                vendorContract.connect(addr1).buyTokens({ value: amount })
            ).to.be.revertedWith('Send ETH to buy tokens')
        })

        it('revert if vendor has no enough tokens', async () => {
            const amount = ethers.utils.parseEther('101')
            await expect(
                vendorContract.connect(addr1).buyTokens({ value: amount })
            ).to.be.revertedWith('Vendor has not enough tokens')
        })

        it('happy path', async () => {
            const amount = ethers.utils.parseEther('1')

            await expect(
                vendorContract.connect(addr1).buyTokens({ value: amount })
            ).to.emit(vendorContract, 'BuyTokens').withArgs(addr1.address, amount, amount.mul(tokensPerEth))

            // Check that the user balance is 100
            const userBalance = await tokenContract.balanceOf(addr1.address)
            const userTokenAmount = ethers.utils.parseEther('100')
            expect(userBalance).to.equal(userTokenAmount)

            // Check that the vendor balance is 900
            const vendorBalance = await tokenContract.balanceOf(vendorContract.address)
            expect(vendorBalance).to.equal(vendorTokensSupply.sub(userTokenAmount))

            // Check that the vendor's ETH balance is 1
            const vendorEthBalance = await ethers.provider.getBalance(vendorContract.address)
            expect(vendorEthBalance).to.equal(amount)
        })
    })

    describe('withdraw()', () => {
        it('revert if it is not called by the owner', async () => {
            await expect(vendorContract.connect(addr1).withdraw()).to.be.revertedWith('Ownable: caller is not the owner')
        })

        it('revert if the owner has no balance', async () => {
            await expect(vendorContract.connect(owner).withdraw()).to.be.revertedWith('Owner has no funds')
        })

        it('happy path', async () => {
            const ethToBuy = ethers.utils.parseEther('1')

            await vendorContract.connect(addr1).buyTokens({ value: ethToBuy })

            const txWithdraw = await vendorContract.connect(owner).withdraw()

            const vendorBalance = await ethers.provider.getBalance(vendorContract.address)
            expect(vendorBalance).to.equal(0)

            await expect(txWithdraw).to.changeEtherBalance(owner, ethToBuy)
        })
    })

    describe('sellTokens()', () => {
        it('revert if token amount to sell is 0', async () => {
            const amountToSell = ethers.utils.parseEther('0')
            await expect(vendorContract.connect(addr1).sellTokens(amountToSell))
                .to.be.revertedWith('Specify the amount of tokens to sell')
        })

        it('revert if user has not enough tokens to sell', async () => {
            const amountToSell = ethers.utils.parseEther('1')
            await expect(vendorContract.connect(addr1).sellTokens(amountToSell))
                .to.be.revertedWith('Your balance is lower than the amount of tokens you want to sell')
        })

        it('rever if vendor has not enought tokens to sell', async () => {
            const tokensToBuyEth = ethers.utils.parseEther('1')

            await vendorContract.connect(addr1).buyTokens({ value: tokensToBuyEth })

            await vendorContract.connect(owner).withdraw()

            const amountToSell = ethers.utils.parseEther('100')
            await expect(vendorContract.connect(addr1).sellTokens(amountToSell))
                .to.be.revertedWith('Vendor has not enough funds to accept')
        })

        it('revert if user has now approved transfer', async () => {
            const ethToBuy = ethers.utils.parseEther('1')

            await vendorContract.connect(addr1).buyTokens({ value: ethToBuy })

            const amountToSell = ethers.utils.parseEther('100')
            await expect(vendorContract.connect(addr1).sellTokens(amountToSell))
                .to.be.revertedWith('ERC20: transfer amount exceeds allowance')
        })

        it('happy path', async () => {
            const ethToBuy = ethers.utils.parseEther('1')

            await vendorContract.connect(addr1).buyTokens({ value: ethToBuy })

            const amountToSell = ethers.utils.parseEther('100')
            await tokenContract.connect(addr1).approve(vendorContract.address, amountToSell)

            const allowance = await tokenContract.allowance(addr1.address, vendorContract.address)
            expect(allowance).to.equal(amountToSell)

            const sellTx = await vendorContract.connect(addr1).sellTokens(amountToSell)

            const vendorBalance = await tokenContract.balanceOf(vendorContract.address)
            expect(vendorBalance).to.equal(ethers.utils.parseEther('1000'))

            const userBalance = await tokenContract.balanceOf(addr1.address)
            expect(userBalance).to.equal(0)

            const userEthBalance = ethers.utils.parseEther('1')
            await expect(sellTx).to.changeEtherBalance(addr1, userEthBalance)
        })
    })
})