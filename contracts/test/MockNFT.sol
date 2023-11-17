import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockNFT is ERC721 {

    constructor() public ERC721("Mock NFT", "MOCKNFT") {
        _mint(msg.sender, 1);
    }
}