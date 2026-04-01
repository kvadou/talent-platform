'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { HeartIcon, EyeSlashIcon, UserGroupIcon } from '@heroicons/react/24/outline';

export default function InclusionPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Inclusion Tools</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure inclusion settings to promote fair hiring
        </p>
      </div>

      <Card>
        <CardHeader
          title="Blind Hiring"
          action={<Badge variant="success">Enabled</Badge>}
        />
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <EyeSlashIcon className="w-6 h-6 text-brand-purple" />
                <div>
                  <p className="font-medium text-gray-900">Hide candidate names</p>
                  <p className="text-sm text-gray-500">Names hidden during initial screening</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-purple"></div>
              </label>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <EyeSlashIcon className="w-6 h-6 text-brand-purple" />
                <div>
                  <p className="font-medium text-gray-900">Hide photos</p>
                  <p className="text-sm text-gray-500">Profile photos hidden until offer stage</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-purple"></div>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Diversity Reporting" />
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <UserGroupIcon className="w-6 h-6 text-brand-purple" />
              <div>
                <p className="font-medium text-gray-900">EEO Data Collection</p>
                <p className="text-sm text-gray-500">Collect voluntary demographic information</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-purple"></div>
            </label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
