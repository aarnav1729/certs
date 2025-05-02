
import { useState } from "react";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Certification, PRODUCT_TYPES, ProductType, UploadFile } from "@/lib/types";
import { fileToBase64 } from "@/lib/storage";
import { format } from "date-fns";
import { X, Upload } from "lucide-react";

interface CertificationFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Certification, 'id' | 'serialNumber' | 'createdAt' | 'updatedAt' | 'status'>) => void;
  initialData?: Certification;
  mode: 'create' | 'edit' | 'view';
}

export function CertificationForm({ 
  isOpen, 
  onClose, 
  onSubmit, 
  initialData,
  mode 
}: CertificationFormProps) {
  const [projectName, setProjectName] = useState(initialData?.projectName || '');
  const [projectDetails, setProjectDetails] = useState(initialData?.projectDetails || '');
  const [productType, setProductType] = useState<ProductType>(initialData?.productType || 'Hardware');
  const [testingLaboratory, setTestingLaboratory] = useState(initialData?.testingLaboratory || '');
  const [pic, setPic] = useState(initialData?.pic || '');
  const [updateOn, setUpdateOn] = useState(initialData?.updateOn ? initialData.updateOn.split('T')[0] : '');
  const [dueDate, setDueDate] = useState(initialData?.dueDate ? initialData.dueDate.split('T')[0] : '');
  const [remarks, setRemarks] = useState(initialData?.remarks || '');
  const [uploads, setUploads] = useState<UploadFile[]>(initialData?.uploads || []);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isCreateMode = mode === 'create';
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!projectName || !productType || !testingLaboratory || !pic || !updateOn || !dueDate) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      onSubmit({
        projectName,
        projectDetails,
        productType,
        testingLaboratory,
        pic,
        updateOn: new Date(updateOn).toISOString(),
        dueDate: new Date(dueDate).toISOString(),
        remarks,
        uploads
      });
      
      // Reset form if creating
      if (isCreateMode) {
        setProjectName('');
        setProjectDetails('');
        setProductType('Hardware');
        setTestingLaboratory('');
        setPic('');
        setUpdateOn('');
        setDueDate('');
        setRemarks('');
        setUploads([]);
      }
      
      onClose();
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error("An error occurred while saving");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    try {
      const newFiles: UploadFile[] = [];
      
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const base64 = await fileToBase64(file);
        
        newFiles.push({
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type,
          data: base64
        });
      }
      
      setUploads([...uploads, ...newFiles]);
      toast.success(`${newFiles.length} file(s) uploaded successfully`);
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error("Failed to upload files");
    }
  };

  const handleRemoveFile = (id: string) => {
    setUploads(uploads.filter(file => file.id !== id));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isCreateMode ? 'Create New Certification' : 
             isEditMode ? 'Edit Certification' : 'View Certification'}
          </DialogTitle>
          <DialogDescription>
            {isCreateMode ? 'Fill in the details to create a new certification.' :
             isEditMode ? 'Update the certification details.' : 'Certification details.'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="projectName">Project Name *</Label>
                <Input 
                  id="projectName" 
                  value={projectName} 
                  onChange={(e) => setProjectName(e.target.value)}
                  disabled={isViewMode}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="productType">Product Type *</Label>
                <Select 
                  value={productType} 
                  onValueChange={(value: ProductType) => setProductType(value)}
                  disabled={isViewMode}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product type" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="projectDetails">Project Details</Label>
              <Textarea 
                id="projectDetails" 
                value={projectDetails} 
                onChange={(e) => setProjectDetails(e.target.value)}
                className="min-h-[100px]"
                disabled={isViewMode}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="testingLaboratory">Testing Laboratory *</Label>
                <Input 
                  id="testingLaboratory" 
                  value={testingLaboratory} 
                  onChange={(e) => setTestingLaboratory(e.target.value)}
                  disabled={isViewMode}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="pic">Person In Charge (PIC) *</Label>
                <Input 
                  id="pic" 
                  value={pic} 
                  onChange={(e) => setPic(e.target.value)}
                  disabled={isViewMode}
                  required
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="updateOn">Update On *</Label>
                <Input 
                  id="updateOn" 
                  type="date" 
                  value={updateOn} 
                  onChange={(e) => setUpdateOn(e.target.value)}
                  disabled={isViewMode}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date *</Label>
                <Input 
                  id="dueDate" 
                  type="date" 
                  value={dueDate} 
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={isViewMode}
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea 
                id="remarks" 
                value={remarks} 
                onChange={(e) => setRemarks(e.target.value)}
                disabled={isViewMode}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Uploads</Label>
              {!isViewMode && (
                <div className="flex items-center gap-2 mb-4">
                  <Input
                    id="fileUpload"
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    multiple
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('fileUpload')?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Files
                  </Button>
                </div>
              )}
              
              {uploads.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {uploads.map((file) => (
                    <div 
                      key={file.id} 
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <div className="truncate flex-1">{file.name}</div>
                      {!isViewMode && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveFile(file.id)}
                          className="text-red-500"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No files uploaded</p>
              )}
              
              {isViewMode && uploads.length > 0 && (
                <div className="mt-2">
                  {uploads.map((file) => (
                    <div key={file.id} className="mt-2">
                      {file.type.startsWith('image/') ? (
                        <img 
                          src={file.data} 
                          alt={file.name} 
                          className="max-w-full h-auto max-h-64 rounded"
                        />
                      ) : (
                        <div className="p-4 border rounded bg-gray-50">
                          <a
                            href={file.data}
                            download={file.name}
                            className="text-blue-600 hover:underline"
                          >
                            Download {file.name}
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              {isViewMode ? 'Close' : 'Cancel'}
            </Button>
            
            {!isViewMode && (
              <Button 
                type="submit" 
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : isCreateMode ? 'Create' : 'Save Changes'}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
