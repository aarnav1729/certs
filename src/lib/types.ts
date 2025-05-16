
export type ProductType = string[];

export const PRODUCT_TYPES: string[] = [
  'Dual Glass M10 PERC',
  'Dual Glass M10 TOPCON',
  'Dual Glass G12R TOPCON',
  'Dual Glass G12 TOPCON',
  'M10 Transparent PERC',
  'Raw Material'
];

export type MaterialCategory = 
  | 'Cell'
  | 'Encapsulant'
  | 'Glass'
  | 'Junction Box'
  | 'Backsheet'
  | 'Flux'
  | 'Sealant'
  | 'Connector'
  | 'FG Module'
  | string;

export const MATERIAL_CATEGORIES: MaterialCategory[] = [
  'Cell',
  'Encapsulant',
  'Glass',
  'Junction Box',
  'Backsheet',
  'Flux',
  'Sealant',
  'Connector',
  'FG Module'
];

export type TestingLaboratory = 
  | 'Bharat Test House Pvt Ltd, Haryana'
  | 'Delhi Test House, Haryana'
  | 'Hi Physix Laboratory India Pvt. Ltd., Pune'
  | 'National Institute of Solar Energy, Gurgaon (empaneled)'
  | 'URS Products and Testing Pvt Ltd, Noida'
  | 'Mitsui Chemicals India Private Limited, Ahemdabad'
  | 'UL India Pvt Ltd, Bangalore'
  | 'TUV Rheinland (India) Pvt Limited, Bangalore'
  | string;

export const TESTING_LABORATORIES: TestingLaboratory[] = [
  'Bharat Test House Pvt Ltd, Haryana',
  'Delhi Test House, Haryana',
  'Hi Physix Laboratory India Pvt. Ltd., Pune',
  'National Institute of Solar Energy, Gurgaon (empaneled)',
  'URS Products and Testing Pvt Ltd, Noida',
  'Mitsui Chemicals India Private Limited, Ahemdabad',
  'UL India Pvt Ltd, Bangalore',
  'TUV Rheinland (India) Pvt Limited, Bangalore'
];

export type PaidForBy = 'Premier' | 'Supplier' | 'Split';

export type CurrencyType = 'INR' | 'USD';

export type CertificationStatus = 'Not Started Yet' | 'In Progress' | 'Completed';

export type CertificationType = 'Standard' | 'Customized';

export type ProductionLine = 'PEIPL' | 'PEPPL' | 'PEGEPL 1' | 'PEGEPL 2';

export const PRODUCTION_LINES: ProductionLine[] = [
  'PEIPL',
  'PEPPL',
  'PEGEPL 1',
  'PEGEPL 2'
];

export interface UploadFile {
  id: string;
  name: string;
  data: string;
  type: string;
}

export interface PaymentInfo {
  paidForBy: PaidForBy;
  currency: CurrencyType;
  amount?: number;
  supplierName?: string;
  supplierAmount?: number;
  premierAmount?: number;
  invoiceAttachment?: UploadFile;
}

export interface CustomizationInfo {
  customerName?: string;
  comments?: string;
}

export interface DueDateChange {
  previousDate: string;
  newDate: string;
  changedAt: string;
}

export interface Certification {
  id: string;
  serialNumber: number;
  projectName: string;
  projectDetails: string;
  productType: ProductType;
  materialCategories: MaterialCategory[];
  material: string;
  testingLaboratory: TestingLaboratory;
  testingApprovedBy?: string;
  status: CertificationStatus;
  dueDate: string;
  dueDateHistory?: DueDateChange[];
  lastUpdatedOn: string;
  remarks: string;
  uploads: UploadFile[];
  paymentInfo: PaymentInfo;
  sampleQuantity?: number;
  certificationType: CertificationType;
  customizationInfo?: CustomizationInfo;
  productionLine?: ProductionLine;
  createdAt: string;
}
