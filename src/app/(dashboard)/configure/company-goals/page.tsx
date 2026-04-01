'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PlusIcon, FlagIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

const GOALS = [
  { id: '1', name: 'Q1 Hiring Target', target: 25, current: 18, deadline: 'Mar 31, 2025' },
  { id: '2', name: 'Engineering Team Growth', target: 10, current: 7, deadline: 'Jun 30, 2025' },
  { id: '3', name: 'Diversity Hiring', target: 40, current: 35, deadline: 'Dec 31, 2025', unit: '%' },
];

export default function CompanyGoalsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Company Goals</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage hiring goals for your organization
          </p>
        </div>
        <Button>
          <PlusIcon className="w-4 h-4 mr-2" />
          Add Goal
        </Button>
      </div>

      <div className="grid gap-4">
        {GOALS.map((goal) => {
          const progress = (goal.current / goal.target) * 100;
          return (
            <Card key={goal.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-50 rounded-lg">
                      <FlagIcon className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{goal.name}</h3>
                      <p className="text-xs text-gray-500">Due {goal.deadline}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-gray-400 hover:text-brand-purple hover:bg-purple-50 rounded-lg">
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Progress</span>
                    <span className="font-medium text-gray-900">
                      {goal.current}{goal.unit || ''} / {goal.target}{goal.unit || ''} ({Math.round(progress)}%)
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
