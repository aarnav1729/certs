import { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { 
  Certification, 
  CertificationStatus,
  PaidForBy,
  UploadFile,
  MaterialCategory,
  ProductType,
  TestingLaboratory,
  PRODUCT_TYPES
} from "@/lib/types";
import { 
  fileToBase64, 
  getAllProductTypes, 
  getAllTestingLaboratories, 
  getAllMaterialCategories, 
  saveCustomProductType,
  saveCustomTestingLaboratory,
  saveCustomMaterialCategory
} from "@/lib/storage";
import { format } from "date-fns";
import { X, Upload, PlusCircle } from "lucide-react";

interface CertificationFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Certification, 'id' | 'serialNumber' | 'createdAt' | 'lastUpdatedOn'>) => void;
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
  const [productType, setProductType] = useState<ProductType>(initialData?.productType || []);
  const [customProductType, setCustomProductType] = useState('');
  const [materialCategories, setMaterialCategories] = useState<MaterialCategory[]>(initialData?.materialCategories || []);
  const [customMaterialCategory, setCustomMaterialCategory] = useState('');
  const [material, setMaterial] = useState(initialData?.material || '');
  const [testingLaboratory, setTestingLaboratory] = useState<TestingLaboratory>(initialData?.testingLaboratory || 'TUV Rheinland');
  const [customTestingLaboratory, setCustomTestingLaboratory] = useState('');
  const [status, setStatus] = useState<CertificationStatus>(initialData?.status || 'Not Started Yet');
  const [dueDate, setDueDate] = useState(initialData?.dueDate ? initialData.dueDate.split('T')[0] : '');
  const [remarks, setRemarks] = useState(initialData?.remarks || '');
  const [uploads, setUploads] = useState<UploadFile[]>(initialData?.uploads || []);
  const [paidForBy, setPaidForBy] = useState<PaidForBy>(initialData?.paymentInfo?.paidForBy || 'Premier');
  const [amount, setAmount] = useState<number | undefined>(initialData?.paymentInfo?.amount);
  const [supplierName, setSupplierName] = useState(initialData?.paymentInfo?.supplierName || '');
  const [invoiceAttachment, setInvoiceAttachment] = useState<UploadFile | undefined>(initialData?.paymentInfo?.invoiceAttachment);
  
  const [allProductTypes, setAllProductTypes] = useState<string[]>([]);
  const [allTestingLaboratories, setAllTestingLaboratories] = useState<TestingLaboratory[]>([]);
  const [allMaterialCategories, setAllMaterialCategories] = useState<MaterialCategory[]>([]);
  const [showCustomProductType, setShowCustomProductType] = useState(false);
  const [showCustomTestingLaboratory, setShowCustomTestingLaboratory] = useState(false);
  const [showCustomMaterialCategory, setShowCustomMaterialCategory] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isCreateMode = mode === 'create';
  
  // Load all custom options when the component mounts
  useEffect(() => {
    setAllProductTypes(getAllProductTypes());
    setAllTestingLaboratories(getAllTestingLaboratories());
    setAllMaterialCategories(getAllMaterialCategories());
  }, [isOpen]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!projectName || !testingLaboratory || !material || !dueDate || materialCategories.length === 0 || productType.length === 0) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Handle custom product type
      let finalProductType = [...productType];
      if (showCustomProductType && customProductType) {
        if (!finalProductType.includes(customProductType)) {
          finalProductType.push(customProductType);
        }
        saveCustomProductType(customProductType);
        setAllProductTypes(prev => prev.includes(customProductType) ? prev : [...prev, customProductType]);
        setCustomProductType('');
        setShowCustomProductType(false);
      }
      
      // Handle custom testing laboratory
      let finalTestingLaboratory = testingLaboratory;
      if (showCustomTestingLaboratory && customTestingLaboratory) {
        finalTestingLaboratory = customTestingLaboratory;
        saveCustomTestingLaboratory(customTestingLaboratory);
        setAllTestingLaboratories(prev => [...prev, customTestingLaboratory]);
      }
      
      // Create payment info object
      const paymentInfo = {
        paidForBy,
        amount: paidForBy === 'Premier' ? amount : undefined,
        supplierName: paidForBy === 'Supplier' ? supplierName : undefined,
        invoiceAttachment
      };
      
      onSubmit({
        projectName,
        projectDetails,
        productType: finalProductType,
        materialCategories,
        material,
        testingLaboratory: finalTestingLaboratory,
        status,
        dueDate: new Date(dueDate).toISOString(),
        remarks,
        uploads,
        paymentInfo
      });
      
      // Reset form if creating
      if (isCreateMode) {
        setProjectName('');
        setProjectDetails('');
        setProductType([]);
        setCustomProductType('');
        setShowCustomProductType(false);
        setMaterialCategories([]);
        setCustomMaterialCategory('');
        setShowCustomMaterialCategory(false);
        setMaterial('');
        setTestingLaboratory('TUV Rheinland');
        setCustomTestingLaboratory('');
        setShowCustomTestingLaboratory(false);
        setStatus('Not Started Yet');
        setDueDate('');
        setRemarks('');
        setUploads([]);
        setPaidForBy('Premier');
        setAmount(undefined);
        setSupplierName('');
        setInvoiceAttachment(undefined);
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

  const handleInvoiceAttachmentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    try {
      const file = e.target.files[0];
      const base64 = await fileToBase64(file);
      
      setInvoiceAttachment({
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type,
        data: base64
      });
      
      toast.success("Invoice uploaded successfully");
    } catch (error) {
      console.error('Error uploading invoice:', error);
      toast.error("Failed to upload invoice");
    }
  };

  const handleRemoveFile = (id: string) => {
    setUploads(uploads.filter(file => file.id !== id));
  };

  const handleRemoveInvoice = () => {
    setInvoiceAttachment(undefined);
  };

  const handleMaterialCategoryChange = (category: MaterialCategory, checked: boolean) => {
    if (checked) {
      setMaterialCategories([...materialCategories, category]);
    } else {
      setMaterialCategories(materialCategories.filter(c => c !== category));
    }
  };

  const handleProductTypeChange = (productTypeOption: string, checked: boolean) => {
    if (checked) {
      setProductType([...productType, productTypeOption]);
    } else {
      setProductType(productType.filter(pt => pt !== productTypeOption));
    }
  };

  const handleAddCustomProductType = () => {
    if (customProductType && !productType.includes(customProductType)) {
      setProductType([...productType, customProductType]);
      saveCustomProductType(customProductType);
      setAllProductTypes(prev => [...prev, customProductType]);
      setCustomProductType('');
      setShowCustomProductType(false);
    }
  };

  const handleAddCustomMaterialCategory = () => {
    if (customMaterialCategory && !materialCategories.includes(customMaterialCategory)) {
      setMaterialCategories([...materialCategories, customMaterialCategory]);
      saveCustomMaterialCategory(customMaterialCategory);
      setAllMaterialCategories(prev => [...prev, customMaterialCategory]);
      setCustomMaterialCategory('');
      setShowCustomMaterialCategory(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
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
                <Label htmlFor="status">Status *</Label>
                <Select 
                  value={status} 
                  onValueChange={(value: CertificationStatus) => setStatus(value)}
                  disabled={isViewMode}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Not Started Yet">Not Started Yet</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="productType">Product Type *</Label>
              <div className="grid grid-cols-3 gap-2 border p-3 rounded-md">
                {allProductTypes.map((type) => (
                  <div className="flex items-center space-x-2" key={type}>
                    <Checkbox 
                      id={`product-type-${type}`} 
                      checked={productType.includes(type)}
                      onCheckedChange={(checked) => 
                        handleProductTypeChange(type, checked as boolean)
                      }
                      disabled={isViewMode}
                    />
                    <label
                      htmlFor={`product-type-${type}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {type}
                    </label>
                  </div>
                ))}
                
                {!isViewMode && !showCustomProductType && (
                  <div className="flex items-center space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => setShowCustomProductType(true)}
                    >
                      <PlusCircle className="h-3 w-3 mr-1" /> Add Other
                    </Button>
                  </div>
                )}
                
                {showCustomProductType && (
                  <div className="col-span-3 flex items-center gap-2 mt-2">
                    <Input
                      placeholder="Enter custom product type"
                      value={customProductType}
                      onChange={(e) => setCustomProductType(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddCustomProductType}
                    >
                      Add
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setCustomProductType('');
                        setShowCustomProductType(false);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              {productType.length === 0 && !isViewMode && (
                <p className="text-xs text-red-500">Please select at least one product type</p>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="material">Material (with model number) *</Label>
                <Input 
                  id="material" 
                  value={material} 
                  onChange={(e) => setMaterial(e.target.value)}
                  disabled={isViewMode}
                  required
                  maxLength={100}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="testingLaboratory">Testing Laboratory *</Label>
                {!showCustomTestingLaboratory ? (
                  <div className="flex items-center gap-2">
                    <Select 
                      value={testingLaboratory} 
                      onValueChange={(value: string) => {
                        if (value === "other") {
                          setShowCustomTestingLaboratory(true);
                        } else {
                          setTestingLaboratory(value as TestingLaboratory);
                        }
                      }}
                      disabled={isViewMode}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select testing laboratory" />
                      </SelectTrigger>
                      <SelectContent>
                        {allTestingLaboratories.map(lab => (
                          <SelectItem key={lab} value={lab}>{lab}</SelectItem>
                        ))}
                        <SelectItem value="other">Others (Specify)</SelectItem>
                      </SelectContent>
                    </Select>
                    {!isViewMode && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setShowCustomTestingLaboratory(true)}
                      >
                        <PlusCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Enter custom testing laboratory"
                      value={customTestingLaboratory}
                      onChange={(e) => setCustomTestingLaboratory(e.target.value)}
                      disabled={isViewMode}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setShowCustomTestingLaboratory(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="materialCategories">Material Categories *</Label>
              <div className="grid grid-cols-3 gap-2 border p-3 rounded-md">
                {allMaterialCategories.map((category) => (
                  <div className="flex items-center space-x-2" key={category}>
                    <Checkbox 
                      id={`category-${category}`} 
                      checked={materialCategories.includes(category)}
                      onCheckedChange={(checked) => 
                        handleMaterialCategoryChange(category, checked as boolean)
                      }
                      disabled={isViewMode}
                    />
                    <label
                      htmlFor={`category-${category}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {category}
                    </label>
                  </div>
                ))}
                
                {!isViewMode && !showCustomMaterialCategory && (
                  <div className="flex items-center space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => setShowCustomMaterialCategory(true)}
                    >
                      <PlusCircle className="h-3 w-3 mr-1" /> Add Other
                    </Button>
                  </div>
                )}
                
                {showCustomMaterialCategory && (
                  <div className="col-span-3 flex items-center gap-2 mt-2">
                    <Input
                      placeholder="Enter custom material category"
                      value={customMaterialCategory}
                      onChange={(e) => setCustomMaterialCategory(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddCustomMaterialCategory}
                    >
                      Add
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setCustomMaterialCategory('');
                        setShowCustomMaterialCategory(false);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              {materialCategories.length === 0 && !isViewMode && (
                <p className="text-xs text-red-500">Please select at least one material category</p>
              )}
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
                <Label htmlFor="dueDate">Due Date *</Label>
                <Input 
                  id="dueDate" 
                  type="date" 
                  value={dueDate} 
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={isEditMode || isViewMode}
                  required
                />
                {(isEditMode || isViewMode) && (
                  <p className="text-xs text-muted-foreground">Due date cannot be changed after creation.</p>
                )}
              </div>
            </div>
            
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="paidForBy">Paid For By *</Label>
              <div className="grid grid-cols-1 gap-4">
                <Select 
                  value={paidForBy} 
                  onValueChange={(value: PaidForBy) => setPaidForBy(value)}
                  disabled={isViewMode}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select who pays" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Premier">Premier</SelectItem>
                    <SelectItem value="Supplier">Supplier</SelectItem>
                  </SelectContent>
                </Select>
                
                {paidForBy === 'Premier' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount in $ (Optional)</Label>
                      <Input 
                        id="amount" 
                        type="number" 
                        min="0"
                        step="0.01"
                        value={amount || ''} 
                        onChange={(e) => setAmount(e.target.value ? parseFloat(e.target.value) : undefined)}
                        disabled={isViewMode}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invoiceAttachment">Invoice Attachment (Optional)</Label>
                      <div className="flex items-center gap-2">
                        {!invoiceAttachment ? (
                          <>
                            <Input
                              id="invoiceAttachment"
                              type="file"
                              className="hidden"
                              onChange={handleInvoiceAttachmentChange}
                              disabled={isViewMode}
                            />
                            {!isViewMode && (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => document.getElementById('invoiceAttachment')?.click()}
                              >
                                <Upload className="h-4 w-4 mr-2" />
                                Upload Invoice
                              </Button>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center justify-between p-2 border rounded w-full">
                            <div className="truncate flex-1">{invoiceAttachment.name}</div>
                            {!isViewMode && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={handleRemoveInvoice}
                                className="text-red-500"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="supplierName">Supplier Name *</Label>
                      <Input 
                        id="supplierName" 
                        value={supplierName} 
                        onChange={(e) => setSupplierName(e.target.value)}
                        disabled={isViewMode}
                        required={paidForBy === 'Supplier'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount in $ (Optional)</Label>
                      <Input 
                        id="amount" 
                        type="number" 
                        min="0"
                        step="0.01"
                        value={amount || ''} 
                        onChange={(e) => setAmount(e.target.value ? parseFloat(e.target.value) : undefined)}
                        disabled={isViewMode}
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="invoiceAttachment">Invoice Attachment (Optional)</Label>
                      <div className="flex items-center gap-2">
                        {!invoiceAttachment ? (
                          <>
                            <Input
                              id="invoiceAttachment"
                              type="file"
                              className="hidden"
                              onChange={handleInvoiceAttachmentChange}
                              disabled={isViewMode}
                            />
                            {!isViewMode && (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => document.getElementById('invoiceAttachment')?.click()}
                              >
                                <Upload className="h-4 w-4 mr-2" />
                                Upload Invoice
                              </Button>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center justify-between p-2 border rounded w-full">
                            <div className="truncate flex-1">{invoiceAttachment.name}</div>
                            {!isViewMode && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={handleRemoveInvoice}
                                className="text-red-500"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
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
            
            {initialData && (
              <div className="border-t pt-4 text-sm text-muted-foreground">
                <p>Last Updated: {format(new Date(initialData.lastUpdatedOn), 'PPpp')}</p>
                <p>Created: {format(new Date(initialData.createdAt), 'PPpp')}</p>
              </div>
            )}
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
