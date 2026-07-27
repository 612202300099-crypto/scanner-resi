/**
 * Desty Omni API Client
 * Handles authentication, token refresh, and API calls
 * 
 * Ref: https://api.desty.app/ (OpenAPI 2026.6.26)
 */

const DESTY_API_BASE = "https://api.desty.app";

interface DestyToken {
  accessToken: string;
  tokenType: string;
  expireTime: number; // timestamp in milliseconds
}

interface DestyApiResponse<T = unknown> {
  code: string;
  msg: string;
  data: T;
}

// ============================================================
// AUTH
// ============================================================

/**
 * Apply for authorization — returns applyId needed for token request
 */
export async function applyAuthorization(config: {
  companyName: string;
  companyEmail: string;
  username: string;
  email: string;
  mobile: string;
}): Promise<string> {
  const res = await fetch(`${DESTY_API_BASE}/api/auth/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });

  if (!res.ok) {
    throw new Error(`Apply auth failed: ${res.status} ${await res.text()}`);
  }

  const json: DestyApiResponse<{ applyId: string }> = await res.json();
  if (json.code !== "0") {
    throw new Error(`Apply auth error: ${json.msg}`);
  }

  return json.data.applyId;
}

/**
 * Get access token using applyId + credentials
 * Token valid for 30 days
 */
export async function getAccessToken(config: {
  applyId: string;
  username: string;
  mobile: string;
}): Promise<DestyToken> {
  const res = await fetch(`${DESTY_API_BASE}/api/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });

  if (!res.ok) {
    throw new Error(`Token request failed: ${res.status} ${await res.text()}`);
  }

  const json: DestyApiResponse<DestyToken> = await res.json();
  if (json.code !== "0") {
    throw new Error(`Token error: ${json.msg}`);
  }

  return json.data;
}

// ============================================================
// ORDERS
// ============================================================

export interface DestyOrder {
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
  totalSales?: number;
  insuranceCost?: number;
  paymentMethod?: string;
  platform: string;
  platformName: string;
  preOrder: boolean;
  codOrder: boolean;
  storeId?: string;
  storeName: string;
  packageCount: number;
  totalWeight: number;
  packageOrganizeType?: string;
  shippedStatus?: string;
  customerInfo?: {
    name: string;
    phone?: string;
    email?: string;
  };
  itemList?: DestyOrderItem[];
  logisticStatus?: string;
  cancelBy?: string;
  cancelReason?: string;
  isStockReturned?: boolean;
  shopifyThirdParty?: boolean;
  tiktokNDD?: boolean;
  orderEditTimes?: number;
  pickupCode?: string;
  refundAmount?: number;
  sellerDiscount?: number;
  totalInvoice?: number;
  finalShippingFee?: number;
  serviceFee?: number;
  escrowAmount?: string;
  otherCost?: number;
}

export interface DestyOrderItem {
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
  returnQuantity?: number;
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
    packageId?: string;
    courier?: string;
    shipper?: string;
    portCode?: string;
    regionCode?: string;
    returnPortCode?: string;
    isShipped: boolean;
  };
}

interface OrderPageParams {
  platform?: string;
  startDate?: number;
  endDate?: number;
  status?: string;
  pageNumber?: number;
  pageSize?: number;
}

interface OrderPageResult {
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
  results: DestyOrder[];
}

/**
 * List orders from Desty Omni
 */
export async function listOrders(
  accessToken: string,
  params: OrderPageParams = {}
): Promise<OrderPageResult> {
  const res = await fetch(`${DESTY_API_BASE}/api/order/page`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: accessToken,
    },
    body: JSON.stringify({
      platform: params.platform,
      startDate: params.startDate,
      endDate: params.endDate,
      status: params.status,
      pageNumber: params.pageNumber || 1,
      pageSize: params.pageSize || 500,
    }),
  });

  if (!res.ok) {
    throw new Error(`List orders failed: ${res.status} ${await res.text()}`);
  }

  const json: DestyApiResponse<OrderPageResult> = await res.json();
  if (json.code !== "0") {
    throw new Error(`List orders error: ${json.msg}`);
  }

  return json.data;
}

/**
 * Get single order detail
 */
export async function getOrderDetail(
  accessToken: string,
  orderId: string
): Promise<DestyOrder> {
  const res = await fetch(
    `${DESTY_API_BASE}/api/order/detail?orderId=${encodeURIComponent(orderId)}`,
    {
      method: "GET",
      headers: {
        Authorization: accessToken,
      },
    }
  );

  if (!res.ok) {
    throw new Error(
      `Get order detail failed: ${res.status} ${await res.text()}`
    );
  }

  const json: DestyApiResponse<DestyOrder> = await res.json();
  if (json.code !== "0") {
    throw new Error(`Get order detail error: ${json.msg}`);
  }

  return json.data;
}

/**
 * Request order pickup (update tracking number)
 */
export async function requestPickup(
  accessToken: string,
  orderId: string,
  warehouseId: string,
  shipmentInfo: Array<{ orderItemId: string; trackingNumber: string }>
): Promise<boolean> {
  const res = await fetch(`${DESTY_API_BASE}/api/order/pickup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: accessToken,
    },
    body: JSON.stringify({ orderId, warehouseId, shipmentInfo }),
  });

  if (!res.ok) {
    throw new Error(`Request pickup failed: ${res.status} ${await res.text()}`);
  }

  const json: DestyApiResponse<boolean> = await res.json();
  return json.data;
}

/**
 * Get shipping label URL
 */
export async function getShippingLabelUrl(
  accessToken: string,
  orderId: string,
  format?: "sellercenter" | "desty"
): Promise<string> {
  const params = new URLSearchParams({ orderId });
  if (format) params.set("format", format);

  const res = await fetch(
    `${DESTY_API_BASE}/api/order/print/label?${params}`,
    {
      headers: { Authorization: accessToken },
    }
  );

  if (!res.ok) {
    throw new Error(
      `Get label URL failed: ${res.status} ${await res.text()}`
    );
  }

  const json: DestyApiResponse<string> = await res.json();
  if (json.code !== "0") {
    throw new Error(`Get label URL error: ${json.msg}`);
  }

  return json.data;
}

// ============================================================
// PRODUCTS
// ============================================================

/**
 * List products (paginated, max 50 per page)
 */
export async function listProducts(
  accessToken: string,
  pageNumber = 1,
  pageSize = 50
) {
  const res = await fetch(`${DESTY_API_BASE}/api/product/page`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: accessToken,
    },
    body: JSON.stringify({ pageNumber, pageSize }),
  });

  if (!res.ok) {
    throw new Error(
      `List products failed: ${res.status} ${await res.text()}`
    );
  }

  return res.json();
}

// ============================================================
// INVENTORY
// ============================================================

/**
 * Sync product stock
 */
export async function syncStock(
  accessToken: string,
  warehouseId: string,
  stocks: Array<{
    skuNumber: string;
    onHandStock: number;
    productName?: string;
    uom?: string;
  }>
) {
  const res = await fetch(`${DESTY_API_BASE}/api/inventory/stock/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: accessToken,
    },
    body: JSON.stringify({ warehouseId, stocks }),
  });

  if (!res.ok) {
    throw new Error(`Sync stock failed: ${res.status} ${await res.text()}`);
  }

  return res.json();
}
