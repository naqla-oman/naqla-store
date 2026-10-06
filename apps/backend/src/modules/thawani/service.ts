import { thawaniCreds } from "../../lib/credentials"
import {
  AbstractPaymentProvider,
  MedusaError,
  PaymentActions,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  Logger,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"

export type ThawaniOptions = {
  secretKey: string
  publishableKey: string
  /** "uat" للبيئة التجريبية (افتراضي) أو "live" للإنتاج */
  mode?: "uat" | "live"
  /** يُستخدم إن لم ترسل الواجهة روابط العودة */
  storefrontUrl?: string
}

type ThawaniSession = {
  session_id: string
  client_reference_id: string
  payment_status: "unpaid" | "paid" | "cancelled"
  total_amount: number
  invoice?: string
  metadata?: Record<string, unknown>
}

const BAISA = 1000 // 1 ر.ع = 1000 بيسة

/**
 * مزوّد الدفع عبر ثواني (Thawani Checkout API v1).
 * التدفق: إنشاء جلسة → تحويل الزبونة لصفحة ثواني → العودة للمتجر → completeCart
 * يتحقق من حالة الجلسة عبر API ثواني (paid) قبل اعتماد الطلب.
 */
class ThawaniPaymentProvider extends AbstractPaymentProvider<ThawaniOptions> {
  static identifier = "thawani"

  protected logger_: Logger
  protected options_: ThawaniOptions

  // المفاتيح تُقرأ عند كل استدعاء (إعدادات المتجر ثم .env) — المزوّد مسجّل دائماً، وظهوره في المنطقة بشرط وجودها (M12)
  static validateOptions(_options: Record<string, unknown>) {}

  protected get creds() {
    const c = thawaniCreds()
    const secretKey = c.secretKey ?? this.options_.secretKey
    const publishableKey = c.publishableKey ?? this.options_.publishableKey
    if (!secretKey || !publishableKey) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "مفاتيح ثواني غير مضبوطة")
    return { secretKey, publishableKey, mode: c.mode ?? this.options_.mode }
  }

  constructor(container: { logger: Logger }, options: ThawaniOptions) {
    super(container, options)
    this.logger_ = container.logger
    this.options_ = options
  }

  protected get base() {
    return this.creds.mode === "live" ? "https://checkout.thawani.om" : "https://uatcheckout.thawani.om"
  }

  protected async request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const res = await fetch(`${this.base}/api/v1${path}`, {
      method: init.method ?? "GET",
      headers: { "Content-Type": "application/json", "thawani-api-key": this.creds.secretKey },
      body: init.body ? JSON.stringify(init.body) : undefined,
    })
    const json = (await res.json().catch(() => ({}))) as { success?: boolean; description?: string; data?: T }
    if (!res.ok || json.success === false) {
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `Thawani ${path}: ${json.description ?? res.status}`)
    }
    return json.data as T
  }

  protected checkoutUrl(sessionId: string) {
    return `${this.base}/pay/${sessionId}?key=${this.creds.publishableKey}`
  }

  /** H3: ثواني يدعم الريال العُماني فقط — أي عملة أخرى تُرفض (لا تحويل صامت: 100 ر.س ≠ 100 ر.ع) */
  protected assertOmr(currency?: string) {
    if (String(currency ?? "").toLowerCase() !== "omr") {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `Thawani: العملة ${String(currency ?? "").toUpperCase() || "؟"} غير مدعومة — الريال العُماني فقط`)
    }
  }

  protected async createSession(amount: unknown, data: Record<string, unknown>, sessionId?: string) {
    const baisa = Math.round(Number(amount) * BAISA)
    if (!Number.isFinite(baisa) || baisa < 100) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Thawani: الحد الأدنى للدفع 0.100 ر.ع")
    }
    const ref = String(data.cart_id ?? sessionId ?? Date.now())
    const fallback = this.options_.storefrontUrl ?? "http://localhost:8000"
    const session = await this.request<ThawaniSession>("/checkout/session", {
      method: "POST",
      body: {
        client_reference_id: ref,
        mode: "payment",
        products: [{ name: String(data.title ?? "طلب من المتجر").slice(0, 40), quantity: 1, unit_amount: baisa }],
        success_url: String(data.success_url ?? `${fallback}/checkout`),
        cancel_url: String(data.cancel_url ?? `${fallback}/checkout`),
        metadata: { cart_id: data.cart_id ?? null, medusa_session_id: sessionId ?? null },
      },
    })
    return {
      ...data,
      session_id: session.session_id,
      invoice: session.invoice,
      amount_baisa: baisa,
      client_reference_id: ref,
      checkout_url: this.checkoutUrl(session.session_id),
    }
  }

  protected mapStatus(s?: ThawaniSession["payment_status"]) {
    if (s === "paid") return PaymentSessionStatus.CAPTURED
    if (s === "cancelled") return PaymentSessionStatus.CANCELED
    return PaymentSessionStatus.PENDING
  }

  async initiatePayment({ amount, currency_code, data, context }: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    this.assertOmr(currency_code)
    const out = await this.createSession(amount, data ?? {}, context?.idempotency_key)
    return { id: out.session_id, data: out }
  }

  async updatePayment({ amount, currency_code, data, context }: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    this.assertOmr(currency_code)
    // تغيّر المبلغ (كوبون/توصيل) → جلسة جديدة بالمبلغ الصحيح
    const prev = data ?? {}
    const baisa = Math.round(Number(amount) * BAISA)
    if (prev.session_id && prev.amount_baisa === baisa) return { data: prev }
    return { data: await this.createSession(amount, prev, context?.idempotency_key) }
  }

  async authorizePayment({ data }: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const id = data?.session_id as string | undefined
    if (!id) return { data: data ?? {}, status: PaymentSessionStatus.ERROR }
    const s = await this.request<ThawaniSession>(`/checkout/session/${id}`)
    // H2: لا نقبل الدفع إلا إن طابق المبلغ المدفوع مبلغ الجلسة، ومرجعها مرجعنا (لا جلسة سلة أخرى ولا مبلغ معدّل)
    const expected = Number(data?.amount_baisa)
    const ref = data?.client_reference_id ? String(data.client_reference_id) : null
    if (s.payment_status === "paid" && (s.total_amount !== expected || (ref && s.client_reference_id !== ref))) {
      this.logger_.error(`Thawani ${id}: عدم تطابق — المدفوع ${s.total_amount} بيسة مقابل ${expected}، المرجع ${s.client_reference_id} مقابل ${ref}`)
      return { data: { ...data, payment_status: s.payment_status, invoice: s.invoice, mismatch: true }, status: PaymentSessionStatus.ERROR }
    }
    // ثواني يحصّل المبلغ فوراً عند نجاح الدفع، لذا الحالة «مُحصّل» مباشرة
    return { data: { ...data, payment_status: s.payment_status, invoice: s.invoice }, status: this.mapStatus(s.payment_status) }
  }

  async getPaymentStatus({ data }: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const id = data?.session_id as string | undefined
    if (!id) return { status: PaymentSessionStatus.PENDING }
    const s = await this.request<ThawaniSession>(`/checkout/session/${id}`)
    return { status: this.mapStatus(s.payment_status), data: { ...data, payment_status: s.payment_status } }
  }

  async capturePayment({ data }: CapturePaymentInput): Promise<CapturePaymentOutput> {
    return { data: data ?? {} }
  }

  async retrievePayment({ data }: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const id = data?.session_id as string | undefined
    if (!id) return { data: data ?? {} }
    return { data: { ...data, session: await this.request<ThawaniSession>(`/checkout/session/${id}`) } }
  }

  async cancelPayment({ data }: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const id = data?.session_id as string | undefined
    if (id && data?.payment_status !== "paid") {
      await this.request(`/checkout/session/${id}/cancel`, { method: "POST" }).catch((e) =>
        this.logger_.warn(`Thawani cancel ${id}: ${e.message}`)
      )
    }
    return { data: data ?? {} }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return this.cancelPayment(input)
  }

  /**
   * H2: الاسترداد عبر API ثواني: payment_id من الفاتورة ثم POST /refunds.
   * ثواني يسترد المبلغ كاملاً فقط — الاسترداد الجزئي يُرفض بوضوح بدل استرداد الكل.
   */
  async refundPayment({ amount, data }: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const invoice = data?.invoice as string | undefined
    if (!invoice) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Thawani: لا فاتورة لهذه الدفعة — لا يمكن الاسترداد")
    const paid = Number(data?.amount_baisa)
    const want = Math.round(Number(amount) * BAISA)
    if (paid && want !== paid) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `Thawani يدعم الاسترداد الكامل فقط (${paid / BAISA} ر.ع) — للجزئي استخدمي قسيمة أو رصيد متجر`)
    }
    const payments = await this.request<{ payment_id: string; status?: string }[]>(`/payments?checkout_invoice=${encodeURIComponent(invoice)}&limit=10&skip=0`)
    const payment = (payments ?? []).find((p) => !p.status || p.status === "successful") ?? payments?.[0]
    if (!payment?.payment_id) throw new MedusaError(MedusaError.Types.NOT_FOUND, `Thawani: لم يُعثر على دفعة للفاتورة ${invoice}`)
    const refund = await this.request<{ refund_id?: string; status?: string }>("/refunds", {
      method: "POST",
      body: { payment_id: payment.payment_id, reason: "طلب استرداد من لوحة المتجر", metadata: { session_id: data?.session_id ?? null } },
    })
    return { data: { ...data, refund_id: refund?.refund_id ?? null, refund_status: refund?.status ?? "requested" } }
  }

  async getWebhookActionAndData(payload: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult> {
    const body = (payload.data ?? {}) as { event_type?: string; data?: { session_id?: string } }
    const sessionId = body.data?.session_id
    if (!sessionId) return { action: PaymentActions.NOT_SUPPORTED }
    // لا نثق بمحتوى الـwebhook: نتحقق من الحالة مباشرة من API ثواني
    const s = await this.request<ThawaniSession>(`/checkout/session/${sessionId}`).catch(() => null)
    const medusaSessionId = s?.metadata?.medusa_session_id as string | undefined
    if (!s || !medusaSessionId) return { action: PaymentActions.NOT_SUPPORTED }
    if (s.payment_status === "paid") {
      return { action: PaymentActions.SUCCESSFUL, data: { session_id: medusaSessionId, amount: s.total_amount / BAISA } }
    }
    if (s.payment_status === "cancelled") {
      return { action: PaymentActions.CANCELED, data: { session_id: medusaSessionId, amount: s.total_amount / BAISA } }
    }
    return { action: PaymentActions.NOT_SUPPORTED }
  }
}

export default ThawaniPaymentProvider
