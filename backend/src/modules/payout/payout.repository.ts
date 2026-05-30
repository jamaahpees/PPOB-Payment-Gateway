import { randomUUID } from "node:crypto";
import {
  type PayoutRequestRecord,
  type PayoutBalanceLedgerRecord,
  type PayoutDecryptAuditRecord,
  type CreatePayoutRequestInput,
  type PayoutStatus,
  type PayoutRepository
} from "./payout.types";

export { PayoutRepository };
export class InMemoryPayoutRepository implements PayoutRepository {
  private readonly payoutRequests: PayoutRequestRecord[] = [];
  private readonly balanceLedgers: PayoutBalanceLedgerRecord[] = [];
  private readonly decryptAuditLogs: PayoutDecryptAuditRecord[] = [];

  async getUserPayableBalance(userId: string): Promise<number> {
    const ledgers = this.balanceLedgers.filter(l => l.userId === userId);
    let balance = 0;
    for (const ledger of ledgers) {
      if (ledger.type === "commission_earned" || ledger.type === "payout_released") {
        balance += ledger.amountMinor;
      } else if (ledger.type === "payout_reserved" || ledger.type === "payout_paid") {
        balance += ledger.amountMinor;
      }
    }
    return balance;
  }

  async createPayoutRequest(input: CreatePayoutRequestInput): Promise<PayoutRequestRecord> {
    const payoutRequest: PayoutRequestRecord = {
      id: randomUUID(),
      userId: input.userId,
      amountMinor: input.amountMinor,
      bankFeeMinor: 0,
      netAmountMinor: input.amountMinor,
      status: "pending",
      encryptedLegalName: input.identityData.legalName,
      encryptedNik: input.identityData.nik,
      encryptedAddress: input.identityData.address,
      encryptedBankName: input.identityData.bankName,
      encryptedAccountNumber: input.identityData.accountNumber,
      encryptedAccountHolder: input.identityData.accountHolder,
      encryptedPhone: input.identityData.phone ?? null,
      encryptedEmail: input.identityData.email ?? null,
      identityFingerprint: randomUUID(),
      adminId: null,
      adminNote: null,
      proofReference: null,
      processedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.payoutRequests.push(payoutRequest);
    return payoutRequest;
  }

  async findPayoutRequestById(id: string): Promise<PayoutRequestRecord | null> {
    return this.payoutRequests.find(p => p.id === id) ?? null;
  }

  async findPayoutRequestsByUserId(userId: string): Promise<readonly PayoutRequestRecord[]> {
    return this.payoutRequests.filter(p => p.userId === userId).sort((a, b) => 
      b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async findAllPayoutRequests(filters?: { status?: PayoutStatus }): Promise<readonly PayoutRequestRecord[]> {
    let results = this.payoutRequests;
    if (filters?.status) {
      results = results.filter(p => p.status === filters.status);
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updatePayoutStatus(id: string, status: PayoutStatus, adminId: string, note?: string): Promise<PayoutRequestRecord> {
    const index = this.payoutRequests.findIndex(p => p.id === id);
    if (index === -1) throw new Error("Payout request not found");
    const updated: PayoutRequestRecord = {
      ...this.payoutRequests[index],
      status,
      adminId,
      adminNote: note ?? null,
      processedAt: new Date(),
      updatedAt: new Date()
    };
    this.payoutRequests[index] = updated;
    return updated;
  }

  async markPayoutPaid(id: string, adminId: string, proofReference: string): Promise<PayoutRequestRecord> {
    const index = this.payoutRequests.findIndex(p => p.id === id);
    if (index === -1) throw new Error("Payout request not found");
    const updated: PayoutRequestRecord = {
      ...this.payoutRequests[index],
      status: "paid",
      adminId,
      proofReference,
      processedAt: new Date(),
      updatedAt: new Date()
    };
    this.payoutRequests[index] = updated;
    return updated;
  }

  async addBalanceLedgerEntry(entry: Omit<PayoutBalanceLedgerRecord, "id" | "createdAt">): Promise<PayoutBalanceLedgerRecord> {
    const ledgerEntry: PayoutBalanceLedgerRecord = {
      ...entry,
      id: randomUUID(),
      createdAt: new Date()
    };
    this.balanceLedgers.push(ledgerEntry);
    return ledgerEntry;
  }

  async getUserBalanceLedgers(userId: string): Promise<readonly PayoutBalanceLedgerRecord[]> {
    return this.balanceLedgers.filter(l => l.userId === userId).sort((a, b) => 
      b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async logDecryptAccess(log: Omit<PayoutDecryptAuditRecord, "id" | "createdAt">): Promise<PayoutDecryptAuditRecord> {
    const auditLog: PayoutDecryptAuditRecord = {
      ...log,
      id: randomUUID(),
      createdAt: new Date()
    };
    this.decryptAuditLogs.push(auditLog);
    return auditLog;
  }
}

export class SupabasePayoutRepository implements PayoutRepository {
  constructor(
    private readonly supabaseUrl: string,
    private readonly supabaseServiceRoleKey: string,
    private readonly tablePrefix: string = ""
  ) {}

  private tableName(table: string): string {
    return this.tablePrefix + table;
  }

  private get headers() {
    return {
      "apikey": this.supabaseServiceRoleKey,
      "Authorization": `Bearer ${this.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    };
  }

  async getUserPayableBalance(userId: string): Promise<number> {
    // Sum all ledger entries for the user
    const response = await fetch(
      `${this.supabaseUrl}/rest/v1/${this.tableName("payout_balance_ledgers")}?user_id=eq.${encodeURIComponent(userId)}&select=amount_minor,type`,
      { headers: this.headers }
    );
    if (!response.ok) return 0;
    const data = await response.json();
    let balance = 0;
    for (const row of data) {
      if (row.type === "commission_earned" || row.type === "payout_released") {
        balance += row.amount_minor;
      } else if (row.type === "payout_reserved" || row.type === "payout_paid") {
        balance += row.amount_minor;
      }
    }
    return balance;
  }

  async createPayoutRequest(input: CreatePayoutRequestInput): Promise<PayoutRequestRecord> {
    const response = await fetch(`${this.supabaseUrl}/rest/v1/${this.tableName("payout_requests")}`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        user_id: input.userId,
        amount_minor: input.amountMinor,
        status: "pending",
        encrypted_legal_name: input.identityData.legalName,
        encrypted_nik: input.identityData.nik,
        encrypted_address: input.identityData.address,
        encrypted_bank_name: input.identityData.bankName,
        encrypted_account_number: input.identityData.accountNumber,
        encrypted_account_holder: input.identityData.accountHolder,
        encrypted_phone: input.identityData.phone ?? null,
        encrypted_email: input.identityData.email ?? null,
        identity_fingerprint: randomUUID()
      })
    });
    if (!response.ok) throw new Error("Failed to create payout request");
    const [data] = await response.json();
    return this.mapPayoutRequestRow(data);
  }

  async findPayoutRequestById(id: string): Promise<PayoutRequestRecord | null> {
    const response = await fetch(
      `${this.supabaseUrl}/rest/v1/${this.tableName("payout_requests")}?id=eq.${encodeURIComponent(id)}&select=*`,
      { headers: this.headers }
    );
    if (!response.ok) return null;
    const [data] = await response.json();
    return data ? this.mapPayoutRequestRow(data) : null;
  }

  async findPayoutRequestsByUserId(userId: string): Promise<readonly PayoutRequestRecord[]> {
    const response = await fetch(
      `${this.supabaseUrl}/rest/v1/${this.tableName("payout_requests")}?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&select=*`,
      { headers: this.headers }
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.map((row: any) => this.mapPayoutRequestRow(row));
  }

  async findAllPayoutRequests(filters?: { status?: PayoutStatus }): Promise<readonly PayoutRequestRecord[]> {
    let url = `${this.supabaseUrl}/rest/v1/${this.tableName("payout_requests")}?order=created_at.desc&select=*`;
    if (filters?.status) {
      url += `&status=eq.${filters.status}`;
    }
    const response = await fetch(url, { headers: this.headers });
    if (!response.ok) return [];
    const data = await response.json();
    return data.map((row: any) => this.mapPayoutRequestRow(row));
  }

  async updatePayoutStatus(id: string, status: PayoutStatus, adminId: string, note?: string): Promise<PayoutRequestRecord> {
    const response = await fetch(
      `${this.supabaseUrl}/rest/v1/${this.tableName("payout_requests")}?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: this.headers,
        body: JSON.stringify({
          status,
          admin_id: adminId,
          admin_note: note ?? null,
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }
    );
    if (!response.ok) throw new Error("Failed to update payout status");
    const [data] = await response.json();
    return this.mapPayoutRequestRow(data);
  }

  async markPayoutPaid(id: string, adminId: string, proofReference: string): Promise<PayoutRequestRecord> {
    const response = await fetch(
      `${this.supabaseUrl}/rest/v1/${this.tableName("payout_requests")}?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: this.headers,
        body: JSON.stringify({
          status: "paid",
          admin_id: adminId,
          proof_reference: proofReference,
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }
    );
    if (!response.ok) throw new Error("Failed to mark payout as paid");
    const [data] = await response.json();
    return this.mapPayoutRequestRow(data);
  }

  async addBalanceLedgerEntry(entry: Omit<PayoutBalanceLedgerRecord, "id" | "createdAt">): Promise<PayoutBalanceLedgerRecord> {
    const response = await fetch(`${this.supabaseUrl}/rest/v1/${this.tableName("payout_balance_ledgers")}`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        user_id: entry.userId,
        payout_request_id: entry.payoutRequestId,
        commission_id: entry.commissionId,
        type: entry.type,
        amount_minor: entry.amountMinor,
        balance_after_minor: entry.balanceAfterMinor,
        description: entry.description
      })
    });
    if (!response.ok) throw new Error("Failed to add balance ledger entry");
    const [data] = await response.json();
    return this.mapBalanceLedgerRow(data);
  }

  async getUserBalanceLedgers(userId: string): Promise<readonly PayoutBalanceLedgerRecord[]> {
    const response = await fetch(
      `${this.supabaseUrl}/rest/v1/${this.tableName("payout_balance_ledgers")}?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&select=*`,
      { headers: this.headers }
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.map((row: any) => this.mapBalanceLedgerRow(row));
  }

  async logDecryptAccess(log: Omit<PayoutDecryptAuditRecord, "id" | "createdAt">): Promise<PayoutDecryptAuditRecord> {
    const response = await fetch(`${this.supabaseUrl}/rest/v1/${this.tableName("payout_decrypt_audit_log")}`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        payout_request_id: log.payoutRequestId,
        admin_id: log.adminId,
        reason: log.reason,
        decrypted_fields: log.decryptedFields,
        ip_address: log.ipAddress,
        user_agent: log.userAgent
      })
    });
    if (!response.ok) throw new Error("Failed to log decrypt access");
    const [data] = await response.json();
    return this.mapDecryptAuditRow(data);
  }

  private mapPayoutRequestRow(row: any): PayoutRequestRecord {
    return {
      id: row.id,
      userId: row.user_id,
      amountMinor: row.amount_minor,
      bankFeeMinor: row.bank_fee_minor ?? 0,
      netAmountMinor: row.net_amount_minor ?? row.amount_minor,
      status: row.status,
      encryptedLegalName: row.encrypted_legal_name,
      encryptedNik: row.encrypted_nik,
      encryptedAddress: row.encrypted_address,
      encryptedBankName: row.encrypted_bank_name,
      encryptedAccountNumber: row.encrypted_account_number,
      encryptedAccountHolder: row.encrypted_account_holder,
      encryptedPhone: row.encrypted_phone,
      encryptedEmail: row.encrypted_email,
      identityFingerprint: row.identity_fingerprint,
      adminId: row.admin_id,
      adminNote: row.admin_note,
      proofReference: row.proof_reference,
      processedAt: row.processed_at ? new Date(row.processed_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapBalanceLedgerRow(row: any): PayoutBalanceLedgerRecord {
    return {
      id: row.id,
      userId: row.user_id,
      payoutRequestId: row.payout_request_id,
      commissionId: row.commission_id,
      type: row.type,
      amountMinor: row.amount_minor,
      balanceAfterMinor: row.balance_after_minor,
      description: row.description,
      createdAt: new Date(row.created_at)
    };
  }

  private mapDecryptAuditRow(row: any): PayoutDecryptAuditRecord {
    return {
      id: row.id,
      payoutRequestId: row.payout_request_id,
      adminId: row.admin_id,
      reason: row.reason,
      decryptedFields: row.decrypted_fields,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: new Date(row.created_at)
    };
  }
}