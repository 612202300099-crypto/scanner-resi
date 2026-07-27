/**
 * desty-sync — Supabase Edge Function
 * 
 * Cron job: sync orders from Desty Omni → Supabase database
 * Schedules: every 5 minutes (via pg_cron)
 * 
 * Flow:
 * 1. Read Desty API config from desty_api_config table
 * 2. Check/refresh access token
 * 3. Fetch orders (Ready_To_Ship + Shipping)
 * 4. Upsert into orders + order_items tables
 * 5. Refresh daily_shipping_queue
 * 6. Log to desty_sync_log
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getAccessToken,
  listOrders,
  getOrderDetail,
  type DestyOrder,
} from "../_shared/desty-client.ts";
import { corsHeaders, corsResponse } from "../_shared/cors.ts";

// Supabase client with service_role for admin operations
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ============================================================
// TOKEN MANAGEMENT
// ============================================================

interface DestyConfig {
  id: string;
  access_token: string;
  token_type: string;
  expire_time: string;
  apply_id: string;
  company_name: string;
  company_email: string;
}

async function getDestyConfig(): Promise<DestyConfig | null> {
  const { data, error } = await supabaseAdmin
    .from("desty_api_config")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    console.error("No active Desty config found:", error);
    return null;
  }

  return data as DestyConfig;
}

async function ensureValidToken(
  config: DestyConfig
): Promise<{ accessToken: string; config: DestyConfig }> {
  const now = Date.now();
  const expireTime = new Date(config.expire_time).getTime();

  // Token still valid (with 1-hour buffer)
  if (config.access_token && expireTime > now + 3600000) {
    console.log("Token still valid, expires:", new Date(expireTime).toISOString());
    return { accessToken: config.access_token, config };
  }

  // Need to refresh token
  console.log("Token expired or expiring soon, refreshing...");

  if (!config.apply_id) {
    throw new Error("No apply_id in config — cannot refresh token");
  }

  // Note: We need username/mobile for token refresh.
  // These should be stored in a secure location (Supabase Vault).
  // For now, using hardcoded fallback from env.
  const username = Deno.env.get("DESTY_USERNAME") || "";
  const mobile = Deno.env.get("DESTY_MOBILE") || "";

  if (!username || !mobile) {
    throw new Error(
      "DESTY_USERNAME and DESTY_MOBILE env vars required for token refresh"
    );
  }

  const tokenData = await getAccessToken({
    applyId: config.apply_id,
    username,
    mobile,
  });

  // Update config in database
  await supabaseAdmin
    .from("desty_api_config")
    .update({
      access_token: tokenData.accessToken,
      token_type: tokenData.tokenType,
      expire_time: new Date(tokenData.expireTime).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", config.id);

  return {
    accessToken: tokenData.accessToken,
    config: { ...config, access_token: tokenData.accessToken },
  };
}

// ============================================================
// ORDER SYNC
// ============================================================

async function syncOrdersFromDesty(accessToken: string): Promise<{
  fetched: number;
  created: number;
  updated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;

  // Statuses to sync: Ready_To_Ship (perlu dikirim), Shipping (sedang dikirim)
  const statusesToSync = ["Ready_To_Ship", "Shipping", "New_Orders"];

  for (const status of statusesToSync) {
    let pageNumber = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        console.log(`Fetching page ${pageNumber} for status: ${status}`);
        const result = await listOrders(accessToken, {
          status,
          pageNumber,
          pageSize: 500,
        });

        totalFetched += result.results.length;

        for (const order of result.results) {
          try {
            // Get detailed order info (includes itemList, shippingDetail, etc.)
            const detail = await getOrderDetail(accessToken, order.orderId);

            const { created, updated } = await upsertOrder(detail);
            if (created) totalCreated++;
            if (updated) totalUpdated++;
          } catch (err: unknown) {
            const msg = `Error processing order ${order.orderId}: ${
              (err as Error).message
            }`;
            console.error(msg);
            errors.push(msg);
          }

          // Rate limiting: 100ms between order detail requests
          await new Promise((r) => setTimeout(r, 100));
        }

        hasMore = pageNumber < result.totalPages;
        pageNumber++;
      } catch (err: unknown) {
        const msg = `Error fetching page ${pageNumber} for ${status}: ${
          (err as Error).message
        }`;
        console.error(msg);
        errors.push(msg);
        hasMore = false;
      }
    }
  }

  return {
    fetched: totalFetched,
    created: totalCreated,
    updated: totalUpdated,
    errors,
  };
}

// ============================================================
// DATABASE UPSERT
// ============================================================

async function upsertOrder(
  order: DestyOrder
): Promise<{ created: boolean; updated: boolean }> {
  const now = new Date().toISOString();

  // Extract shipping info from first item
  const firstItem = order.itemList?.[0];
  const shippingDetail = firstItem?.shippingDetail;

  const orderData = {
    desty_order_id: order.orderId,
    order_sn: order.orderSn,
    booking_sn: order.bookingSn || null,
    platform: order.platformName || order.platform || "unknown",
    platform_name: order.platformName,
    store_id: order.storeId || null,
    store_name: order.storeName,
    order_type: order.orderType || "DEFAULT_ORDER",
    order_status: order.orderStatusList?.[0] || "Unknown",
    sub_status: order.subOrderStatusList?.[0] || null,
    logistic_status: order.logisticStatus || null,
    shipped_status: order.shippedStatus || "NotShipped",
    customer_name: order.customerInfo?.name || null,
    customer_phone: order.customerInfo?.phone || null,
    customer_email: order.customerInfo?.email || null,
    buyer_notes: order.buyerNotes || null,
    shipping_full_name: shippingDetail?.shippingFullName || null,
    shipping_address: shippingDetail?.shippingAddress || null,
    shipping_area: shippingDetail?.shippingArea || null,
    shipping_city: shippingDetail?.shippingCity || null,
    shipping_province: shippingDetail?.shippingProvince || null,
    shipping_post_code: shippingDetail?.shippingPostCode || null,
    shipping_phone: shippingDetail?.shippingPhone || null,
    delivery_deadline: shippingDetail?.deliveryDeadline
      ? new Date(Number(shippingDetail.deliveryDeadline)).toISOString()
      : null,
    sub_total: order.subTotal,
    discount: order.discount,
    tax: order.tax || 0,
    total_price: order.totalPrice,
    insurance_cost: order.insuranceCost || 0,
    payment_method: order.paymentMethod || null,
    cod_order: order.codOrder || false,
    has_paid: order.hasPaid || false,
    total_sales: order.totalSales || null,
    seller_discount: order.sellerDiscount || 0,
    final_shipping_fee: order.finalShippingFee || 0,
    service_fee: order.serviceFee || 0,
    escrow_amount: order.escrowAmount || null,
    other_cost: order.otherCost || 0,
    package_count: order.packageCount || 1,
    total_weight: order.totalWeight || 0,
    package_organize_type: order.packageOrganizeType || null,
    order_create_time: order.orderCreateTime
      ? new Date(order.orderCreateTime).toISOString()
      : null,
    order_update_time: order.orderUpdateTime
      ? new Date(order.orderUpdateTime).toISOString()
      : null,
    order_payment_time: order.orderPaymentTime
      ? new Date(order.orderPaymentTime).toISOString()
      : null,
    pre_order: order.preOrder || false,
    tiktok_ndd: order.tiktokNDD || false,
    shopify_third_party: order.shopifyThirdParty || false,
    order_edit_times: order.orderEditTimes || 0,
    synced_at: now,
    updated_at: now,
  };

  // Upsert order (by unique desty_order_id)
  const { data: existingOrder } = await supabaseAdmin
    .from("orders")
    .select("id, all_shipped")
    .eq("desty_order_id", order.orderId)
    .single();

  let orderId: string;
  let created = false;
  let updated = false;

  if (existingOrder) {
    orderId = existingOrder.id;
    const { error } = await supabaseAdmin
      .from("orders")
      .update(orderData)
      .eq("id", orderId);
    if (!error) updated = true;
  } else {
    const { data: newOrder, error } = await supabaseAdmin
      .from("orders")
      .insert(orderData)
      .select("id")
      .single();
    if (error) throw error;
    orderId = newOrder.id;
    created = true;
  }

  // Upsert order items
  if (order.itemList && order.itemList.length > 0) {
    for (const item of order.itemList) {
      const itemData = {
        order_id: orderId,
        item_order_id: item.itemOrderId,
        item_id: item.itemId,
        item_code: item.itemCode || null,
        item_external_code: item.itemExternalCode || null,
        item_name: item.itemName,
        description: item.description || null,
        image_url: item.imageUrl || null,
        original_price: item.originalPrice,
        sell_price: item.sellPrice,
        discount_amount: item.discountAmount || 0,
        tax_amount: item.taxAmount || 0,
        quantity: item.quantity,
        return_quantity: item.returnQuantity || 0,
        location_id: item.locationId || null,
        location_name: item.locationName || null,
        platform_warehouse_id: item.platformWarehouseId || null,
        platform_warehouse_name: item.platformWarehouseName || null,
        platform_warehouse_address: item.platformWarehouseAddress || null,
        on_hand_stock: item.onHandStock || 0,
        promotion_stock: item.promotionStock || 0,
        tracking_number: item.shippingDetail?.trackingNumber || null,
        courier: item.shippingDetail?.courier || null,
        shipping_cost: item.shippingDetail?.shippingCost || 0,
        package_id: item.shippingDetail?.packageId || null,
        is_shipped: item.shippingDetail?.isShipped || false,
        order_status: item.orderStatus || null,
        platform_order_status: item.platformOrderStatus || null,
        updated_at: now,
      };

      // Upsert by item_order_id
      const { data: existingItem } = await supabaseAdmin
        .from("order_items")
        .select("id")
        .eq("item_order_id", item.itemOrderId)
        .single();

      if (existingItem) {
        await supabaseAdmin
          .from("order_items")
          .update(itemData)
          .eq("id", existingItem.id);
      } else {
        await supabaseAdmin.from("order_items").insert(itemData);
      }
    }
  }

  return { created, updated };
}

// ============================================================
// MAIN HANDLER
// ============================================================

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  const syncId = crypto.randomUUID();

  try {
    console.log(`[${syncId}] Starting Desty sync...`);

    // 1. Get API config
    const config = await getDestyConfig();
    if (!config) {
      return corsResponse(
        {
          error: "No active Desty API configuration found. Please configure desty_api_config table.",
        },
        400
      );
    }

    // 2. Ensure valid token
    const { accessToken } = await ensureValidToken(config);

    // 3. Sync orders
    const result = await syncOrdersFromDesty(accessToken);

    // 4. Refresh daily queue
    const { error: queueError } = await supabaseAdmin.rpc(
      "refresh_daily_shipping_queue"
    );
    if (queueError) {
      console.error("Error refreshing daily queue:", queueError);
    }

    // 5. Log
    const duration = Date.now() - startTime;
    const logEntry = {
      sync_type: req.method === "POST" ? "manual" : "cron",
      orders_fetched: result.fetched,
      orders_created: result.created,
      orders_updated: result.updated,
      errors: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
    };

    await supabaseAdmin.from("desty_sync_log").insert(logEntry);

    console.log(
      `[${syncId}] Sync complete in ${duration}ms: ${result.fetched} fetched, ${result.created} created, ${result.updated} updated`
    );

    return corsResponse({
      success: true,
      sync_id: syncId,
      duration_ms: duration,
      fetched: result.fetched,
      created: result.created,
      updated: result.updated,
      errors: result.errors.length,
    });
  } catch (err: unknown) {
    const duration = Date.now() - startTime;
    const errorMsg = (err as Error).message;
    console.error(`[${syncId}] Sync failed after ${duration}ms:`, errorMsg);

    // Log error
    await supabaseAdmin.from("desty_sync_log").insert({
      sync_type: "error",
      orders_fetched: 0,
      orders_created: 0,
      orders_updated: 0,
      errors: errorMsg,
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
    });

    return corsResponse(
      {
        success: false,
        sync_id: syncId,
        error: errorMsg,
      },
      500
    );
  }
});
