
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { CertificationTable } from '@/components/CertificationTable';
import { CertificationForm } from '@/components/CertificationForm';
import { Certification } from '@/lib/types';
import { getCertifications, addCertification, updateCertification, sortCertifications } from '@/lib/storage';
import { toast } from 'sonner';

const Index = () => {
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCertification, setSelectedCertification] = useState<Certification | undefined>();
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
  
  // Load certifications on mount
  useEffect(() => {
    loadCertifications();
  }, []);
  
  const loadCertifications = () => {
    const data = getCertifications();
    // Sort certifications - overdue first, then in progress, then completed last
    sortCertifications(data);
    setCertifications(data);
  };
  
  const handleCreateNew = () => {
    setSelectedCertification(undefined);
    setFormMode('create');
    setIsFormOpen(true);
  };
  
  const handleEdit = (certification: Certification) => {
    setSelectedCertification(certification);
    setFormMode('edit');
    setIsFormOpen(true);
  };
  
  const handleView = (certification: Certification) => {
    setSelectedCertification(certification);
    setFormMode('view');
    setIsFormOpen(true);
  };
  
  const handleSubmit = (data: Omit<Certification, 'id' | 'serialNumber' | 'createdAt' | 'lastUpdatedOn'>) => {
    try {
      if (formMode === 'create') {
        // Create new certification
        const newCertification = addCertification(data);
        loadCertifications(); // Reload to ensure sorting is applied
        toast.success('Certification created successfully');
      } else if (formMode === 'edit' && selectedCertification) {
        // Update existing certification
        const updatedCertification = updateCertification(selectedCertification.id, data);
        if (updatedCertification) {
          loadCertifications(); // Reload to ensure sorting is applied
          toast.success('Certification updated successfully');
        }
      }
    } catch (error) {
      console.error('Error handling form submission:', error);
      toast.error('Failed to save certification');
    }
  };

  return (
    <div className="container py-8 max-w-[1400px]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Certification Board</h1>
        <Button onClick={handleCreateNew} className="bg-brand-500 hover:bg-brand-600">
          <Plus className="h-4 w-4 mr-2" />
          Create New
        </Button>
      </div>
      
      <CertificationTable 
        certifications={certifications}
        onEdit={handleEdit}
        onView={handleView}
        onDelete={() => {}} // Delete functionality removed as per requirements
        onDataChange={loadCertifications}
      />
      
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
