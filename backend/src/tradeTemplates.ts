/**
 * Trade catalogue for the settlement desk.
 *
 * Each template is a multi-leg DvP the demo store can mint inventory for and
 * propose in one call. Roles stay fixed so privacy views remain comparable:
 *   Alice  = exporter / seller (proposer)
 *   Bob    = lender / buyer
 *   Oracle = inspector / sponsor / insurer
 */
import type { PartyId } from "./demoStore.js";

export type TemplateLeg = {
  legId: string;
  label: string;
  instrumentId: string;
  amount: string;
  provider: PartyId;
  receiver: PartyId;
};

export type TradeTemplate = {
  id: string;
  name: string;
  commodity: string;
  region: string;
  /** Oracle symbol used for spot price lookups. */
  oracleSymbol: string;
  summary: string;
  description: string;
  counterparties: PartyId[];
  legs: TemplateLeg[];
  /** USD reference prices per instrument unit, used for collateral cover. */
  referencePrices?: Record<string, number>;
};

export const TRADE_TEMPLATES: TradeTemplate[] = [
  {
    id: "cocoa",
    name: "Cocoa export finance",
    commodity: "Cocoa",
    region: "Ghana · Côte d'Ivoire",
    oracleSymbol: "COCOA",
    summary: "Exporter pledges CBTC collateral, lender advances USDCx, sponsor posts cETH.",
    description:
      "African cocoa export — CBTC collateral + USDCx cash + cETH sponsor leg",
    counterparties: ["Bob", "Oracle"],
    legs: [
      { legId: "collateral", label: "Collateral", instrumentId: "CBTC", amount: "2.0", provider: "Alice", receiver: "Bob" },
      { legId: "cash", label: "Cash advance", instrumentId: "USDCx", amount: "10000.0", provider: "Bob", receiver: "Alice" },
      { legId: "sponsor", label: "Sponsor asset", instrumentId: "cETH", amount: "1.5", provider: "Oracle", receiver: "Bob" },
    ],
    referencePrices: { CBTC: 65000, USDCx: 1 },
  },
  {
    id: "coffee",
    name: "Coffee pre-export",
    commodity: "Coffee",
    region: "Ethiopia · Kenya",
    oracleSymbol: "COFFEE",
    summary: "Tokenized warehouse receipt for 20 MT green coffee against a USDCx advance.",
    description:
      "Ethiopian coffee pre-export — COFFEE-WR receipt + USDCx advance + USDCx inspection bond",
    counterparties: ["Bob", "Oracle"],
    legs: [
      { legId: "receipt", label: "Warehouse receipt", instrumentId: "COFFEE-WR", amount: "20.0", provider: "Alice", receiver: "Bob" },
      { legId: "cash", label: "Cash advance", instrumentId: "USDCx", amount: "64000.0", provider: "Bob", receiver: "Alice" },
      { legId: "inspection", label: "Inspection bond", instrumentId: "USDCx", amount: "750.0", provider: "Oracle", receiver: "Bob" },
    ],
    referencePrices: { "COFFEE-WR": 4120, USDCx: 1 },
  },
  {
    id: "cashew",
    name: "Raw cashew sale",
    commodity: "Cashew",
    region: "Côte d'Ivoire · Nigeria",
    oracleSymbol: "CASHEW",
    summary: "40 MT raw cashew nuts delivered against USDCx, with a Canton Coin sponsor leg.",
    description:
      "Raw cashew nut sale — CASHEW-WR receipt + USDCx payment + CC sponsor leg",
    counterparties: ["Bob", "Oracle"],
    legs: [
      { legId: "receipt", label: "Warehouse receipt", instrumentId: "CASHEW-WR", amount: "40.0", provider: "Alice", receiver: "Bob" },
      { legId: "cash", label: "Payment", instrumentId: "USDCx", amount: "70000.0", provider: "Bob", receiver: "Alice" },
      { legId: "sponsor", label: "Sponsor asset", instrumentId: "CC", amount: "2500.0", provider: "Oracle", receiver: "Bob" },
    ],
    referencePrices: { "CASHEW-WR": 1850, USDCx: 1 },
  },
  {
    id: "gold",
    name: "Gold doré purchase",
    commodity: "Gold",
    region: "Ghana · Mali",
    oracleSymbol: "GOLD",
    summary: "Tokenized gold (XAUt) delivered against USDCx, with insurer cover in cETH.",
    description:
      "Gold doré purchase — XAUt gold + USDCx payment + cETH insurance leg",
    counterparties: ["Bob", "Oracle"],
    legs: [
      { legId: "metal", label: "Gold delivery", instrumentId: "XAUt", amount: "12.0", provider: "Alice", receiver: "Bob" },
      { legId: "cash", label: "Payment", instrumentId: "USDCx", amount: "28500.0", provider: "Bob", receiver: "Alice" },
      { legId: "insurance", label: "Insurance cover", instrumentId: "cETH", amount: "0.75", provider: "Oracle", receiver: "Bob" },
    ],
    referencePrices: { XAUt: 2400, USDCx: 1 },
  },
  {
    id: "shea",
    name: "Shea butter export",
    commodity: "Shea",
    region: "Burkina Faso · Ghana",
    oracleSymbol: "SHEA",
    summary: "15 MT shea butter receipt against a USDCx advance plus an inspection bond.",
    description:
      "Shea butter export — SHEA-WR receipt + USDCx advance + USDCx inspection bond",
    counterparties: ["Bob", "Oracle"],
    legs: [
      { legId: "receipt", label: "Warehouse receipt", instrumentId: "SHEA-WR", amount: "15.0", provider: "Alice", receiver: "Bob" },
      { legId: "cash", label: "Cash advance", instrumentId: "USDCx", amount: "33000.0", provider: "Bob", receiver: "Alice" },
      { legId: "inspection", label: "Inspection bond", instrumentId: "USDCx", amount: "400.0", provider: "Oracle", receiver: "Bob" },
    ],
    referencePrices: { "SHEA-WR": 2600, USDCx: 1 },
  },
  {
    id: "sesame",
    name: "Sesame seed shipment",
    commodity: "Sesame",
    region: "Nigeria · Sudan",
    oracleSymbol: "SESAME",
    summary: "25 MT sesame seed receipt delivered against USDCx payment.",
    description:
      "Sesame seed shipment — SESAME-WR receipt + USDCx payment + cETH sponsor leg",
    counterparties: ["Bob", "Oracle"],
    legs: [
      { legId: "receipt", label: "Warehouse receipt", instrumentId: "SESAME-WR", amount: "25.0", provider: "Alice", receiver: "Bob" },
      { legId: "cash", label: "Payment", instrumentId: "USDCx", amount: "40000.0", provider: "Bob", receiver: "Alice" },
      { legId: "sponsor", label: "Sponsor asset", instrumentId: "cETH", amount: "0.5", provider: "Oracle", receiver: "Bob" },
    ],
    referencePrices: { "SESAME-WR": 1900, USDCx: 1 },
  },
  {
    id: "cotton",
    name: "Cotton lint forward",
    commodity: "Cotton",
    region: "Benin · Mali",
    oracleSymbol: "COTTON",
    summary: "50 MT cotton lint receipt delivered against USDCx on settlement day.",
    description:
      "Cotton lint forward — COTTON-WR receipt + USDCx payment + USDCx grading bond",
    counterparties: ["Bob", "Oracle"],
    legs: [
      { legId: "receipt", label: "Warehouse receipt", instrumentId: "COTTON-WR", amount: "50.0", provider: "Alice", receiver: "Bob" },
      { legId: "cash", label: "Payment", instrumentId: "USDCx", amount: "78000.0", provider: "Bob", receiver: "Alice" },
      { legId: "grading", label: "Grading bond", instrumentId: "USDCx", amount: "600.0", provider: "Oracle", receiver: "Bob" },
    ],
    referencePrices: { "COTTON-WR": 1700, USDCx: 1 },
  },
  {
    id: "fx-ngn",
    name: "Naira ↔ dollar FX swap",
    commodity: "FX",
    region: "Nigeria",
    oracleSymbol: "USDNGN",
    summary: "Two-party FX: exporter swaps cNGN for USDCx. No third party needed.",
    description: "Exporter FX conversion — cNGN for USDCx (2-leg swap)",
    counterparties: ["Bob"],
    legs: [
      { legId: "naira", label: "Naira leg", instrumentId: "cNGN", amount: "15500000.0", provider: "Alice", receiver: "Bob" },
      { legId: "dollar", label: "Dollar leg", instrumentId: "USDCx", amount: "10000.0", provider: "Bob", receiver: "Alice" },
    ],
  },
];

export const DEFAULT_TEMPLATE_ID = "cocoa";

export function getTemplate(id?: string): TradeTemplate {
  const key = (id ?? DEFAULT_TEMPLATE_ID).toLowerCase();
  const t = TRADE_TEMPLATES.find((x) => x.id === key);
  if (!t) {
    throw new Error(
      `unknown trade template "${id}" — choose one of: ${TRADE_TEMPLATES.map((x) => x.id).join(", ")}`,
    );
  }
  return t;
}
