const hre = require('hardhat')

async function main() {
    const Seb = await hre.ethers.getContractFactory('Seb')
    const seb = await Seb.deploy(10)

    await seb.deployed()

    const Vendor = await hre.ethers.getContractFactory('SebVendor')
    const vendor = await Vendor.deploy(seb.address)

    await vendor.deployed()

    console.log()
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.log(err)
        process.exit(1)
    })
