
export type ProductType = 'Hardware' | 'Software' | 'Electronics' | 'Mechanical' | 'Electrical' | 'Chemical' | 'Other';

export const PRODUCT_TYPES: ProductType[] = [
  'Hardware', 
  'Software', 
  'Electronics', 
  'Mechanical', 
  'Electrical', 
  'Chemical', 
  'Other'
];

export type CertificationStatus = 'In-Progress' | 'Complete';

export interface UploadFile {
  id: string;
  name: string;
  data: string;
  type: string;
}

export interface Certification {
  id: string;
  serialNumber: number;
  projectName: string;
  projectDetails: string;
  productType: ProductType;
  testingLaboratory: string;
  pic: string;
  status: CertificationStatus;
  updateOn: string;
  dueDate: string;
  remarks: string;
  uploads: UploadFile[];
  createdAt: string;
  updatedAt: string;
}
