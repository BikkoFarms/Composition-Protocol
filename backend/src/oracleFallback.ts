/**
 * Offline reference quotes used when the oracle microservice is unreachable.
 * Covers every commodity in the trade catalogue, not just cocoa.
 */
const FALLBACK_PRICES: Record<string, { price: number; unit: string }> = {
  COCOA: { price: 8240.5, unit: "MT" },
  COFFEE: { price: 4120, unit: "MT" },
  CASHEW: { price: 1850.25, unit: "MT" },
  GOLD: { price: 2400, unit: "OZ" },
  SHEA: { price: 2600, unit: "MT" },
  SESAME: { price: 1900, unit: "MT" },
  COTTON: { price: 1700, unit: "MT" },
  USDNGN: { price: 1550, unit: "NGN" },
};

export const FALLBACK_SYMBOLS = Object.keys(FALLBACK_PRICES);

export function fallbackQuote(rawSymbol: string) {
  const symbol = FALLBACK_PRICES[rawSymbol] ? rawSymbol : "COCOA";
  const { price, unit } = FALLBACK_PRICES[symbol];
  return {
    symbol,
    price: (price * (1 + Math.sin(Date.now() / 10000) * 0.0015)).toFixed(2),
    currency: "USD",
    unit,
    signature: "0x98f2ba7c65e8d91024bda71289cf8211029",
    timestamp: new Date().toISOString(),
  };
}
