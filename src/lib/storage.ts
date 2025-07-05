// root/src/lib/storage.ts
import {
  Certification,
  TestingLaboratory,
  MaterialCategory,
  UploadFile,
  PRODUCT_TYPES,
  TESTING_LABORATORIES,
  MATERIAL_CATEGORIES
} from "./types";

const API_BASE = "https://certs-1d5v.onrender.com";
//const API_BASE = "http://localhost:7777";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Fetch all certifications.
 */
export async function getCertifications(): Promise<Certification[]> {
  const res = await fetch(`${API_BASE}/api/certifications`, {
    headers: { "Accept": "application/json" },
    credentials: "include",
  });
  return handleResponse<Certification[]>(res);
}

/**
 * Create a new certification.
 * (Expects everything except id, serialNumber, createdAt, lastUpdatedOn.)
 */
export async function addCertification(
  data: Omit<Certification, "id" | "serialNumber" | "createdAt" | "lastUpdatedOn">
): Promise<Certification> {
  const res = await fetch(`${API_BASE}/api/certifications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  return handleResponse<Certification>(res);
}

/**
 * Update an existing certification by its Mongo ID.
 */
export async function updateCertification(
  id: string,
  data: Omit<Certification, "id" | "serialNumber" | "createdAt" | "lastUpdatedOn">
): Promise<Certification> {
  const res = await fetch(`${API_BASE}/api/certifications/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  return handleResponse<Certification>(res);
}

/**
 * Delete a certification by its Mongo ID.
 */
export async function deleteCertification(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/certifications/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to delete: ${res.status} ${text}`);
  }
}

// --- Local-storage–based helpers for form choices & uploads ---

const CUSTOM_PRODUCT_TYPES_KEY = 'cert-board-custom-product-types';
export function getCustomProductTypes(): string[] {
  const stored = localStorage.getItem(CUSTOM_PRODUCT_TYPES_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}
export function saveCustomProductType(productType: string): void {
  try {
    const list = getCustomProductTypes();
    if (!list.includes(productType)) {
      list.push(productType);
      localStorage.setItem(CUSTOM_PRODUCT_TYPES_KEY, JSON.stringify(list));
    }
  } catch {
    /* ignore */
  }
}
export function getAllProductTypes(): string[] {
  return [...PRODUCT_TYPES, ...getCustomProductTypes()];
}

const CUSTOM_TESTING_LABS_KEY = 'cert-board-custom-testing-laboratories';
export function getCustomTestingLaboratories(): TestingLaboratory[] {
  const stored = localStorage.getItem(CUSTOM_TESTING_LABS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}
export function saveCustomTestingLaboratory(lab: TestingLaboratory): void {
  try {
    const list = getCustomTestingLaboratories();
    if (!list.includes(lab)) {
      list.push(lab);
      localStorage.setItem(CUSTOM_TESTING_LABS_KEY, JSON.stringify(list));
    }
  } catch {
    /* ignore */
  }
}
export function getAllTestingLaboratories(): TestingLaboratory[] {
  return [...TESTING_LABORATORIES, ...getCustomTestingLaboratories()];
}

const CUSTOM_MATERIAL_CATEGORIES_KEY = 'cert-board-custom-material-categories';
export function getCustomMaterialCategories(): MaterialCategory[] {
  const stored = localStorage.getItem(CUSTOM_MATERIAL_CATEGORIES_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}
export function saveCustomMaterialCategory(category: MaterialCategory): void {
  try {
    const list = getCustomMaterialCategories();
    if (!list.includes(category)) {
      list.push(category);
      localStorage.setItem(CUSTOM_MATERIAL_CATEGORIES_KEY, JSON.stringify(list));
    }
  } catch {
    /* ignore */
  }
}
export function getAllMaterialCategories(): MaterialCategory[] {
  return [...MATERIAL_CATEGORIES, ...getCustomMaterialCategories()];
}

/**
 * Convert a File to base64 for uploads.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
  });
}