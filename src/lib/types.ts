
export type ProductType = 
  | 'DUAL GLASS G12R'
  | 'DUAL GLASS M10'
  | 'M10 TOPCON'
  | 'G12R TOPCON'
  | 'G12 TOPCON'
  | 'M10 PERC TRANSPARENT'
  | string;

export const PRODUCT_TYPES: ProductType[] = [
  'DUAL GLASS G12R', 
  'DUAL GLASS M10', 
  'M10 TOPCON', 
  'G12R TOPCON', 
  'G12 TOPCON',
  'M10 PERC TRANSPARENT'
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
  | string;

export const MATERIAL_CATEGORIES: MaterialCategory[] = [
  'Cell',
  'Encapsulant',
  'Glass',
  'Junction Box',
  'Backsheet',
  'Flux',
  'Sealant',
  'Connector'
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

export interface Certification {
  id: string;
  serialNumber: number;
  projectName: string;
  projectDetails: string;
  productType: ProductType;
  materialCategories: MaterialCategory[];
  material: string;
  testingLaboratory: TestingLaboratory;
  status: CertificationStatus;
  dueDate: string;
  lastUpdatedOn: string;
  remarks: string;
  uploads: UploadFile[];
  paymentInfo: PaymentInfo;
  createdAt: string;
}
