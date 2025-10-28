export type MidtransCustomer = {
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
};

export type MidtransItem = {
  id: string;
  name: string;
  price: number; // IDR
  quantity: number;
};

export function buildMidtransPayload(params: {
  orderId: string;
  customer: MidtransCustomer;
  items: MidtransItem[];
}): any {
  const gross = params.items.reduce((sum, it) => sum + (Number(it.price) * Number(it.quantity)), 0);
  return {
    transaction_details: {
      order_id: params.orderId,
      gross_amount: Math.round(gross)
    },
    credit_card: { secure: true },
    customer_details: {
      first_name: params.customer.first_name,
      last_name: params.customer.last_name ?? '',
      email: params.customer.email,
      phone: params.customer.phone ?? ''
    },
    item_details: params.items.map(i => ({
      id: i.id,
      name: i.name.slice(0, 50),
      price: Math.round(Number(i.price)),
      quantity: Number(i.quantity)
    }))
  };
}

