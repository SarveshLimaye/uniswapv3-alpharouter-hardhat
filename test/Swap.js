const { assert, expect } = require("chai");
const hre = require("hardhat");
const chai = require("chai");
const {
  AlphaRouter,
  SwapOptionsSwapRouter02,
  SwapType,
} = require("@uniswap/smart-order-router");
const ERC20_ABI = require("../abi.json");
const USDC_ABI = require("../usdc.json");
const WETH_ABI = require("../weth.json");
const { computePoolAddress, FeeAmount } = require("@uniswap/v3-sdk");
const {
  Token,
  CurrencyAmount,
  TradeType,
  Percent,
} = require("@uniswap/sdk-core");
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);

const V3_SWAP_ROUTER_ADDRESS = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";

const WETH_TOKEN = new Token(
  1,
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  18,
  "WETH9",
  "Wrapped Ether"
);

const USDC_TOKEN = new Token(
  1,
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  6,
  "USDC",
  "USD//C"
);

async function getSigner() {
  const [signer] = await hre.ethers.getSigners();
  return signer;
}

async function executeSwap(inputamount, options, router, signer) {
  const route = await router.route(
    CurrencyAmount.fromRawAmount(WETH_TOKEN, inputamount),
    USDC_TOKEN,
    TradeType.EXACT_INPUT,
    options
  );

  const tokenContract = new hre.ethers.Contract(
    WETH_TOKEN.address,
    ERC20_ABI,
    signer
  );

  const approvalAmount = hre.ethers.utils.parseUnits("10", 18).toString();

  const tokenApproval = await tokenContract.approve(
    V3_SWAP_ROUTER_ADDRESS,
    approvalAmount
  );

  console.log("tokenApproval hash " + tokenApproval.hash);

  await tokenApproval.wait(1);

  const txRes = await signer.sendTransaction({
    data: route?.methodParameters?.calldata,
    to: V3_SWAP_ROUTER_ADDRESS,
    value: route?.methodParameters?.value,
    from: signer.address,
    maxFeePerGas: 100000000000,
    maxPriorityFeePerGas: 100000000000,
  });

  console.log("txRes hash " + txRes.hash);

  await txRes.wait(1);
}

describe("Uniswap V3 Swap", function () {
  let signer;
  let provider;
  let router;
  let options;

  before(async function () {
    signer = await getSigner();
    provider = hre.ethers.provider;
    router = new AlphaRouter({ chainId: 1, provider: provider });
    options = {
      recipient: signer.address,
      slippageTolerance: new Percent(50, 10_000),
      deadline: Math.floor(Date.now() / 1000 + 1800),
      type: SwapType.SWAP_ROUTER_02,
    };
    const weth = new hre.ethers.Contract(WETH_TOKEN.address, WETH_ABI, signer);

    const tx = await weth.deposit({ value: hre.ethers.utils.parseEther("5") });

    await tx.wait(1);

    const wethBalance = await weth.balanceOf(signer.address);

    expect(parseFloat(hre.ethers.utils.formatEther(wethBalance))).to.eq(5.0);
  });

  it("Should perform a successful swap", async function () {
    const inputamount = hre.ethers.utils.parseEther("1").toString();
    console.log("inputamount" + inputamount);
    await executeSwap(inputamount, options, router, signer);

    const weth = new hre.ethers.Contract(WETH_TOKEN.address, WETH_ABI, signer);

    const usdc = new hre.ethers.Contract(USDC_TOKEN.address, ERC20_ABI, signer);

    const wethBalance = await weth.balanceOf(signer.address);

    console.log("wethBalance" + wethBalance);

    const usdcBalance = await usdc.balanceOf(signer.address);

    expect(parseFloat(hre.ethers.utils.formatEther(wethBalance))).to.be.above(
      3.9
    );

    expect(
      parseFloat(hre.ethers.utils.formatUnits(usdcBalance, 6))
    ).to.be.above(0);
  });
});
