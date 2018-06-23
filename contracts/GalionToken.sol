pragma solidity ^0.4.23;

// Galion.io Token Contract : ERC20 Token
// developed by contact@it.galion.io
// ----------------------------------------------------------------------------
contract ERC20Interface {
    function totalSupply() public constant returns (uint256 supplyTotal);
    function balanceOf(address _owner) public constant returns (uint256 balance);
    function transfer(address _to, uint256 _value) public returns (bool success);
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool success);
    function approve(address _spender, uint256 _value) public returns (bool success);
    function allowance(address _owner, address _spender) public constant returns (uint256 remaining);

    event Transfer(address indexed _from, address indexed _to, uint256 _value);
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);
}

/**
 * @title SafeMath
 * @dev Math operations with safety checks that throw on error
 */
library SafeMath {

  /**
  * @dev Multiplies two numbers, throws on overflow.
  */
  function mul(uint256 a, uint256 b) internal pure returns (uint256 c) {
    if (a == 0) {
      return 0;
    }
    c = a * b;
    assert(c / a == b);
    return c;
  }

  /**
  * @dev Integer division of two numbers, truncating the quotient.
  */
  function div(uint256 a, uint256 b) internal pure returns (uint256) {
    // assert(b > 0); // Solidity automatically throws when dividing by 0
    // uint256 c = a / b;
    // assert(a == b * c + a % b); // There is no case in which this doesn't hold
    return a / b;
  }

  /**
  * @dev Subtracts two numbers, throws on overflow (i.e. if subtrahend is greater than minuend).
  */
  function sub(uint256 a, uint256 b) internal pure returns (uint256) {
    assert(b <= a);
    return a - b;
  }

  /**
  * @dev Adds two numbers, throws on overflow.
  */
  function add(uint256 a, uint256 b) internal pure returns (uint256 c) {
    c = a + b;
    assert(c >= a);
    return c;
  }
}

contract GalionToken is ERC20Interface {
    using SafeMath for uint256;
    
    // burn event, launched when burning tokens
    event Burn(address indexed burner, uint256 value);

    // Contract owner, set once by the constructor. Can't be changed after.
    address public owner;

    uint256 public constant decimals = 18;
    string public constant symbol = "GLN";
    string public constant name = "Galion Token";

    // Total supply of GLN tokens
    uint256 public supplyTotal = 320 * 10**6 * (10 ** uint256(decimals));

    // GLN token balances for all addresses
    mapping(address => uint256) private balances;

    // If true, tokens can be transferred by all token owners.
    bool public tradable = false;

    // Allowance map.
    // If bob allows alice to transfer 10 of his tokens on his behalf, the map will look like :
    // { bob: { alice: 10 } }
    mapping(address => mapping (address => uint256)) private allowed;

    // bool to indicate that the presale is running
    bool public isPreSaleOn = false;
    // bool to indicate that all the tokens for the presale has been sold
    bool public preSaleSoldOut = false;
    // bool to indicate that all the tokens for the sale has been sold
    bool public saleSoldOut = false;

    // buy price = how much token can 1 ETH buy
    uint256 public baseBuyPrice = 0;

    // presale bonus (in multiplier percent). E.g. 130 = 130% multiplier = *1.3 = 30% bonus.
    uint256 public preSaleBonus = 120;

    // Whitelisted addresses (who passed the KYC process)
    // 0 : not whitelisted (default)
    // 1 : whitelisted for mainsale
    // 2 : whitelisted for presale
    mapping(address => uint8) private whitelist;

    uint256 public whitelistCount = 0;

    // Initial mainsale repartition : 60% of total tokens.
    // Note : the mainsale supply includes the presale's supply, because unsold tokens from presale will
    // be available for purchase during the mainsale.
    uint256 public icoSalePercent = 60;

    // Initial presale repartition : 50% of total tokens.
    uint256 public icoPreSalePercent = 50;

    // Supply of tokens available for sale during the mainsale.
    uint256 public saleSupply = supplyTotal.mul(icoSalePercent).div(100);
    // Supply of tokens available for sale during the presale.
    uint256 public preSaleSupply = supplyTotal.mul(icoPreSalePercent).div(100);

    // amount of wei contribued
    uint256 public totalWeiContributed = 0;

    // Token sold count (used to display progress on a website, and stop the presale / mainsale when their
    // respective supply have been sold).
    uint256 public totalTokenSold = 0;

    // amount of wei needed to reach the soft cap
    // will be calculated when the function "setBuyPrice" will be called
    uint256 public softCap = 0;
    // amount of wei needed to reach the hard cap
    // will be calculated when the function "setBuyPrice" will be called
    uint256 public hardCap = 0;

    // store the amount contributed by each contributors
    // used in case of refund in the claim function
    // also used for the individual cap
    mapping(address => uint256) private contributed;

    // sale start block
    uint256 public saleStartBlock = 9999999999999999999;
    // safe sale end block
    uint256 public safeSaleEndBlock = 9999999999999999999;
    // individual wei cap during safe sale, must be set before calling the "setSaleStartBlock" and used to allow every whitelisted user to have a share
    uint256 public individualWeiCap = 0;
    // sale end block
    uint256 public saleEndBlock = 99999999999999999999;

    // Address for the company tokens (advisory, company)
    address public COMPANY_ADDRESS;
    // GLN token vested for company founders
    mapping(address => uint256) private vested;
    // min block to release the team tokens
    // instanciated in the constructor
    uint256 public VESTED_RELEASE_BLOCK = 0;
    
    // block per week, based on 14 sec per block
    uint256 public constant BLOCK_PER_WEEK = 43200;
    // block per 12hour, based on 260 blocks per hour
    uint256 public constant BLOCK_PER_12HOUR = 3120;    

    // Modifier for functions that can only be called by the contract's creator (owner).
    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    // Modifier for functions that can only be called after token transfers are enabled.
    // company address can send token anyway : may be usefull for bounty when deploying the contract
    modifier isTradable() {
        require(tradable == true || msg.sender == COMPANY_ADDRESS);
        _;
    }

    // Modifier for the burn function, allowing to burn token when tokens are tradable or if the owner is calling
    modifier canBurn() {
        require(tradable == true || msg.sender == owner);
        _;
    }

    // Modifier for functions that can only be called if tokens can be bought.
    // Tokens can be bought in 3 cases :
    // Case 1 "presale" : presale is running and not sold out and the caller is whitelisted = 2 and the contribution is at least 0.1 ETH
    // case 2 "safe main sale" : sale is not sold out, block number is between start and start + 12h and the caller is whitelisted > 0 (mainsale or presale)
    // Case 3 "main sale" : sale is not sold out, block number is between start and stop, and the caller is whitelisted > 0 (mainsale or presale) and the contribution is at least 0.1 ETH
    modifier canBuy() {
        // require the buy price is set
        require(baseBuyPrice > 0);

        bool presaleOk = !preSaleSoldOut && whitelist[msg.sender] == 2 && isPreSaleOn && msg.value >= 100000000000000000;
        bool safeMainSaleOk = !saleSoldOut && whitelist[msg.sender] > 0 && block.number >= saleStartBlock && block.number <= saleEndBlock && block.number <= safeSaleEndBlock;
        bool mainsaleOk = !saleSoldOut && whitelist[msg.sender] > 0 && block.number >= saleStartBlock && block.number <= saleEndBlock && (msg.value >= 100000000000000000 || getWeiLeftToContribute() < 100000000000000000);
        require(presaleOk || safeMainSaleOk || mainsaleOk);
        _;
    }

    // Constructor (called upon creation)
    constructor()
        public {

            owner = msg.sender;
            // owner will have 60% of the tokens, the sale supply
            balances[owner] = supplyTotal.mul(60).div(100);
            emit Transfer(address(0), owner, supplyTotal.mul(60).div(100));
            
            // REMEMBER TO CHANGE ADDRESS WHEN DEPLOYING CONTRACT
			// FOLLOWING ADDRESSES ARE TESTNET ADDRESSES
            COMPANY_ADDRESS = address(0x849F14948588d2bDe7a3ff68DE9269b2160483C1);

            // 30% for the company - for the bounty & recruitment incentives and the advisory fund
            balances[COMPANY_ADDRESS] = supplyTotal.mul(30).div(100);
            emit Transfer(address(0), COMPANY_ADDRESS, supplyTotal.mul(30).div(100));
            
            // vesting token for the founders, tokens will be claimed using the function "claimVestedTokens" after the block number "VESTED_RELEASE_BLOCK" is reached. 
            // "VESTED_RELEASE_BLOCK" is set to be reached in 52 weeks (using 43200 blocks per week)
            VESTED_RELEASE_BLOCK = block.number.add(BLOCK_PER_WEEK.mul(52));
            uint256 vestedVolumePerFounder = supplyTotal.mul(2).div(100);

            // here, 10% of the token are stored in the vested[] mapping and not in circulation
            // the only way to get the token is via the claimVestedTokens function which will not release them until 1 year has passed
            vested[address(0x4933916d10aB8225a33F3a8bae7CF1A8AA316068)] = vestedVolumePerFounder;
            vested[address(0x531A551dE22317857b10d9FaB69674E56130679e)] = vestedVolumePerFounder;
            vested[address(0xDe6fdA07c2f16dE22654B707c80d25705f6410a5)] = vestedVolumePerFounder;
            vested[address(0x13E45dFF393716f3169E34Dd9039468975b808C6)] = vestedVolumePerFounder;
            vested[address(0xFcCB4C7D53745f03DF19039f3B37083D0E4ff47B)] = vestedVolumePerFounder;
    }

    // Default function called when someone is sending ETH : redirects to the ICO buy function.
    function()
        public
        payable {
            buyGLN();
    }

    // ICO buy function
    // The sender can only buy if :
    // - the ICO is in progress (mainsale or presale)
    // - the sender is whitelisted (for the current phase)
    function buyGLN()
        public
        payable
        canBuy {
            // Initialize buyPrice and supply to the mainsale's values
            uint256 buyPrice = baseBuyPrice;
            uint256 supply = saleSupply;

            // if presale is in progress then we can only be here if the sender is whitelisted for presale (modifier canBuy)
            // then adjust buy price with preSaleBonus and set the max supply buyable to the preSaleSupply
            if(isPreSaleOn) {
                buyPrice = baseBuyPrice.mul(preSaleBonus).div(100);
                supply = preSaleSupply;
            }

            // if not in presale, must be during the sale, check if before the safe sale end block
            // if during the safe sale, check if the total contribution from this address
            // is lower or equal than the individual wei cap
            else if(block.number <= safeSaleEndBlock) {
                require(contributed[msg.sender].add(msg.value) <= individualWeiCap);
            }

            // Amount of tokens bought
            uint256 buyAmount = msg.value.mul(buyPrice);

            // Disallow buying if the owner doesn't have enough tokens.
            require(balances[owner] >= buyAmount);

            // Disallow buying if the transaction would make the sale go beyond its cap.
            uint256 futureTotalTokenSold = totalTokenSold.add(buyAmount);
            require(futureTotalTokenSold <= supply);

            totalTokenSold = futureTotalTokenSold;

            // If sold tokens is above the presale supply, stop presale.
            if (totalTokenSold >= preSaleSupply) {
                preSaleSoldOut = true;
                isPreSaleOn = false;
            }

            // If sold tokens is above the mainsale supply, stop mainsale.
            if (totalTokenSold >= saleSupply) {
                saleSoldOut = true;
                saleEndBlock = block.number;
                // Send ETH to the company multi sig address if the token sale is over
				COMPANY_ADDRESS.transfer(address(this).balance);
            }

            // transfer tokens to contributor 
            balances[owner] = balances[owner].sub(buyAmount);
            balances[msg.sender] = balances[msg.sender].add(buyAmount);
            // and Trigger the Transfer event.
            emit Transfer(owner, msg.sender, buyAmount);

            // add the contributed amount in WEI by the sender and in the total
            contributed[msg.sender] = contributed[msg.sender].add(msg.value);
            totalWeiContributed = totalWeiContributed.add(msg.value);
    }

    // release vested tokens if the sender has any in the vested[] mapping and the release block is reached
    function claimVestedTokens()
        public {
            // the block number must be at least the "release block" set in the constructor at the deployment time
            require(block.number >= VESTED_RELEASE_BLOCK);
            require(vested[msg.sender] > 0);

            uint256 vestedVolumeToGive = vested[msg.sender];
            vested[msg.sender] = 0;
            balances[msg.sender] = balances[msg.sender].add(vestedVolumeToGive);

            emit Transfer(address(0), msg.sender, vestedVolumeToGive);
    }

    // check amount of token vested for an address
    function vestedOf(address _addr)
        public
        constant
        returns (uint256) {
            return vested[_addr];
    }

    // Returns the total token supply.
    function totalSupply()
        public
        constant
        returns (uint256) {
            return supplyTotal;
    }

    // burn a number of tokens equals to _value
    // tokens must be tradable and msg.sender must have at least _value tokens
    // decrease the total supply of tokens and fires Burn and Transfer events
    function burn(uint256 _value)
        public 
        canBurn {
            require(_value <= balances[msg.sender]);
            // no need to require value <= totalSupply, since that would imply the
            // sender's balance is greater than the totalSupply, which *should* be an assertion failure
            address burner = msg.sender;
            balances[burner] = balances[burner].sub(_value);
            supplyTotal = supplyTotal.sub(_value);
            emit Burn(burner, _value);
            emit Transfer(burner, address(0), _value);
    }

    // Burn unsold tokens during ICO
    function burnUnsoldTokens()
        public
        onlyOwner {
            // cannot burn before the end of the main sale
            require(block.number > saleEndBlock);
            require(totalTokenSold < saleSupply);

            uint256 ownerBalance = balances[owner];
            require(ownerBalance > 0);

            burn(ownerBalance);
    }

    // Make tokens transferrable.
    // After this function is called; this can not be undone.
    // unsold tokens must be burnt before calling this function
    function enableTrade()
        public
        onlyOwner {
            // ICO must have ended
            require(block.number > saleEndBlock);

            // owner must have 0 tokens (all sold or burned)
            require(balances[owner] == 0);

            tradable = true;
    }

    function stopPreSale()
        public
        onlyOwner {
            isPreSaleOn = false;
    }

    function startPreSale()
        public
        onlyOwner {
            // check that buy price is set
            require(baseBuyPrice > 0);
            // check that the sale is not started, we should not be able to be in presale and in sale
            require(block.number < saleStartBlock);
            isPreSaleOn = true;
    }

    // Set the individual wei cap which is only used during the first 12h of the main sale
    function setIndividualWeiCap(uint256 newWeiCap)
        public
        onlyOwner {
            // must not be in presale
            require(!isPreSaleOn);

            require(newWeiCap > 0);
            individualWeiCap = newWeiCap;
    }

    // Set the mainsale block start.
    // The new block must be in the future.
    function setSaleStartBlock(uint256 newSaleStartBlock)
        public
        onlyOwner {
            // check that buy price is set
            require(baseBuyPrice > 0);
            // must not be in presale
            require(!isPreSaleOn);
            // the individual wei cap must be set before
            require(individualWeiCap > 0);
            // check that the sale has not already been done
            require(block.number < saleStartBlock);
            // check set block is future
            require(newSaleStartBlock > block.number);

            saleStartBlock = newSaleStartBlock;
            // safe main sale ends 12h after the sale starts
            safeSaleEndBlock = saleStartBlock.add(BLOCK_PER_12HOUR);
            // sale duration : 2 weeks
            saleEndBlock = newSaleStartBlock.add(BLOCK_PER_WEEK.mul(2));
    }

    // Set presale bonus.
    function setPreSaleBonus(uint256 newBonus)
        public
        onlyOwner {
            // must not be in presale
            require(!isPreSaleOn);
            require(newBonus >= 100);
            preSaleBonus = newBonus;
    }
    
    // Set buy price (tokens per ETH, without bonus).
    // because both have 18 decimal, newBuyPrice is "how much token can be bought with 1 eth"
    function setBuyPrice(uint256 newBuyPrice)
        public
        onlyOwner {
            // must not be in presale
            require(!isPreSaleOn);

            require(newBuyPrice > 0);

            // should not be able to change price during sale
            require(block.number < saleStartBlock);
            baseBuyPrice = newBuyPrice;

            // recalc the new soft cap 
            // softCap = 26% of sale supply / buy price
            softCap = saleSupply.div(baseBuyPrice).mul(26).div(100);
			
			hardCap = saleSupply.div(baseBuyPrice);
    }

    // get the amount of wei contributed per address
    function getContributed(address _addr)
        public
        constant
        returns (uint256) {
            return contributed[_addr];
    }
	
	// get the amount of wei left to be contributed
	function getWeiLeftToContribute()
		public
		constant
		returns (uint256) {
			// the amount left to be contributed for the sale is the hardcap minus the amount of wei already contributed
			return hardCap.sub(totalWeiContributed);
	}

    // Public function to get the balance of an address.
    function balanceOf(address _addr)
        public
        constant
        returns (uint256) {
            return balances[_addr];
    }

    // Public function to check if an address is in the presale whitelist.
    function checkWhitelistedForPresale(address _addr)
        public
        constant
        returns (bool) {
            return whitelist[_addr] == 2;
    }

    // Public function to check if an address is in the mainsale whitelist.
    function checkWhitelistedForMainsale(address _addr)
        public
        constant
        returns (bool) {
            return whitelist[_addr] > 0;
    }

    // Add addresses to whitelist (level = presale).
    function addWhitelistedAddressPresaleList(address[] addresses)
        public
        onlyOwner {
            for (uint256 i = 0; i < addresses.length; i++){
                whitelist[addresses[i]] = 2;
            }

            whitelistCount = whitelistCount.add(addresses.length);
    }

    // Add addresses to whitelist (level = mainsale).
    function addAddressesToMainsaleWhitelist(address[] addresses)
        public
        onlyOwner {
            for (uint256 i = 0; i < addresses.length; i++){
                whitelist[addresses[i]] = 1;
            }

            whitelistCount = whitelistCount.add(addresses.length);
    }

    // Remove addresses from the whitelist.
    function removeWhitelistedAddress(address[] addresses)
        public
        onlyOwner {
            for (uint256 i = 0; i < addresses.length; i++){
                whitelist[addresses[i]] = 0;
            }
            
            whitelistCount = whitelistCount.sub(addresses.length);
    }

    // Transfer a given number of tokens from the sender's address to a given address.
    function transfer(address _to, uint256 _value)
        public
        isTradable
        returns (bool) {
            require(_to != address(0));
            require(_value <= balances[msg.sender]);

            balances[msg.sender] = balances[msg.sender].sub(_value);
            balances[_to] = balances[_to].add(_value);
            emit Transfer(msg.sender, _to, _value);
            return true;
    }

    // Transfer a given number of tokens from a given address to another address.
    // The sender must be approved to transfer tokens on the _from address's behalf.
    // So, this method can only be used after approve() has been called by the _from address.
    function transferFrom(address _from, address _to, uint256 _value)
        public
        isTradable
        returns (bool) {
            require(_to != address(0));
            require(_value <= balances[_from]);
            require(_value <= allowed[_from][msg.sender]);

            balances[_from] = balances[_from].sub(_value);
            balances[_to] = balances[_to].add(_value);
            allowed[_from][msg.sender] = allowed[_from][msg.sender].sub(_value);
            emit Transfer(_from, _to, _value);
            return true;
    }

    // Approve the _spender address to spend _amount tokens on behalf of msg.sender.
    function approve(address _spender, uint256 _amount)
        public
        isTradable
        returns (bool success) {
            
            //  To change the approve amount you first have to reduce the addresses`
            //  allowance to zero by calling `approve(_spender,0)` if it is not
            //  already 0 to mitigate the race condition described here:
            //  https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
            require((_amount == 0) || (allowed[msg.sender][_spender] == 0));

            allowed[msg.sender][_spender] = _amount;
            emit Approval(msg.sender, _spender, _amount);
            return true;
    }

    // Get the number of tokens _spender can transfer on behalf of _owner.
    function allowance(address _owner, address _spender)
        public
        constant
        returns (uint256 remaining) {
            return allowed[_owner][_spender];
    }

    // Withdraw all ETH stored on the contract, by sending them to the company address
    // It shouldn't be needed as ETH is transferred to the owner at each transaction.
    function withdraw()
        onlyOwner
        public {
			// cannot withdraw before the soft cap is reached
            require(totalWeiContributed >= softCap);
            // check if the sale is over
            require(block.number > saleEndBlock);
            COMPANY_ADDRESS.transfer(address(this).balance);
    }
    
    // allow user to get refund 
    function refund()
        public {
            // check if the soft cap has not been attained
            require(totalWeiContributed < softCap);
            // check if the sale is over
            require(block.number > saleEndBlock);
            
            uint256 contributedWei = contributed[msg.sender];
            //require contributed more than 0
            require(contributedWei > 0);

            // Checks-Effects-Interactions to avoid reentrency
            contributed[msg.sender] = 0;
            if (contributedWei > 0 && address(this).balance >= contributedWei) {
                msg.sender.transfer(contributedWei);
            }
    }
}