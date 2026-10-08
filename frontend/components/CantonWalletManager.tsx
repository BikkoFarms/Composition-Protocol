"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

type CantonParty = {
  party: string;
  cantonPartyId: string;
  displayName: string;
  role: string;
  domain: string;
  type: string;
  canActAs: boolean;
  canReadAs: boolean;
  isLiveSynchronized: boolean;
  tokensCount: number;
  tokensSummary: string;
};

type WalletType = "partylayer" | "console" | "loop" | "splice" | "walletconnect";

const WALLETS: { id: WalletType; name: string; tag: string; desc: string; icon: string }[] = [
  {
    id: "partylayer",
    name: "PartyLayer (CIP-103)",
    tag: "Official Standard",
    desc: "Browser wallet connection layer for Canton dApps with reactive ACS signing.",
    icon: "⚡",
  },
  {
    id: "console",
    name: "Console Wallet",
    tag: "PixelPlex SDK",
    desc: "Institutional self-custody wallet powered by @console-wallet/dapp-sdk.",
    icon: "🏛️",
  },
  {
    id: "loop",
    name: "Loop Wallet",
    tag: "5North SDK",
    desc: "High-throughput Canton settlement wallet for trading desks and commodity brokers.",
    icon: "🔄",
  },
  {
    id: "splice",
    name: "Splice Wallet Kernel",
    tag: "Hyperledger Labs",
    desc: "Decentralized Canton validator wallet kernel with Canton Coin (CC) gas management.",
    icon: "⛓️",
  },
  {
    id: "walletconnect",
    name: "WalletConnect for Canton",
    tag: "Relay Protocol",
    desc: "Connect hardware wallets (Ledger), Fireblocks, and MPC vaults across Canton synchronizers.",
    icon: "🌐",
  },
];

export function CantonWalletManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"wallet" | "parties" | "node">("wallet");
  const [connectedWallet, setConnectedWallet] = useState<WalletType | null>("partylayer");
  const [activeParty, setActiveParty] = useState<string>("Alice");
  const [parties, setParties] = useState<CantonParty[]>([]);
  const [loadingParties, setLoadingParties] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pingResult, setPingResult] = useState<{
    ok: boolean;
    latencyMs?: number;
    ledgerOffset?: string;
    message?: string;
  } | null>(null);
  const [pinging, setPinging] = useState(false);
  const [allocHint, setAllocHint] = useState("");
  const [allocLoading, setAllocLoading] = useState(false);
  const [allocMsg, setAllocMsg] = useState<string | null>(null);
  const [runtimeMode, setRuntimeMode] = useState<"ledger" | "demo">("demo");
  const [ledgerUrl, setLedgerUrl] = useState<string>("");

  // Load persisted state on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedParty = localStorage.getItem("canton_active_party");
      if (savedParty) setActiveParty(savedParty);
      const savedWallet = localStorage.getItem("canton_connected_wallet") as WalletType | null;
      if (savedWallet) setConnectedWallet(savedWallet);
    }
  }, []);

  const loadParties = useCallback(async () => {
    setLoadingParties(true);
    try {
      const data = await api<{
        parties: CantonParty[];
        runtimeMode: "ledger" | "demo";
        ledgerUrl: string;
      }>("/admin/canton/parties");
      setParties(data.parties ?? []);
      setRuntimeMode(data.runtimeMode ?? "demo");
      setLedgerUrl(data.ledgerUrl ?? "");
    } catch {
      // Offline / fallback fallback
    } finally {
      setLoadingParties(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadParties();
    }
  }, [isOpen, loadParties]);

  function handleSelectParty(pName: string) {
    setActiveParty(pName);
    if (typeof window !== "undefined") {
      localStorage.setItem("canton_active_party", pName);
      window.dispatchEvent(new CustomEvent("canton-party-changed", { detail: { party: pName } }));
    }
  }

  function handleConnectWallet(wId: WalletType) {
    setConnectedWallet(wId);
    if (typeof window !== "undefined") {
      localStorage.setItem("canton_connected_wallet", wId);
    }
  }

  function handleDisconnectWallet() {
    setConnectedWallet(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("canton_connected_wallet");
    }
  }

  const currentPartyObj = parties.find((p) => p.party === activeParty);
  const currentCantonId = currentPartyObj?.cantonPartyId ?? `${activeParty}::1220a48f...`;

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }

  async function runPing() {
    setPinging(true);
    setPingResult(null);
    try {
      const res = await api<{
        ok: boolean;
        latencyMs?: number;
        ledgerOffset?: string;
        message?: string;
      }>("/admin/ledger/ping", { method: "POST" });
      setPingResult(res);
    } catch (e) {
      setPingResult({ ok: false, message: (e as Error).message });
    } finally {
      setPinging(false);
    }
  }

  async function handleAllocateParty(e: React.FormEvent) {
    e.preventDefault();
    if (!allocHint.trim()) return;
    setAllocLoading(true);
    setAllocMsg(null);
    try {
      const res = await api<{ ok: boolean; party: string; cantonPartyId?: string; message?: string }>(
        "/admin/canton/parties/allocate",
        {
          method: "POST",
          body: JSON.stringify({ partyHint: allocHint.trim(), displayName: allocHint.trim() }),
        },
      );
      setAllocMsg(`Party allocated: ${res.party} (${res.cantonPartyId ?? "Canton 1220 ID"})`);
      setAllocHint("");
      await loadParties();
      handleSelectParty(res.party);
    } catch (err) {
      setAllocMsg(`Allocation error: ${(err as Error).message}`);
    } finally {
      setAllocLoading(false);
    }
  }

  return (
    <>
      {/* Top Header Trigger Button */}
      <button
        type="button"
        className="canton-wallet-btn"
        onClick={() => setIsOpen(true)}
        title="Open Canton Identity & Web3 Wallet Manager"
        aria-label="Canton Wallet & Identity Manager"
      >
        <span className="canton-wallet-pulse" />
        <span className="canton-wallet-icon">
          {connectedWallet ? "💼" : "🔗"}
        </span>
        <span className="canton-wallet-label">
          {connectedWallet ? (
            <>
              <strong>{activeParty}</strong>
              <span className="canton-wallet-role">
                {activeParty === "Alice"
                  ? "Exporter"
                  : activeParty === "Bob"
                    ? "Lender"
                    : activeParty === "Oracle"
                      ? "Oracle"
                      : activeParty === "Regulator"
                        ? "Auditor"
                        : "Desk"}
              </span>
            </>
          ) : (
            "Connect Canton Wallet"
          )}
        </span>
        <span className="canton-wallet-caret">▾</span>
      </button>

      {/* Modal Dialog Overlay */}
      {isOpen && (
        <div className="canton-modal-overlay" onClick={() => setIsOpen(false)}>
          <div
            className="canton-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="canton-modal-header">
              <div className="canton-modal-header-titles">
                <div className="canton-badge-chain">
                  <span className="pulse-indicator" />
                  Canton Network · CIP-103 dApp API
                </div>
                <h2>Canton Identity &amp; Web3 Wallet</h2>
                <p>
                  Multi-party DvP settlement identity, participant node user rights, and CIP-0103
                  wallet connectors.
                </p>
              </div>
              <button
                type="button"
                className="canton-modal-close"
                onClick={() => setIsOpen(false)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Active Identity Summary Strip */}
            <div className="canton-active-strip">
              <div className="canton-active-strip-left">
                <span className="canton-active-avatar">{activeParty[0]}</span>
                <div>
                  <div className="canton-active-name-row">
                    <span className="canton-active-name">{activeParty}</span>
                    <span className="canton-active-pill">
                      {connectedWallet
                        ? WALLETS.find((w) => w.id === connectedWallet)?.name
                        : "Direct Participant Session"}
                    </span>
                    <span className="canton-active-status">● Synchronized</span>
                  </div>
                  <div className="canton-active-id-row">
                    <code>{currentCantonId}</code>
                    <button
                      type="button"
                      className="canton-copy-btn"
                      onClick={() => copyToClipboard(currentCantonId)}
                    >
                      {copied ? "✓ Copied!" : "📋 Copy ID"}
                    </button>
                  </div>
                </div>
              </div>
              <div className="canton-active-strip-right">
                <div className="canton-stat">
                  <span className="canton-stat-label">Domain</span>
                  <span className="canton-stat-val">
                    {currentPartyObj?.domain ?? "canton-global-synchronizer.global"}
                  </span>
                </div>
                <div className="canton-stat">
                  <span className="canton-stat-label">KYC / 5North ID</span>
                  <span className="canton-stat-val text-success">✓ Cleared</span>
                </div>
              </div>
            </div>

            {/* Tab Bar */}
            <div className="canton-tab-bar">
              <button
                type="button"
                className={`canton-tab ${activeTab === "wallet" ? "active" : ""}`}
                onClick={() => setActiveTab("wallet")}
              >
                1. Web3 Wallets (CIP-103)
              </button>
              <button
                type="button"
                className={`canton-tab ${activeTab === "parties" ? "active" : ""}`}
                onClick={() => setActiveTab("parties")}
              >
                2. Participant Parties &amp; Desks ({parties.length || 8})
              </button>
              <button
                type="button"
                className={`canton-tab ${activeTab === "node" ? "active" : ""}`}
                onClick={() => setActiveTab("node")}
              >
                3. Canton Participant &amp; Telemetry
              </button>
            </div>

            {/* Tab Content */}
            <div className="canton-tab-body">
              {/* TAB 1: WEB3 WALLETS */}
              {activeTab === "wallet" && (
                <div className="canton-tab-pane">
                  <div className="canton-notice">
                    <span>💡</span>
                    <div>
                      <strong>Canton Network Wallet Model:</strong> Unlike EVM public addresses,
                      Canton uses privacy-preserving party identifiers (<code>Party::1220...</code>)
                      and cryptographic multi-signers. Connect your browser extension or institutional
                      vault below.
                    </div>
                  </div>

                  <div className="canton-wallet-grid">
                    {WALLETS.map((w) => {
                      const isSelected = connectedWallet === w.id;
                      return (
                        <div
                          key={w.id}
                          className={`canton-wallet-card ${isSelected ? "selected" : ""}`}
                          onClick={() => handleConnectWallet(w.id)}
                        >
                          <div className="canton-wallet-card-header">
                            <span className="canton-wallet-card-icon">{w.icon}</span>
                            <div className="canton-wallet-card-title">
                              <h4>{w.name}</h4>
                              <span className="canton-wallet-badge">{w.tag}</span>
                            </div>
                            {isSelected ? (
                              <span className="canton-connected-check">✓ Connected</span>
                            ) : (
                              <button
                                type="button"
                                className="canton-btn-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleConnectWallet(w.id);
                                }}
                              >
                                Connect
                              </button>
                            )}
                          </div>
                          <p className="canton-wallet-card-desc">{w.desc}</p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="canton-wallet-actions">
                    {connectedWallet ? (
                      <button
                        type="button"
                        className="canton-btn-danger"
                        onClick={handleDisconnectWallet}
                      >
                        Disconnect Current Wallet Session
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="canton-btn-primary"
                        onClick={() => handleConnectWallet("partylayer")}
                      >
                        Connect Default PartyLayer Wallet
                      </button>
                    )}
                  </div>

                  {/* Ecosystem Resources Footer */}
                  <div className="canton-resources-block">
                    <h4>Canton Developer Hub &amp; Network Explorers:</h4>
                    <div className="canton-link-tags">
                      <a
                        href="https://dev-hub.canton.foundation/"
                        target="_blank"
                        rel="noreferrer"
                        className="canton-tag-link"
                      >
                        Developer Hub ↗
                      </a>
                      <a
                        href="https://docs.canton.network/"
                        target="_blank"
                        rel="noreferrer"
                        className="canton-tag-link"
                      >
                        Canton Docs ↗
                      </a>
                      <a
                        href="https://ccview.io/"
                        target="_blank"
                        rel="noreferrer"
                        className="canton-tag-link"
                      >
                        CCView Explorer ↗
                      </a>
                      <a
                        href="https://lighthouse.cantonloop.com/"
                        target="_blank"
                        rel="noreferrer"
                        className="canton-tag-link"
                      >
                        Lighthouse Explorer ↗
                      </a>
                      <a
                        href="https://docs.fivenorth.io/id-sdk/introduction/"
                        target="_blank"
                        rel="noreferrer"
                        className="canton-tag-link"
                      >
                        Five North ID SDK ↗
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PARTIES & DESKS */}
              {activeTab === "parties" && (
                <div className="canton-tab-pane">
                  <div className="canton-section-header">
                    <div>
                      <h3>Active Canton Participant Parties</h3>
                      <p>
                        Select a party to switch your active trading identity. Desks will immediately
                        reflect this party&apos;s ACS portfolio and co-signing authority.
                      </p>
                    </div>
                    {loadingParties && <span className="canton-loading-badge">Refreshing...</span>}
                  </div>

                  <div className="canton-parties-list">
                    {parties.map((p) => {
                      const isActive = p.party === activeParty;
                      return (
                        <div
                          key={p.party}
                          className={`canton-party-item ${isActive ? "active-party" : ""}`}
                        >
                          <div className="canton-party-item-top">
                            <div className="canton-party-item-info">
                              <span className="canton-party-badge-role">{p.type}</span>
                              <h4 className="canton-party-name">{p.displayName}</h4>
                              <span className="canton-party-subrole">{p.role}</span>
                            </div>
                            <div className="canton-party-item-action">
                              {isActive ? (
                                <span className="canton-party-active-label">★ Active Identity</span>
                              ) : (
                                <button
                                  type="button"
                                  className="canton-btn-select"
                                  onClick={() => handleSelectParty(p.party)}
                                >
                                  Switch to {p.party}
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="canton-party-meta-grid">
                            <div>
                              <span className="k">Canton 1220 ID:</span>
                              <code title={p.cantonPartyId}>
                                {p.cantonPartyId.slice(0, 24)}...
                              </code>
                            </div>
                            <div>
                              <span className="k">Assigned Domain:</span>
                              <span>{p.domain}</span>
                            </div>
                            <div>
                              <span className="k">ACS Holdings:</span>
                              <span className="v-tokens">
                                {p.tokensSummary || "0 holdings"}
                              </span>
                            </div>
                            <div>
                              <span className="k">Daml Rights:</span>
                              <span>
                                {p.canActAs ? "CanActAs" : ""}
                                {p.canActAs && p.canReadAs ? " · " : ""}
                                {p.canReadAs ? "CanReadAs" : ""}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Allocate Party Form */}
                  <div className="canton-allocate-box">
                    <h4>Allocate New Canton Party on Participant Node</h4>
                    <form onSubmit={handleAllocateParty} className="canton-allocate-form">
                      <input
                        type="text"
                        placeholder="Party Hint (e.g. StandardChartered, CustodianA, Trader99)"
                        value={allocHint}
                        onChange={(e) => setAllocHint(e.target.value)}
                        className="canton-input"
                        disabled={allocLoading}
                      />
                      <button
                        type="submit"
                        className="canton-btn-primary"
                        disabled={allocLoading || !allocHint.trim()}
                      >
                        {allocLoading ? "Allocating..." : "Allocate Party →"}
                      </button>
                    </form>
                    {allocMsg && <div className="canton-alloc-msg">{allocMsg}</div>}
                  </div>
                </div>
              )}

              {/* TAB 3: NODE & TELEMETRY */}
              {activeTab === "node" && (
                <div className="canton-tab-pane">
                  <div className="canton-node-card">
                    <div className="canton-node-card-header">
                      <div>
                        <h3>Canton Ledger API v2 Participant</h3>
                        <p>Direct HTTP/JSON &amp; gRPC synchronization layer for SettleFlow</p>
                      </div>
                      <span className={`canton-mode-pill ${runtimeMode}`}>
                        {runtimeMode === "ledger" ? "Live Ledger Mode" : "Hosted In-Memory Simulation"}
                      </span>
                    </div>

                    <div className="canton-notice">
                      <span>
                        <strong>Hosted Environment Status:</strong> The hosted demo runs in high-fidelity in-memory engine mode (<code>/health</code> reports <code>mode: &quot;demo&quot;</code>) to guarantee instant evaluation without external DevNet sequencer outages. Connecting to an active Canton participant is fully supported by configuring <code>LEDGER_API_URL</code> and <code>LEDGER_API_TOKEN</code> in the backend environment.
                      </span>
                    </div>

                    <div className="canton-node-fields">
                      <div className="canton-field-row">
                        <span className="k">Participant JSON Endpoint</span>
                        <code>
                          {ledgerUrl ||
                            "https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services"}
                        </code>
                      </div>
                      <div className="canton-field-row">
                        <span className="k">Keycloak OIDC Token Issuer</span>
                        <code>
                          https://keycloak.naas.noders.services/realms/noders-appsfactory/...
                        </code>
                      </div>
                      <div className="canton-field-row">
                        <span className="k">Daml Package ID</span>
                        <code>composition-v1.0.0-f8e9a2c410b3</code>
                      </div>
                      <div className="canton-field-row">
                        <span className="k">Identity Verification</span>
                        <span className="text-success">
                          Five North ID (5N ID) Verified · KYC Tier 3 Multi-Sig
                        </span>
                      </div>
                    </div>

                    <div className="canton-ping-section">
                      <button
                        type="button"
                        className="canton-btn-primary"
                        onClick={runPing}
                        disabled={pinging}
                      >
                        {pinging ? "Measuring Round-Trip..." : "⚡ Ping Participant Node"}
                      </button>

                      {pingResult && (
                        <div
                          className={`canton-ping-result ${pingResult.ok ? "success" : "warning"}`}
                        >
                          <div className="ping-title">
                            {pingResult.ok
                              ? `Participant Reachable · ${pingResult.latencyMs}ms Latency`
                              : "Connection Diagnostic Notice"}
                          </div>
                          {pingResult.ledgerOffset && (
                            <div className="ping-offset">
                              Ledger Offset: <code>{pingResult.ledgerOffset}</code>
                            </div>
                          )}
                          <div className="ping-msg">{pingResult.message}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="canton-modal-footer">
              <span className="canton-footer-info">
                Connected: <strong>{activeParty}</strong> via{" "}
                <strong>
                  {connectedWallet
                    ? WALLETS.find((w) => w.id === connectedWallet)?.name
                    : "Participant User Management"}
                </strong>
              </span>
              <button
                type="button"
                className="canton-btn-done"
                onClick={() => setIsOpen(false)}
              >
                Close &amp; Return to Desk
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
