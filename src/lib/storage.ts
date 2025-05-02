
import { Certification, CertificationStatus, UploadFile } from "./types";

const STORAGE_KEY = 'cert-board-certifications';

// Get all certifications from local storage
export const getCertifications = (): Certification[] => {
  const storedData = localStorage.getItem(STORAGE_KEY);
  if (!storedData) return [];
  
  try {
    return JSON.parse(storedData);
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

// Add a new certification
export const addCertification = (certification: Omit<Certification, 'id' | 'serialNumber' | 'createdAt' | 'updatedAt' | 'status'>): Certification => {
  const certifications = getCertifications();
  
  const newCertification: Certification = {
    ...certification,
    id: crypto.randomUUID(),
    serialNumber: getNextSerialNumber(),
    status: certification.uploads && certification.uploads.length > 0 ? 'Complete' : 'In-Progress',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  certifications.push(newCertification);
  saveCertifications(certifications);
  
  return newCertification;
};

// Update an existing certification
export const updateCertification = (id: string, data: Partial<Certification>): Certification | null => {
  const certifications = getCertifications();
  const index = certifications.findIndex(cert => cert.id === id);
  
  if (index === -1) return null;
  
  // Determine status based on uploads
  let status: CertificationStatus = certifications[index].status;
  if (data.uploads) {
    status = data.uploads.length > 0 ? 'Complete' : 'In-Progress';
  }
  
  const updatedCertification: Certification = {
    ...certifications[index],
    ...data,
    status,
    updatedAt: new Date().toISOString()
  };
  
  certifications[index] = updatedCertification;
  saveCertifications(certifications);
  
  return updatedCertification;
};

// Delete a certification
export const deleteCertification = (id: string): boolean => {
  const certifications = getCertifications();
  const updatedCertifications = certifications.filter(cert => cert.id !== id);
  
  if (updatedCertifications.length === certifications.length) {
    return false;
  }
  
  saveCertifications(updatedCertifications);
  return true;
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
