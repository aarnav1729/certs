// root/src/pages/Index.tsx
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import { CertificationTable } from '@/components/CertificationTable';
import { CertificationForm } from '@/components/CertificationForm';
import { Certification } from '@/lib/types';
import {
  getCertifications,
  addCertification,
  updateCertification,
} from '@/lib/storage';
import { toast } from 'sonner';

const Index: React.FC = () => {
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCertification, setSelectedCertification] = useState<Certification>();
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
  const [loading, setLoading] = useState(false);

  // Load certifications on mount
  useEffect(() => {
    loadCertifications();
  }, []);

  const loadCertifications = async () => {
    setLoading(true);
    try {
      const data = await getCertifications();
      // Custom sorting:
      // 1. Overdue items (not completed) at the top
      // 2. In progress and not started in the middle
      // 3. Completed items at the bottom
      data.sort((a, b) => {
        const now = new Date().getTime();
        const aDue = new Date(a.dueDate).getTime();
        const bDue = new Date(b.dueDate).getTime();
        const aOverdue = aDue < now && a.status !== 'Completed';
        const bOverdue = bDue < now && b.status !== 'Completed';
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        if (a.status === 'Completed' && b.status !== 'Completed') return 1;
        if (a.status !== 'Completed' && b.status === 'Completed') return -1;
        return aDue - bDue;
      });
      setCertifications(data);
    } catch (err: any) {
      console.error('Failed to load certifications:', err);
      toast.error(`Error loading certifications: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedCertification(undefined);
    setFormMode('create');
    setIsFormOpen(true);
  };

  const handleEdit = (cert: Certification) => {
    setSelectedCertification(cert);
    setFormMode('edit');
    setIsFormOpen(true);
  };

  const handleView = (cert: Certification) => {
    setSelectedCertification(cert);
    setFormMode('view');
    setIsFormOpen(true);
  };

  const handleSubmit = async (
    data: Omit<
      Certification,
      'id' | 'serialNumber' | 'createdAt' | 'lastUpdatedOn'
    >
  ) => {
    try {
      if (formMode === 'create') {
        await addCertification(data);
        toast.success('Certification created successfully');
      } else if (formMode === 'edit' && selectedCertification) {
        await updateCertification(selectedCertification.id, data);
        toast.success('Certification updated successfully');
      }
      setIsFormOpen(false);
      await loadCertifications();
    } catch (err: any) {
      console.error('Failed to save certification:', err);
      toast.error(`Save failed: ${err.message}`);
    }
  };

  return (
    <div className="container py-8 max-w-[1400px]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Certification Board</h1>
        <Button
          onClick={handleCreateNew}
          className="bg-brand-500 hover:bg-brand-600"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create New
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin h-6 w-6 mr-2 text-gray-500" />
          <span className="text-gray-500">Loading certifications…</span>
        </div>
      ) : (
        <CertificationTable
          certifications={certifications}
          onEdit={handleEdit}
          onView={handleView}
          onDataChange={loadCertifications}
        />
      )}

      <CertificationForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleSubmit}
        initialData={selectedCertification}
        mode={formMode}
      />
    </div>
  );
};

export default Index;