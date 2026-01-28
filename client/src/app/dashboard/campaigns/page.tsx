"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  addRecipients,
  closeCampaign,
  createCampaign,
  checkFunding,
  deleteCampaign,
  getCampaignForEdit,
  listCampaigns,
  replaceRecipients,
  updateCampaign,
  uploadCampaignImage,
  type CampaignSummary,
  type CampaignTheme,
  type FundingStatus,
} from "@/lib/campaign";
import type { DepositEstimate, PrivacyCashContext, WalletProvider, WithdrawEstimate } from "@/lib/privacy-cash";

const filters = ["All", "Payout", "Escrow"];
const EXTRA_DEPOSIT_BUFFER_LAMPORTS = 200_000;

const themeDefaults: CampaignTheme = {
  primary: "#0f172a",
  secondary: "#94a3b8",
  background: "#f8fafc",
};

type PrivacyCashModule = typeof import("@/lib/privacy-cash");

let privacyCashModulePromise: Promise<PrivacyCashModule> | null = null;

const loadPrivacyCashModule = () => {
  if (!privacyCashModulePromise) {
    privacyCashModulePromise = import("@/lib/privacy-cash");
  }
  return privacyCashModulePromise;
};

export default function CampaignsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("All");
  const [listStatus, setListStatus] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [replaceRecipientsEnabled, setReplaceRecipientsEnabled] = useState(false);
  const [editParticipantCount, setEditParticipantCount] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "payout",
    authMethod: "email",
    payoutAmount: "",
    maxClaims: "",
    expiresAt: "",
    winnersDeadline: "",
    recipients: "",
    refundAddress: "",
  });
  const [theme, setTheme] = useState<CampaignTheme>(themeDefaults);
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [createdCampaign, setCreatedCampaign] = useState<{
    id: string;
    fundingAddress: string;
    totalRequired: number;
  } | null>(null);
  const [funding, setFunding] = useState<FundingStatus | null>(null);
  const [fundingLoading, setFundingLoading] = useState(false);
  const [copiedFunding, setCopiedFunding] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [wallet, setWallet] = useState<WalletProvider | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [pcContext, setPcContext] = useState<PrivacyCashContext | null>(null);
  const [pcBalance, setPcBalance] = useState<number | null>(null);
  const [pcStatus, setPcStatus] = useState<string | null>(null);
  const [depositTx, setDepositTx] = useState<string | null>(null);
  const [withdrawTx, setWithdrawTx] = useState<string | null>(null);
  const [pcLoading, setPcLoading] = useState(false);
  const [withdrawEstimate, setWithdrawEstimate] = useState<WithdrawEstimate | null>(null);
  const [depositEstimate, setDepositEstimate] = useState<DepositEstimate | null>(null);
  const [depositBufferLamports, setDepositBufferLamports] = useState<number>(0);
  const [depositLoading, setDepositLoading] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    listCampaigns()
      .then((items) => {
        if (isMounted) setCampaigns(items);
      })
      .catch(() => {
        if (isMounted) setCampaigns([]);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (searchParams.get("create") !== "1") return;
    setShowCreate(true);
    setStep(1);
    setStatus(null);
    setEditingCampaignId(null);
    setReplaceRecipientsEnabled(false);
    setEditParticipantCount(null);
    setCreatedCampaign(null);
    setFunding(null);
    setWallet(null);
    setWalletError(null);
    setPcContext(null);
    setPcBalance(null);
    setPcStatus(null);
    setDepositTx(null);
    setWithdrawTx(null);
    setWithdrawEstimate(null);
    setDepositEstimate(null);
    setDepositBufferLamports(0);
  }, [searchParams]);

  useEffect(() => {
    if (imageFile) {
      const objectUrl = URL.createObjectURL(imageFile);
      setPreview(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
    setPreview(imageUrl || null);
  }, [imageFile, imageUrl]);

  useEffect(() => {
    let active = true;
    if (!createdCampaign) {
      setWithdrawEstimate(null);
      setDepositEstimate(null);
      setDepositBufferLamports(0);
      return;
    }
    (async () => {
      try {
        const { getDepositEstimate, getDepositRentBufferLamports, getWithdrawEstimate } =
          await loadPrivacyCashModule();
        let rentBuffer = 0;
        try {
          rentBuffer = await getDepositRentBufferLamports(process.env.NEXT_PUBLIC_SOLANA_RPC_URL);
        } catch {
          rentBuffer = 0;
        }
        let deposit: DepositEstimate | null = null;
        rentBuffer += EXTRA_DEPOSIT_BUFFER_LAMPORTS;
        let targetLamports = createdCampaign.totalRequired + rentBuffer;
        try {
          deposit = await getDepositEstimate(targetLamports);
          if (deposit.depositLamports > 0) {
            targetLamports = deposit.depositLamports;
          }
        } catch {
          deposit = null;
        }
        let withdraw: WithdrawEstimate | null = null;
        try {
          withdraw = await getWithdrawEstimate(targetLamports);
        } catch {
          withdraw = null;
        }
        if (active) {
          setDepositBufferLamports(rentBuffer);
          setDepositEstimate(deposit);
          setWithdrawEstimate(withdraw);
        }
      } catch {
        if (active) {
          setDepositBufferLamports(0);
          setDepositEstimate(null);
          setWithdrawEstimate(null);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [createdCampaign]);

  const filteredCampaigns = useMemo(() => {
    if (filter === "All") return campaigns;
    const type = filter.toLowerCase();
    return campaigns.filter((campaign) => campaign.type === type);
  }, [campaigns, filter]);

  const parseRecipients = () =>
    form.recipients
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean);

  const toLamports = (value: string) => Math.round(Number(value) * 1e9);

  const parseLocalDateTime = (value: string) => {
    if (!value) return null;
    const [datePart, timePart] = value.split("T");
    if (!datePart || !timePart) return null;
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute] = timePart.split(":").map(Number);
    if ([year, month, day, hour, minute].some((part) => Number.isNaN(part))) return null;
    return new Date(year, month - 1, day, hour, minute, 0);
  };

  const formatLocalDateTime = (timestamp?: number) => {
    if (!timestamp) return "";
    const date = new Date(timestamp * 1000);
    const pad = (value: number) => value.toString().padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`;
  };

  const formatSolInput = (lamports: number) => {
    const value = lamports / 1e9;
    const fixed = value.toFixed(9);
    return fixed.replace(/\.?0+$/, "");
  };

  const recipientsList = useMemo(() => parseRecipients(), [form.recipients]);
  const isEditing = editingCampaignId !== null;
  const formatSol = (lamports: number) =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 9,
    }).format(lamports / 1e9);
  const campaignLink = useMemo(() => {
    if (!createdCampaign || typeof window === "undefined") return "";
    return `${window.location.origin}/claim/${createdCampaign.id}`;
  }, [createdCampaign]);
  const requiredLamports = funding?.totalRequired ?? createdCampaign?.totalRequired ?? 0;
  const campaignTargetLamports = requiredLamports + depositBufferLamports;
  const depositFeeLamports = depositEstimate?.feeLamports ?? 0;
  const campaignDepositLamports = depositEstimate?.depositLamports ?? campaignTargetLamports;
  const withdrawTargetLamports = withdrawEstimate?.requestedLamports ?? campaignDepositLamports;
  const withdrawFeeLamports = withdrawEstimate?.feeLamports ?? 0;
  const withdrawNetLamports = withdrawEstimate?.netLamports ?? campaignDepositLamports;
  const creatorDepositLamports =
    withdrawTargetLamports > 0 ? withdrawTargetLamports : campaignDepositLamports;
  const fundingWarning = funding?.warnings?.length ? funding.warnings.join(" | ") : null;
  const hasPrivacyBalance =
    !!createdCampaign && pcBalance !== null && pcBalance >= creatorDepositLamports;
  const authHint = useMemo(() => {
    switch (form.authMethod) {
      case "email":
        return {
          placeholder: "sam@gmail.com\naustin@domain.com",
          helper: "Enter emails separated by commas or new lines.",
        };
      case "twitter":
        return {
          placeholder: "chigozzdev\nsammy",
          helper: "Enter X usernames separated by commas or new lines.",
        };
      case "github":
        return {
          placeholder: "octocat\nsammy",
          helper: "Enter GitHub usernames separated by commas or new lines.",
        };
      case "discord":
        return {
          placeholder: "sammy\nchigozzdev",
          helper: "Enter Discord usernames separated by commas or new lines.",
        };
      case "telegram":
        return {
          placeholder: "sammy\nchigozzdev",
          helper: "Enter Telegram usernames separated by commas or new lines.",
        };
      default:
        return {
          placeholder: "identifier",
          helper: "Enter identifiers separated by commas or new lines.",
        };
    }
  }, [form.authMethod]);

  const validateBasics = () => {
    if (!form.name.trim()) {
      setStatus("Campaign name is required.");
      return false;
    }
    const payoutSol = Number(form.payoutAmount);
    if (!form.payoutAmount || Number.isNaN(payoutSol) || payoutSol <= 0) {
      setStatus("Payout amount is required.");
      return false;
    }
    if (toLamports(form.payoutAmount) <= 0) {
      setStatus("Payout amount is too small.");
      return false;
    }
    if (!form.maxClaims || Number.isNaN(Number(form.maxClaims))) {
      setStatus("Max claims is required.");
      return false;
    }
    if (!form.expiresAt) {
      setStatus("Expiration date is required.");
      return false;
    }
    const expiresDate = parseLocalDateTime(form.expiresAt);
    if (!expiresDate || Number.isNaN(expiresDate.getTime())) {
      setStatus("Expiration date is invalid.");
      return false;
    }
    if (expiresDate.getTime() <= Date.now()) {
      setStatus("Expiration date must be in the future.");
      return false;
    }
    if (form.type === "escrow" && form.winnersDeadline) {
      const winnersDate = parseLocalDateTime(form.winnersDeadline);
      if (!winnersDate || Number.isNaN(winnersDate.getTime())) {
        setStatus("Winners deadline is invalid.");
        return false;
      }
      if (winnersDate.getTime() >= expiresDate.getTime()) {
        setStatus("Winners deadline must be before expiration.");
        return false;
      }
    }
    const recipients = parseRecipients();
    if (!isEditing && !recipients.length) {
      setStatus("Add at least one recipient.");
      return false;
    }
    if (isEditing && replaceRecipientsEnabled && !recipients.length) {
      setStatus("Add at least one recipient to replace.");
      return false;
    }
    if (isEditing && !replaceRecipientsEnabled && form.recipients && !recipients.length) {
      setStatus("Add at least one recipient.");
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (!validateBasics()) return;
    setStatus(null);
    setStep(2);
  };

  const handleClose = () => {
    setShowCreate(false);
    setStep(1);
    setStatus(null);
    setEditingCampaignId(null);
    setEditLoading(false);
    setReplaceRecipientsEnabled(false);
    setEditParticipantCount(null);
    setCreatedCampaign(null);
    setFunding(null);
    setCopiedFunding(false);
    setCopiedLink(false);
    setWallet(null);
    setWalletError(null);
    setPcContext(null);
    setPcBalance(null);
    setPcStatus(null);
    setDepositTx(null);
    setWithdrawTx(null);
    setPcLoading(false);
    setWithdrawEstimate(null);
    setDepositEstimate(null);
    setDepositBufferLamports(0);
    setDepositLoading(false);
    setWithdrawLoading(false);
    if (searchParams.get("create") === "1") {
      router.replace("/dashboard/campaigns");
    }
  };

  const handleEditCampaign = async (campaignId: string) => {
    setShowCreate(true);
    setStep(1);
    setStatus("Loading campaign...");
    setEditingCampaignId(campaignId);
    setEditLoading(true);
    setReplaceRecipientsEnabled(false);
    setCreatedCampaign(null);
    setFunding(null);
    setCopiedFunding(false);
    setCopiedLink(false);
    setWallet(null);
    setWalletError(null);
    setPcContext(null);
    setPcBalance(null);
    setPcStatus(null);
    setDepositTx(null);
    setWithdrawTx(null);
    setPcLoading(false);
    setWithdrawEstimate(null);
    setDepositEstimate(null);
    setDepositBufferLamports(0);
    setDepositLoading(false);
    setWithdrawLoading(false);

    try {
      const result = await getCampaignForEdit(campaignId);
      const campaign = result.campaign;
      setForm({
        name: campaign.name || "",
        description: campaign.description || "",
        type: campaign.type,
        authMethod: campaign.authMethod,
        payoutAmount: formatSolInput(campaign.payoutAmount),
        maxClaims: campaign.maxClaims.toString(),
        expiresAt: formatLocalDateTime(campaign.expiresAt),
        winnersDeadline: formatLocalDateTime(campaign.winnersDeadline),
        recipients: "",
        refundAddress: campaign.refundAddress || "",
      });
      setTheme({ ...themeDefaults, ...(campaign.theme || {}) });
      setImageFile(null);
      setImageUrl(campaign.imageUrl || "");
      setEditParticipantCount(campaign.participantCount ?? null);
      setCreatedCampaign({
        id: campaign.id,
        fundingAddress: result.fundingAddress,
        totalRequired: result.totalRequired,
      });
      setStatus(null);
      await refreshFunding(campaignId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load campaign.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    const confirmed = window.confirm(
      "Delete this campaign? This cannot be undone and is only allowed for pending or closed campaigns."
    );
    if (!confirmed) return;
    setListStatus(null);
    try {
      await deleteCampaign(campaignId);
      const updated = await listCampaigns();
      setCampaigns(updated);
      setListStatus("Campaign deleted.");
    } catch (error) {
      setListStatus(error instanceof Error ? error.message : "Unable to delete campaign.");
    }
  };

  const handleCloseCampaign = async (campaignId: string) => {
    const reclaimAddress = window.prompt("Enter a wallet address to reclaim remaining funds:");
    if (!reclaimAddress) return;
    setListStatus(null);
    try {
      const result = await closeCampaign(campaignId, reclaimAddress.trim());
      const updated = await listCampaigns();
      setCampaigns(updated);
      if (result.reclaimedAmount > 0) {
        setListStatus(`Campaign closed. Reclaimed ${formatSol(result.reclaimedAmount)} SOL.`);
      } else {
        setListStatus("Campaign closed.");
      }
    } catch (error) {
      setListStatus(error instanceof Error ? error.message : "Unable to close campaign.");
    }
  };

  const refreshFunding = async (campaignId: string) => {
    setFundingLoading(true);
    try {
      const result = await checkFunding(campaignId);
      setFunding(result);
      setCreatedCampaign((prev) => {
        if (!prev || prev.id !== campaignId) return prev;
        return { ...prev, totalRequired: result.totalRequired };
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to refresh funding.");
    } finally {
      setFundingLoading(false);
    }
  };

  const copyToClipboard = async (value: string, setCopied: (state: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleCreateCampaign = async () => {
    if (!validateBasics()) return;
    const recipients = parseRecipients();

    setLoading(true);
    setStatus(null);
    try {
      const expiresDate = parseLocalDateTime(form.expiresAt);
      if (!expiresDate) {
        setStatus("Expiration date is invalid.");
        return;
      }
      const expiresAt = Math.floor(expiresDate.getTime() / 1000);
      const winnersDeadlineValue =
        form.type === "escrow"
          ? (() => {
              if (!form.winnersDeadline) return null;
              const winnersDate = parseLocalDateTime(form.winnersDeadline);
              return winnersDate ? Math.floor(winnersDate.getTime() / 1000) : null;
            })()
          : null;
      const payoutAmountLamports = toLamports(form.payoutAmount);

      if (editingCampaignId) {
        const result = await updateCampaign(editingCampaignId, {
          name: form.name.trim(),
          description: form.description.trim(),
          payoutAmount: payoutAmountLamports,
          maxClaims: Number(form.maxClaims),
          expiresAt,
          winnersDeadline: winnersDeadlineValue,
          refundAddress: form.refundAddress.trim() || null,
          theme,
        });

        if (imageFile || imageUrl) {
          await uploadCampaignImage(editingCampaignId, { file: imageFile, imageUrl });
        }

        if (replaceRecipientsEnabled) {
          if (!recipients.length) {
            throw new Error("Add at least one recipient to replace.");
          }
          await replaceRecipients(editingCampaignId, recipients);
        } else if (recipients.length) {
          await addRecipients(editingCampaignId, recipients);
        }

        const updated = await listCampaigns();
        setCampaigns(updated);
        setCreatedCampaign({
          id: editingCampaignId,
          fundingAddress: result.fundingAddress,
          totalRequired: result.totalRequired,
        });
        setStatus(null);
        setStep(3);
        await refreshFunding(editingCampaignId);
      } else {
        const winnersDeadline =
          form.type === "escrow" && winnersDeadlineValue !== null ? winnersDeadlineValue : undefined;
        const result = await createCampaign({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          type: form.type as "payout" | "escrow",
          authMethod: form.authMethod as "email" | "twitter" | "discord" | "github" | "telegram",
          payoutAmount: payoutAmountLamports,
          maxClaims: Number(form.maxClaims),
          expiresAt,
          winnersDeadline,
          recipients,
          requireCompliance: true,
          refundAddress: form.refundAddress.trim() || undefined,
          theme,
        });

        if (imageFile || imageUrl) {
          await uploadCampaignImage(result.campaignId, { file: imageFile, imageUrl });
        }

        const updated = await listCampaigns();
        setCampaigns(updated);
        setCreatedCampaign({
          id: result.campaignId,
          fundingAddress: result.fundingAddress,
          totalRequired: result.totalRequired,
        });
        setStatus(null);
        setStep(3);
        await refreshFunding(result.campaignId);
        setForm({
          name: "",
          description: "",
          type: "payout",
          authMethod: "email",
          payoutAmount: "",
          maxClaims: "",
          expiresAt: "",
          winnersDeadline: "",
          recipients: "",
          refundAddress: "",
        });
        setImageFile(null);
        setImageUrl("");
        setTheme(themeDefaults);
      }
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : editingCampaignId
          ? "Campaign update failed."
          : "Campaign creation failed."
      );
    } finally {
      setLoading(false);
    }
  };

  const connectWallet = async () => {
    setWalletError(null);
    setPcStatus(null);
    setDepositTx(null);
    setWithdrawTx(null);
    const provider = (window as typeof window & { solana?: any }).solana;
    if (!provider?.connect || !provider?.signMessage || !provider?.signTransaction) {
      setWalletError("No wallet found. Install Phantom or another Solana wallet.");
      return;
    }
    try {
      await provider.connect();
      const adapter: WalletProvider = {
        publicKey: provider.publicKey,
        signMessage: async (message: Uint8Array) => {
          const signed = await provider.signMessage(message);
          return signed?.signature || signed;
        },
        signTransaction: provider.signTransaction.bind(provider),
      };
      setWallet(adapter);
      const { initPrivacyCashContext, getPrivacyCashBalance } = await loadPrivacyCashModule();
      const context = await initPrivacyCashContext(
        adapter,
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL
      );
      setPcContext(context);
      setPcLoading(true);
      const balance = await getPrivacyCashBalance(context, adapter);
      setPcBalance(balance);
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "Wallet connection failed.");
    } finally {
      setPcLoading(false);
    }
  };

  const refreshPrivacyBalance = async () => {
    if (!wallet || !pcContext) return;
    setPcLoading(true);
    setPcStatus(null);
    try {
      const { getPrivacyCashBalance } = await loadPrivacyCashModule();
      const balance = await getPrivacyCashBalance(pcContext, wallet);
      setPcBalance(balance);
    } catch (error) {
      setPcStatus(error instanceof Error ? error.message : "Unable to refresh private balance.");
    } finally {
      setPcLoading(false);
    }
  };

  const handlePrivacyDeposit = async () => {
    if (!wallet || !pcContext || !createdCampaign) return;
    setDepositLoading(true);
    setPcStatus(null);
    setDepositTx(null);
    try {
      const { depositToPrivacyCash, getPrivacyCashBalance } = await loadPrivacyCashModule();
      const targetLamports = creatorDepositLamports || createdCampaign.totalRequired;
      const currentBalance = pcBalance ?? 0;
      const missingLamports = Math.max(0, targetLamports - currentBalance);
      if (missingLamports <= 0) {
        setPcStatus("Privacy Cash balance already covers the required amount.");
        return;
      }
      const tx = await depositToPrivacyCash(pcContext, wallet, missingLamports);
      setPcStatus("Deposit submitted.");
      setDepositTx(tx);
      const balance = await getPrivacyCashBalance(pcContext, wallet);
      setPcBalance(balance);
    } catch (error) {
      setPcStatus(error instanceof Error ? error.message : "Privacy Cash deposit failed.");
    } finally {
      setDepositLoading(false);
    }
  };

  const handlePrivacyWithdraw = async () => {
    if (!wallet || !pcContext || !createdCampaign) return;
    setWithdrawLoading(true);
    setPcStatus(null);
    setWithdrawTx(null);
    try {
      const { withdrawToAddress, getPrivacyCashBalance } = await loadPrivacyCashModule();
      // Privacy Cash withdraw pre-fee amount so net matches the campaign target.
      const targetLamports = withdrawTargetLamports || campaignDepositLamports;
      const result = await withdrawToAddress(
        pcContext,
        wallet,
        createdCampaign.fundingAddress,
        targetLamports
      );
      setPcStatus("Withdraw submitted.");
      setWithdrawTx(result.tx);
      const balance = await getPrivacyCashBalance(pcContext, wallet);
      setPcBalance(balance);
      await refreshFunding(createdCampaign.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Privacy Cash withdraw failed.";
      if (/balance|utxo/i.test(message) && withdrawEstimate) {
        setPcStatus(
          `Withdrawal requires relayer fees (~${formatSol(withdrawFeeLamports)} SOL). ` +
            `Deposit at least ${formatSol(withdrawTargetLamports)} SOL to cover fees.`
        );
      } else {
        setPcStatus(message);
      }
    } finally {
      setWithdrawLoading(false);
    }
  };

  const previewTitle = form.name.trim() || "Campaign preview";
  const previewDescription =
    form.description.trim() || "Add a short description for claimants.";
  const previewPrimary = theme.primary || themeDefaults.primary;
  const previewSecondary = theme.secondary || themeDefaults.secondary;
  const previewBackground = theme.background || themeDefaults.background;
  const solscanTxUrl = (signature: string) => `https://solscan.io/tx/${signature}`;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.1)] backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Campaigns
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">
              All campaigns
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowCreate(true);
              setStep(1);
              setStatus(null);
              setEditingCampaignId(null);
              setEditLoading(false);
              setReplaceRecipientsEnabled(false);
              setEditParticipantCount(null);
              setCreatedCampaign(null);
              setFunding(null);
              setCopiedFunding(false);
              setCopiedLink(false);
              setWallet(null);
              setWalletError(null);
              setPcContext(null);
              setPcBalance(null);
              setPcStatus(null);
              setDepositTx(null);
              setWithdrawTx(null);
              setPcLoading(false);
              setWithdrawEstimate(null);
              setDepositEstimate(null);
              setDepositBufferLamports(0);
              setDepositLoading(false);
              setWithdrawLoading(false);
            }}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
          >
            New campaign
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {filters.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setFilter(label)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                filter === label
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {listStatus ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-xs font-semibold text-slate-600">
            {listStatus}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white/90 px-5 py-8 text-sm text-slate-500">
            Loading campaigns…
          </div>
        ) : filteredCampaigns.length ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {filteredCampaigns.map((campaign) => {
              const isPending = campaign.status === "pending-funding";
              const isActive = campaign.status === "active";
              const isClosed = campaign.status === "closed";
              const expiresAtMs = campaign.expiresAt ? campaign.expiresAt * 1000 : 0;
              const isExpired = !!campaign.expiresAt && expiresAtMs <= Date.now();
              const canDelete = isPending || isClosed;
              const canClose = isActive && isExpired;

              return (
                <div
                  key={campaign.id}
                  className="rounded-2xl border border-slate-200 bg-white/90 px-5 py-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        {campaign.type}
                      </p>
                      <h3 className="mt-2 text-base font-semibold text-slate-900">
                        {campaign.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {isPending ? (
                        <button
                          type="button"
                          onClick={() => handleEditCampaign(campaign.id)}
                          disabled={editLoading}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 disabled:opacity-60"
                        >
                          {editLoading ? "Loading" : "Edit"}
                        </button>
                      ) : null}
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                        {campaign.status}
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    ID: {campaign.id}
                  </p>
                  {canDelete || isActive ? (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {canDelete ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteCampaign(campaign.id)}
                          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-600"
                        >
                          Delete
                        </button>
                      ) : null}
                      {isActive ? (
                        <button
                          type="button"
                          onClick={() => handleCloseCampaign(campaign.id)}
                          disabled={!canClose}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 disabled:opacity-50"
                        >
                          {canClose ? "Close" : "Close (after expiry)"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white/90 px-5 py-8 text-sm text-slate-500">
            No campaigns yet. Create a private payout or escrow to get started.
          </div>
        )}
      </section>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] border border-white/60 bg-white/95 p-6 shadow-[0_30px_70px_rgba(15,23,42,0.18)] backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  {isEditing ? "Edit campaign" : "New campaign"}
                </p>
                <h2 className="mt-2 text-lg font-semibold text-slate-900">
                  {isEditing ? "Update campaign details" : "Create a private payout or escrow"}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { id: 1, label: "Basics" },
                { id: 2, label: "Branding" },
                { id: 3, label: "Funding" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id === 1) {
                      setStep(1);
                    } else if (item.id === 2) {
                      handleNextStep();
                    } else if (createdCampaign) {
                      setStep(3);
                    }
                  }}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
                    step === item.id
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {item.id}. {item.label}
                </button>
              ))}
            </div>

            {step === 1 ? (
              <div className="mt-6 space-y-4">
                <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Campaign name
                  <input
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-slate-900 focus:border-slate-400 focus:outline-none"
                  />
                </label>
                <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Description
                  <textarea
                    value={form.description}
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                    className="min-h-[88px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-slate-900 focus:border-slate-400 focus:outline-none"
                  />
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Type
                    <select
                      value={form.type}
                      onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
                      disabled={isEditing}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60"
                    >
                      <option value="payout">Payout</option>
                      <option value="escrow">Escrow</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Auth method
                    <select
                      value={form.authMethod}
                      onChange={(event) => setForm((prev) => ({ ...prev, authMethod: event.target.value }))}
                      disabled={isEditing}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60"
                    >
                      <option value="email">Email</option>
                      <option value="twitter">X (Twitter)</option>
                      <option value="telegram">Telegram</option>
                      <option value="discord">Discord</option>
                      <option value="github">GitHub</option>
                    </select>
                  </label>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Payout amount (SOL)
                    <input
                      value={form.payoutAmount}
                      onChange={(event) => setForm((prev) => ({ ...prev, payoutAmount: event.target.value }))}
                      type="number"
                      min="0"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-slate-900 focus:border-slate-400 focus:outline-none"
                    />
                  </label>
                  <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Max claims
                    <input
                      value={form.maxClaims}
                      onChange={(event) => setForm((prev) => ({ ...prev, maxClaims: event.target.value }))}
                      type="number"
                      min="1"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-slate-900 focus:border-slate-400 focus:outline-none"
                    />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Total recipients that can claim.
                    </span>
                  </label>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Expires at
                    <input
                      value={form.expiresAt}
                      onChange={(event) => setForm((prev) => ({ ...prev, expiresAt: event.target.value }))}
                      type="datetime-local"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-slate-900 focus:border-slate-400 focus:outline-none"
                    />
                  </label>
                  {form.type === "escrow" ? (
                    <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Winners deadline
                      <input
                        value={form.winnersDeadline}
                        onChange={(event) => setForm((prev) => ({ ...prev, winnersDeadline: event.target.value }))}
                        type="datetime-local"
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-slate-900 focus:border-slate-400 focus:outline-none"
                      />
                    </label>
                  ) : null}
                </div>
                <div className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  <span>{isEditing ? "Add recipients (optional)" : "Eligible recipients"}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {isEditing
                      ? replaceRecipientsEnabled
                        ? "This will replace all existing recipients."
                        : "New recipients will be added. Existing recipients stay the same."
                      : authHint.helper}
                  </span>
                  {isEditing ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                      <span>Recipients are hashed and hidden.</span>
                      {typeof editParticipantCount === "number" ? (
                        <span>{editParticipantCount} current recipients</span>
                      ) : null}
                    </div>
                  ) : null}
                  {isEditing ? (
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      <input
                        type="checkbox"
                        checked={replaceRecipientsEnabled}
                        onChange={(event) => setReplaceRecipientsEnabled(event.target.checked)}
                        className="h-3 w-3 rounded border-slate-300 text-slate-900"
                      />
                      <span>Replace recipients list</span>
                    </div>
                  ) : null}
                  <textarea
                    value={form.recipients}
                    onChange={(event) => setForm((prev) => ({ ...prev, recipients: event.target.value }))}
                    placeholder={authHint.placeholder}
                    className="min-h-[120px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-slate-900 focus:border-slate-400 focus:outline-none"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  <span>
                    {recipientsList.length} {isEditing ? "new recipients parsed" : "recipients parsed"}
                  </span>
                  {form.recipients ? (
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, recipients: "" }))}
                      className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"
                    >
                      Clear list
                    </button>
                  ) : null}
                </div>
                {recipientsList.length ? (
                  <div className="flex flex-wrap gap-2">
                    {recipientsList.slice(0, 6).map((recipient) => (
                      <span
                        key={recipient}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
                      >
                        {recipient}
                      </span>
                    ))}
                    {recipientsList.length > 6 ? (
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                        +{recipientsList.length - 6} more
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <input
                  value={form.refundAddress}
                  onChange={(event) => setForm((prev) => ({ ...prev, refundAddress: event.target.value }))}
                  placeholder="Refund address (optional)"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-slate-900 focus:border-slate-400 focus:outline-none"
                />
              </div>
            ) : step === 2 ? (
              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Branding
                    </p>
                    <div className="mt-3 grid gap-3 text-sm">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => setImageFile(event.target.files?.[0] || null)}
                        className="text-xs text-slate-500"
                      />
                      <input
                        value={imageUrl}
                        onChange={(event) => setImageUrl(event.target.value)}
                        placeholder="or paste image URL"
                        className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-700"
                      />
                      {preview && (
                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={preview} alt="Campaign preview" className="h-36 w-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Theme colors
                    </p>
                    <div className="mt-3 grid gap-3">
                      {[
                        { key: "primary", label: "Primary" },
                        { key: "secondary", label: "Secondary" },
                        { key: "background", label: "Background" },
                      ].map((item) => (
                        <label
                          key={item.key}
                          className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"
                        >
                          {item.label}
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={theme[item.key as keyof CampaignTheme] || ""}
                              onChange={(event) =>
                                setTheme((prev) => ({
                                  ...prev,
                                  [item.key]: event.target.value,
                                }))
                              }
                              className="h-9 w-10 rounded-lg border border-slate-200 bg-white"
                            />
                            <input
                              value={theme[item.key as keyof CampaignTheme] || ""}
                              onChange={(event) =>
                                setTheme((prev) => ({
                                  ...prev,
                                  [item.key]: event.target.value,
                                }))
                              }
                              className="w-28 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600"
                            />
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Campaign preview
                  </p>
                  <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
                    {preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={preview} alt="Preview artwork" className="h-36 w-full object-cover" />
                    ) : (
                      <div
                        className="h-36 w-full"
                        style={{
                          background: `linear-gradient(120deg, ${previewPrimary} 0%, ${previewSecondary} 100%)`,
                        }}
                      />
                    )}
                    <div className="space-y-3 px-4 py-4" style={{ background: previewBackground }}>
                      <div>
                        <p
                          className="text-xs font-semibold uppercase tracking-[0.2em]"
                          style={{ color: previewSecondary }}
                        >
                          {form.type === "escrow" ? "Escrow campaign" : "Direct payout"}
                        </p>
                        <h3 className="mt-2 text-lg font-semibold" style={{ color: previewPrimary }}>
                          {previewTitle}
                        </h3>
                        <p className="mt-2 text-sm" style={{ color: previewSecondary }}>
                          {previewDescription}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: previewSecondary }}>
                        <span>{form.payoutAmount || "0"} SOL per claim</span>
                        <span>·</span>
                        <span>{form.maxClaims || "0"} recipients</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-white/90 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Privacy Cash funding
                  </p>
                  <div className="space-y-3 text-sm text-slate-600">
                    <p>
                      Deposit{" "}
                      <strong>{createdCampaign ? formatSol(creatorDepositLamports) : "—"} SOL</strong> into
                      Privacy Cash, then withdraw it to the campaign wallet. This breaks the on-chain link before
                      claims go live.
                    </p>
                    {createdCampaign ? (
                      <p className="text-xs text-slate-500">
                        {withdrawEstimate
                          ? `Includes ~${formatSol(withdrawFeeLamports)} SOL relayer fees so the campaign wallet receives ${formatSol(withdrawNetLamports)} SOL${
                              depositBufferLamports > 0
                                ? ` (includes ~${formatSol(depositBufferLamports)} SOL auto-deposit buffer)`
                                : ""
                            }${
                              depositFeeLamports > 0
                                ? ` (covers ~${formatSol(depositFeeLamports)} SOL deposit fee)`
                                : ""
                            }.`
                          : `Campaign requires ${formatSol(requiredLamports)} SOL. Relayer fees apply on withdrawal.`}
                      </p>
                    ) : null}
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Creator wallet
                      </p>
                      {wallet ? (
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-700">
                          <span className="break-all">{wallet.publicKey.toBase58()}</span>
                          <button
                            type="button"
                            onClick={refreshPrivacyBalance}
                            disabled={pcLoading}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 disabled:opacity-60"
                          >
                            {pcLoading ? "Refreshing" : "Refresh balance"}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={connectWallet}
                          className="mt-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
                        >
                          Connect wallet
                        </button>
                      )}
                      {walletError ? (
                        <p className="mt-2 text-xs text-rose-500">{walletError}</p>
                      ) : null}
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Creator Privacy Cash balance
                      </p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-700">
                        <span>{pcBalance === null ? "—" : `${formatSol(pcBalance)} SOL`}</span>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={handlePrivacyDeposit}
                        disabled={!wallet || !pcContext || depositLoading}
                        className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white disabled:opacity-60"
                      >
                        {depositLoading ? "Depositing" : "Deposit to Privacy Cash"}
                      </button>
                      <button
                        type="button"
                        onClick={handlePrivacyWithdraw}
                        disabled={!wallet || !pcContext || withdrawLoading || !hasPrivacyBalance}
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 disabled:opacity-60"
                      >
                        {withdrawLoading ? "Withdrawing" : "Withdraw to campaign wallet"}
                      </button>
                    </div>
                    {wallet && pcContext && !hasPrivacyBalance ? (
                      <p className="text-xs text-slate-500">
                        Deposit at least {formatSol(creatorDepositLamports)} SOL before withdrawing.
                      </p>
                    ) : null}
                    {pcStatus ? (
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-600">
                        {pcStatus}
                      </div>
                    ) : null}
                    {depositTx ? (
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                          <span>Deposit tx</span>
                          <a
                            href={solscanTxUrl(depositTx)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
                          >
                            View on Solscan ↗
                          </a>
                        </div>
                        <div className="mt-2 break-all text-xs font-semibold text-slate-700">
                          {depositTx}
                        </div>
                      </div>
                    ) : null}
                    {withdrawTx ? (
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                          <span>Withdraw tx</span>
                          <a
                            href={solscanTxUrl(withdrawTx)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
                          >
                            View on Solscan ↗
                          </a>
                        </div>
                        <div className="mt-2 break-all text-xs font-semibold text-slate-700">
                          {withdrawTx}
                        </div>
                      </div>
                    ) : null}
                    {fundingWarning ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">
                        {fundingWarning}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white/90 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Campaign wallet
                    </p>
                    <div className="mt-4 space-y-3 text-sm text-slate-600">
                      <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-700">
                          <span className="break-all">{createdCampaign?.fundingAddress}</span>
                          <button
                            type="button"
                            onClick={() =>
                              createdCampaign &&
                              copyToClipboard(createdCampaign.fundingAddress, setCopiedFunding)
                            }
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
                          >
                            {copiedFunding ? "Copied" : "Copy"}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-2">
                        <span>
                          On-chain wallet
                          {funding?.onChainFresh === false ? " (stale)" : ""}
                        </span>
                        <span>{funding ? `${formatSol(funding.onChainBalance)} SOL` : "—"}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-2">
                        <span>
                          Campaign Privacy Cash balance
                          {funding?.privacyFresh === false ? " (stale)" : ""}
                        </span>
                        <span>{funding ? `${formatSol(funding.balance)} SOL` : "—"}</span>
                      </div>
                      {withdrawEstimate ? (
                        <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-2">
                          <span>Relayer fee (est.)</span>
                          <span>{formatSol(withdrawFeeLamports)} SOL</span>
                        </div>
                      ) : null}
                      {depositFeeLamports > 0 ? (
                        <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-2">
                          <span>Privacy Cash deposit fee (est.)</span>
                          <span>{formatSol(depositFeeLamports)} SOL</span>
                        </div>
                      ) : null}
                      {depositBufferLamports > 0 ? (
                        <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-2">
                          <span>Auto-deposit buffer (est.)</span>
                          <span>{formatSol(depositBufferLamports)} SOL</span>
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-2">
                        <span>Total to deposit</span>
                        <span>{createdCampaign ? `${formatSol(creatorDepositLamports)} SOL` : "—"}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-2">
                        <span>Required (incl. fees)</span>
                        <span>{createdCampaign ? `${formatSol(requiredLamports)} SOL` : "—"}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-2">
                        <span>Status</span>
                        <span>{funding?.funded ? "Funded" : "Waiting"}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => createdCampaign && refreshFunding(createdCampaign.id)}
                        disabled={fundingLoading}
                        className="w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {fundingLoading ? "Refreshing..." : "Refresh funding"}
                      </button>
                      {funding?.funded ? (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Claim link
                          </p>
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-700">
                            <span className="break-all">{campaignLink}</span>
                            <button
                              type="button"
                              onClick={() => campaignLink && copyToClipboard(campaignLink, setCopiedLink)}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
                            >
                              {copiedLink ? "Copied" : "Copy"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                          Claim link unlocks after funding is confirmed.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {status && (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-xs font-semibold text-slate-600">
                {status}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Close
              </button>
              {step === 1 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
                >
                  Next step
                </button>
              ) : step === 2 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateCampaign}
                    disabled={loading}
                    className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {isEditing ? "Update campaign" : "Create campaign"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={!funding?.funded}
                  className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {funding?.funded ? "Done" : "Complete funding"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
