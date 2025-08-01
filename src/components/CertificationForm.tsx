import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Certification,
  CertificationStatus,
  CertificationType,
  PaidForBy,
  CurrencyType,
  ProductionLine,
  PRODUCTION_LINES,
  UploadFile,
  MaterialCategory,
  ProductType,
  TestingLaboratory,
  PRODUCT_TYPES,
  DueDateChange,
} from "@/lib/types";
import {
  fileToBase64,
  getAllProductTypes,
  getAllTestingLaboratories,
  getAllMaterialCategories,
  saveCustomProductType,
  saveCustomTestingLaboratory,
  saveCustomMaterialCategory,
} from "@/lib/storage";
import { format } from "date-fns";
import {
  X,
  Upload,
  PlusCircle,
  Mail,
  Calendar,
  History,
  Box,
  Check,
  DollarSign,
} from "lucide-react";

interface CertificationFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    data: Omit<
      Certification,
      "id" | "serialNumber" | "createdAt" | "lastUpdatedOn"
    >
  ) => void;
  initialData?: Certification;
  mode: "create" | "edit" | "view";
}

export function CertificationForm({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode,
}: CertificationFormProps) {
  const [projectName, setProjectName] = useState("");
  const [projectDetails, setProjectDetails] = useState("");
  const [productType, setProductType] = useState<ProductType>([]);
  const [customProductType, setCustomProductType] = useState("");
  const [materialCategories, setMaterialCategories] = useState<
    MaterialCategory[]
  >([]);
  const [customMaterialCategory, setCustomMaterialCategory] = useState("");
  const [material, setMaterial] = useState("");
  const [testingLaboratory, setTestingLaboratory] = useState<TestingLaboratory>(
    "Bharat Test House Pvt Ltd, Haryana"
  );
  const [testingApprovedBy, setTestingApprovedBy] = useState("");
  const [customTestingLaboratory, setCustomTestingLaboratory] = useState("");
  const [status, setStatus] = useState<CertificationStatus>("Not Started Yet");
  const [dueDate, setDueDate] = useState("");
  const [dueDateHistory, setDueDateHistory] = useState<DueDateChange[]>([]);
  const [remarks, setRemarks] = useState("");
  const [uploads, setUploads] = useState<UploadFile[]>([]);
  const [paidForBy, setPaidForBy] = useState<PaidForBy>("Premier");
  const [currency, setCurrency] = useState<CurrencyType>("INR");
  const [amount, setAmount] = useState<number | undefined>();
  const [supplierName, setSupplierName] = useState("");
  const [supplierAmount, setSupplierAmount] = useState<number | undefined>();
  const [premierAmount, setPremierAmount] = useState<number | undefined>();
  const [invoiceAttachment, setInvoiceAttachment] = useState<
    UploadFile | undefined
  >();
  const [sampleQuantity, setSampleQuantity] = useState<number | undefined>();
  const [certificationType, setCertificationType] =
    useState<CertificationType>("Standard");
  const [customerName, setCustomerName] = useState("");
  const [comments, setComments] = useState("");
  const [productionLine, setProductionLine] = useState<ProductionLine[]>([]);
  const [allProductTypes, setAllProductTypes] = useState<string[]>([]);
  const [allTestingLaboratories, setAllTestingLaboratories] = useState<
    TestingLaboratory[]
  >([]);
  const [allMaterialCategories, setAllMaterialCategories] = useState<
    MaterialCategory[]
  >([]);
  const [showCustomProductType, setShowCustomProductType] = useState(false);
  const [showCustomTestingLaboratory, setShowCustomTestingLaboratory] =
    useState(false);
  const [showCustomMaterialCategory, setShowCustomMaterialCategory] =
    useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDueDateHistory, setShowDueDateHistory] = useState(false);

  const isViewMode = mode === "view";
  const isEditMode = mode === "edit";
  const isCreateMode = mode === "create";

  // Load all custom options and initialize form with initialData when the component mounts or mode changes
  useEffect(() => {
    setAllProductTypes(getAllProductTypes());
    setAllTestingLaboratories(getAllTestingLaboratories());
    setAllMaterialCategories(getAllMaterialCategories());

    // Initialize form with initialData
    if (initialData) {
      setProjectName(initialData.projectName || "");
      setProjectDetails(initialData.projectDetails || "");
      setProductType(
        Array.isArray(initialData.productType) ? initialData.productType : []
      );
      setMaterialCategories(initialData.materialCategories || []);
      setMaterial(initialData.material || "");
      setTestingLaboratory(
        initialData.testingLaboratory || "Bharat Test House Pvt Ltd, Haryana"
      );
      setTestingApprovedBy(initialData.testingApprovedBy || "");
      setStatus(initialData.status || "Not Started Yet");
      setDueDate(initialData.dueDate ? initialData.dueDate.split("T")[0] : "");
      setDueDateHistory(initialData.dueDateHistory || []);
      setRemarks(initialData.remarks || "");
      setUploads(initialData.uploads || []);
      setPaidForBy(initialData.paymentInfo?.paidForBy || "Premier");
      setCurrency(initialData.paymentInfo?.currency || "INR");
      setAmount(initialData.paymentInfo?.amount);
      setSupplierName(initialData.paymentInfo?.supplierName || "");
      setSupplierAmount(initialData.paymentInfo?.supplierAmount);
      setPremierAmount(initialData.paymentInfo?.premierAmount);
      setInvoiceAttachment(initialData.paymentInfo?.invoiceAttachment);
      setSampleQuantity(initialData.sampleQuantity || undefined);
      setCertificationType(initialData.certificationType || "Standard");
      setCustomerName(initialData.customizationInfo?.customerName || "");
      setComments(initialData.customizationInfo?.comments || "");
      setProductionLine(initialData.productionLine);
    } else {
      // Reset form if no initialData
      resetForm();
    }
  }, [initialData, isOpen, mode]);

  const resetForm = () => {
    setProjectName("");
    setProjectDetails("");
    setProductType([]);
    setCustomProductType("");
    setShowCustomProductType(false);
    setMaterialCategories([]);
    setCustomMaterialCategory("");
    setShowCustomMaterialCategory(false);
    setMaterial("");
    setTestingLaboratory("Bharat Test House Pvt Ltd, Haryana");
    setTestingApprovedBy("");
    setCustomTestingLaboratory("");
    setShowCustomTestingLaboratory(false);
    setStatus("Not Started Yet");
    setDueDate("");
    setDueDateHistory([]);
    setRemarks("");
    setUploads([]);
    setPaidForBy("Premier");
    setCurrency("INR");
    setAmount(undefined);
    setSupplierName("");
    setSupplierAmount(undefined);
    setPremierAmount(undefined);
    setInvoiceAttachment(undefined);
    setSampleQuantity(undefined);
    setCertificationType("Standard");
    setCustomerName("");
    setComments("");
    setProductionLine([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !projectName ||
      !testingLaboratory ||
      !material ||
      !dueDate ||
      materialCategories.length === 0 ||
      productType.length === 0
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (certificationType === "Customized" && !customerName) {
      toast.error(
        "Customer name is required for customized certification type"
      );
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
        setAllProductTypes((prev) =>
          prev.includes(customProductType) ? prev : [...prev, customProductType]
        );
        setCustomProductType("");
        setShowCustomProductType(false);
      }

      // Handle custom testing laboratory
      let finalTestingLaboratory = testingLaboratory;
      if (showCustomTestingLaboratory && customTestingLaboratory) {
        finalTestingLaboratory = customTestingLaboratory;
        saveCustomTestingLaboratory(customTestingLaboratory);
        setAllTestingLaboratories((prev) => [...prev, customTestingLaboratory]);
      }

      // Handle due date change history for edit mode
      let updatedDueDateHistory = [...dueDateHistory];
      if (
        isEditMode &&
        initialData &&
        dueDate !== initialData.dueDate.split("T")[0]
      ) {
        updatedDueDateHistory.push({
          previousDate: initialData.dueDate.split("T")[0],
          newDate: dueDate, // again, just YYYY-MM-DD
          changedAt: new Date().toISOString(),
        });
      }

      // Create payment info object
      const paymentInfo = {
        paidForBy,
        currency,
        amount: paidForBy === "Premier" ? amount : undefined,
        supplierName:
          paidForBy === "Supplier" || paidForBy === "Split"
            ? supplierName
            : undefined,
        supplierAmount: paidForBy === "Split" ? supplierAmount : undefined,
        premierAmount: paidForBy === "Split" ? premierAmount : undefined,
        invoiceAttachment,
      };

      // Create customization info if needed
      const customizationInfo =
        certificationType === "Customized"
          ? {
              customerName,
              comments,
            }
          : undefined;

      onSubmit({
        projectName,
        projectDetails,
        productType: finalProductType,
        materialCategories,
        material,
        testingLaboratory: finalTestingLaboratory,
        testingApprovedBy,
        status,
        dueDate: dueDate,
        dueDateHistory: updatedDueDateHistory,
        remarks,
        uploads,
        paymentInfo,
        sampleQuantity,
        certificationType,
        customizationInfo,
        productionLine,
      });

      // Reset form if creating
      if (isCreateMode) {
        resetForm();
      }

      onClose();
    } catch (error) {
      console.error("Error submitting form:", error);
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
          data: base64,
        });
      }

      setUploads([...uploads, ...newFiles]);
      toast.success(`${newFiles.length} file(s) uploaded successfully`);
    } catch (error) {
      console.error("Error uploading files:", error);
      toast.error("Failed to upload files");
    }
  };

  const handleInvoiceAttachmentChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!e.target.files || e.target.files.length === 0) return;

    try {
      const file = e.target.files[0];
      const base64 = await fileToBase64(file);

      setInvoiceAttachment({
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type,
        data: base64,
      });

      toast.success("Invoice uploaded successfully");
    } catch (error) {
      console.error("Error uploading invoice:", error);
      toast.error("Failed to upload invoice");
    }
  };

  const handleRemoveFile = (id: string) => {
    setUploads(uploads.filter((file) => file.id !== id));
  };

  const handleRemoveInvoice = () => {
    setInvoiceAttachment(undefined);
  };

  const handleMaterialCategoryChange = (
    category: MaterialCategory,
    checked: boolean
  ) => {
    if (checked) {
      setMaterialCategories([...materialCategories, category]);
    } else {
      setMaterialCategories(materialCategories.filter((c) => c !== category));
    }
  };

  const handleProductTypeChange = (
    productTypeOption: string,
    checked: boolean
  ) => {
    if (checked) {
      setProductType([...productType, productTypeOption]);
    } else {
      setProductType(productType.filter((pt) => pt !== productTypeOption));
    }
  };

  const handleAddCustomProductType = () => {
    if (customProductType && !productType.includes(customProductType)) {
      setProductType([...productType, customProductType]);
      saveCustomProductType(customProductType);
      setAllProductTypes((prev) => [...prev, customProductType]);
      setCustomProductType("");
      setShowCustomProductType(false);
    }
  };

  const handleAddCustomMaterialCategory = () => {
    if (
      customMaterialCategory &&
      !materialCategories.includes(customMaterialCategory)
    ) {
      setMaterialCategories([...materialCategories, customMaterialCategory]);
      saveCustomMaterialCategory(customMaterialCategory);
      setAllMaterialCategories((prev) => [...prev, customMaterialCategory]);
      setCustomMaterialCategory("");
      setShowCustomMaterialCategory(false);
    }
  };

  const selectAllProductTypes = () => {
    setProductType([...allProductTypes]);
  };

  const deselectAllProductTypes = () => {
    setProductType([]);
  };

  const selectAllMaterialCategories = () => {
    setMaterialCategories([...allMaterialCategories]);
  };

  const deselectAllMaterialCategories = () => {
    setMaterialCategories([]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isCreateMode
              ? "Create New Certification"
              : isEditMode
              ? "Edit Certification"
              : "View Certification"}
          </DialogTitle>
          <DialogDescription>
            {isCreateMode
              ? "Fill in the details to create a new certification."
              : isEditMode
              ? "Update the certification details."
              : "Certification details."}
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
                  onValueChange={(value: CertificationStatus) =>
                    setStatus(value)
                  }
                  disabled={isViewMode}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Not Started Yet">
                      Not Started Yet
                    </SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="certificationType">Certification Type *</Label>
                <Select
                  value={certificationType}
                  onValueChange={(value: CertificationType) =>
                    setCertificationType(value)
                  }
                  disabled={isViewMode}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select certification type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Standard">Standard</SelectItem>
                    <SelectItem value="Customized">Customized</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Production Line</Label>
                <div className="grid grid-cols-2 gap-2 border p-3 rounded-md">
                  {PRODUCTION_LINES.map((line) => (
                    <div key={line} className="flex items-center space-x-2">
                      <Checkbox
                        id={`line-${line}`}
                        checked={productionLine.includes(line)}
                        onCheckedChange={(checked) => {
                          const next = checked
                            ? [...productionLine, line]
                            : productionLine.filter((l) => l !== line);
                          setProductionLine(next);
                        }}
                        disabled={isViewMode}
                      />
                      <label
                        htmlFor={`line-${line}`}
                        className="text-sm font-medium"
                      >
                        {line}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {certificationType === "Customized" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customerName">Customer Name *</Label>
                  <Input
                    id="customerName"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    disabled={isViewMode}
                    required={certificationType === "Customized"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comments">Customer Comments</Label>
                  <Input
                    id="comments"
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    disabled={isViewMode}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="productType">Product Type *</Label>
                {!isViewMode && (
                  <div className="flex space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={selectAllProductTypes}
                    >
                      <Check className="h-3 w-3 mr-1" /> Select All
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={deselectAllProductTypes}
                    >
                      <X className="h-3 w-3 mr-1" /> Deselect All
                    </Button>
                  </div>
                )}
              </div>
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
                        setCustomProductType("");
                        setShowCustomProductType(false);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              {productType.length === 0 && !isViewMode && (
                <p className="text-xs text-red-500">
                  Please select at least one product type
                </p>
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
                <Label htmlFor="sampleQuantity">Sample Quantity</Label>
                <div className="flex items-center gap-2">
                  <Box className="h-4 w-4 text-gray-500" />
                  <Input
                    id="sampleQuantity"
                    type="number"
                    min="0"
                    step="1"
                    value={sampleQuantity || ""}
                    onChange={(e) =>
                      setSampleQuantity(
                        e.target.value ? parseInt(e.target.value) : undefined
                      )
                    }
                    disabled={isViewMode}
                    placeholder="Enter quantity"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                        {allTestingLaboratories.map((lab) => (
                          <SelectItem key={lab} value={lab}>
                            {lab}
                          </SelectItem>
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
                      onChange={(e) =>
                        setCustomTestingLaboratory(e.target.value)
                      }
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

              <div className="space-y-2">
                <Label htmlFor="testingApprovedBy">
                  Testing Approved By (Email)
                </Label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <Input
                    id="testingApprovedBy"
                    type="email"
                    value={testingApprovedBy}
                    onChange={(e) => setTestingApprovedBy(e.target.value)}
                    disabled={isViewMode}
                    placeholder="email@example.com"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="materialCategories">
                  Material Categories *
                </Label>
                {!isViewMode && (
                  <div className="flex space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={selectAllMaterialCategories}
                    >
                      <Check className="h-3 w-3 mr-1" /> Select All
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={deselectAllMaterialCategories}
                    >
                      <X className="h-3 w-3 mr-1" /> Deselect All
                    </Button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 border p-3 rounded-md">
                {allMaterialCategories.map((category) => (
                  <div className="flex items-center space-x-2" key={category}>
                    <Checkbox
                      id={`category-${category}`}
                      checked={materialCategories.includes(category)}
                      onCheckedChange={(checked) =>
                        handleMaterialCategoryChange(
                          category,
                          checked as boolean
                        )
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
                      onChange={(e) =>
                        setCustomMaterialCategory(e.target.value)
                      }
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
                        setCustomMaterialCategory("");
                        setShowCustomMaterialCategory(false);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              {materialCategories.length === 0 && !isViewMode && (
                <p className="text-xs text-red-500">
                  Please select at least one material category
                </p>
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
                <div className="flex items-center gap-2">
                  <Label htmlFor="dueDate">Estimated Due Date *</Label>
                  <Calendar className="h-4 w-4 text-gray-500" />
                </div>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={isViewMode}
                  required
                />
                {dueDateHistory && dueDateHistory.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDueDateHistory(!showDueDateHistory)}
                    className="mt-2 w-full flex items-center justify-center"
                  >
                    <History className="h-4 w-4 mr-2" />
                    {showDueDateHistory ? "Hide History" : "Show History"}
                  </Button>
                )}
                {showDueDateHistory &&
                  dueDateHistory &&
                  dueDateHistory.length > 0 && (
                    <div className="border rounded-md p-2 mt-2 bg-gray-50 max-h-[150px] overflow-y-auto">
                      <p className="text-sm font-medium mb-1">
                        Due Date Change History:
                      </p>
                      {dueDateHistory.map((change, index) => (
                        <div
                          key={index}
                          className="text-xs border-b last:border-b-0 py-1"
                        >
                          <p>
                            Changed from{" "}
                            {format(
                              new Date(change.previousDate),
                              "dd MMM yyyy"
                            )}{" "}
                            to {format(new Date(change.newDate), "dd MMM yyyy")}
                          </p>
                          <p className="text-gray-500">
                            {format(
                              new Date(change.changedAt),
                              "dd MMM yyyy HH:mm"
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
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
                    <SelectItem value="Split">Split Payment</SelectItem>
                    <SelectItem value="Not Discussed Yet">
                      Not Discussed Yet
                    </SelectItem>
                  </SelectContent>
                </Select>
                {paidForBy !== "Not Discussed Yet" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency *</Label>
                      <Select
                        value={currency}
                        onValueChange={(value: CurrencyType) =>
                          setCurrency(value)
                        }
                        disabled={isViewMode}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INR">INR (₹)</SelectItem>
                          <SelectItem value="USD">USD ($)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {paidForBy === "Premier" && (
                      <div className="space-y-2">
                        <Label htmlFor="amount">Amount (Optional)</Label>
                        <div className="flex items-center gap-2">
                          
                          <Input
                            id="amount"
                            type="number"
                            min="0"
                            step="0.01"
                            value={amount || ""}
                            onChange={(e) =>
                              setAmount(
                                e.target.value
                                  ? parseFloat(e.target.value)
                                  : undefined
                              )
                            }
                            disabled={isViewMode}
                          />
                        </div>
                      </div>
                    )}

                    {paidForBy === "Supplier" && (
                      <div className="space-y-2">
                        <Label htmlFor="supplierName">Supplier Name *</Label>
                        <Input
                          id="supplierName"
                          value={supplierName}
                          onChange={(e) => setSupplierName(e.target.value)}
                          disabled={isViewMode}
                          required={
                            paidForBy === "Supplier" || paidForBy === "Split"
                          }
                        />
                      </div>
                    )}
                  </div>
                )}

                {paidForBy === "Split" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="supplierName">Supplier Name *</Label>
                      <Input
                        id="supplierName"
                        value={supplierName}
                        onChange={(e) => setSupplierName(e.target.value)}
                        disabled={isViewMode}
                        required={paidForBy === "Split"}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="supplierAmount">Supplier Amount *</Label>
                      <div className="flex items-center gap-2">
                        
                        <Input
                          id="supplierAmount"
                          type="number"
                          min="0"
                          step="0.01"
                          value={supplierAmount || ""}
                          onChange={(e) =>
                            setSupplierAmount(
                              e.target.value
                                ? parseFloat(e.target.value)
                                : undefined
                            )
                          }
                          disabled={isViewMode}
                          required={paidForBy === "Split"}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="premierAmount">Premier Amount *</Label>
                      <div className="flex items-center gap-2">
                        
                        <Input
                          id="premierAmount"
                          type="number"
                          min="0"
                          step="0.01"
                          value={premierAmount || ""}
                          onChange={(e) =>
                            setPremierAmount(
                              e.target.value
                                ? parseFloat(e.target.value)
                                : undefined
                            )
                          }
                          disabled={isViewMode}
                          required={paidForBy === "Split"}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="invoiceAttachment">
                    Invoice Attachment (Optional)
                  </Label>
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
                            onClick={() =>
                              document
                                .getElementById("invoiceAttachment")
                                ?.click()
                            }
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Invoice
                          </Button>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-between p-2 border rounded w-full">
                        <div className="truncate flex-1">
                          {invoiceAttachment.name}
                        </div>
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
                    onClick={() =>
                      document.getElementById("fileUpload")?.click()
                    }
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
                      {file.type.startsWith("image/") ? (
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
                <p>
                  Last Updated:{" "}
                  {format(new Date(initialData.lastUpdatedOn), "PPpp")}
                </p>
                <p>
                  Created: {format(new Date(initialData.createdAt), "PPpp")}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {isViewMode ? "Close" : "Cancel"}
            </Button>

            {!isViewMode && (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving..."
                  : isCreateMode
                  ? "Create"
                  : "Save Changes"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
