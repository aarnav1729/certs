import { Certification, CertificationStatus, UploadFile, ProductType, TestingLaboratory, MaterialCategory, PRODUCT_TYPES, TESTING_LABORATORIES, MATERIAL_CATEGORIES } from "./types";

const STORAGE_KEY = 'cert-board-certifications';
const CUSTOM_PRODUCT_TYPES_KEY = 'cert-board-custom-product-types';
const CUSTOM_TESTING_LABORATORIES_KEY = 'cert-board-custom-testing-laboratories';
const CUSTOM_MATERIAL_CATEGORIES_KEY = 'cert-board-custom-material-categories';

// Get all certifications from local storage
export const getCertifications = (): Certification[] => {
  const storedData = localStorage.getItem(STORAGE_KEY);
  if (!storedData) return [];
  
  try {
    const data = JSON.parse(storedData);
    // Handle migration of data format
    return data.map((cert: any) => {
      // Convert string product type to array if needed
      if (typeof cert.productType === 'string') {
        return {
          ...cert,
          productType: [cert.productType]
        };
      }
      return cert;
    });
  } catch (error) {
    console.error('Error parsing certifications data:', error);
    return [];
  }
};

// Save all certifications to local storage
export const saveCertifications = (certifications: Certification[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(certifications));
  } catch (error) {
    console.error('Error saving certifications data:', error);
  }
};

// Get the next serial number
export const getNextSerialNumber = (): number => {
  const certifications = getCertifications();
  if (certifications.length === 0) return 1;
  
  // Find the highest serial number and add 1
  return Math.max(...certifications.map(cert => cert.serialNumber)) + 1;
};

// Get custom product types
export const getCustomProductTypes = (): string[] => {
  const storedData = localStorage.getItem(CUSTOM_PRODUCT_TYPES_KEY);
  if (!storedData) return [];
  
  try {
    return JSON.parse(storedData);
  } catch (error) {
    console.error('Error parsing custom product types data:', error);
    return [];
  }
};

// Save custom product type
export const saveCustomProductType = (productType: string): void => {
  try {
    const customTypes = getCustomProductTypes();
    if (!customTypes.includes(productType)) {
      customTypes.push(productType);
      localStorage.setItem(CUSTOM_PRODUCT_TYPES_KEY, JSON.stringify(customTypes));
    }
  } catch (error) {
    console.error('Error saving custom product type:', error);
  }
};

// Get all product types (including custom ones)
export const getAllProductTypes = (): string[] => {
  return [...PRODUCT_TYPES, ...getCustomProductTypes()];
};

// Get custom testing laboratories
export const getCustomTestingLaboratories = (): TestingLaboratory[] => {
  const storedData = localStorage.getItem(CUSTOM_TESTING_LABORATORIES_KEY);
  if (!storedData) return [];
  
  try {
    return JSON.parse(storedData);
  } catch (error) {
    console.error('Error parsing custom testing laboratories data:', error);
    return [];
  }
};

// Save custom testing laboratory
export const saveCustomTestingLaboratory = (lab: TestingLaboratory): void => {
  try {
    const customLabs = getCustomTestingLaboratories();
    if (!customLabs.includes(lab)) {
      customLabs.push(lab);
      localStorage.setItem(CUSTOM_TESTING_LABORATORIES_KEY, JSON.stringify(customLabs));
    }
  } catch (error) {
    console.error('Error saving custom testing laboratory:', error);
  }
};

// Get all testing laboratories (including custom ones)
export const getAllTestingLaboratories = (): TestingLaboratory[] => {
  return [...TESTING_LABORATORIES, ...getCustomTestingLaboratories()];
};

// Get custom material categories
export const getCustomMaterialCategories = (): MaterialCategory[] => {
  const storedData = localStorage.getItem(CUSTOM_MATERIAL_CATEGORIES_KEY);
  if (!storedData) return [];
  
  try {
    return JSON.parse(storedData);
  } catch (error) {
    console.error('Error parsing custom material categories data:', error);
    return [];
  }
};

// Save custom material category
export const saveCustomMaterialCategory = (category: MaterialCategory): void => {
  try {
    const customCategories = getCustomMaterialCategories();
    if (!customCategories.includes(category)) {
      customCategories.push(category);
      localStorage.setItem(CUSTOM_MATERIAL_CATEGORIES_KEY, JSON.stringify(customCategories));
    }
  } catch (error) {
    console.error('Error saving custom material category:', error);
  }
};

// Get all material categories (including custom ones)
export const getAllMaterialCategories = (): MaterialCategory[] => {
  return [...MATERIAL_CATEGORIES, ...getCustomMaterialCategories()];
};

// Add a new certification
export const addCertification = (certification: Omit<Certification, 'id' | 'serialNumber' | 'createdAt' | 'lastUpdatedOn'>): Certification => {
  const certifications = getCertifications();
  const now = new Date().toISOString();
  
  const newCertification: Certification = {
    ...certification,
    id: crypto.randomUUID(),
    serialNumber: getNextSerialNumber(),
    createdAt: now,
    lastUpdatedOn: now
  };
  
  // Check if custom product types need to be saved
  if (Array.isArray(newCertification.productType)) {
    newCertification.productType.forEach(type => {
      if (!PRODUCT_TYPES.includes(type)) {
        saveCustomProductType(type);
      }
    });
  } else if (!PRODUCT_TYPES.includes(newCertification.productType as string)) {
    // Handle case where productType might still be a string (backward compatibility)
    saveCustomProductType(newCertification.productType as string);
  }
  
  // Check if custom testing laboratory needs to be saved
  if (!TESTING_LABORATORIES.includes(newCertification.testingLaboratory)) {
    saveCustomTestingLaboratory(newCertification.testingLaboratory);
  }
  
  // Check if custom material categories need to be saved
  newCertification.materialCategories.forEach(category => {
    if (!MATERIAL_CATEGORIES.includes(category)) {
      saveCustomMaterialCategory(category);
    }
  });
  
  certifications.push(newCertification);
  
  // Sort certifications - overdue (red) first, then in progress, then completed last
  sortCertifications(certifications);
  
  saveCertifications(certifications);
  
  return newCertification;
};

// Update an existing certification
export const updateCertification = (id: string, data: Partial<Certification>): Certification | null => {
  const certifications = getCertifications();
  const index = certifications.findIndex(cert => cert.id === id);
  
  if (index === -1) return null;
  
  // Update the certification with new data
  const updatedCertification: Certification = {
    ...certifications[index],
    ...data,
    lastUpdatedOn: new Date().toISOString()
  };
  
  // Check if custom product types need to be saved
  if (data.productType) {
    if (Array.isArray(data.productType)) {
      data.productType.forEach(type => {
        if (!PRODUCT_TYPES.includes(type)) {
          saveCustomProductType(type);
        }
      });
    } else if (!PRODUCT_TYPES.includes(data.productType as string)) {
      // Handle case where productType might still be a string (backward compatibility)
      saveCustomProductType(data.productType as string);
    }
  }
  
  // Check if custom testing laboratory needs to be saved
  if (data.testingLaboratory && !TESTING_LABORATORIES.includes(data.testingLaboratory)) {
    saveCustomTestingLaboratory(data.testingLaboratory);
  }
  
  // Check if custom material categories need to be saved
  if (data.materialCategories) {
    data.materialCategories.forEach(category => {
      if (!MATERIAL_CATEGORIES.includes(category)) {
        saveCustomMaterialCategory(category);
      }
    });
  }
  
  certifications[index] = updatedCertification;
  
  // Sort certifications - overdue (red) first, then in progress, then completed last
  sortCertifications(certifications);
  
  saveCertifications(certifications);
  
  return updatedCertification;
};

// Convert file to base64 for storage
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

// Sort certifications
export const sortCertifications = (certifications: Certification[]): void => {
  const now = new Date();
  
  certifications.sort((a, b) => {
    // Helper function to check if a certification is overdue
    const isOverdue = (cert: Certification) => {
      return new Date(cert.dueDate) < now && cert.status !== 'Completed';
    };
    
    const aOverdue = isOverdue(a);
    const bOverdue = isOverdue(b);
    
    // First priority: Overdue certifications
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    
    // Second priority: Status (Not Started Yet > In Progress > Completed)
    if (a.status !== b.status) {
      if (a.status === 'Completed') return 1;
      if (b.status === 'Completed') return -1;
      if (a.status === 'In Progress' && b.status === 'Not Started Yet') return -1;
      if (a.status === 'Not Started Yet' && b.status === 'In Progress') return 1;
    }
    
    // Third priority: Due date (earlier due dates first)
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
};
