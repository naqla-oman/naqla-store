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

  static validateOptions(options: Record<string, unknown>) {
    if (!options.secretKey || !options.publishableKey) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Thawani: secretKey و publishableKey مطلوبان")
    }
  }

  constructor(container: { logger: Logger }, options: ThawaniOptions) {
    super(container, options)
    this.logger_ = container.logger
    this.options_ = options
  }

  protected get base() {
    return this.options_.mode === "live" ? "https://checkout.thawani.om" : "https://uatcheckout.thawani.om"
  }

  protected async request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const res = await fetch(`${this.base}/api/v1${path}`, {
      method: init.method ?? "GET",
      headers: { "Content-Type": "application/json", "thawani-api-key": this.options_.secretKey },
      body: init.body ? JSON.stringify(init.body) : undefined,
    })
    const json = (await res.json().catch(() => ({}))) as { success?: boolean; description?: string; data?: T }
    if (!res.ok || json.success === false) {
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `Thawani ${path}: ${json.description ?? res.status}`)
    }
    return json.data as T
  }

  protected checkoutUrl(sessionId: string) {
    return `${this.base}/pay/${sessionId}?key=${this.options_.publishableKey}`
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
      checkout_url: this.checkoutUrl(session.session_id),
    }
  }

  protected mapStatus(s?: ThawaniSession["payment_status"]) {
    if (s === "paid") return PaymentSessionStatus.CAPTURED
    if (s === "cancelled") return PaymentSessionStatus.CANCELED
    return PaymentSessionStatus.PENDING
  }

  async initiatePayment({ amount, data, context }: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const out = await this.createSession(amount, data ?? {}, context?.idempotency_key)
    return { id: out.session_id, data: out }
  }

  async updatePayment({ amount, data, context }: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
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

  async refundPayment(_: RefundPaymentInput): Promise<RefundPaymentOutput> {
    // يتطلب payment_id من حساب التاجر الفعلي؛ يُفعَّل بعد الحصول على حساب ثواني
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "الاسترداد عبر ثواني غير مفعّل بعد — نفّذيه من لوحة تاجر ثواني ثم سجّليه يدوياً"
    )
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
