pragma solidity ^0.4.24;

import "./OpenZeppelin/SafeMath.sol";
import "./OpenZeppelin/TokenTimelock.sol";
import "./GalionToken.sol";
import "./PhasedSale.sol";
import "./SimpleWhitelist.sol";


// Galion.io Token Contract : ERC20 Token
// developed by contact@it.galion.io
// ----------------------------------------------------------------------------
contract GalionTokenSale is PhasedSale, SimpleWhitelist {
    using SafeMath for uint256;

    GalionToken public token;
    address public constant COMPANY_ADDRESS = address(0x849F14948588d2bDe7a3ff68DE9269b2160483C1);
    address public constant ADVISORY_ADDRESS = address(0x5a2a667f7A416D4660a7464c6C555F0Ecb328e2a);
    TokenTimelock public teamLockAddress1;
    TokenTimelock public teamLockAddress2;
    TokenTimelock public teamLockAddress3;
    TokenTimelock public teamLockAddress4;
    TokenTimelock public teamLockAddress5;

    // mapping of timelock contracts used in the presale to lock bonus token until 2019/01/01
    mapping(address => address) timelock;

    // store the amount contributed by each contributors
    // used in case of refund in the claim function
    // also used for the individual cap
    mapping(address => uint256) internal contributed;

    // amount of dollar raised, costant, used to define softcap, presalecap and hardcap
    uint256 public constant DOLLARTARGET = 9500000;
    uint256 public constant DOLLARSOFTTARGET = 2500000;

    // the following variables are used to define the different caps of the sale
    // they are set in the "setEthPrice" function
    uint256 public weiSoftCap = 0;
    uint256 public weiPresaleCap = 0;
    uint256 public weiHardCap = 0;

    // buy price = how much token can 1 ETH buy
    uint256 public baseBuyPrice = 0;

    // presale bonus (in percent)
    uint256 public constant PRESALEBONUS = 30;

    // amount of raised money in wei
    uint256 public weiRaised = 0;

    // the max date for contributing, set in the constructor to X months in the future
    uint public tokenSaleMaxDateLimit = 0;

    
    // check if the TGE is over
    // the TGE is over when the phase = 4
    // This modifier can also change the phase to 4 in 2 cases :
    // - if the max token date limit is reached (contract deployed for more than 4 months)
    // - if the main sale end is reached
    modifier saleIsOver() {
        if (phase < 4 ) {
            bool maxTokenDateLimitReached = block.timestamp > tokenSaleMaxDateLimit;
            bool mainSaleEndReached = (phase == 2 || phase == 3) && block.timestamp > mainsaleEnd;
            if (maxTokenDateLimitReached || mainSaleEndReached) {
                phase = 4;
            }
        }

        require(phase >= 4);
        _;
    }

    // modifier for functions that can only be called if the softcap is reached
    modifier softCapReached() {
        require(weiRaised >= weiSoftCap);
        _;
    }

    constructor() public {
        // Token contract creation
        token = new GalionToken();

        // the token sale max date limit is 4 month after deployment
        tokenSaleMaxDateLimit = block.timestamp + 22 weeks;

        // set the eth price directly for the presale
        //setEthPrice(0);
    }

    // Default function called when someone is sending ETH : redirects to the ICO buy function.
    // The sender can only buy if :
    // - the ICO is in progress (mainsale or presale)
    // - the sender is whitelisted
    function () public payable whitelisted saleIsOn {
        require(block.timestamp <= tokenSaleMaxDateLimit);
        // require the buy price to be set
        require(baseBuyPrice > 0);
        // presale
        if (phase == 0) {
            buyPresale();
        }
        // safe main sale
        else if (phase == 2) {
            // potentially switch to normal mainsale if time is elapsed
            if (block.timestamp > safeMainsaleEnd) { 
                phase = 3;
                buyMainSale();
            }
            else {
                buySafeMainSale();
            }
        }
        // main sale
        else if (phase == 3) {
            buyMainSale();
        }
    }

    // you can only be in the buyPresale if the contributor is whitelisted and the phase is 0 and the buy price has been set
    function buyPresale() private {
        // min contribution = 1 eth during presale
        require(msg.value >= 10 ** 18);

        // Check for presale hardcap
        require(weiRaised.add(msg.value) <= weiPresaleCap);
        
        // here, all the tests have been made to check if the user can buy tokens
        buyGLN();

        // also give PRESALEBONUS token in a token time lock contract
        address tokenTimeLockAddress = timelock[msg.sender];
        // if the contributor does not have a contract yet, create it
        if (tokenTimeLockAddress == address(0)) {
            // create the timelock contract with a release date in 3 months
            tokenTimeLockAddress = new TokenTimelock(token, address(msg.sender), block.timestamp + 90 days);
            timelock[msg.sender] = tokenTimeLockAddress;
        }

        // here, the contract time lock address is set (already exists or new contract has been deployed)
        // mint the bonus token to the contract
        token.mint(tokenTimeLockAddress, msg.value.mul(baseBuyPrice).mul(PRESALEBONUS).div(100));
    }

    // you can only be in the buySafeMainSale if the contributor is whitelisted and the phase is 2 and the buy price has been set
    function buySafeMainSale() private {
        // check for individual cap
        require(contributed[msg.sender].add(msg.value) <= individualWeiCap);
        
        // Check for hardcap
        require(weiRaised.add(msg.value) <= weiHardCap);

        // here, all the test have been made to check if the user can buy tokens
        buyGLN();
    }

    // you can only be in the buyMainSale if the contributor is whitelisted and the phase is 3 and the buy price has been set
    function buyMainSale() private {
        // min contrib of 0.1 eth during mainsale
        require(msg.value >= 10 ** 17);
        require(block.timestamp <= mainsaleEnd);
        
        // Check for hardcap
        require(weiRaised.add(msg.value) <= weiHardCap);

        // here, all the test have been made to check if the user can buy tokens
        buyGLN();
    }

    // this function can only be called from within buyPresale, buySafeMainSale or buyMainSale function
    // where all test have already been made
    function buyGLN() private {
        // Mint token & assign to contributor
        uint256 buyAmount = msg.value.mul(baseBuyPrice);
        contributed[msg.sender] = contributed[msg.sender].add(msg.value);
        weiRaised = weiRaised.add(msg.value);
        token.mint(msg.sender, buyAmount);

        // end the token generation event if the total token sold is the hard cap
        if (weiRaised == weiHardCap) {
            phase = 4;
        }
    }

    // set the price of 1 ETH in $, exemple 1 ETH = $ 515
    // can (and must) be set once during the presale or nobody can contribute
    // can be reset during the pause phase (to adjust the price if the price has dropped or mooned)
    // using the constant "DOLLARTARGET", the calculation of the weiSoftCap, weiPresaleCap and weiHardcap and the buyPrice is done here
    function setEthPrice(uint256 ethPriceInDollar) public onlyOwner {
        // the base price can only be changed before the main sale
        require(phase < 2);
        // can be set only once during presale (might already be set in the constructor)
        if (phase == 0) {
            require(baseBuyPrice == 0);
        }

        require(ethPriceInDollar > 0);

        // the tokenBuyPrice is set using the value 0.05$ / token
        baseBuyPrice = ethPriceInDollar.mul(20);

        // the sale hardcap in wei is how much wei is needed to reach 9.5M$
        weiHardCap = DOLLARTARGET.mul(10 ** 18).div(ethPriceInDollar);

        // the soft cap in wei is how much wei is needed to reach 2.5M$
        weiSoftCap = DOLLARSOFTTARGET.mul(10 ** 18).div(ethPriceInDollar);

        // the presale cap is 80% of the sale hardcap
        weiPresaleCap = weiHardCap.mul(80).div(100);
    }

    // Public function to check the address of the time lock contract for a contributor
    function getTimelockContractAddress(address _addr) public view returns (address) {
        return timelock[_addr];
    }

    // Withdraw all ETH stored on the contract, by sending them to the company address
    function withdraw() public saleIsOver softCapReached {
        COMPANY_ADDRESS.transfer(address(this).balance);
    }

    // allow a user to get refund if the soft cap has not been reached
    function refund(address contributor) public saleIsOver {
        // cannot refund if the soft cap in wei has been reached
        require(weiRaised < weiSoftCap);

        uint256 contributedWei = contributed[contributor];
        require(contributedWei > 0);

        contributed[contributor] = 0;
        if (address(this).balance >= contributedWei) {
            contributor.transfer(contributedWei);
        }
    }

    // activate token after token generation even (enable the transfer() function of ERC20)
    function activateToken() public saleIsOver softCapReached {
        // the total minted during the sale must represent 60% of the supply total
        uint256 realTotalSupply = token.totalSupply().mul(100).div(60);
        // Mint company tokens (20% of the total)
        token.mint(COMPANY_ADDRESS, realTotalSupply.mul(20).div(100));
        // Mint company tokens (10% of the total)
        token.mint(ADVISORY_ADDRESS, realTotalSupply.mul(10).div(100));

        // Mint & lock team tokens
        uint256 releaseTime = block.timestamp + 52 weeks;
        teamLockAddress1 = new TokenTimelock(token, address(0x4933916d10aB8225a33F3a8bae7CF1A8AA316068), releaseTime);
        teamLockAddress2 = new TokenTimelock(token, address(0x531A551dE22317857b10d9FaB69674E56130679e), releaseTime);
        teamLockAddress3 = new TokenTimelock(token, address(0xDe6fdA07c2f16dE22654B707c80d25705f6410a5), releaseTime);
        teamLockAddress4 = new TokenTimelock(token, address(0x13E45dFF393716f3169E34Dd9039468975b808C6), releaseTime);
        teamLockAddress5 = new TokenTimelock(token, address(0xFcCB4C7D53745f03DF19039f3B37083D0E4ff47B), releaseTime);
        token.mint(teamLockAddress1, realTotalSupply.mul(2).div(100));
        token.mint(teamLockAddress2, realTotalSupply.mul(2).div(100));
        token.mint(teamLockAddress3, realTotalSupply.mul(2).div(100));
        token.mint(teamLockAddress4, realTotalSupply.mul(2).div(100));
        token.mint(teamLockAddress5, realTotalSupply.mul(2).div(100));

        // now the total supply of the token is composed of 60% of tokens sold during the sale
        // and 40% of token given to the company / founders
        // we can now activate the token

        token.activate();
        token.transferOwnership(owner);
    }
}
