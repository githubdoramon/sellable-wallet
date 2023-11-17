import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {

    constructor() public ERC20("Mock token", "MOCK") {
        _mint(msg.sender, 1000000);
    }
}