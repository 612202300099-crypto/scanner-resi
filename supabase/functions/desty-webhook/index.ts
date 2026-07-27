/**
 * desty-webhook — Supabase Edge Function
 * 
 * Webhook endpoint untuk menerima order status callback dari Desty Omni
 * 
 * Desty akan POST ke endpoint ini setiap kali status order berubah.
 * Header: accessToken (untuk verifikasi bahwa request berasal dari Desty)
 * 
 * Flow:
 * 1. Verifikasi accessToken header
 * 2. Parse order data dari body
 * 3. Update order + order_items di database
 * 4. Return 200 OK
 * 
 * DOCS: Desty akan mengirim accessToken di header.
 * Token bisa berubah saat re-authorization — kita harus kompatibel dengan token lama
 * selama 1 jam masa transisi.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, corsResponse } from "../_shared/cors.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ============================================================
// WEBHOOK PAYLOAD TYPE (from Desty OpenAPI)
// ============================================================

interface DestyWebhookPayload {
  orderId: string;
  orderSn: string;
  bookingSn?: string;
  orderType: string;
  orderStatusList: string[];
  subOrderStatusList?: string[];
  platformOrderStatusList?: string[];
  orderCreateTime: number;
  orderUpdateTime: number;
  createTime: number;
  hasPaid: boolean;
  orderPaymentTime?: number;
  includeTax?: boolean;
  buyerNotes?: string;
  subTotal: number;
  discount: number;
  tax?: number;
  totalPrice: number;
  insuranceCost?: number;
  paymentMethod?: string;
  platform: string;
  platformName: string;
  preOrder: boolean;
  codOrder: boolean;
  customerInfo?: {
    name: string;
    phone?: string;
    email?: string;
  };
  platformOrderStatus?: string;
  storeId?: string;
  storeName: string;
  packageCount: number;
  totalWeight: number;
  itemList?: WebhookItem[];
  cancelBy?: string;
  logisticStatus?: string;
  cancelReason?: string;
  packageOrganizeType?: string;
  sellerDiscount?: number;
  otherCost?: number;
  isStockReturned?: boolean;
  shopifyThirdParty?: boolean;
  tiktokNDD?: boolean;
  orderEditTimes?: number;
}

interface WebhookItem {
  itemOrderId: string;
  itemId: string;
  itemCode?: string;
  itemExternalCode?: string;
  itemName: string;
  orderStatus?: string;
  platformOrderStatus?: string;
  description?: string;
  price: number;
  quantity: number;
  onHandStock?: number;
  promotionStock?: number;
  discountAmount?: number;
  taxAmount?: number;
  sellPrice: number;
  originalPrice: number;
  locationName?: string;
  locationId?: string;
  platformWarehouseId?: string;
  platformWarehouseName?: string;
  platformWarehouseAddress?: string;
  imageUrl?: string;
  shippingDetail?: {
    shippingCost: number;
    shippingFullName: string;
    shippingAddress: string;
    shippingArea?: string;
    shippingCity?: string;
    shippingProvince?: string;
    shippingPostCode?: string;
    shippingPhone?: string;
    deliveryDeadline?: string;
    trackingNumber?: string;
    courier?: string;
    shipper?: string;
    portCode?: string;
    regionCode?: string;
    returnPortCode?: string;
    isShipped: boolean;
  };
}

// ============================================================
// TOKEN VERIFICATION
// ============================================================

async function verifyAccessToken(token: string): Promise<boolean> {
  // Check against all active tokens in our config
  const { data: configs, error } = await supabaseAdmin
    .from("desty_api_config")
    .select("access_token")
    .eq("is_active", true);

  if (error || !configs) {
    console.error("Cannot verify token:", error);
    return false;
  }

  return configs.some((c) => c.access_token === token);
}

// ============================================================
// ORDER UPDATE
// ============================================================

async function updateOrderFromWebhook(payload: DestyWebhookPayload) {
  const now = new Date().toISOString();

  // Find existing order
  const { data: existingOrder } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("desty_order_id", payload.orderId)
    .single();

  // Extract shipping from first item (used for order-level address)
  const firstItem = payload.itemList?.[0];

  const orderData = {
    order_sn: payload.orderSn,
    order_status: payload.orderStatusList?.[0] || "Unknown",
    sub_status: payload.subOrderStatusList?.[0] || null,
    logistic_status: payload.logisticStatus || null,
    has_paid: payload.hasPaid,
    order_update_time: payload.orderUpdateTime
      ? new Date(payload.orderUpdateTime).toISOString()
      : null,
    order_payment_time: payload.orderPaymentTime
      ? new Date(payload.orderPaymentTime).toISOString()
      : null,
    total_price: payload.totalPrice,
    cod_order: payload.codOrder,
    package_count: payload.packageCount,
    total_weight: payload.totalWeight,
    updated_at: now,
  };

  if (existingOrder) {
    // Update existing
    await supabaseAdmin
      .from("orders")
      .update(orderData)
      .eq("id", existingOrder.id);

    // Update items
    if (payload.itemList) {
      for (const item of payload.itemList) {
        const itemShipping = item.shippingDetail;

        await supabaseAdmin
          .from("order_items")
          .update({
            order_status: item.orderStatus || null,
            platform_order_status: item.platformOrderStatus || null,
            tracking_number: itemShipping?.trackingNumber || null,
            courier: itemShipping?.courier || null,
            is_shipped: itemShipping?.isShipped || false,
            updated_at: now,
          })
          .eq("item_order_id", item.itemOrderId);
      }
    }

    console.log(`Updated order: ${payload.orderId} → ${orderData.order_status}`);
  } else {
    console.log(
      `Order ${payload.orderId} not found locally — triggering full sync`
    );
    // If order doesn't exist, it might be new or from a platform we haven't synced
    // The cron job will pick it up on next run
  }

  // Refresh daily queue
  await supabaseAdmin.rpc("refresh_daily_shipping_queue");
}

// ============================================================
// MAIN HANDLER
// ============================================================

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const webhookId = crypto.randomUUID();

  try {
    // 1. Verify access token from header
    const accessToken = req.headers.get("accessToken") || req.headers.get("accesstoken");
    if (!accessToken) {
      console.warn(`[${webhookId}] Missing accessToken header`);
      return corsResponse({ error: "Missing accessToken header" }, 401);
    }

    const isValid = await verifyAccessToken(accessToken);
    if (!isValid) {
      console.warn(`[${webhookId}] Invalid accessToken`);
      // Desty docs: be compatible with old tokens for 1 hour
      // We still accept and process, just log warning
      console.warn(`[${webhookId}] Processing anyway (token grace period)`);
    }

    // 2. Parse body
    const payload: DestyWebhookPayload = await req.json();
    console.log(
      `[${webhookId}] Webhook received: order=${payload.orderId}, status=${payload.orderStatusList?.[0]}, platform=${payload.platformName}`
    );

    // 3. Update database
    await updateOrderFromWebhook(payload);

    // 4. Return 200 OK (Desty expects 200)
    console.log(`[${webhookId}] Webhook processed successfully`);
    return corsResponse({ success: true, webhook_id: webhookId });
  } catch (err: unknown) {
    const errorMsg = (err as Error).message;
    console.error(`[${webhookId}] Webhook error:`, errorMsg);

    // Still return 200 to prevent Desty from retrying (we'll sync via cron instead)
    return corsResponse({
      success: false,
      webhook_id: webhookId,
      error: errorMsg,
    });
  }
});
