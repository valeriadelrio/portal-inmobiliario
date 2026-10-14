import { notImplemented, type Actor, type PhotoDto, type ServiceResult } from "@/contracts";

// Pieza 2C. Subida directa a R2 con URL firmada; variantes WebP con sharp en confirmPhotoUpload.
export const requestPhotoUpload = async (_a: Actor, _propertyId: string, _mime: string, _size: number): Promise<ServiceResult<{ photoId: string; url: string; headers: Record<string, string> }>> =>
  notImplemented("requestPhotoUpload");
export const confirmPhotoUpload = async (_a: Actor, _photoId: string): Promise<ServiceResult<PhotoDto>> => notImplemented("confirmPhotoUpload");
export const listPhotos = async (_a: Actor, _propertyId: string): Promise<ServiceResult<PhotoDto[]>> => notImplemented("listPhotos");
export const reorderPhotos = async (_a: Actor, _propertyId: string, _photoIds: string[]): Promise<ServiceResult<void>> => notImplemented("reorderPhotos");
export const setCover = async (_a: Actor, _photoId: string): Promise<ServiceResult<void>> => notImplemented("setCover");
export const deletePhoto = async (_a: Actor, _photoId: string): Promise<ServiceResult<void>> => notImplemented("deletePhoto");
export const updateAltText = async (_a: Actor, _photoId: string, _alt: string): Promise<ServiceResult<void>> => notImplemented("updateAltText");
