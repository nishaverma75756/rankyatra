import React, { useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import ViewShot, { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";
import { showError, showSuccess } from "@/utils/alert";

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  pending:  { bg: "#f59e0b22", text: "#d97706" },
  approved: { bg: "#10b98122", text: "#059669" },
  success:  { bg: "#10b98122", text: "#059669" },
  credited: { bg: "#10b98122", text: "#059669" },
  rejected: { bg: "#ef444422", text: "#dc2626" },
};

function statusStyle(s: string) {
  return STATUS_COLOR[s?.toLowerCase()] ?? { bg: "#6b728022", text: "#6b7280" };
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
}

function fmtAmt(amt: string | number) {
  return Number(amt).toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

function buildReceiptHtml(params: Record<string, string>, invoiceNo: string, isCredit: boolean, isDeposit: boolean, isWithdrawal: boolean, isTx: boolean) {
  const amountColor = isCredit ? "#059669" : "#dc2626";
  const amountPrefix = isCredit ? "+" : "-";
  const amountLabel = isDeposit ? "Amount Deposited" : isWithdrawal ? "Amount Withdrawn" : isCredit ? "Amount Credited" : "Amount Debited";
  const statusLabel = (params.status === "success" || params.status === "approved") ? "Credited" : params.status === "rejected" ? "Rejected" : "Pending Review";

  const rows: { label: string; value: string; highlight?: boolean; valueColor?: string }[] = [];
  rows.push({ label: "Date", value: fmtDate(params.createdAt ?? "") });
  rows.push({ label: "Time", value: fmtTime(params.createdAt ?? "") });

  if (isDeposit) {
    rows.push({ label: "Payment Method", value: params.paymentMethod === "instamojo" ? "Instamojo (Online)" : params.paymentMethod === "referral_bonus" ? "Referral Bonus" : "Manual UPI" });
    if (params.utrNumber) rows.push({ label: "UTR / Reference", value: params.utrNumber, highlight: true });
    if (params.adminNote) rows.push({ label: "Admin Note", value: params.adminNote });
  }
  if (isWithdrawal) {
    if (params.bankName) rows.push({ label: "Bank", value: params.bankName });
    if (params.accountNumber) rows.push({ label: "Account", value: `••••${params.accountNumber.slice(-4)}` });
    if (params.ifsc) rows.push({ label: "IFSC", value: params.ifsc });
    if (params.utrNumber) rows.push({ label: "UTR / Reference", value: params.utrNumber, highlight: true });
    if (params.adminNote) rows.push({ label: "Remark", value: params.adminNote });
  }
  if (isTx) {
    rows.push({ label: "Description", value: params.description ?? "" });
    rows.push({ label: "Type", value: params.txType === "credit" ? "Credit (Received)" : "Debit (Spent)", valueColor: params.txType === "credit" ? "#059669" : "#dc2626" });
    if (params.balanceAfter) rows.push({ label: "Balance After", value: `₹${fmtAmt(params.balanceAfter)}`, highlight: true });
  }
  rows.push({ label: "Invoice No.", value: invoiceNo });
  rows.push({ label: "Transaction ID", value: `#${params.id}` });

  const rowsHtml = rows.map(r => `
    <tr>
      <td style="padding:10px 16px;color:#6b7280;font-size:13px;border-bottom:1px solid #f1f5f9;">${r.label}</td>
      <td style="padding:10px 16px;text-align:right;font-weight:${r.highlight ? "700" : "600"};font-size:13px;color:${r.valueColor ?? "#0f172a"};border-bottom:1px solid #f1f5f9;">${r.value}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, Arial, sans-serif; background:#f8fafc; padding:24px; }
  .card { background:#fff; border-radius:20px; border:1px solid #e2e8f0; max-width:480px; margin:0 auto; overflow:hidden; }
  .header { text-align:center; padding:28px 24px 20px; border-bottom:1px solid #f1f5f9; }
  .logo-text { font-size:28px; font-weight:900; color:#f97316; letter-spacing:-0.5px; }
  .logo-sub { font-size:11px; color:#94a3b8; letter-spacing:3px; text-transform:uppercase; margin-top:2px; }
  .receipt-label { font-size:11px; font-weight:700; letter-spacing:3px; color:#94a3b8; text-transform:uppercase; margin-top:12px; }
  .invoice-no { font-size:15px; font-weight:800; color:#0f172a; margin-top:4px; }
  .amount-block { margin:20px; padding:20px; border-radius:14px; text-align:center; background:${isCredit ? "#f0fdf4" : "#fef2f2"}; border:1px solid ${isCredit ? "#bbf7d0" : "#fecaca"}; }
  .amount-label { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; }
  .amount-big { font-size:40px; font-weight:900; color:${amountColor}; margin-top:4px; }
  .status-pill { display:inline-block; margin-top:10px; padding:4px 14px; border-radius:20px; font-size:12px; font-weight:700; background:${statusLabel === "Credited" ? "#d1fae5" : statusLabel === "Rejected" ? "#fee2e2" : "#fef3c7"}; color:${statusLabel === "Credited" ? "#059669" : statusLabel === "Rejected" ? "#dc2626" : "#d97706"}; }
  table { width:100%; border-collapse:collapse; }
  .footer { text-align:center; padding:20px 24px; border-top:1px solid #f1f5f9; margin-top:4px; }
  .footer-brand { font-size:16px; font-weight:900; color:#f97316; }
  .footer-tagline { font-size:11px; color:#94a3b8; margin-top:2px; }
  .footer-note { font-size:11px; color:#94a3b8; margin-top:6px; line-height:1.5; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <div class="logo-text">RankYatra</div>
    <div class="logo-sub">Compete · Rank · Win</div>
    <div class="receipt-label">Receipt</div>
    <div class="invoice-no">${invoiceNo}</div>
  </div>
  <div class="amount-block">
    <div class="amount-label">${amountLabel}</div>
    <div class="amount-big">${amountPrefix}₹${fmtAmt(params.amount)}</div>
    ${(isDeposit || isWithdrawal) ? `<div class="status-pill">${statusLabel}</div>` : ""}
  </div>
  <table>${rowsHtml}</table>
  <div class="footer">
    <div class="footer-brand">RankYatra</div>
    <div class="footer-tagline">rankyatra.in</div>
    <div class="footer-note">This is a digital receipt. For any issues, contact support@rankyatra.in</div>
  </div>
</div>
</body>
</html>`;
}

export default function TransactionDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const receiptRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const params = useLocalSearchParams<{
    type: string;
    id: string;
    amount: string;
    txType: string;
    description: string;
    balanceAfter: string;
    createdAt: string;
    utrNumber: string;
    status: string;
    paymentMethod: string;
    adminNote: string;
    bankName: string;
    accountNumber: string;
    ifsc: string;
    updatedAt: string;
  }>();

  const type = params.type ?? "tx";
  const isDeposit = type === "deposit";
  const isWithdrawal = type === "withdrawal";
  const isTx = type === "tx";

  const invoiceNo = isDeposit
    ? `RY-DEP-${String(params.id).padStart(6, "0")}`
    : isWithdrawal
    ? `RY-WDR-${String(params.id).padStart(6, "0")}`
    : `RY-TXN-${String(params.id).padStart(6, "0")}`;

  const isCredit = params.txType === "credit" || isDeposit;
  const amountColor = isCredit ? "#059669" : "#dc2626";
  const amountPrefix = isCredit ? "+" : "-";

  const st = isDeposit || isWithdrawal ? statusStyle(params.status ?? "") : null;

  const handleShareImage = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const uri = await captureRef(receiptRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: `Receipt ${invoiceNo}`,
        });
      } else {
        showError("Sharing not available on this device.");
      }
    } catch (e) {
      showError("Could not generate receipt image. Please try again.");
    } finally {
      setSharing(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const html = buildReceiptHtml(
        params as Record<string, string>,
        invoiceNo,
        isCredit,
        isDeposit,
        isWithdrawal,
        isTx
      );
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const fileName = `${invoiceNo}.pdf`;
      const destUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.copyAsync({ from: uri, to: destUri });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(destUri, {
          mimeType: "application/pdf",
          dialogTitle: `Download ${fileName}`,
          UTI: "com.adobe.pdf",
        });
      } else {
        showSuccess("PDF Saved", `Receipt saved as ${fileName}`);
      }
    } catch (e) {
      showError("Could not generate PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {isDeposit ? "Deposit Details" : isWithdrawal ? "Withdrawal Details" : "Transaction Details"}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleDownloadPdf} style={styles.iconBtn} disabled={downloading}>
            {downloading
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Feather name="download" size={20} color={colors.primary} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShareImage} style={styles.iconBtn} disabled={sharing}>
            {sharing
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Feather name="share-2" size={20} color={colors.primary} />}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40, paddingTop: 20 }}
      >
        {/* Invoice Card — captured as image */}
        <ViewShot ref={receiptRef} options={{ format: "png", quality: 1 }}>
          <View style={[styles.invoiceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Invoice Brand Header */}
            <View style={[styles.invoiceHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.logoRow}>
                <Image
                  source={require("@/assets/images/full-logo.png")}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <Text style={[styles.invoiceLabel, { color: colors.mutedForeground }]}>RECEIPT</Text>
              <Text style={[styles.invoiceNo, { color: colors.foreground }]}>{invoiceNo}</Text>
            </View>

            {/* Amount Big Display */}
            <View style={[styles.amountBlock, { backgroundColor: isCredit ? "#10b98110" : "#ef444410", borderColor: isCredit ? "#10b98130" : "#ef444430" }]}>
              <Text style={[styles.amountLabel, { color: colors.mutedForeground }]}>
                {isDeposit ? "Amount Deposited" : isWithdrawal ? "Amount Withdrawn" : isCredit ? "Amount Credited" : "Amount Debited"}
              </Text>
              <Text style={[styles.amountBig, { color: amountColor }]}>
                {amountPrefix}₹{fmtAmt(params.amount)}
              </Text>
              {(isDeposit || isWithdrawal) && st && (
                <View style={[styles.statusPill, { backgroundColor: st.bg, marginTop: 8 }]}>
                  <Feather
                    name={params.status === "success" || params.status === "approved" ? "check-circle" : params.status === "rejected" ? "x-circle" : "clock"}
                    size={12}
                    color={st.text}
                  />
                  <Text style={[styles.statusText, { color: st.text }]}>
                    {params.status === "success" || params.status === "approved" ? "Credited" : params.status === "rejected" ? "Rejected" : "Pending Review"}
                  </Text>
                </View>
              )}
            </View>

            {/* Details Table */}
            <View style={styles.detailsTable}>
              <DetailRow label="Date" value={fmtDate(params.createdAt ?? "")} colors={colors} />
              <DetailRow label="Time" value={fmtTime(params.createdAt ?? "")} colors={colors} />

              {isDeposit && (
                <>
                  <DetailRow label="Payment Method" value={params.paymentMethod === "instamojo" ? "Instamojo (Online)" : params.paymentMethod === "referral_bonus" ? "Referral Bonus" : "Manual UPI"} colors={colors} />
                  {params.utrNumber ? <DetailRow label="UTR / Reference" value={params.utrNumber} colors={colors} highlight /> : null}
                  {params.adminNote ? <DetailRow label="Admin Note" value={params.adminNote} colors={colors} /> : null}
                </>
              )}

              {isWithdrawal && (
                <>
                  {params.bankName ? <DetailRow label="Bank" value={params.bankName} colors={colors} /> : null}
                  {params.accountNumber ? <DetailRow label="Account" value={`••••${params.accountNumber.slice(-4)}`} colors={colors} /> : null}
                  {params.ifsc ? <DetailRow label="IFSC" value={params.ifsc} colors={colors} /> : null}
                  {params.utrNumber ? <DetailRow label="UTR / Reference" value={params.utrNumber} colors={colors} highlight /> : null}
                  {params.adminNote ? <DetailRow label="Remark" value={params.adminNote} colors={colors} /> : null}
                </>
              )}

              {isTx && (
                <>
                  <DetailRow label="Description" value={params.description ?? ""} colors={colors} />
                  <DetailRow
                    label="Type"
                    value={params.txType === "credit" ? "Credit (Received)" : "Debit (Spent)"}
                    colors={colors}
                    valueColor={params.txType === "credit" ? "#059669" : "#dc2626"}
                  />
                  {params.balanceAfter ? (
                    <DetailRow label="Balance After" value={`₹${fmtAmt(params.balanceAfter)}`} colors={colors} highlight />
                  ) : null}
                </>
              )}

              <DetailRow label="Invoice No." value={invoiceNo} colors={colors} />
              <DetailRow label="Transaction ID" value={`#${params.id}`} colors={colors} />
            </View>

            {/* Footer */}
            <View style={[styles.invoiceFooter, { borderTopColor: colors.border }]}>
              <Text style={[styles.footerBrand, { color: colors.primary }]}>RankYatra</Text>
              <Text style={[styles.footerTagline, { color: colors.mutedForeground }]}>Compete. Rank. Win. — rankyatra.in</Text>
              <Text style={[styles.footerNote, { color: colors.mutedForeground }]}>
                This is a digital receipt. For any issues, contact support@rankyatra.in
              </Text>
            </View>
          </View>
        </ViewShot>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnOutline, { borderColor: colors.primary }]}
            onPress={handleDownloadPdf}
            disabled={downloading}
            activeOpacity={0.8}
          >
            {downloading
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Feather name="download" size={17} color={colors.primary} />}
            <Text style={[styles.actionBtnOutlineText, { color: colors.primary }]}>Download PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={handleShareImage}
            disabled={sharing}
            activeOpacity={0.8}
          >
            {sharing
              ? <ActivityIndicator size="small" color="#fff" />
              : <Feather name="share-2" size={17} color="#fff" />}
            <Text style={styles.actionBtnText}>Share Receipt</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function DetailRow({
  label,
  value,
  colors,
  highlight = false,
  valueColor,
}: {
  label: string;
  value: string;
  colors: any;
  highlight?: boolean;
  valueColor?: string;
}) {
  return (
    <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text
        style={[
          styles.detailValue,
          { color: valueColor ?? colors.foreground },
          highlight && { fontWeight: "700" },
        ]}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "800" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  iconBtn: { padding: 6 },

  invoiceCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 16,
  },

  invoiceHeader: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    gap: 6,
  },
  logoRow: { alignItems: "center", marginBottom: 4 },
  logo: { width: 140, height: 48 },
  invoiceLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 3, textTransform: "uppercase" },
  invoiceNo: { fontSize: 15, fontWeight: "800" },

  amountBlock: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  amountLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  amountBig: { fontSize: 36, fontWeight: "900" },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: { fontSize: 13, fontWeight: "700" },

  detailsTable: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  detailLabel: { fontSize: 13, flex: 1 },
  detailValue: { fontSize: 13, fontWeight: "600", flex: 1, textAlign: "right" },

  invoiceFooter: {
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    marginTop: 8,
    gap: 4,
  },
  footerBrand: { fontSize: 16, fontWeight: "900" },
  footerTagline: { fontSize: 11 },
  footerNote: { fontSize: 11, textAlign: "center", marginTop: 4, lineHeight: 16 },

  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  actionBtnOutline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
  },
  actionBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  actionBtnOutlineText: { fontSize: 15, fontWeight: "700" },
});
