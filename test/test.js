const { assert } = require("chai");

const ETHER_VALUE = ethers.utils.parseEther('1');

describe("Wallet", function() {

  let wallet, walletAddress, owner, ownerAddress, s1, a1;

  before(async () => {

    const Wallet = await ethers.getContractFactory("Wallet");
    wallet = await Wallet.deploy();
    await wallet.deployed()
    walletAddress = wallet.address;

    owner = ethers.provider.getSigner(0);
    ownerAddress = await owner.getAddress();
    s1 = ethers.provider.getSigner(1);
    a1 = await s1.getAddress();


  });

  describe('Before any funds are transferred', () => {
    it('should contain a balance of zero Ether', async() => {
      let balance = await ethers.provider.getBalance(walletAddress);
      assert.equal(balance.toString(), '0');
    });

    it('should have have the contract deployer as the owner', async () => {
      let owner = await wallet.owner();
      assert.equal(owner.toString(), ownerAddress.toString());
    });
  });

  describe('We attempt to transfer in Ether', () => {
    let balance;
    it('should transfer ether to the contract', async () => {
      owner.sendTransaction({
        to: walletAddress,
        value: ETHER_VALUE,
      });
      balance = await ethers.provider.getBalance(walletAddress);
      assert.equal(balance.toString(), ETHER_VALUE.toString());
    });

    describe('We try to send Ether from the contract to another address', () => {
      before(async() => {
        await wallet.sendEther(a1, balance);
      });

      // Will not pass, two different values for some reason
      it('should transfer Ether to an EOA', async () => {
        let a1Balance = await ethers.provider.getBalance(a1);
        assert.equal(
          (a1Balance.sub(ethers.utils.parseEther('10000'))).toString(),
          balance.toString()
        );
      });

      it('should have a balance of 0', async () => {
        let walletAfterTransfer = await ethers.provider.getBalance(walletAddress);
        assert.equal(
          walletAfterTransfer.toString(), '0');
      });
    });

    describe('trying to send withdraw Ether from another account', () => {
      before(async() => {
        owner.sendTransaction({
          to: walletAddress,
          value: ETHER_VALUE,
        });
      });

      it('should not allow someone other than the owner to withdraw', async () => {
        let ex;
        try {
          await wallet.connect(s1).sendEther(ownerAddress, ETHER_VALUE);
        } catch (_ex) {
          ex = _ex;
        }
        assert(ex, 'should revert!');
      });
    });
  });

  describe('Attempting to transfer an ERC20 token in and out', () => {
    let ERC20Test, ERC20TestAddress
    before(async() =>{
      const ERC20TestFactory = await ethers.getContractFactory('ERC20Test');
      ERC20Test = await ERC20TestFactory.deploy();
      await ERC20Test.deployed();

      await ERC20Test.approve(walletAddress, 1000);
      ERC20TestAddress = ERC20Test.address;
    });

    it('should receive ERC20 tokens', async () => {
      await wallet.receiveERC20(ERC20TestAddress, 250);
      assert.equal(
        await ERC20Test.balanceOf(walletAddress),
        250
      );
    });

    it('should have 750 still approved', async () => {
      assert.equal(
        await ERC20Test.allowance(ownerAddress, walletAddress), 750
      );
    });

    it('should not allow anyone but the owner to send', async() => {
      let ex;
      try {
        await walletAddress.connect(s1).sendERC20(ERC20TestAddress, a1, 250);
      } catch (_ex) {
        ex = _ex
      }
      assert(ex, 'Should revert transaction!');
    });

    it('should transfer ERC20 tokens', async () => {
      await wallet.sendERC20(ERC20TestAddress, a1, 250);
      assert.equal(
        await ERC20Test.balanceOf(a1), 250
      );
    });

    it('should have a contract balance of 0 ERC20 tokens', async () => {
      assert.equal(
        await ERC20Test.balanceOf(walletAddress), 0
      );
    });
  });
});
