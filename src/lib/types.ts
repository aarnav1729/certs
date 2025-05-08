
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
  | 'TUV Rheinland'
  | 'UL India'
  | 'URS'
  | 'PVEL Lab'
  | 'HPHY6'
  | string;

export const TESTING_LABORATORIES: TestingLaboratory[] = [
  'TUV Rheinland',
  'UL India',
  'URS',
  'PVEL Lab',
  'HPHY6'
];

export type PaidForBy = 'Premier' | 'Supplier';

export type CertificationStatus = 'Not Started Yet' | 'In Progress' | 'Completed';

export interface UploadFile {
  id: string;
  name: string;
  data: string;
  type: string;
}

export interface PaymentInfo {
  paidForBy: PaidForBy;
  amount?: number;
  supplierName?: string;
  invoiceAttachment?: UploadFile;
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
  createdAt: string;
}
