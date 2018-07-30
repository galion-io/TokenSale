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

    constructor() public {
        // Token contract creation
        token = new GalionToken();
    }

    // Default function called when someone is sending ETH : redirects to the ICO buy function.
    // The sender can only buy if :
    // - the ICO is in progress (mainsale or presale)
    // - the sender is whitelisted
    function () public payable whitelisted saleIsOn {
        // require the buy price to be set
        require(baseBuyPrice > 0);
        // presale
        if (phase == 0) {
            buyPresale();
        }
        // safe main sale
        else if (phase == 2) {
            // potentially switch to normal mainsale if time is elapsed
            if (block.timestamp >= safeMainsaleEnd) { 
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
        require(phase == 0);
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
        require(phase == 2 && block.timestamp <= safeMainsaleEnd);

        // check for presale cap
        require(contributed[msg.sender].add(msg.value) <= individualWeiCap);
        
        // Check for hardcap
        require(weiRaised.add(msg.value) <= weiHardCap);

        // here, all the test have been made to check if the user can buy tokens
        buyGLN();
    }

    // you can only be in the buyMainSale if the contributor is whitelisted and the phase is 0 and the buy price has been set
    function buyMainSale() private {
        require(phase == 3 && block.timestamp <= mainsaleEnd);
        
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
        // can be set only once during presale
        if (phase == 0) {
            require(baseBuyPrice == 0);
        }

        require(ethPriceInDollar > 0);

        // the tokenBuyPrice is set using the value 0.05$ / token
        baseBuyPrice = ethPriceInDollar.mul(20);

        // the sale hardcap in wei is how much wei is needed to reach 9.5M$
        weiHardCap = DOLLARTARGET.div(ethPriceInDollar).mul(10 ** 18);

        // the soft cap is 26% of the hardcap
        weiSoftCap = weiHardCap.mul(26).div(100);

        // the presale cap is 80% of the sale hardcap
        weiPresaleCap = weiHardCap.mul(80).div(100);
    }

    // Public function to check the address of the time lock contract for a contributor
    function getTimelockContractAddress(address _addr) public view returns (address) {
        return timelock[_addr];
    }

    // Withdraw all ETH stored on the contract, by sending them to the company address
    function withdraw() public {
        // cannot withdraw if the soft cap is not reached
        require(weiRaised >= weiSoftCap);
        // cannot withdraw if the sale is not over
        require(phase >= 4);

        COMPANY_ADDRESS.transfer(address(this).balance);
    }

    // allow a user to get refund before softcap is reached
    function refund(address contributor) public {
        // cannot refund if the soft cap in wei has been reached
        require(weiRaised < weiSoftCap);
        // allow to get a refund if the phase is TGE over or if the main sale if over (over the timestamp)
        require(phase >= 4 || ((phase == 2 || phase == 3) && block.timestamp > mainsaleEnd));

        uint256 contributedWei = contributed[contributor];
        require(contributedWei > 0);

        contributed[contributor] = 0;
        if (contributedWei > 0 && address(this).balance >= contributedWei) {
            contributor.transfer(contributedWei);
        }
    }

    // activate token after token generation even (enable the transfer() function of ERC20)
    function activateToken() public {
        // allow to get a refund if the phase is TGE over or if the main sale if over (over the timestamp)
        require(phase >= 4 || ((phase == 2 || phase == 3) && block.timestamp > mainsaleEnd));
        // cannot activate the token if the soft cap is not reached
        require(weiRaised >= weiSoftCap);

        // the total minted during the sale must represent 60% of the supply total
        uint256 realTotalSupply = token.totalSupply().mul(100).div(60);
        // Mint company tokens (20% of the )
        token.mint(COMPANY_ADDRESS, realTotalSupply.mul(20).div(100));
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
