import { supabase } from './supabase';

export const navigateToShipment = async (
  shipmentId: string,
  navigation: any,
  source: 'home' | 'shipments' = 'home',
): Promise<void> => {
  const { data: shipment } = await supabase
    .from('shipments')
    .select('id, status, slot_name, slot_tag, slot_rate, rate_currency, warehouse_address')
    .eq('id', shipmentId)
    .single();

  if (!shipment) return;

  if (shipment.status === 'in_progress') {
    navigation.navigate('ShipmentWorkspace', {
      shipmentId: shipment.id,
      source,
      slot: {
        name:              shipment.slot_name  || '',
        tag:               shipment.slot_tag   || '',
        general_rate:      shipment.slot_rate  || 0,
        currency:          shipment.rate_currency || 'USD',
        warehouse_address: shipment.warehouse_address || null,
      },
    });
  } else {
    navigation.navigate('ShipmentDetail', {
      shipmentId:  shipment.id,
      isCompleted: shipment.status === 'delivered',
    });
  }
};
