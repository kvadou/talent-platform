'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

const ORDERS = [
  { id: 'INV-001', date: 'Dec 1, 2024', amount: '$299.00', status: 'Paid' },
  { id: 'INV-002', date: 'Nov 1, 2024', amount: '$299.00', status: 'Paid' },
  { id: 'INV-003', date: 'Oct 1, 2024', amount: '$299.00', status: 'Paid' },
  { id: 'INV-004', date: 'Sep 1, 2024', amount: '$299.00', status: 'Paid' },
];

export default function OrderHistoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Order History</h1>
        <p className="text-sm text-gray-500 mt-1">
          View your billing and order history
        </p>
      </div>

      <Card>
        <CardHeader title="Invoices" />
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100">
            {ORDERS.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                <div className="flex items-center gap-8">
                  <span className="font-mono text-sm text-gray-900">{order.id}</span>
                  <span className="text-sm text-gray-500">{order.date}</span>
                  <span className="font-medium text-gray-900">{order.amount}</span>
                  <Badge variant="success">{order.status}</Badge>
                </div>
                <button className="p-2 text-gray-400 hover:text-brand-purple hover:bg-purple-50 rounded-lg">
                  <ArrowDownTrayIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
