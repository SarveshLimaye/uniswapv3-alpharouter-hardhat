const {
  AlphaRouter,
  SwapOptionsSwapRouter02,
  SwapType,
} = require("@uniswap/smart-order-router");
const ERC20_ABI = require("../abi.json");
const { computePoolAddress, FeeAmount } = require("@uniswap/v3-sdk");
const {
  Token,
  CurrencyAmount,
  TradeType,
  Percent,
} = require("@uniswap/sdk-core");
const { ethers, BigNumber } = require("ethers");
require("dotenv").config();
const JSBI = require("jsbi");

const V3_SWAP_ROUTER_ADDRESS = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";
const WALLET_ADDRESS = process.env.WALLET_ADDRESS || "";
const GOERLI_RPC_URL = process.env.GOERLI_RPC_URL || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

const provider = new ethers.providers.JsonRpcProvider(GOERLI_RPC_URL); //Goerli

const chainId = 5;
const router = new AlphaRouter({ chainId: chainId, provider: provider });

const options = {
  recipient: WALLET_ADDRESS,
  slippageTolerance: new Percent(50, 10_000),
  deadline: Math.floor(Date.now() / 1000 + 1800),
  type: SwapType.SWAP_ROUTER_02,
};

const WETH_TOKEN = new Token(
  5,
  "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
  18,
  "WETH",
  "Wrapped Ether"
);

const USDC_TOKEN = new Token(
  5,
  "0x2f3A40A3db8a7e3D09B0adfEfbCe4f6F81927557",
  6,
  "USDC",
  "USD//C"
);

async function main() {
  const rawTokenAmountIn = fromReadableAmount(0.001, WETH_TOKEN.decimals);

  const route = await router.route(
    CurrencyAmount.fromRawAmount(WETH_TOKEN, rawTokenAmountIn),
    USDC_TOKEN,
    TradeType.EXACT_INPUT,
    options
  );

  console.log("Route is " + JSON.stringify(route));

  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const tokenContract = new ethers.Contract(
    WETH_TOKEN.address,
    ERC20_ABI,
    wallet
  );

  const approvalAmount = ethers.utils.parseUnits("1", 18).toString();

  const tokenApproval = await tokenContract.approve(
    V3_SWAP_ROUTER_ADDRESS,
    approvalAmount
  );

  await tokenApproval.wait(1);

  console.log("Successfully approved token" + tokenApproval.hash);

  console.log("Sending transaction...");

  const txRes = await wallet.sendTransaction({
    data: route?.methodParameters?.calldata,
    to: V3_SWAP_ROUTER_ADDRESS,
    value: route?.methodParameters?.value,
    from: WALLET_ADDRESS,
    maxFeePerGas: 100000000000,
    maxPriorityFeePerGas: 100000000000,
  });

  await txRes.wait(1);
  console.log("Successfully sent transaction . Hash is " + txRes.hash);
}

function fromReadableAmount(amount, decimals) {
  const extraDigits = Math.pow(10, countDecimals(amount));
  const adjustedAmount = amount * extraDigits;
  return JSBI.divide(
    JSBI.multiply(
      JSBI.BigInt(adjustedAmount),
      JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(decimals))
    ),
    JSBI.BigInt(extraDigits)
  );
}

function countDecimals(x) {
  if (Math.floor(x) === x) {
    return 0;
  }
  return x.toString().split(".")[1].length || 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
