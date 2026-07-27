/**
 * Desty Service — Frontend API client
 * Handles Desty-related data operations via Supabase
 */

import { supabase } from '../lib/supabase';

// ============================================================
// TYPES
// ============================================================

export interface ShippingOrder {
  id: string;
  desty_order_id: string;
  order_sn: string;
  platform: string;
  platform_name: string;
  store_name: string;
  order_status: string;
  sub_status: string | null;
  shipped_status: string;
  customer_name: string;
  shipping_city: string;
  shipping_address: string;
  total_price: number;
  cod_order: boolean;
  package_count: number;
  total_weight: number;
  all_shipped: boolean;
  order_create_time: string;
  items: ShippingOrderItem[];
}

export interface ShippingOrderItem {
  id: string;
  item_name: string;
  quantity: number;
  tracking_number: string | null;
  courier: string | null;
  is_shipped: boolean;
  image_url: string | null;
}

export interface DailyShippingStats {
  date: string;
  total_orders: number;
  total_items: number;
  shipped_orders: number;
  shipped_items: number;
  pending_orders: number;
  pending_items: number;
  breakdown: Record<string, { total: number; shipped: number }>;
}

export interface DestySyncLog {
  id: string;
  sync_type: string;
  orders_fetched: number;
  orders_created: number;
  orders_updated: number;
  errors: string | null;
  started_at: string;
  completed_at: string | null;
}

// ============================================================
// ORDER QUERIES
// ============================================================

/**
 * Get today's shipping queue — orders that need to be shipped
 */
export async function getTodayShippingQueue(): Promise<ShippingOrder[]> {
  // Desty "Telah Diproses" tab = status=Processed (all have shipmentNo)
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('order_status', 'Processed')
    .order('order_create_time', { ascending: false })
    .limit(300);

  if (error) {
    console.error('Error fetching shipping queue:', error);
    return [];
  }

  if (!orders || orders.length === 0) return [];

  // Fetch all items in ONE query
  const orderIds = orders.map(o => o.id);
  const { data: allItems } = await supabase
    .from('order_items')
    .select('*')
    .in('order_id', orderIds)
    .order('item_name');

  // Map items to orders
  const itemsByOrder: Record<string, any[]> = {};
  (allItems || []).forEach(item => {
    if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
    itemsByOrder[item.order_id].push(item);
  });

  return orders.map(order => ({
    ...order,
    items: itemsByOrder[order.id] || [],
  })) as ShippingOrder[];
}

/**
 * Get daily shipping stats
 */
export async function getDailyShippingStats(): Promise<DailyShippingStats | null> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('daily_shipping_queue')
    .select('*')
    .eq('date', today)
    .single();

  if (error) {
    // Try to refresh
    await supabase.rpc('refresh_daily_shipping_queue');
    const { data: fresh } = await supabase
      .from('daily_shipping_queue')
      .select('*')
      .eq('date', today)
      .single();
    return fresh as DailyShippingStats | null;
  }

  return data as DailyShippingStats;
}

/**
 * Search order by tracking number (resi)
 */
export async function findOrderByTracking(
  trackingNumber: string
): Promise<ShippingOrderItem | null> {
  const { data, error } = await supabase
    .from('order_items')
    .select('*, orders(*)')
    .eq('tracking_number', trackingNumber)
    .single();

  if (error || !data) return null;

  return {
    ...data,
    order: data.orders,
  } as unknown as ShippingOrderItem;
}

/**
 * Match a scanned tracking number to an unshipped order item
 */
export async function matchScanToOrderItem(
  trackingNumber: string
): Promise<{
  orderItem: ShippingOrderItem;
  order: ShippingOrder;
} | null> {
  const { data: item, error } = await supabase
    .from('order_items')
    .select('*, orders(*)')
    .eq('tracking_number', trackingNumber)
    .eq('is_shipped', false)
    .single();

  if (error || !item) return null;

  return {
    orderItem: item as unknown as ShippingOrderItem,
    order: (item as unknown as { orders: ShippingOrder }).orders,
  };
}

/**
 * Mark order item as shipped (after scan)
 */
export async function markItemAsShipped(
  itemId: string,
  _scanId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('order_items')
    .update({
      is_shipped: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId);

  if (error) {
    console.error('Error marking item as shipped:', error);
    return false;
  }

  // Check if all items in order are shipped → update order.all_shipped
  const { data: item } = await supabase
    .from('order_items')
    .select('order_id')
    .eq('id', itemId)
    .single();

  if (item) {
    const { data: unshipped } = await supabase
      .from('order_items')
      .select('id', { count: 'exact' })
      .eq('order_id', item.order_id)
      .eq('is_shipped', false);

    if (unshipped && unshipped.length === 0) {
      await supabase
        .from('orders')
        .update({
          all_shipped: true,
          shipped_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.order_id);
    }
  }

  // Refresh daily queue
  await supabase.rpc('refresh_daily_shipping_queue');

  return true;
}

// ============================================================
// SYNC LOGS
// ============================================================

export async function getSyncLogs(limit = 10): Promise<DestySyncLog[]> {
  const { data, error } = await supabase
    .from('desty_sync_log')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching sync logs:', error);
    return [];
  }

  return data as DestySyncLog[];
}

// ============================================================
// PLATFORM HELPER
// ============================================================

export const PLATFORM_COLORS: Record<string, string> = {
  shopee: '#ee4d2d',
  tokopedia: '#42b549',
  tiktok: '#000000',
  lazada: '#0f1568',
  blibli: '#0095d9',
  zalora: '#000000',
  destyStore: '#6366f1',
  destyPos: '#8b5cf6',
};

export const PLATFORM_ICONS: Record<string, string> = {
  shopee: '🛒',
  tokopedia: '🦉',
  tiktok: '🎵',
  lazada: '🛍️',
  blibli: '📚',
  zalora: '👗',
  destyStore: '🏪',
  destyPos: '🏬',
};

export function getPlatformColor(platform: string): string {
  return PLATFORM_COLORS[platform] || '#64748b';
}

export function getPlatformIcon(platform: string): string {
  return PLATFORM_ICONS[platform] || '📦';
}
