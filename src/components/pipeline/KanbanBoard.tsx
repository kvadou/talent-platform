'use client';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useMemo, useState } from 'react';
import { StageColumn } from './StageColumn';
import { ApplicationCardData } from './ApplicationCard';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ArrowPathIcon, FunnelIcon, CheckIcon } from '@heroicons/react/24/outline';
import { Card, CardContent } from '@/components/ui/Card';

export type StageData = { id: string; name: string; order: number };
export type ApplicationData = ApplicationCardData & { stageId: string };

async function moveStage(applicationId: string, stageId: string) {
  const res = await fetch(`/api/applications/${applicationId}/move-stage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stageId })
  });
  if (!res.ok) throw new Error('Failed to move stage');
}

export function KanbanBoard({
  jobId,
  stages,
  applications,
  metrics
}: {
  jobId: string;
  stages: StageData[];
  applications: ApplicationData[];
  metrics?: Record<string, { count: number; avgDaysInStage: number; slaBreaches: number }>;
}) {
  const [items, setItems] = useState(applications);
  const columns = useMemo(() => stages.sort((a, b) => a.order - b.order), [stages]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);

  const grouped = useMemo(() => {
    return columns.reduce<Record<string, ApplicationData[]>>((acc, stage) => {
      // Filter by stage and sort by AI score (highest first, nulls last)
      acc[stage.id] = items
        .filter((item) => item.stageId === stage.id)
        .sort((a, b) => {
          const scoreA = a.matchScore ?? -1;
          const scoreB = b.matchScore ?? -1;
          return scoreB - scoreA; // Descending order
        });
      return acc;
    }, {});
  }, [columns, items]);

  async function handleDragEnd(event: DragEndEvent) {
    const { over, active } = event;
    if (!over) return;
    const stageId = over.id as string;
    const appId = active.id as string;
    const app = items.find((i) => i.id === appId);
    if (!app || app.stageId === stageId) return;
    setItems((prev) => prev.map((item) => (item.id === appId ? { ...item, stageId } : item)));
    try {
      await moveStage(appId, stageId);
    } catch (err) {
      console.error(err);
      // Revert on error
      setItems((prev) => prev.map((item) => (item.id === appId ? app : item)));
    }
  }

  async function handleBulkMove(stageId: string) {
    setBulkActionLoading(true);
    try {
      const res = await fetch('/api/applications/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'move_stage',
          applicationIds: Array.from(selectedIds),
          stageId,
        }),
      });
      if (res.ok) {
        setItems(prev => prev.map(item =>
          selectedIds.has(item.id) ? { ...item, stageId } : item
        ));
        setSelectedIds(new Set());
        setShowBulkMoveModal(false);
        setBulkMode(false);
      }
    } catch (err) {
      console.error('Bulk move failed:', err);
    } finally {
      setBulkActionLoading(false);
    }
  }

  async function handleBulkReject() {
    setBulkActionLoading(true);
    try {
      const res = await fetch('/api/applications/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          applicationIds: Array.from(selectedIds),
          sendEmail: false,
        }),
      });
      if (res.ok) {
        setItems(prev => prev.filter(item => !selectedIds.has(item.id)));
        setSelectedIds(new Set());
        setBulkMode(false);
      }
    } catch (err) {
      console.error('Bulk reject failed:', err);
    } finally {
      setBulkActionLoading(false);
    }
  }

  const totalCandidates = items.length;

  return (
    <div className="space-y-5">
      {/* Pipeline Controls */}
      <Card variant="elevated">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-navy-900">
              <FunnelIcon className="h-5 w-5 text-purple-600" />
              <span>{totalCandidates} Candidates in Pipeline</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={bulkMode ? 'primary' : 'outline'}
              size="sm"
              icon={<CheckIcon className="h-4 w-4" />}
              onClick={() => {
                setBulkMode(!bulkMode);
                setSelectedIds(new Set());
              }}
            >
              {bulkMode ? `${selectedIds.size} Selected` : 'Select'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<ArrowPathIcon className="h-4 w-4" />}
              onClick={() => setItems(applications)}
            >
              Reset Board
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Kanban Board */}
      <DndContext onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
          <div className="inline-flex gap-4 min-w-full">
            {columns.map((stage, index) => {
              // Assign brand colors to stages in sequence
              const accentColors = ['purple', 'cyan', 'yellow', 'purple', 'cyan', 'yellow'];
              const accentColor = accentColors[index % accentColors.length];

              return (
                <div key={stage.id} className="flex-1 min-w-[280px] sm:min-w-[320px]">
                  <SortableContext
                    items={grouped[stage.id] ?? []}
                    strategy={verticalListSortingStrategy}
                  >
                    <StageColumn
                      id={stage.id}
                      name={stage.name}
                      applications={grouped[stage.id] ?? []}
                      metrics={metrics?.[stage.id]}
                      accentColor={accentColor as 'purple' | 'cyan' | 'yellow'}
                      jobId={jobId}
                      bulkMode={bulkMode}
                      selectedIds={selectedIds}
                      onToggleSelect={(appId: string) => {
                        setSelectedIds(prev => {
                          const next = new Set(prev);
                          if (next.has(appId)) next.delete(appId);
                          else next.add(appId);
                          return next;
                        });
                      }}
                      onSelectAll={(appIds: string[]) => {
                        setSelectedIds(prev => {
                          const next = new Set(prev);
                          const allSelected = appIds.every(id => next.has(id));
                          if (allSelected) {
                            appIds.forEach(id => next.delete(id));
                          } else {
                            appIds.forEach(id => next.add(id));
                          }
                          return next;
                        });
                      }}
                    />
                  </SortableContext>
                </div>
              );
            })}
          </div>
        </div>
      </DndContext>

      {/* Bulk Action Bar */}
      {bulkMode && selectedIds.size > 0 && (
        <div className="sticky bottom-4 z-30">
          <Card variant="elevated" className="border-purple-200 shadow-xl">
            <CardContent className="flex items-center justify-between gap-4 py-3">
              <span className="text-sm font-semibold text-navy-900">
                {selectedIds.size} candidate{selectedIds.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkMoveModal(true)}
                  disabled={bulkActionLoading}
                >
                  Move to Stage
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-danger-600 border-danger-300 hover:bg-danger-50"
                  onClick={handleBulkReject}
                  loading={bulkActionLoading}
                >
                  Reject
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bulk Move Modal */}
      <Modal
        open={showBulkMoveModal}
        onClose={() => setShowBulkMoveModal(false)}
        title={`Move ${selectedIds.size} candidate${selectedIds.size !== 1 ? 's' : ''}`}
      >
        <div className="space-y-2">
          {columns.map((stage) => (
            <button
              key={stage.id}
              className="w-full text-left px-4 py-3 rounded-lg hover:bg-purple-50 transition-colors text-sm font-medium text-gray-700 hover:text-purple-700"
              onClick={() => handleBulkMove(stage.id)}
              disabled={bulkActionLoading}
            >
              {stage.name}
            </button>
          ))}
        </div>
      </Modal>

      {/* Empty State */}
      {totalCandidates === 0 && (
        <Card variant="elevated">
          <CardContent className="py-16 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-cyan-100 flex items-center justify-center mb-4">
              <FunnelIcon className="h-8 w-8 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-navy-900 mb-2">No candidates yet</h3>
            <p className="text-slate-600">
              Candidates will appear here as they apply to this position
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
